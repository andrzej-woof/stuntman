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
                localFn: (req: Stuntman.Request): Stuntman.RuleMatchResult => {
                    const ___url = new URL(req.url);
                    const ___headers = req.rawHeaders;

                    const arrayIndexerRegex = /\[(?<arrayIndex>[0-9]*)\]/i;
                    const matchObject = (
                        obj: any,
                        path: string,
                        value?: string | RegExp | number | boolean | null,
                        parentPath?: string
                    ): Exclude<Stuntman.RuleMatchResult, boolean> => {
                        if (!obj) {
                            return { result: false, description: `${parentPath} is falsey` };
                        }
                        const [rawKey, ...rest] = path.split('.');
                        const key = rawKey.replace(arrayIndexerRegex, '');
                        const shouldBeArray = arrayIndexerRegex.test(rawKey);
                        const arrayIndex = Number(arrayIndexerRegex.exec(rawKey)?.groups?.arrayIndex);
                        const actualValue = key ? obj[key] : obj;
                        const currentPath = `${parentPath ? `${parentPath}.` : ''}${rawKey}`;
                        if (value === undefined && actualValue === undefined) {
                            return { result: false, description: `${currentPath}=undefined` };
                        }
                        if (rest.length === 0) {
                            if (
                                shouldBeArray &&
                                (!Array.isArray(actualValue) ||
                                    !(!Number.isInteger(arrayIndex) && actualValue.length > Number(arrayIndex)))
                            ) {
                                return { result: false, description: `${currentPath} empty array` };
                            }
                            if (value === undefined) {
                                const result = shouldBeArray
                                    ? !Number.isInteger(arrayIndex) || actualValue.length >= Number(arrayIndex)
                                    : actualValue !== undefined;
                                return { result, description: `${currentPath}` };
                            }
                            if (!shouldBeArray) {
                                const result = value instanceof RegExp ? value.test(actualValue) : value === actualValue;
                                return { result, description: `${currentPath}` };
                            }
                        }
                        if (shouldBeArray) {
                            if (Number.isInteger(arrayIndex)) {
                                return matchObject(actualValue[Number(arrayIndex)], rest.join('.'), value, currentPath);
                            }
                            const hasArrayMatch = (actualValue as Array<any>).some((arrayValue) =>
                                matchObject(arrayValue, rest.join('.'), value, currentPath)
                            );
                            return { result: hasArrayMatch, description: `array match ${currentPath}` };
                        }
                        if (typeof actualValue !== 'object') {
                            return { result: false, description: `${currentPath} not an object` };
                        }
                        return matchObject(actualValue, rest.join('.'), value, currentPath);
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
                        return {
                            result: false,
                            description: `url ${req.url} doesn't match ${matchBuilderVariables.filter?.toString()}`,
                        };
                    }
                    if (!___matchesValue(matchBuilderVariables.hostname, ___url.hostname)) {
                        return {
                            result: false,
                            description: `hostname ${
                                ___url.hostname
                            } doesn't match ${matchBuilderVariables.hostname?.toString()}`,
                        };
                    }
                    if (!___matchesValue(matchBuilderVariables.pathname, ___url.pathname)) {
                        return {
                            result: false,
                            description: `pathname ${
                                ___url.pathname
                            } doesn't match ${matchBuilderVariables.pathname?.toString()}`,
                        };
                    }
                    if (matchBuilderVariables.searchParams) {
                        for (const searchParamMatcher of matchBuilderVariables.searchParams) {
                            if (typeof searchParamMatcher === 'string') {
                                const result = ___url.searchParams.has(searchParamMatcher);
                                return { result, description: `searchParams.has("${searchParamMatcher}")` };
                            }
                            if (searchParamMatcher instanceof RegExp) {
                                const result = Array.from(___url.searchParams.keys()).some((key) => searchParamMatcher.test(key));
                                return { result, description: `searchParams.keys() matches ${searchParamMatcher.toString()}` };
                            }
                            if (!___url.searchParams.has(searchParamMatcher.key)) {
                                return { result: false, description: `searchParams.has("${searchParamMatcher.key}")` };
                            }
                            if (searchParamMatcher.value) {
                                const value = ___url.searchParams.get(searchParamMatcher.key);
                                if (value === null) {
                                    return {
                                        result: false,
                                        description: `searchParams.get("${searchParamMatcher.key}") === null`,
                                    };
                                }
                                if (!___matchesValue(searchParamMatcher.value, value)) {
                                    return {
                                        result: false,
                                        description: `searchParams.get("${searchParamMatcher.key}") = "${searchParamMatcher.value}"`,
                                    };
                                }
                            }
                        }
                    }
                    if (matchBuilderVariables.headers) {
                        for (const headerMatcher of matchBuilderVariables.headers) {
                            if (typeof headerMatcher === 'string') {
                                const result = ___headers.has(headerMatcher);
                                return { result, description: `headers.has("${headerMatcher}")` };
                            }
                            if (headerMatcher instanceof RegExp) {
                                const result = ___headers.toHeaderPairs().some(([key]) => headerMatcher.test(key));
                                return { result, description: `headers.keys matches ${headerMatcher.toString()}` };
                            }
                            if (!___headers.has(headerMatcher.key)) {
                                return { result: false, description: `headers.has("${headerMatcher.key}")` };
                            }
                            if (headerMatcher.value) {
                                const value = ___headers.get(headerMatcher.key);
                                if (value === null) {
                                    return { result: false, description: `headers.get("${headerMatcher.key}") === null` };
                                }
                                if (!___matchesValue(headerMatcher.value, value as string)) {
                                    return {
                                        result: false,
                                        description: `headerMatcher.get("${headerMatcher.key}") = "${headerMatcher.value}"`,
                                    };
                                }
                            }
                        }
                    }
                    if (matchBuilderVariables.bodyText === null && !!req.body) {
                        return { result: false, description: `empty body` };
                    }
                    if (matchBuilderVariables.bodyText) {
                        if (!req.body) {
                            return { result: false, description: `empty body` };
                        }
                        if (matchBuilderVariables.bodyText instanceof RegExp) {
                            if (!___matchesValue(matchBuilderVariables.bodyText, req.body)) {
                                return {
                                    result: false,
                                    description: `body text doesn't match ${matchBuilderVariables.bodyText.toString()}`,
                                };
                            }
                        } else if (!req.body.includes(matchBuilderVariables.bodyText)) {
                            return {
                                result: false,
                                description: `body text doesn't include "${matchBuilderVariables.bodyText}"`,
                            };
                        }
                    }
                    if (matchBuilderVariables.bodyJson) {
                        let json: any;
                        try {
                            json = JSON.parse(req.body);
                        } catch (kiss) {
                            return { result: false, description: `unparseable json` };
                        }
                        if (!json) {
                            return { result: false, description: `empty json object` };
                        }
                        for (const jsonMatcher of Array.isArray(matchBuilderVariables.bodyJson)
                            ? matchBuilderVariables.bodyJson
                            : [matchBuilderVariables.bodyJson]) {
                            if (!matchObject(json, jsonMatcher.key, jsonMatcher.value)) {
                                return { result: false, description: `$.${jsonMatcher.key} != "${jsonMatcher.value}"` };
                            }
                        }
                    }
                    if (matchBuilderVariables.bodyGql) {
                        if (!req.gqlBody) {
                            return { result: false, description: `not a gql body` };
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.methodName, req.gqlBody.methodName)) {
                            return {
                                result: false,
                                description: `methodName "${matchBuilderVariables.bodyGql.methodName}" !== "${req.gqlBody.methodName}"`,
                            };
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.operationName, req.gqlBody.operationName)) {
                            return {
                                result: false,
                                description: `operationName "${matchBuilderVariables.bodyGql.operationName}" !== "${req.gqlBody.operationName}"`,
                            };
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.query, req.gqlBody.query)) {
                            return {
                                result: false,
                                description: `query "${matchBuilderVariables.bodyGql.query}" !== "${req.gqlBody.query}"`,
                            };
                        }
                        if (!___matchesValue(matchBuilderVariables.bodyGql.type, req.gqlBody.type)) {
                            return {
                                result: false,
                                description: `type "${matchBuilderVariables.bodyGql.type}" !== "${req.gqlBody.type}"`,
                            };
                        }
                        if (!matchBuilderVariables.bodyGql.variables) {
                            return { result: true, description: `no variables to match` };
                        }
                        for (const jsonMatcher of Array.isArray(matchBuilderVariables.bodyGql.variables)
                            ? matchBuilderVariables.bodyGql.variables
                            : [matchBuilderVariables.bodyGql.variables]) {
                            const matchObjectResult = matchObject(req.gqlBody.variables, jsonMatcher.key, jsonMatcher.value);
                            if (!matchObjectResult.result) {
                                return {
                                    result: false,
                                    description: `GQL variable ${jsonMatcher.key} != "${jsonMatcher.value}". Detail: ${matchObjectResult.description}`,
                                };
                            }
                        }
                    }
                    return { result: true, description: 'match' };
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
        return this.onRequestTo(/.*/);
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
