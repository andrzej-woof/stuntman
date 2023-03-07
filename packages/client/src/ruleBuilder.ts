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
    methodName?: Stuntman.HttpMethod | RegExp;
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

// TODO add fluent match on multipart from data
function matchFunction(req: Stuntman.Request): Stuntman.RuleMatchResult {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const localMatchBuilderVariables: MatchBuilderVariables = this?.matchBuilderVariables ?? matchBuilderVariables;
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
        const key = (rawKey ?? '').replace(arrayIndexerRegex, '');
        const shouldBeArray = rawKey ? arrayIndexerRegex.test(rawKey) : false;
        const arrayIndex =
            rawKey && (arrayIndexerRegex.exec(rawKey)?.groups?.arrayIndex || '').length > 0
                ? Number(arrayIndexerRegex.exec(rawKey)?.groups?.arrayIndex)
                : Number.NaN;
        const actualValue = key ? obj[key] : obj;
        const currentPath = `${parentPath ? `${parentPath}.` : ''}${rawKey}`;
        if (value === undefined && actualValue === undefined) {
            return { result: false, description: `${currentPath}=undefined` };
        }
        if (rest.length === 0) {
            if (
                shouldBeArray &&
                (!Array.isArray(actualValue) || (Number.isInteger(arrayIndex) && actualValue.length <= Number(arrayIndex)))
            ) {
                return { result: false, description: `${currentPath} empty array` };
            }
            if (value === undefined) {
                const result = shouldBeArray
                    ? !Number.isInteger(arrayIndex) || actualValue.length >= Number(arrayIndex)
                    : actualValue !== undefined;
                return { result, description: `${currentPath} === undefined` };
            }
            if (!shouldBeArray) {
                const result = value instanceof RegExp ? value.test(actualValue) : value === actualValue;
                return { result, description: `${currentPath} === "${actualValue}"` };
            }
        }
        if (shouldBeArray) {
            if (Number.isInteger(arrayIndex)) {
                return matchObject(actualValue[Number(arrayIndex)], rest.join('.'), value, currentPath);
            }
            const hasArrayMatch = (actualValue as Array<any>).some(
                (arrayValue) => matchObject(arrayValue, rest.join('.'), value, currentPath).result
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
    if (!___matchesValue(localMatchBuilderVariables.filter, req.url)) {
        return {
            result: false,
            description: `url ${req.url} doesn't match ${localMatchBuilderVariables.filter?.toString()}`,
        };
    }
    if (!___matchesValue(localMatchBuilderVariables.hostname, ___url.hostname)) {
        return {
            result: false,
            description: `hostname ${___url.hostname} doesn't match ${localMatchBuilderVariables.hostname?.toString()}`,
        };
    }
    if (!___matchesValue(localMatchBuilderVariables.pathname, ___url.pathname)) {
        return {
            result: false,
            description: `pathname ${___url.pathname} doesn't match ${localMatchBuilderVariables.pathname?.toString()}`,
        };
    }
    if (localMatchBuilderVariables.port) {
        const port = ___url.port && ___url.port !== '' ? ___url.port : ___url.protocol === 'https:' ? '443' : '80';
        if (
            !___matchesValue(
                localMatchBuilderVariables.port instanceof RegExp
                    ? localMatchBuilderVariables.port
                    : `${localMatchBuilderVariables.port}`,
                port
            )
        ) {
            return {
                result: false,
                description: `port ${port} doesn't match ${localMatchBuilderVariables.port?.toString()}`,
            };
        }
    }
    if (localMatchBuilderVariables.searchParams) {
        for (const searchParamMatcher of localMatchBuilderVariables.searchParams) {
            if (typeof searchParamMatcher === 'string') {
                const result = ___url.searchParams.has(searchParamMatcher);
                if (!result) {
                    return { result, description: `searchParams.has("${searchParamMatcher}")` };
                }
                continue;
            }
            if (searchParamMatcher instanceof RegExp) {
                const result = Array.from(___url.searchParams.keys()).some((key) => searchParamMatcher.test(key));
                if (!result) {
                    return { result, description: `searchParams.keys() matches ${searchParamMatcher.toString()}` };
                }
                continue;
            }
            if (!___url.searchParams.has(searchParamMatcher.key)) {
                return { result: false, description: `searchParams.has("${searchParamMatcher.key}")` };
            }
            if (searchParamMatcher.value) {
                const value = ___url.searchParams.get(searchParamMatcher.key);
                if (!___matchesValue(searchParamMatcher.value, value as string)) {
                    return {
                        result: false,
                        description: `searchParams.get("${searchParamMatcher.key}") = "${searchParamMatcher.value}"`,
                    };
                }
            }
        }
    }
    if (localMatchBuilderVariables.headers) {
        for (const headerMatcher of localMatchBuilderVariables.headers) {
            if (typeof headerMatcher === 'string') {
                const result = ___headers.has(headerMatcher);
                if (result) {
                    continue;
                }
                return { result: false, description: `headers.has("${headerMatcher}")` };
            }
            if (headerMatcher instanceof RegExp) {
                const result = ___headers.toHeaderPairs().some(([key]) => headerMatcher.test(key));
                if (result) {
                    continue;
                }
                return { result: false, description: `headers.keys matches ${headerMatcher.toString()}` };
            }
            if (!___headers.has(headerMatcher.key)) {
                return { result: false, description: `headers.has("${headerMatcher.key}")` };
            }
            if (headerMatcher.value) {
                const value = ___headers.get(headerMatcher.key);
                if (!___matchesValue(headerMatcher.value, value)) {
                    return {
                        result: false,
                        description: `headerMatcher.get("${headerMatcher.key}") = "${headerMatcher.value}"`,
                    };
                }
            }
        }
    }
    if (localMatchBuilderVariables.bodyText === null && !!req.body) {
        return { result: false, description: `empty body` };
    }
    if (localMatchBuilderVariables.bodyText) {
        if (!req.body) {
            return { result: false, description: `empty body` };
        }
        if (localMatchBuilderVariables.bodyText instanceof RegExp) {
            if (!___matchesValue(localMatchBuilderVariables.bodyText, req.body)) {
                return {
                    result: false,
                    description: `body text doesn't match ${localMatchBuilderVariables.bodyText.toString()}`,
                };
            }
        } else if (!req.body.includes(localMatchBuilderVariables.bodyText)) {
            return {
                result: false,
                description: `body text doesn't include "${localMatchBuilderVariables.bodyText}"`,
            };
        }
    }
    if (localMatchBuilderVariables.bodyJson) {
        let json: any;
        try {
            json = JSON.parse(req.body);
        } catch (kiss) {
            return { result: false, description: `unparseable json` };
        }
        if (!json) {
            return { result: false, description: `empty json object` };
        }
        for (const jsonMatcher of Array.isArray(localMatchBuilderVariables.bodyJson)
            ? localMatchBuilderVariables.bodyJson
            : [localMatchBuilderVariables.bodyJson]) {
            const matchObjectResult = matchObject(json, jsonMatcher.key, jsonMatcher.value);
            if (!matchObjectResult.result) {
                return { result: false, description: `$.${jsonMatcher.key} != "${jsonMatcher.value}"` };
            }
        }
    }
    if (localMatchBuilderVariables.bodyGql) {
        if (!req.gqlBody) {
            return { result: false, description: `not a gql body` };
        }
        if (!___matchesValue(localMatchBuilderVariables.bodyGql.methodName, req.gqlBody.methodName)) {
            return {
                result: false,
                description: `methodName "${localMatchBuilderVariables.bodyGql.methodName}" !== "${req.gqlBody.methodName}"`,
            };
        }
        if (!___matchesValue(localMatchBuilderVariables.bodyGql.operationName, req.gqlBody.operationName)) {
            return {
                result: false,
                description: `operationName "${localMatchBuilderVariables.bodyGql.operationName}" !== "${req.gqlBody.operationName}"`,
            };
        }
        if (!___matchesValue(localMatchBuilderVariables.bodyGql.query, req.gqlBody.query)) {
            return {
                result: false,
                description: `query "${localMatchBuilderVariables.bodyGql.query}" !== "${req.gqlBody.query}"`,
            };
        }
        if (!___matchesValue(localMatchBuilderVariables.bodyGql.type, req.gqlBody.type)) {
            return {
                result: false,
                description: `type "${localMatchBuilderVariables.bodyGql.type}" !== "${req.gqlBody.type}"`,
            };
        }
        if (localMatchBuilderVariables.bodyGql.variables) {
            for (const jsonMatcher of Array.isArray(localMatchBuilderVariables.bodyGql.variables)
                ? localMatchBuilderVariables.bodyGql.variables
                : [localMatchBuilderVariables.bodyGql.variables]) {
                const matchObjectResult = matchObject(req.gqlBody.variables, jsonMatcher.key, jsonMatcher.value);
                if (!matchObjectResult.result) {
                    return {
                        result: false,
                        description: `GQL variable ${jsonMatcher.key} != "${jsonMatcher.value}". Detail: ${matchObjectResult.description}`,
                    };
                }
            }
        }
    }
    return { result: true, description: 'match' };
}

class RuleBuilderBaseBase {
    protected rule: Stuntman.SerializableRule;
    protected _matchBuilderVariables: MatchBuilderVariables;

    constructor(rule?: Stuntman.SerializableRule, _matchBuilderVariables?: MatchBuilderVariables) {
        this._matchBuilderVariables = _matchBuilderVariables || {};
        this.rule = rule || {
            id: uuidv4(),
            ttlSeconds: DEFAULT_RULE_TTL_SECONDS,
            priority: DEFAULT_RULE_PRIORITY,
            actions: {
                mockResponse: { status: 200 },
            },
            matches: {
                localFn: matchFunction,
                localVariables: { matchBuilderVariables: this._matchBuilderVariables },
            },
        };
    }
}

class RuleBuilderBase extends RuleBuilderBaseBase {
    limitedUse(hitCount: number) {
        if (this.rule.removeAfterUse) {
            throw new Error(`limit already set at ${this.rule.removeAfterUse}`);
        }
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
        if (this.rule.priority !== DEFAULT_RULE_PRIORITY) {
            throw new Error('you should not alter rule priority more than once');
        }
        const subtract = by ?? 1;
        if (subtract >= DEFAULT_RULE_PRIORITY) {
            throw new Error(`Unable to raise priority over the default ${DEFAULT_RULE_PRIORITY}`);
        }
        this.rule.priority = DEFAULT_RULE_PRIORITY - subtract;
        return this;
    }

    decreasePriority(by?: number) {
        if (this.rule.priority !== DEFAULT_RULE_PRIORITY) {
            throw new Error('you should not alter rule priority more than once');
        }
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

    onRequestToPort(port: string | number | RegExp): RuleBuilderInitialized {
        this._matchBuilderVariables.port = port;
        return new RuleBuilderInitialized(this.rule, this._matchBuilderVariables);
    }

    onAnyRequest(): RuleBuilderInitialized {
        return new RuleBuilderInitialized(this.rule, this._matchBuilderVariables);
    }
}

class RuleBuilderRequestInitialized extends RuleBuilderBase {
    modifyResponse(
        modifyFunction: Stuntman.ResponseManipulationFn | Stuntman.RemotableFunction<Stuntman.ResponseManipulationFn>,
        localVariables?: Stuntman.LocalVariables
    ): Stuntman.SerializableRule {
        if (!this.rule.actions) {
            throw new Error('rule.actions not defined - builder implementation error');
        }
        if (typeof modifyFunction === 'function') {
            this.rule.actions.modifyResponse = { localFn: modifyFunction, localVariables: localVariables ?? {} };
            return this.rule;
        }
        if (localVariables) {
            throw new Error('invalid call - localVariables cannot be used together with Response or RemotableFunction');
        }
        this.rule.actions.modifyResponse = modifyFunction;
        return this.rule;
    }
}

class RuleBuilderInitialized extends RuleBuilderRequestInitialized {
    withHostname(hostname: string | RegExp) {
        if (this._matchBuilderVariables.hostname) {
            throw new Error('hostname already set');
        }
        this._matchBuilderVariables.hostname = hostname;
        return this;
    }

    withPathname(pathname: string | RegExp) {
        if (this._matchBuilderVariables.pathname) {
            throw new Error('pathname already set');
        }
        this._matchBuilderVariables.pathname = pathname;
        return this;
    }

    withPort(port: number | string | RegExp) {
        if (this._matchBuilderVariables.port) {
            throw new Error('port already set');
        }
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

    withHeaders(...headers: KeyValueMatcher[]): RuleBuilderInitialized {
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
        if (this._matchBuilderVariables.bodyText) {
            throw new Error('bodyText already set');
        }
        if (this._matchBuilderVariables.bodyText === null) {
            throw new Error('cannot use both withBodyText and withoutBody');
        }
        this._matchBuilderVariables.bodyText = includesOrMatches;
        return this;
    }

    withoutBody(): RuleBuilderInitialized {
        if (this._matchBuilderVariables.bodyText) {
            throw new Error('cannot use both withBodyText and withoutBody');
        }
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
                throw new Error(`invalid key "${keyOrMatcher}"`);
            }
            if (withValue === undefined) {
                this._matchBuilderVariables.bodyJson.push({ key: keyOrMatcher });
            } else {
                this._matchBuilderVariables.bodyJson.push({ key: keyOrMatcher, value: withValue });
            }
            return this;
        }
        if (withValue !== undefined) {
            throw new Error('invalid usage');
        }
        if (!keyRegex.test(keyOrMatcher.key)) {
            throw new Error(`invalid key "${keyOrMatcher}"`);
        }
        this._matchBuilderVariables.bodyJson.push(keyOrMatcher);
        return this;
    }

    withBodyGql(gqlMatcher: GQLRequestMatcher): RuleBuilderInitialized {
        if (this._matchBuilderVariables.bodyGql) {
            throw new Error('gqlMatcher already set');
        }
        this._matchBuilderVariables.bodyGql = gqlMatcher;
        return this;
    }

    proxyPass(): Stuntman.SerializableRule {
        this.rule.actions = { proxyPass: true };
        return this.rule;
    }

    mockResponse(staticResponse: Stuntman.Response): Stuntman.SerializableRule;
    mockResponse(generationFunction: Stuntman.RemotableFunction<Stuntman.ResponseGenerationFn>): Stuntman.SerializableRule;
    mockResponse(localFn: Stuntman.ResponseGenerationFn, localVariables?: Stuntman.LocalVariables): Stuntman.SerializableRule;
    mockResponse(
        response: Stuntman.Response | Stuntman.RemotableFunction<Stuntman.ResponseGenerationFn> | Stuntman.ResponseGenerationFn,
        localVariables?: Stuntman.LocalVariables
    ): Stuntman.SerializableRule {
        if (typeof response === 'function') {
            this.rule.actions = { mockResponse: { localFn: response, localVariables: localVariables ?? {} } };
            return this.rule;
        }
        if (localVariables) {
            throw new Error('invalid call - localVariables cannot be used together with Response or RemotableFunction');
        }
        this.rule.actions = { mockResponse: response };
        return this.rule;
    }

    modifyRequest(
        modifyFunction: Stuntman.RequestManipulationFn | Stuntman.RemotableFunction<Stuntman.RequestManipulationFn>,
        localVariables?: Stuntman.LocalVariables
    ): RuleBuilderRequestInitialized {
        if (typeof modifyFunction === 'function') {
            this.rule.actions = { modifyRequest: { localFn: modifyFunction, localVariables: localVariables ?? {} } };
            return new RuleBuilderRequestInitialized(this.rule, this._matchBuilderVariables);
        }
        if (localVariables) {
            throw new Error('invalid call - localVariables cannot be used together with Response or RemotableFunction');
        }
        this.rule.actions = { modifyRequest: modifyFunction };
        return new RuleBuilderRequestInitialized(this.rule, this._matchBuilderVariables);
    }

    override modifyResponse(
        modifyFunction: Stuntman.ResponseManipulationFn | Stuntman.RemotableFunction<Stuntman.ResponseManipulationFn>,
        localVariables?: Stuntman.LocalVariables
    ): Stuntman.SerializableRule {
        if (!this.rule.actions) {
            this.rule.actions = { proxyPass: true };
        }
        return super.modifyResponse(modifyFunction, localVariables);
    }
}

export const ruleBuilder = () => new RuleBuilder();
