import http from 'http';
import https from 'https';
import express from 'express';
import defaults from 'defaults';
import { v4 as uuidv4 } from 'uuid';
import { ruleExecutor } from './ruleExecutor';
import { getTrafficStore } from './storage';
import { DEFAULT_MOCK_DOMAIN, DEFAULT_MOCK_PORT, DEFAULT_PROXY_TIMEOUT, RawHeaders, logger, HttpCode } from '@stuntman/shared';
import RequestContext from './requestContext';
import type * as Stuntman from '@stuntman/shared';
import { IPUtils } from './ipUtils';
import LRUCache from 'lru-cache';
import { API } from './api/api';

type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};

type MockOptions = {
    domain?: string;
    port?: number;
    httpsPort?: number;
    httpsKey?: string;
    httpsCert?: string;
    proxyTimeout?: number;
    externalDns?: boolean | [string, ...string[]];
    apiPort?: number;
    disableAPI?: boolean;
    disableWebGUI?: boolean;
    trafficLimitCount?: number;
    trafficLimitSize: number;
};

const DEFAULT_MOCK_OPTIONS = {
    domain: DEFAULT_MOCK_DOMAIN,
    port: DEFAULT_MOCK_PORT,
    proxyTimeout: DEFAULT_PROXY_TIMEOUT,
};

const naiveGQLParser = (body: Buffer | string): Stuntman.GQLRequestBody | undefined => {
    try {
        let json: Stuntman.GQLRequestBody | undefined = undefined;
        try {
            json = JSON.parse(Buffer.isBuffer(body) ? body.toString('utf-8') : body);
        } catch (kiss) {
            // and swallow
        }
        if (!json?.query && !json?.operationName) {
            return;
        }
        const lines = json.query
            .split('\n')
            .map((l) => l.replace(/^\s+/g, '').trim())
            .filter((l) => !!l);
        if (/^query /.test(lines[0])) {
            json.type = 'query';
        } else if (/^mutation /.test(lines[0])) {
            json.type = 'mutation';
        } else {
            throw new Error(`Unable to resolve query type of ${lines[0]}`);
        }
        json.methodName = lines[json.operationName ? 1 : 0].split('(')[0].split('{')[0];
        return json;
    } catch (error) {
        logger.debug(error, 'unable to parse GQL');
    }
    return undefined;
};

// TODO add proper web proxy mode

export class Mock {
    protected mockUuid: string;
    protected options: MockOptions;
    protected mockApp: express.Express;
    protected MOCK_DOMAIN_REGEX: RegExp;
    protected URL_PORT_REGEX: RegExp;
    protected server: http.Server | null = null;
    protected serverHttps: https.Server | null = null;
    protected trafficStore: LRUCache<string, Stuntman.LogEntry>;
    protected ipUtils: IPUtils | null = null;
    private _api: API | null = null;

    get apiServer() {
        if (this.options.disableAPI) {
            return null;
        }
        if (!this._api) {
            this._api = new API({ port: this.options.apiPort, mockUuid: this.mockUuid });
        }
        return this._api;
    }

