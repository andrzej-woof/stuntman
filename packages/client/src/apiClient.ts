import serializeJavascript from 'serialize-javascript';
import { ClientError } from './clientError';
import { DEFAULT_API_PORT } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

type ClientOptions = {
    protocol?: 'http' | 'https';
    host?: string;
    port?: number;
    timeout?: number;
    apiKey?: string;
};

const SERIALIZE_JAVASCRIPT_OPTIONS: serializeJavascript.SerializeJSOptions = {
    unsafe: true,
    ignoreFunction: true,
};

const getFunctionParams = (func: () => any) => {
    const funstr = func.toString();
    const params = funstr.slice(funstr.indexOf('(') + 1, funstr.indexOf(')')).match(/([^\s,]+)/g) || new Array<string>();
    if (params.includes('=')) {
        throw new Error('default argument values are not supported');
    }
    return params;
};

const serializeApiFunction = (fn: (...args: any[]) => any, variables?: Stuntman.LocalVariables): string => {
    const variableInitializer: string[] = [];
    const functionParams = getFunctionParams(fn);
    if (variables) {
        for (const varName of Object.keys(variables)) {
            let varValue = variables[varName];
            if (varValue === undefined || varValue === null || typeof varValue === 'number' || typeof varValue === 'boolean') {
                varValue = `${varValue}`;
            } else if (typeof varValue === 'string') {
                varValue = `${serializeJavascript(variables[varName], SERIALIZE_JAVASCRIPT_OPTIONS)}`;
            } else {
                varValue = `eval('(${serializeJavascript(variables[varName], SERIALIZE_JAVASCRIPT_OPTIONS).replace(
                    /'/g,
                    "\\'"
                )})')`;
            }
            variableInitializer.push(`const ${varName} = ${varValue};`);
        }
    }
    const functionString = fn.toString();
    const serializedHeader = `return ((${functionParams.map((_param, index) => `____arg${index}`).join(',')}) => {`;
    const serializedParams = `${functionParams
        .map((_param, index) => `const ${functionParams[index]} = ____arg${index};`)
        .join('\n')}`;
    const serializedVariables = `${variableInitializer.join('\n')}`;
    // prettier-ignore
    const serializedFunction = `return (${functionString.substring(0, functionString.indexOf('('))}()${functionString.substring(functionString.indexOf(')')+1)})(); })(${functionParams.map((_param, index) => `____arg${index}`).join(',')})`;
    if (!serializedParams && !serializedVariables) {
        return `${serializedHeader}${serializedFunction}`;
    }
    return [serializedHeader, serializedParams, serializedVariables, serializedFunction].filter((x) => !!x).join('\n');
};

const keysOf = <T extends object>(obj: T): Array<keyof T> => {
    return Array.from(Object.keys(obj)) as any;
};
const serializeRemotableFunctions = <T>(obj: any): Stuntman.WithSerializedFunctions<T> => {
    const objectKeys = keysOf(obj);
    if (!objectKeys || objectKeys.length === 0) {
        return obj;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const output: WithSerializedFunctions<T> = {};
    for (const key of objectKeys) {
        if (typeof obj[key] === 'object') {
            if ('localFn' in obj[key]) {
                const remotableFunction = obj[key] as Stuntman.RemotableFunction<(...args: any[]) => any>;
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                output[key] = {
                    remoteFn: serializeApiFunction(remotableFunction.localFn, remotableFunction.localVariables),
                    localFn: remotableFunction.localFn.toString(),
                    localVariables: serializeJavascript(remotableFunction.localVariables, SERIALIZE_JAVASCRIPT_OPTIONS),
                };
            } else {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                output[key] = serializeRemotableFunctions<any>(obj[key]);
            }
        } else {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            output[key] = obj[key];
        }
    }
    return output;
};

export class Client {
    // TODO websockets connection to API and hooks `onIntereceptedRequest`, `onInterceptedResponse`

    private options: ClientOptions;

    private get baseUrl() {
        return `${this.options.protocol}://${this.options.host}${this.options.port ? `:${this.options.port}` : ''}`;
    }

    constructor(options?: ClientOptions) {
        this.options = {
            ...options,
            timeout: options?.timeout || 60000,
            host: options?.host || 'localhost',
            protocol: options?.protocol || 'http',
            port: options?.port || options?.protocol ? (options.protocol === 'https' ? 443 : 80) : DEFAULT_API_PORT,
        };
    }

    private async fetch(url: RequestInfo, init?: RequestInit): Promise<Response> {
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, this.options.timeout);
        try {
            const response = await fetch(url, {
                ...init,
                headers: {
                    ...(this.options.apiKey && { 'x-api-key': this.options.apiKey }),
                    ...init?.headers,
                },
                signal: init?.signal ?? controller.signal,
            });
            if (!response.ok) {
                const text = await response.text();
                let json: any;
                try {
                    json = JSON.parse(text);
                } catch (kiss) {
                    // and swallow
                }
                if (json && 'error' in json) {
                    throw new ClientError(json.error);
                }
                throw new Error(`Unexpected errror: ${text}`);
            }
            return response;
        } finally {
            clearTimeout(timeout);
        }
    }

    async getRules(): Promise<Stuntman.LiveRule[]> {
        const response = await this.fetch(`${this.baseUrl}/rules`);
        return (await response.json()) as Promise<Stuntman.LiveRule[]>;
    }

    async getRule(id: string): Promise<Stuntman.LiveRule> {
        const response = await this.fetch(`${this.baseUrl}/rule/${encodeURIComponent(id)}`);
        return (await response.json()) as Stuntman.LiveRule;
    }

    async disableRule(id: string): Promise<void> {
        await this.fetch(`${this.baseUrl}/rule/${encodeURIComponent(id)}/disable`);
    }

    async enableRule(id: string): Promise<void> {
        await this.fetch(`${this.baseUrl}/rule/${encodeURIComponent(id)}/enable`);
    }

    async removeRule(id: string): Promise<void> {
        await this.fetch(`${this.baseUrl}/rule/${encodeURIComponent(id)}/remove`);
    }

    async addRule(rule: Stuntman.SerializableRule): Promise<Stuntman.Rule> {
        const serializedRule = serializeRemotableFunctions<Stuntman.SerializableRule>(rule);
        const response = await this.fetch(`${this.baseUrl}/rule`, {
            method: 'POST',
            body: JSON.stringify(serializedRule),
            headers: { 'content-type': 'application/json' },
        });
        return (await response.json()) as Stuntman.Rule;
    }

    // TODO improve filtering by timestamp from - to, multiple labels, etc.
    async getTraffic(rule: Stuntman.Rule): Promise<Stuntman.LogEntry[]>;
    async getTraffic(ruleIdOrLabel: string): Promise<Stuntman.LogEntry[]>;
    async getTraffic(ruleOrIdOrLabel: string | Stuntman.Rule): Promise<Stuntman.LogEntry[]> {
        const ruleId = typeof ruleOrIdOrLabel === 'object' ? ruleOrIdOrLabel.id : ruleOrIdOrLabel;
        const response = await this.fetch(`${this.baseUrl}/traffic${ruleId ? `/${encodeURIComponent(ruleId)}` : ''}`);
        return (await response.json()) as Stuntman.LogEntry[];
    }
}
