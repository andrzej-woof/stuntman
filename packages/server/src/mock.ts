import { request as fetchRequest } from 'undici';
import type { Dispatcher } from 'undici';
import http from 'http';
import https from 'https';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getRuleExecutor } from './ruleExecutor';
import { getTrafficStore } from './storage';
import { RawHeaders, logger, HttpCode, naiveGQLParser, escapeStringRegexp, errorToLog } from '@stuntman/shared';
import RequestContext from './requestContext';
import type * as Stuntman from '@stuntman/shared';
import { IPUtils } from './ipUtils';
import LRUCache from 'lru-cache';
import { API } from './api/api';

type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};

// TODO add proper web proxy mode

export class Mock {
    public readonly mockUuid: string;
    protected options: Stuntman.Config;
    protected mockApp: express.Express | null = null;
    protected MOCK_DOMAIN_REGEX: RegExp;
    protected URL_PORT_REGEX: RegExp;
    protected server: http.Server | null = null;
    protected serverHttps: https.Server | null = null;
    protected trafficStore: LRUCache<string, Stuntman.LogEntry>;
    protected ipUtils: IPUtils | null = null;
    private _api: API | null = null;

    get apiServer() {
        if (this.options.api.disabled) {
            return null;
        }
        if (!this._api) {
            this._api = new API({ ...this.options.api, mockUuid: this.mockUuid }, this.options.webgui);
        }
        return this._api;
    }

    public get ruleExecutor(): Stuntman.RuleExecutorInterface {
        return getRuleExecutor(this.mockUuid);
    }

    constructor(options: Stuntman.Config) {
        this.mockUuid = uuidv4();
        this.options = options;
        if (this.options.mock.httpsPort && (!this.options.mock.httpsKey || !this.options.mock.httpsCert)) {
            throw new Error('missing https key/cert');
        }

        this.MOCK_DOMAIN_REGEX = new RegExp(
            `(?:\\.([0-9]+))?\\.(?:(?:${this.options.mock.domain}(https?)?)|(?:localhost))(:${this.options.mock.port}${
                this.options.mock.httpsPort ? `|${this.options.mock.httpsPort}` : ''
            })?(?:\\b|$)`,
            'i'
        );
        this.URL_PORT_REGEX = new RegExp(
            `^(https?:\\/\\/[^:/]+):(?:${this.options.mock.port}${
                this.options.mock.httpsPort ? `|${this.options.mock.httpsPort}` : ''
            })(\\/.*)`,
            'i'
        );
        this.trafficStore = getTrafficStore(this.mockUuid, this.options.storage.traffic);
        this.ipUtils =
            !this.options.mock.externalDns || this.options.mock.externalDns.length === 0
                ? null
                : new IPUtils({ mockUuid: this.mockUuid, externalDns: this.options.mock.externalDns });

        this.requestHandler = this.requestHandler.bind(this);
    }

    private async requestHandler(req: express.Request, res: express.Response): Promise<void> {
        const ctx: RequestContext | null = RequestContext.get(req);
        const requestUuid = ctx?.uuid || uuidv4();
        const timestamp = Date.now();
        const originalHostname = req.headers.host || req.hostname;
        const unproxiedHostname = req.hostname.replace(this.MOCK_DOMAIN_REGEX, '');
        const isProxiedHostname = originalHostname !== unproxiedHostname;
        const originalRequest = {
            id: requestUuid,
            timestamp,
            url: `${req.protocol}://${req.hostname}${req.originalUrl}`,
            method: req.method,
            rawHeaders: new RawHeaders(...req.rawHeaders),
            ...((Buffer.isBuffer(req.body) && { body: req.body.toString('utf-8') }) ||
                (typeof req.body === 'string' && { body: req.body })),
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
        const matchingRule = await getRuleExecutor(this.mockUuid).findMatchingRule(mockEntry.modifiedRequest);
        if (matchingRule) {
            mockEntry.mockRuleId = matchingRule.id;
            mockEntry.labels = matchingRule.labels;
            if (matchingRule.actions.mockResponse) {
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
            if (matchingRule.actions.modifyRequest) {
                mockEntry.modifiedRequest = matchingRule.actions.modifyRequest(mockEntry.modifiedRequest);
                logger.debug({ ...logContext, modifiedRequest: mockEntry.modifiedRequest }, 'modified original request');
            }
        }
        if (this.ipUtils && !isProxiedHostname && !this.ipUtils.isIP(originalHostname)) {
            const hostname = originalHostname.split(':')[0]!;
            try {
                const internalIPs = await this.ipUtils.resolveIP(hostname);
                if (this.ipUtils.isLocalhostIP(internalIPs) && this.options.mock.externalDns.length) {
                    const externalIPs = await this.ipUtils.resolveIP(hostname, { useExternalDns: true });
                    logger.debug({ ...logContext, hostname, externalIPs, internalIPs }, 'switched to external IP');
                    mockEntry.modifiedRequest.url = mockEntry.modifiedRequest.url.replace(
                        /^(https?:\/\/)[^:/]+/i,
                        `$1${externalIPs}`
                    );
                }
            } catch (error) {
                // swallow the exeception, don't think much can be done at this point
                logger.warn({ ...logContext, error: errorToLog(error as Error) }, `error trying to resolve IP for "${hostname}"`);
            }
        }

        const originalResponse: Required<Stuntman.Response> = this.options.mock.disableProxy
            ? {
                  timestamp: Date.now(),
                  body: undefined,
                  rawHeaders: new RawHeaders(),
                  status: 404,
              }
            : await this.proxyRequest(req, mockEntry, logContext);

        logger.debug({ ...logContext, originalResponse }, 'received response');
        mockEntry.originalResponse = originalResponse;
        let modifedResponse: Stuntman.Response = {
            ...originalResponse,
            rawHeaders: new RawHeaders(
                ...Array.from(originalResponse.rawHeaders.toHeaderPairs()).flatMap(([key, value]) => {
                    // TODO this replace may be too aggressive and doesn't handle protocol (won't be necessary with a trusted cert and mock serving http+https)
                    return [
                        key,
                        isProxiedHostname
                            ? value
                            : value.replace(
                                  new RegExp(`(?:^|\\b)(${escapeStringRegexp(unproxiedHostname)})(?:\\b|$)`, 'igm'),
                                  originalHostname
                              ),
                    ];
                })
            ),
        };
        if (matchingRule?.actions.modifyResponse) {
            modifedResponse = matchingRule?.actions.modifyResponse(mockEntry.modifiedRequest, originalResponse);
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
                // if (/^content-(?:length|encoding)$/i.test(header[0])) {
                //     continue;
                // }
                res.setHeader(header[0], isProxiedHostname ? header[1].replace(unproxiedHostname, originalHostname) : header[1]);
            }
        }
        res.end(Buffer.from(modifedResponse.body, 'binary'));
    }

    init() {
        if (this.mockApp) {
            return;
        }
        this.mockApp = express();
        // TODO for now request body is just a buffer passed further, not inflated
        this.mockApp.use(express.raw({ type: '*/*' }));

        this.mockApp.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
            RequestContext.bind(req, this.mockUuid);
            next();
        });

