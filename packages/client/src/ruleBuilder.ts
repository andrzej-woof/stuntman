import { v4 as uuidv4 } from 'uuid';
import type * as Stuntman from '@stuntman/shared';
import { DEFAULT_RULE_PRIORITY, DEFAULT_RULE_TTL_SECONDS, MAX_RULE_TTL_SECONDS, MIN_RULE_TTL_SECONDS } from '@stuntman/shared';

type KeyValueMatcher = string | RegExp | { key: string; value?: string | RegExp };
type ObjectValueMatcher = string | RegExp | number | boolean | null;
type ObjectKeyValueMatcher = { key: string; value?: ObjectValueMatcher };
type GQLRequestMatcher = {
    operationName?: string | RegExp;
    variables?: ObjectKeyValueMatcher[];
    query?: string | RegExp;
    type?: 'query' | 'mutation';
    methodName?: string | RegExp;
};

type MatchBuilderVariables = {
    filter?: string | RegExp;
    hostname?: string | RegExp;
    pathname?: string | RegExp;
    port?: number | string | RegExp;
    searchParams?: KeyValueMatcher[];
    headers?: KeyValueMatcher[];
    bodyText?: string | RegExp | null;
    bodyJson?: ObjectKeyValueMatcher[];
    bodyGql?: GQLRequestMatcher;
};

// eslint-disable-next-line no-var
declare var matchBuilderVariables: MatchBuilderVariables;

// TODO add fluent match on multipart from data

class RuleBuilderBaseBase {
    protected rule: Stuntman.SerializableRule;
    protected _matchBuilderVariables: MatchBuilderVariables;

