import http from 'http';
import express, { NextFunction, Request, Response, Express as ExpressServer } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getTrafficStore } from '../storage';
import { getRuleExecutor } from '../ruleExecutor';
import { logger, AppError, HttpCode, MAX_RULE_TTL_SECONDS, stringify, INDEX_DTS, errorToLog } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';
import RequestContext from '../requestContext';
import serializeJavascript from 'serialize-javascript';
import LRUCache from 'lru-cache';
import { validateDeserializedRule } from './validators';
import { deserializeRule, escapedSerialize, liveRuleToRule } from './utils';

type ApiOptions = Stuntman.ApiConfig & {
    mockUuid: string;
};

const API_KEY_HEADER = 'x-api-key';

export class API {
    protected options: Required<ApiOptions>;
    protected webGuiOptions: Stuntman.WebGuiConfig;
    protected apiApp: ExpressServer | null = null;
    trafficStore: LRUCache<string, Stuntman.LogEntry>;
    server: http.Server | null = null;

    constructor(options: ApiOptions, webGuiOptions: Stuntman.WebGuiConfig = { disabled: false }) {
        if (!options.apiKeyReadOnly !== !options.apiKeyReadWrite) {
            throw new Error('apiKeyReadOnly and apiKeyReadWrite options need to be set either both or none');
        }
        this.options = options;
        this.webGuiOptions = webGuiOptions;

        this.trafficStore = getTrafficStore(this.options.mockUuid);
        this.auth = this.auth.bind(this);
        this.authReadOnly = this.authReadOnly.bind(this);
        this.authReadWrite = this.authReadWrite.bind(this);
    }

    private auth(req: Request, type: 'read' | 'write'): void {
        if (!this.options.apiKeyReadOnly && !this.options.apiKeyReadWrite) {
            return;
        }
        const hasValidReadKey = req.header(API_KEY_HEADER) === this.options.apiKeyReadOnly;
        const hasValidWriteKey = req.header(API_KEY_HEADER) === this.options.apiKeyReadWrite;
        const hasValidKey = type === 'read' ? hasValidReadKey || hasValidWriteKey : hasValidWriteKey;
        if (!hasValidKey) {
            throw new AppError({ httpCode: HttpCode.UNAUTHORIZED, message: 'unauthorized' });
        }
        return;
    }

    protected authReadOnly(req: Request, _res: Response, next: NextFunction): void {
        this.auth(req, 'read');
        next();
    }

    protected authReadWrite(req: Request, _res: Response, next: NextFunction): void {
        this.auth(req, 'write');
        next();
    }

    private initApi() {
        this.apiApp = express();

        this.apiApp.use(express.json());
        this.apiApp.use(express.text());

        this.apiApp.use((req: Request, _res: Response, next: NextFunction) => {
            RequestContext.bind(req, this.options.mockUuid);
            next();
        });

        this.apiApp.get('/rule', this.authReadOnly.bind, async (_req, res) => {
            res.send(stringify(await getRuleExecutor(this.options.mockUuid).getRules()));
        });

        this.apiApp.get('/rule/:ruleId', this.authReadOnly, async (req, res) => {
            if (!req.params.ruleId) {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'missing ruleId' });
            }
            res.send(stringify(await getRuleExecutor(this.options.mockUuid).getRule(req.params.ruleId)));
        });

        this.apiApp.get('/rule/:ruleId/disable', this.authReadWrite, (req, res) => {
            if (!req.params.ruleId) {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'missing ruleId' });
            }
            getRuleExecutor(this.options.mockUuid).disableRule(req.params.ruleId);
            res.send();
        });

        this.apiApp.get('/rule/:ruleId/enable', this.authReadWrite, (req, res) => {
            if (!req.params.ruleId) {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'missing ruleId' });
            }
            getRuleExecutor(this.options.mockUuid).enableRule(req.params.ruleId);
            res.send();
        });

        this.apiApp.post(
            '/rule',
            this.authReadWrite,
            async (req: Request<object, string, Stuntman.SerializedRule>, res: Response) => {
                const deserializedRule = deserializeRule(req.body);
                validateDeserializedRule(deserializedRule);
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const rule = await getRuleExecutor(this.options.mockUuid).addRule(deserializedRule);
                res.send(stringify(rule));
            }
        );

        this.apiApp.get('/rule/:ruleId/remove', this.authReadWrite, async (req, res) => {
            if (!req.params.ruleId) {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'missing ruleId' });
            }
            await getRuleExecutor(this.options.mockUuid).removeRule(req.params.ruleId);
            res.send();
        });

        this.apiApp.get('/traffic', this.authReadOnly, (_req, res) => {
            const serializedTraffic: Stuntman.LogEntry[] = [];
            for (const value of this.trafficStore.values()) {
                serializedTraffic.push(value);
            }
            res.json(serializedTraffic);
        });

        this.apiApp.get('/traffic/:ruleIdOrLabel', this.authReadOnly, (req, res) => {
            if (!req.params.ruleIdOrLabel) {
                throw new AppError({ httpCode: HttpCode.BAD_REQUEST, message: 'missing ruleIdOrLabel' });
            }
            const serializedTraffic: Stuntman.LogEntry[] = [];
            for (const value of this.trafficStore.values()) {
                if (value.mockRuleId === req.params.ruleIdOrLabel || (value.labels || []).includes(req.params.ruleIdOrLabel)) {
                    serializedTraffic.push(value);
                }
            }
            res.json(serializedTraffic);
        });

        if (!this.webGuiOptions.disabled) {
            this.apiApp.set('views', __dirname + '/webgui');
            this.apiApp.set('view engine', 'pug');
            this.initWebGui();
        }

        this.apiApp.all(/.*/, (_req: Request, res: Response) => res.status(404).send());

        this.apiApp.use((error: Error | AppError, req: Request, res: Response) => {
            const ctx: RequestContext | null = RequestContext.get(req);
            const uuid = ctx?.uuid || uuidv4();
            if (error instanceof AppError && error.isOperational && res) {
                logger.error(error);
                res.status(error.httpCode).json({
                    error: { message: error.message, httpCode: error.httpCode, stack: error.stack },
                });
                return;
            }
            logger.error({ error: errorToLog(error), uuid }, 'unexpected error');
            if (res) {
                res.status(HttpCode.INTERNAL_SERVER_ERROR).json({
                    error: { message: error.message, httpCode: HttpCode.INTERNAL_SERVER_ERROR, uuid },
                });
                return;
            }
            // eslint-disable-next-line no-console
            console.log('API server encountered a critical error. Exiting');
            process.exit(1);
        });
    }

    private initWebGui() {
        if (!this.apiApp) {
            throw new Error('initialization error');
        }
        this.apiApp.get('/webgui/rules', this.authReadOnly, async (_req, res) => {
            const rules: Record<string, string> = {};
            for (const rule of await getRuleExecutor(this.options.mockUuid).getRules()) {
                rules[rule.id] = serializeJavascript(liveRuleToRule(rule), { unsafe: true });
            }
            res.render('rules', { rules: escapedSerialize(rules), INDEX_DTS, ruleKeys: Object.keys(rules) });
        });

        this.apiApp.get('/webgui/traffic', this.authReadOnly, async (_req, res) => {
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

        this.apiApp.post('/webgui/rules/unsafesave', this.authReadWrite, async (req, res) => {
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
            await getRuleExecutor(this.options.mockUuid).addRule(
                {
                    id: rule.id,
                    matches: rule.matches,
                    ttlSeconds: rule.ttlSeconds,
                    actions: rule.actions,
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
        this.initApi();
        if (!this.apiApp) {
            throw new Error('initialization error');
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