    constructor(options?: MockOptions) {
        this.mockUuid = uuidv4();
        this.options = defaults(options, DEFAULT_MOCK_OPTIONS);
        if (this.options.httpsPort && (!this.options.httpsKey || !this.options.httpsCert)) {
            throw new Error('missing https key/cert');
        }

        this.MOCK_DOMAIN_REGEX = new RegExp(
            `(?:\\.([0-9]+))?\\.(?:(?:${this.options.domain})|(?:localhost))(https?)?(:${this.options.port}${
                this.options.httpsPort ? `|${this.options.httpsPort}` : ''
            })?(?:\\b|$)`,
            'i'
        );
        this.URL_PORT_REGEX = new RegExp(
            `^(https?:\\/\\/[^:/]+):(?:${this.options.port}${this.options.httpsPort ? `|${this.options.httpsPort}` : ''})(\\/.*)`,
            'i'
        );
        this.trafficStore = getTrafficStore(this.mockUuid, {
            max: this.options.trafficLimitCount,
            maxSize: this.options.trafficLimitSize,
        });
        if (!this.options.externalDns) {
            this.ipUtils = null;
        } else if (typeof this.options.externalDns === 'boolean') {
            this.ipUtils = new IPUtils({ mockUuid: this.mockUuid });
        } else {
            this.ipUtils = new IPUtils({ mockUuid: this.mockUuid, externalDns: this.options.externalDns });
        }

        this.mockApp = express();
        // TODO for now request body is just a buffer passed further, not inflated
        this.mockApp.use(express.raw({ type: '*/*' }));

        this.mockApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
            RequestContext.bind(req, this.mockUuid);
            next();
        });

        this.mockApp.all(/.*/, async (req, res) => {
            const ctx: RequestContext | null = RequestContext.get(req);
            const requestUuid = ctx?.uuid || uuidv4();
            const timestamp = Date.now();
            const originalHostname = req.hostname;
            const unproxiedHostname = req.hostname.replace(this.MOCK_DOMAIN_REGEX, '');
            const isProxiedHostname = originalHostname !== unproxiedHostname;
            const originalRequest = {
                id: requestUuid,
                timestamp,
                url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
                method: req.method,
                rawHeaders: new RawHeaders(...req.rawHeaders),
                ...(Buffer.isBuffer(req.body) && { body: req.body.toString('utf-8') }),
            };
            logger.debug(originalRequest, 'processing request');
            const logContext: Record<string, any> = {
                requestId: originalRequest.id,
            };
            const mockEntry: WithRequiredProperty<Stuntman.LogEntry, 'modifiedRequest'> = {
                originalRequest,
                modifiedRequest: {
                    ...this.unproxyRequest(req),
                    id: requestUuid,
                    timestamp,
                    ...(originalRequest.body && { gqlBody: naiveGQLParser(originalRequest.body) }),
                },
            };
            if (!isProxiedHostname) {
                this.removeProxyPort(mockEntry.modifiedRequest);
            }
            const matchingRule = await ruleExecutor.findMatchingRule(mockEntry.modifiedRequest);
            if (matchingRule) {
                mockEntry.mockRuleId = matchingRule.id;
                mockEntry.labels = matchingRule.labels;
                if (matchingRule.actions?.mockResponse) {
                    const staticResponse =
                        typeof matchingRule.actions.mockResponse === 'function'
                            ? matchingRule.actions.mockResponse(mockEntry.modifiedRequest)
                            : matchingRule.actions.mockResponse;
                    mockEntry.modifiedResponse = staticResponse;
                    logger.debug({ ...logContext, staticResponse }, 'replying with mocked response');
                    if (matchingRule.storeTraffic) {
                        this.trafficStore.set(requestUuid, mockEntry);
                    }
                    if (staticResponse.rawHeaders) {
                        for (const header of staticResponse.rawHeaders.toHeaderPairs()) {
                            res.setHeader(header[0], header[1]);
                        }
                    }
                    res.status(staticResponse.status || 200);
                    res.send(staticResponse.body);
                    // static response blocks any further processing
                    return;
                }
                if (matchingRule.actions?.modifyRequest) {
                    mockEntry.modifiedRequest = matchingRule.actions?.modifyRequest(mockEntry.modifiedRequest);
                    logger.debug({ ...logContext, modifiedRequest: mockEntry.modifiedRequest }, 'modified original request');
                }
            }
            if (this.ipUtils && !isProxiedHostname && !this.ipUtils.isIP(originalHostname)) {
                const hostname = originalHostname.split(':')[0];
                try {
                    const internalIPs = await this.ipUtils.resolveIP(hostname);
                    if (this.ipUtils.isLocalhostIP(internalIPs)) {
                        const externalIPs = await this.ipUtils.resolveIP(hostname, { useExternalDns: true });
                        logger.debug({ ...logContext, hostname, externalIPs, internalIPs }, 'switched to external IP');
                        mockEntry.modifiedRequest.url = mockEntry.modifiedRequest.url.replace(
                            /^(https?:\/\/)[^:/]+/i,
                            `$1${externalIPs}`
                        );
                    }
                } catch (error) {
                    // swallow the exeception, don't think much can be done at this point
                    logger.warn({ ...logContext, error }, `error trying to resolve IP for "${hostname}"`);
                }
            }

            let controller: AbortController | null = new AbortController();
            const fetchTimeout = setTimeout(() => {
                if (controller) {
                    controller.abort(`timeout after ${this.options.proxyTimeout}`);
                }
            }, this.options.proxyTimeout);
            req.on('close', () => {
                logger.debug(logContext, 'remote client canceled the request');
                clearTimeout(fetchTimeout);
                if (controller) {
                    controller.abort('remote client canceled the request');
                }
            });
            let targetResponse: Response;
            const hasKeepAlive = !!mockEntry.modifiedRequest.rawHeaders
                .toHeaderPairs()
                .find((h) => /^connection$/.test(h[0]) && /^keep-alive$/.test(h[1]));
            try {
                targetResponse = await fetch(mockEntry.modifiedRequest.url, {
                    redirect: 'manual',
                    headers: mockEntry.modifiedRequest.rawHeaders
                        .toHeaderPairs()
                        .filter((h) => !/^connection$/.test(h[0]) && !/^keep-alive$/.test(h[1])),
                    body: mockEntry.modifiedRequest.body,
                    method: mockEntry.modifiedRequest.method,
                    keepalive: !!hasKeepAlive,
                });
            } finally {
                controller = null;
                clearTimeout(fetchTimeout);
            }
            const targetResponseBuffer = Buffer.from(await targetResponse.arrayBuffer());
            const originalResponse = {
                timestamp: Date.now(),
                body: targetResponseBuffer.toString('binary'),
                status: targetResponse.status,
                rawHeaders: new RawHeaders(
                    ...Array.from(targetResponse.headers.entries()).flatMap(([key, value]) => [key, value])
                ),
            };
            logger.debug({ ...logContext, originalResponse }, 'received response');
            mockEntry.originalResponse = originalResponse;
            let modifedResponse: Stuntman.Response = {
                ...originalResponse,
                rawHeaders: new RawHeaders(
                    ...Array.from(targetResponse.headers.entries()).flatMap(([key, value]) => {
                        // TODO this replace may be too aggressive and doesn't handle protocol (won't be necessary with a trusted cert and mock serving http+https)
                        return [
                            key,
                            isProxiedHostname
                                ? value
                                : value.replace(
                                      new RegExp(`(?:^|\\b)(${unproxiedHostname.replace('.', '\\.')})(?:\\b|$)`, 'igm'),
                                      originalHostname
                                  ),
                        ];
                    })
                ),
            };
            if (matchingRule?.actions?.modifyResponse) {
                modifedResponse = matchingRule?.actions?.modifyResponse(mockEntry.modifiedRequest, originalResponse);
                logger.debug({ ...logContext, modifedResponse }, 'modified response');
            }

            mockEntry.modifiedResponse = modifedResponse;
            if (matchingRule?.storeTraffic) {
                this.trafficStore.set(requestUuid, mockEntry);
            }

            if (modifedResponse.status) {
                res.status(modifedResponse.status);
            }
            if (modifedResponse.rawHeaders) {
                for (const header of modifedResponse.rawHeaders.toHeaderPairs()) {
                    // since fetch decompresses responses we need to get rid of some headers
                    // TODO maybe could be handled better than just skipping, although express should add these back for new body
                    if (/^content-(?:length|encoding)$/i.test(header[0])) {
                        continue;
                    }
                    res.setHeader(header[0], header[1]);
                }
            }
            res.end(Buffer.from(modifedResponse.body, 'binary'));
        });

        this.mockApp.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
            const ctx: RequestContext | null = RequestContext.get(req);
            const uuid = ctx?.uuid || uuidv4();
            logger.error({ ...error, uuid }, 'Unexpected error');
            if (res) {
                res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
                    error: { message: error.message, httpCode: HttpCode.INTERNAL_SERVER_ERROR, uuid },
                });
                return;
            }
            console.log('mock encountered a critical error. exiting');
            process.exit(1);
        });
    }

    public start() {
        if (this.server) {
            throw new Error('mock server already started');
        }
        if (this.options.httpsPort) {
            this.serverHttps = https
                .createServer(
                    {
                        key: this.options.httpsKey,
                        cert: this.options.httpsCert,
                    },
                    this.mockApp
                )
                .listen(this.options.httpsPort, () => {
                    logger.info(`Mock listening on ${this.options.domain}:${this.options.httpsPort}`);
                });
        }
        this.server = this.mockApp.listen(this.options.port, () => {
            logger.info(`Mock listening on ${this.options.domain}:${this.options.port}`);
            if (!this.options.disableAPI) {
                this.apiServer?.start();
            }
        });
    }

    public stop() {
        if (!this.server) {
            throw new Error('mock server not started');
        }
        if (!this.options.disableAPI) {
            this.apiServer?.stop();
        }
        this.server.close((error) => {
            logger.warn(error, 'problem closing server');
            this.server = null;
        });
    }

    protected unproxyRequest(req: express.Request): Stuntman.BaseRequest {
        const protocol = (this.MOCK_DOMAIN_REGEX.exec(req.hostname) || [])[2] || req.protocol;
        const port = (this.MOCK_DOMAIN_REGEX.exec(req.hostname) || [])[1] || undefined;

        // TODO unproxied req might fail if there's a signed url :shrug:
        // but then we can probably switch DNS for some particular 3rd party server to point to mock
        // and in mock have a mapping rule for that domain to point directly to some IP :thinking:
        return {
            url: `${protocol}://${req.hostname.replace(this.MOCK_DOMAIN_REGEX, '')}${port ? `:${port}` : ''}${req.originalUrl}`,
            rawHeaders: new RawHeaders(...req.rawHeaders.map((h) => h.replace(this.MOCK_DOMAIN_REGEX, ''))),
            method: req.method,
            ...(Buffer.isBuffer(req.body) && { body: req.body.toString('utf-8') }),
        };
    }

    protected removeProxyPort(req: Stuntman.Request): void {
        if (this.URL_PORT_REGEX.test(req.url)) {
            req.url = req.url.replace(this.URL_PORT_REGEX, '$1$2');
        }
        const host = req.rawHeaders.get('host') || '';
        if (host.endsWith(`:${this.options.port}`) || (this.options.httpsPort && host.endsWith(`:${this.options.httpsPort}`))) {
            req.rawHeaders.set('host', host.split(':')[0]);
        }
    }
}