    constructor(rule?: Stuntman.SerializableRule, _matchBuilderVariables?: MatchBuilderVariables) {
        this._matchBuilderVariables = _matchBuilderVariables || {};
        this.rule = rule || {
            id: uuidv4(),
            ttlSeconds: DEFAULT_RULE_TTL_SECONDS,
            priority: DEFAULT_RULE_PRIORITY,
            matches: {
                localFn: (req: Stuntman.Request): boolean => {
                    const ___url = new URL(req.url);
                    const ___headers = req.rawHeaders;

                    const arrayIndexerRegex = /\[(?<arrayIndex>[0-9]*)\]/i;
                    const matchObject = (obj: any, path: string, value?: string | RegExp | number | boolean | null): boolean => {
                        if (!obj) {
                            return false;
                        }
                        const [rawKey, ...rest] = path.split('.');
                        const key = rawKey.replace(arrayIndexerRegex, '');
                        const shouldBeArray = arrayIndexerRegex.test(rawKey);
                        const arrayIndex = Number(arrayIndexerRegex.exec(rawKey)?.groups?.arrayIndex);
                        const actualValue = key ? obj[key] : obj;
                        if (value === undefined && actualValue === undefined) {
                            return false;
                        }
                        if (rest.length === 0) {
                            if (
                                shouldBeArray &&
                                (!Array.isArray(actualValue) ||
                                    !(!Number.isInteger(arrayIndex) && actualValue.length > Number(arrayIndex)))
                            ) {
                                return false;
                            }
                            if (value === undefined) {
                                return shouldBeArray
                                    ? !Number.isInteger(arrayIndex) || actualValue.length >= Number(arrayIndex)
                                    : actualValue !== undefined;
                            }
                            if (!shouldBeArray) {
                                return value instanceof RegExp ? value.test(actualValue) : value === actualValue;
                            }
                        }
                        if (shouldBeArray) {
                            return Number.isInteger(arrayIndex)
                                ? matchObject(actualValue[Number(arrayIndex)], rest.join('.'), value)
                                : (actualValue as Array<any>).some((arrayValue) =>
                                      matchObject(arrayValue, rest.join('.'), value)
                                  );
                        }
                        return typeof actualValue !== 'object' ? false : matchObject(actualValue, rest.join('.'), value);
                    };

                    const ___matchesValue = (matcher: number | string | RegExp | undefined, value?: string | number): boolean => {
                        if (matcher === undefined) {
                            return true;
                        }
                        if (typeof matcher !== 'string' && !(matcher instanceof RegExp) && typeof matcher !== 'number') {
                            throw new Error('invalid matcher');
                        }
                        if (typeof matcher === 'string' && matcher !== value) {
                            return false;
                        }
                        if (matcher instanceof RegExp && (typeof value !== 'string' || !matcher.test(value))) {
                            return false;
                        }
                        if (typeof matcher === 'number' && (typeof value !== 'number' || matcher !== value)) {
                            return false;
                        }
                        return true;
                    };
                    if (!___matchesValue(matchBuilderVariables.filter, req.url)) {
                        return false;
                    }
                    if (!___matchesValue(matchBuilderVariables.hostname, ___url.hostname)) {
                        return false;
                    }
                    if (!___matchesValue(matchBuilderVariables.pathname, ___url.pathname)) {
                        return false;
                    }
                    if (matchBuilderVariables.searchParams) {
                        for (const searchParamMatcher of matchBuilderVariables.searchParams) {
                            if (typeof searchParamMatcher === 'string') {
                                return ___url.searchParams.has(searchParamMatcher);
                            }
                            if (searchParamMatcher instanceof RegExp) {
                                return Array.from(___url.searchParams.keys()).some((key) => searchParamMatcher.test(key));
                            }
                            if (!___url.searchParams.has(searchParamMatcher.key)) {
                                return false;
                            }
                            if (searchParamMatcher.value) {
                                const value = ___url.searchParams.get(searchParamMatcher.key);
                                if (value === null) {
                                    return false;
                                }
                                if (!___matchesValue(searchParamMatcher.value, value)) {
                                    return false;
                                }
                            }
                        }
                    }
                    if (matchBuilderVariables.headers) {
                        for (const headerMatcher of matchBuilderVariables.headers) {
                            if (typeof headerMatcher === 'string') {
                                return ___headers.has(headerMatcher);
                            }
                            if (headerMatcher instanceof RegExp) {
                                return ___headers.toHeaderPairs().some(([key]) => headerMatcher.test(key));
                            }
                            if (!___headers.has(headerMatcher.key)) {
                                return false;
                            }
                            if (headerMatcher.value) {
                                const value = ___headers.get(headerMatcher.key);
                                if (value === null) {
                                    return false;
                                }
                                if (!___matchesValue(headerMatcher.value, value as string)) {
                                    return false;
                                }
                            }
                        }
                    }
                    if (matchBuilderVariables.bodyText === null && !!req.body) {
                        return false;
                    }
                    if (matchBuilderVariables.bodyText) {
                        if (!___matchesValue(matchBuilderVariables.bodyText, req.body)) {
                            return false;
                        }
                    }
                    if (matchBuilderVariables.bodyJson) {
                        let json: any;
                        try {
                            json = JSON.parse(req.body);
                        } catch (kiss) {
                            return false;
                        }
                        if (!json) {
                            return false;
                        }
                        for (const jsonMatcher of Array.isArray(matchBuilderVariables.bodyJson)
                            ? matchBuilderVariables.bodyJson
                            : [matchBuilderVariables.bodyJson]) {
                            if (!matchObject(json, jsonMatcher.key, jsonMatcher.value)) {
                                return false;
                            }
                        }
                    }
                    if (matchBuilderVariables.bodyGql) {
                        if (!req.gqlBody) {
                            return false;
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.methodName, req.gqlBody.methodName)) {
                            return false;
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.operationName, req.gqlBody.operationName)) {
                            return false;
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.query, req.gqlBody.query)) {
                            return false;
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.type, req.gqlBody.type)) {
                            return false;
                        }
                        if (!matchBuilderVariables.bodyGql.variables) {
                            return true;
                        }
                        for (const jsonMatcher of Array.isArray(matchBuilderVariables.bodyGql.variables)
                            ? matchBuilderVariables.bodyGql.variables
                            : [matchBuilderVariables.bodyGql.variables]) {
                            if (!matchObject(req.gqlBody.variables, jsonMatcher.key, jsonMatcher.value)) {
                                return false;
                            }
                        }
                    }
                    return true;
                },
                localVariables: { matchBuilderVariables: this._matchBuilderVariables },
            },
        };
    }
}

class RuleBuilderBase extends RuleBuilderBaseBase {
    limitedUse(hitCount: number) {
        if (Number.isNaN(hitCount) || !Number.isFinite(hitCount) || !Number.isInteger(hitCount) || hitCount <= 0) {
            throw new Error('Invalid hitCount');
        }
        this.rule.removeAfterUse = hitCount;
        return this;
    }