        this.mockApp.all(/.*/, this.requestHandler);

        this.mockApp.use((error: Error, req: express.Request, res: express.Response) => {
            const ctx: RequestContext | null = RequestContext.get(req);
            const uuid = ctx?.uuid || uuidv4();
            logger.error({ error: errorToLog(error), uuid }, 'unexpected error');
            if (res) {
                res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
                    error: { message: error.message, httpCode: HttpCode.INTERNAL_SERVER_ERROR, uuid },
                });
                return;
            }
            // eslint-disable-next-line no-console
            console.error('mock server encountered a critical error. exiting');
            process.exit(1);
        });
    }

    private async proxyRequest(
        req: express.Request,
        mockEntry: WithRequiredProperty<Stuntman.LogEntry, 'modifiedRequest'>,
        logContext: any
    ) {
        let controller: AbortController | null = new AbortController();
        const fetchTimeout = setTimeout(() => {
            if (controller) {
                controller.abort(`timeout after ${this.options.mock.timeout}`);
            }
        }, this.options.mock.timeout);
        req.on('close', () => {
            logger.debug(logContext, 'remote client canceled the request');
            clearTimeout(fetchTimeout);
            if (controller) {
                controller.abort('remote client canceled the request');
            }
        });
        let targetResponse: Dispatcher.ResponseData;
        try {
            const requestOptions = {
                headers: mockEntry.modifiedRequest.rawHeaders,
                body: mockEntry.modifiedRequest.body,
                method: mockEntry.modifiedRequest.method.toUpperCase() as Dispatcher.HttpMethod,
            };
            logger.debug(
                {
                    ...logContext,
                    url: mockEntry.modifiedRequest.url,
                    ...requestOptions,
                },
                'outgoing request attempt'
            );
            targetResponse = await fetchRequest(mockEntry.modifiedRequest.url, requestOptions);
        } catch (error) {
            logger.error(
                { ...logContext, error: errorToLog(error as Error), request: mockEntry.modifiedRequest },
                'error fetching'
            );
            throw error;
        } finally {
            controller = null;
            clearTimeout(fetchTimeout);
        }
        const targetResponseBuffer = Buffer.from(await targetResponse.body.arrayBuffer());
        return {
            timestamp: Date.now(),
            body: targetResponseBuffer.toString('binary'),
            status: targetResponse.statusCode,
            rawHeaders: RawHeaders.fromHeadersRecord(targetResponse.headers),
        };
    }

    public start() {
        this.init();
        if (!this.mockApp) {
            throw new Error('initialization error');
        }
        if (this.server) {
            throw new Error('mock server already started');
        }
        if (this.options.mock.httpsPort) {
            this.serverHttps = https
                .createServer(
                    {
                        key: this.options.mock.httpsKey,
                        cert: this.options.mock.httpsCert,
                    },
                    this.mockApp
                )
                .listen(this.options.mock.httpsPort, () => {
                    logger.info(`Mock listening on ${this.options.mock.domain}:${this.options.mock.httpsPort}`);
                });
        }
        this.server = this.mockApp.listen(this.options.mock.port, () => {
            logger.info(`Mock listening on ${this.options.mock.domain}:${this.options.mock.port}`);
            if (!this.options.api.disabled) {
                this.apiServer?.start();
            }
        });
    }

    public stop() {
        if (!this.server) {
            throw new Error('mock server not started');
        }
        if (!this.options.api.disabled) {
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
        if (
            host.endsWith(`:${this.options.mock.port}`) ||
            (this.options.mock.httpsPort && host.endsWith(`:${this.options.mock.httpsPort}`))
        ) {
            req.rawHeaders.set('host', host.split(':')[0]!);
        }
    }
}
