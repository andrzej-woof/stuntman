import http from 'http';
import express, { NextFunction, Request, Response, Express as ExpressServer } from 'express';
import defaults from 'defaults';
import { v4 as uuidv4 } from 'uuid';
import { getTrafficStore } from '../storage';
import { ruleExecutor } from '../ruleExecutor';
import { logger, AppError, HttpCode, DEFAULT_API_PORT, MAX_RULE_TTL_SECONDS, stringify } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';
import RequestContext from '../requestContext';
import serializeJavascript from 'serialize-javascript';
import LRUCache from 'lru-cache';
import { validateDeserializedRule } from './validatiors';
import { INDEX_DTS, deserializeRule, escapedSerialize, liveRuleToRule } from './utils';

type APIOptions = {
    mockUuid: string;
    port?: number;
    disableWebGUI?: boolean;
};

const DEFAULT_API_OPTIONS = {
    port: DEFAULT_API_PORT,
    disableWebGUI: false,
};

export class API {
    protected options: Required<APIOptions>;
    protected apiApp: ExpressServer;
    trafficStore: LRUCache<string, Stuntman.LogEntry>;
    server: http.Server | null = null;

    constructor(options: APIOptions) {
        this.options = defaults(options, DEFAULT_API_OPTIONS);

        this.trafficStore = getTrafficStore(this.options.mockUuid);
        this.apiApp = express();

        this.apiApp.use(express.json());
        this.apiApp.use(express.text());

        this.apiApp.use((req: Request, res: Response, next: NextFunction) => {
            RequestContext.bind(req, this.options.mockUuid);
            next();
        });

        this.apiApp.get('/rule', async (req, res) => {
            res.send(stringify(await ruleExecutor.getRules()));
        });

        this.apiApp.get('/rule/:ruleId', async (req, res) => {
            res.send(stringify(await ruleExecutor.getRule(req.params.ruleId)));
        });

        this.apiApp.get('/rule/:ruleId/disable', (req, res) => {
            ruleExecutor.disableRule(req.params.ruleId);
            res.send();
        });

        this.apiApp.get('/rule/:ruleId/enable', (req, res) => {
            ruleExecutor.enableRule(req.params.ruleId);
            res.send();
        });

        this.apiApp.post('/rule', async (req: Request<object, string, Stuntman.SerializedRule>, res) => {
            const deserializedRule = deserializeRule(req.body);
            validateDeserializedRule(deserializedRule);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const rule = await ruleExecutor.addRule(deserializedRule);
            res.send(stringify(rule));
        });

        this.apiApp.get('/rule/:ruleId/remove', async (req, res) => {
            await ruleExecutor.removeRule(req.params.ruleId);
            res.send();
        });

        this.apiApp.get('/traffic', (req, res) => {
            const serializedTraffic: Record<string, Stuntman.LogEntry> = {};
            for (const [key, value] of this.trafficStore.entries()) {
                serializedTraffic[key] = value;
            }
            res.json(serializedTraffic);
        });

        this.apiApp.get('/traffic/:ruleIdOrLabel', (req, res) => {
            const serializedTraffic: Record<string, Stuntman.LogEntry> = {};
            for (const [key, value] of this.trafficStore.entries()) {
                if (value.mockRuleId === req.params.ruleIdOrLabel || (value.labels || []).includes(req.params.ruleIdOrLabel)) {
                    serializedTraffic[key] = value;
                }
            }
            res.json(serializedTraffic);
        });

        this.apiApp.use((error: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
            const ctx: RequestContext | null = RequestContext.get(req);
            const uuid = ctx?.uuid || uuidv4();
            if (error instanceof AppError && error.isOperational && res) {
                logger.error(error);
                res.status(error.httpCode).json({
                    error: { message: error.message, httpCode: error.httpCode, stack: error.stack },
                });
                return;
            }
            logger.error({ ...error, uuid }, 'Unexpected error');
            if (res) {
                res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
                    error: { message: error.message, httpCode: HttpCode.INTERNAL_SERVER_ERROR, uuid },
                });
                return;
            }
            console.log('Application encountered a critical error. Exiting');
            process.exit(1);
        });

        this.apiApp.set('views', __dirname + '/webgui');
        this.apiApp.set('view engine', 'pug');

        if (!this.options.disableWebGUI) {
            this.initWebGui();
        }
    }

    private initWebGui() {
        this.apiApp.get('/webgui/rules', async (req, res) => {
            const rules: Record<string, string> = {};
            for (const rule of await ruleExecutor.getRules()) {
                rules[rule.id] = serializeJavascript(liveRuleToRule(rule), { unsafe: true });
            }
            res.render('rules', { rules: escapedSerialize(rules), INDEX_DTS, ruleKeys: Object.keys(rules) });
        });

        this.apiApp.get('/webgui/traffic', async (req, res) => {
            const serializedTraffic: Stuntman.LogEntry[] = [];
            for (const value of this.trafficStore.values()) {
                serializedTraffic.push(value);
            }
            res.render('traffic', {
                traffic: JSON.stringify(
                    serializedTraffic.sort((a, b) => b.originalRequest.timestamp - a.originalRequest.timestamp)
                ),
            });
        });

        // TODO make webui way better and safer, nicer formatting, eslint/prettier, blackjack and hookers

        this.apiApp.post('/webgui/rules/unsafesave', async (req, res) => {
            const rule: Stuntman.Rule = new Function(req.body)();
            if (
                !rule ||
                !rule.id ||
                typeof rule.matches !== 'function' ||
                typeof rule.ttlSeconds !== 'number' ||
                rule.ttlSeconds > MAX_RULE_TTL_SECONDS
            ) {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'Invalid rule' });
            }
            await ruleExecutor.addRule(
                {
                    id: rule.id,
                    matches: rule.matches,
                    ttlSeconds: rule.ttlSeconds,
                    ...(rule.actions && {
                        actions: {
                            ...(rule.actions.mockResponse
                                ? { mockResponse: rule.actions.mockResponse }
                                : { modifyRequest: rule.actions.modifyRequest, modifyResponse: rule.actions.modifyResponse }),
                        },
                    }),
                    ...(rule.disableAfterUse !== undefined && { disableAfterUse: rule.disableAfterUse }),
                    ...(rule.isEnabled !== undefined && { isEnabled: rule.isEnabled }),
                    ...(rule.labels !== undefined && { labels: rule.labels }),
                    ...(rule.priority !== undefined && { priority: rule.priority }),
                    ...(rule.removeAfterUse !== undefined && { removeAfterUse: rule.removeAfterUse }),
                    ...(rule.storeTraffic !== undefined && { storeTraffic: rule.storeTraffic }),
                },
                true
            );
            res.send();
        });
    }

    public start() {
        if (this.server) {
            throw new Error('mock server already started');
        }
        this.server = this.apiApp.listen(this.options.port, () => {
            logger.info(`API listening on ${this.options.port}`);
        });
    }

    public stop() {
        if (!this.server) {
            throw new Error('mock server not started');
        }
        this.server.close((error) => {
            logger.warn(error, 'problem closing server');
            this.server = null;
        });
    }
}