    singleUse() {
        return this.limitedUse(1);
    }

    storeTraffic() {
        this.rule.storeTraffic = true;
        return this;
    }

    disabled() {
        this.rule.isEnabled = false;
    }
}

class RuleBuilder extends RuleBuilderBase {
    raisePriority(by?: number) {
        const subtract = by ?? 1;
        if (subtract >= DEFAULT_RULE_PRIORITY) {
            throw new Error(`Unable to raise priority over the default ${DEFAULT_RULE_PRIORITY}`);
        }
        this.rule.priority = DEFAULT_RULE_PRIORITY - subtract;
        return this;
    }

    decreasePriority(by?: number) {
        const add = by ?? 1;
        this.rule.priority = DEFAULT_RULE_PRIORITY + add;
        return this;
    }

    customTtl(ttlSeconds: number) {
        if (Number.isNaN(ttlSeconds) || !Number.isInteger(ttlSeconds) || !Number.isFinite(ttlSeconds) || ttlSeconds < 0) {
            throw new Error('Invalid ttl');
        }
        if (ttlSeconds < MIN_RULE_TTL_SECONDS || ttlSeconds > MAX_RULE_TTL_SECONDS) {
            throw new Error(
                `ttl of ${ttlSeconds} seconds is outside range min: ${MIN_RULE_TTL_SECONDS}, max:${MAX_RULE_TTL_SECONDS}`
            );
        }
        this.rule.ttlSeconds = ttlSeconds;
        return this;
    }

    customId(id: string) {
        this.rule.id = id;
        return this;
    }

    onRequestTo(filter: string | RegExp): RuleBuilderInitialized {
        this._matchBuilderVariables.filter = filter;
        return new RuleBuilderInitialized(this.rule, this._matchBuilderVariables);
    }

    onRequestToHostname(hostname: string | RegExp): RuleBuilderInitialized {
        this._matchBuilderVariables.hostname = hostname;
        return new RuleBuilderInitialized(this.rule, this._matchBuilderVariables);
    }

    onRequestToPathname(pathname: string | RegExp): RuleBuilderInitialized {
        this._matchBuilderVariables.pathname = pathname;
        return new RuleBuilderInitialized(this.rule, this._matchBuilderVariables);
    }

    onAnyRequest(): RuleBuilderInitialized {
        this.rule.matches = { localFn: () => true };
        return new RuleBuilderInitialized(this.rule, this._matchBuilderVariables);
    }
}

class RuleBuilderInitialized extends RuleBuilderBase {
    withHostname(hostname: string | RegExp) {
        this._matchBuilderVariables.hostname = hostname;
        return this;
    }

    withPathname(pathname: string | RegExp) {
        this._matchBuilderVariables.pathname = pathname;
        return this;
    }

    withPort(port: number | string | RegExp) {
        this._matchBuilderVariables.port = port;
        return this;
    }

    withSearchParam(key: string | RegExp): RuleBuilderInitialized;
    withSearchParam(key: string, value?: string | RegExp): RuleBuilderInitialized;
    withSearchParam(key: string | RegExp, value?: string | RegExp): RuleBuilderInitialized {
        if (!this._matchBuilderVariables.searchParams) {
            this._matchBuilderVariables.searchParams = [];
        }
        if (!key) {
            throw new Error('key cannot be empty');
        }
        if (!value) {
            this._matchBuilderVariables.searchParams.push(key);
            return this;
        }
        if (key instanceof RegExp) {
            throw new Error('Unsupported regex param key with value');
        }
        this._matchBuilderVariables.searchParams.push({ key, value });
        return this;
    }

    withSearchParams(params: KeyValueMatcher[]): RuleBuilderInitialized {
        if (!this._matchBuilderVariables.searchParams) {
            this._matchBuilderVariables.searchParams = [];
        }
        for (const param of params) {
            if (typeof param === 'string' || param instanceof RegExp) {
                this.withSearchParam(param);
            } else {
                this.withSearchParam(param.key, param.value);
            }
        }
        return this;
    }

    withHeader(key: string | RegExp): RuleBuilderInitialized;
    withHeader(key: string, value?: string | RegExp): RuleBuilderInitialized;
    withHeader(key: string | RegExp, value?: string | RegExp): RuleBuilderInitialized {
        if (!this._matchBuilderVariables.headers) {
            this._matchBuilderVariables.headers = [];
        }
        if (!key) {
            throw new Error('key cannot be empty');
        }
        if (!value) {
            this._matchBuilderVariables.headers.push(key);
            return this;
        }
        if (key instanceof RegExp) {
            throw new Error('Unsupported regex param key with value');
        }
        this._matchBuilderVariables.headers.push({ key, value });
        return this;
    }

    withHeaders(headers: KeyValueMatcher[]): RuleBuilderInitialized {
        if (!this._matchBuilderVariables.headers) {
            this._matchBuilderVariables.headers = [];
        }
        for (const header of headers) {
            if (typeof header === 'string' || header instanceof RegExp) {
                this.withHeader(header);
            } else {
                this.withHeader(header.key, header.value);
            }
        }
        return this;
    }

    withBodyText(includes: string): RuleBuilderInitialized;
    withBodyText(matches: RegExp): RuleBuilderInitialized;
    withBodyText(includesOrMatches: string | RegExp): RuleBuilderInitialized {
        this._matchBuilderVariables.bodyText = includesOrMatches;
        return this;
    }

    withoutBody(): RuleBuilderInitialized {
        this._matchBuilderVariables.bodyText = null;
        return this;
    }

    withBodyJson(hasKey: string): RuleBuilderInitialized;
    withBodyJson(hasKey: string, withValue: ObjectValueMatcher): RuleBuilderInitialized;
    withBodyJson(matches: ObjectKeyValueMatcher): RuleBuilderInitialized;
    withBodyJson(keyOrMatcher: string | ObjectKeyValueMatcher, withValue?: ObjectValueMatcher): RuleBuilderInitialized {
        const keyRegex = /^(?:(?:[a-z0-9_-]+)|(?:\[[0-9]*\]))(?:\.(?:(?:[a-z0-9_-]+)|(?:\[[0-9]*\])))*$/i;
        if (!this._matchBuilderVariables.bodyJson) {
            this._matchBuilderVariables.bodyJson = [];
        }
        if (typeof keyOrMatcher === 'string') {
            if (!keyRegex.test(keyOrMatcher)) {
                throw new Error('invalid key');
            }
            this._matchBuilderVariables.bodyJson.push({ key: keyOrMatcher, value: withValue });
            return this;
        }
        if (withValue !== undefined) {
            throw new Error('invalid usage');
        }
        if (!keyRegex.test(keyOrMatcher.key)) {
            throw new Error('invalid key');
        }
        this._matchBuilderVariables.bodyJson.push(keyOrMatcher);
        return this;
    }

    withBodyGql(gqlMatcher: GQLRequestMatcher): RuleBuilderInitialized {
        this._matchBuilderVariables.bodyGql = gqlMatcher;
        return this;
    }

    proxyPass(): Stuntman.SerializableRule {
        return this.rule;
    }

    mockResponse(staticResponse: Stuntman.Response): Stuntman.SerializableRule;
    mockResponse(generationFunction: Stuntman.RemotableFunction<Stuntman.ResponseGenerationFn>): Stuntman.SerializableRule;
    mockResponse(
        response: Stuntman.Response | Stuntman.RemotableFunction<Stuntman.ResponseGenerationFn>
    ): Stuntman.SerializableRule {
        this.rule.actions = { mockResponse: response };
        return this.rule;
    }

    modifyRequest(modifyFunction: Stuntman.RemotableFunction<Stuntman.RequestManipulationFn>): RuleBuilderRequestInitialized {
        this.rule.actions = { modifyRequest: modifyFunction };
        return new RuleBuilderRequestInitialized(this.rule, this._matchBuilderVariables);
    }

    modifyResponse(modifyFunction: Stuntman.RemotableFunction<Stuntman.ResponseManipulationFn>): Stuntman.SerializableRule {
        this.rule.actions = { modifyResponse: modifyFunction };
        return this.rule;
    }
}

class RuleBuilderRequestInitialized extends RuleBuilderBase {
    modifyResponse(modifyFunction: Stuntman.RemotableFunction<Stuntman.ResponseManipulationFn>): Stuntman.SerializableRule {
        if (!this.rule.actions) {
            throw new Error('rule.actions not defined - builder implementation error');
        }
        this.rule.actions.modifyResponse = modifyFunction;
        return this.rule;
    }
}

export const ruleBuilder = () => new RuleBuilder();
