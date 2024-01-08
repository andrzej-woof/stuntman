/* eslint-disable @typescript-eslint/ban-types */
export * from './constants';
export * from './appError';
export * from './logger';
export * from './stringify';
export * from './rawHeaders';
export * from './gqlParser';
export * from './escapeStringRegexp';
export * from './errorToLog';
import fs from 'fs';

import config from './config';
export const stuntmanConfig = config.stuntmanConfig;

// TODO this file read sucks
export const INDEX_DTS = fs.readFileSync(`${__dirname}/index.d.ts`, 'utf-8');

type NonObject = string | number | boolean | symbol | undefined | null | any[];

export type SharedProps<T1, T2> = Pick<T1 | T2, Extract<keyof T1, keyof T2>>;

export type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
    [Property in Key]-?: Type[Property];
};

interface SerializableTypesRecord<T> {
    [k: string | number]: T;
}

export type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[] ? RecursivePartial<U>[] : T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

type SerializableTypes =
    | string
    | number
    | boolean
    | undefined
    | null
    | RegExp
    | SerializableTypes[]
    | SerializableTypesRecord<SerializableTypes>;

export enum HttpCode {
    OK = 200,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    NOT_FOUND = 404,
    CONFLICT = 409,
    UNPROCESSABLE_ENTITY = 422,
    INTERNAL_SERVER_ERROR = 500,
}

export type LocalVariables = Record<string, SerializableTypes>;

export type RuleMatchResult =
    | boolean
    | { result: boolean; enableRuleIds?: string[]; disableRuleIds?: string[]; description?: string };

export type RemotableFunction<T extends Function> = {
    localFn: T;
    localVariables?: LocalVariables;
};

export type SerializedRemotableFunction = {
    localFn: string;
    localVariables?: string;
    remoteFn: string;
};

type WithRemotableFunctions<Type> = {
    [PropertyKey in keyof Type]: Extract<Type[PropertyKey], Function> extends never
        ? Exclude<Type[PropertyKey], NonObject> extends never
            ? Type[PropertyKey]
            : WithRemotableFunctions<Exclude<Type[PropertyKey], NonObject>>
        : Exclude<Type[PropertyKey], Function> | RemotableFunction<Extract<Type[PropertyKey], Function>>;
};

export type WithSerializedFunctions<Type> = {
    [PropertyKey in keyof Type]: Extract<Type[PropertyKey], RemotableFunction<Function>> extends never
        ? Exclude<Type[PropertyKey], NonObject> extends never
            ? Type[PropertyKey]
            : WithSerializedFunctions<Exclude<Type[PropertyKey], NonObject>>
        : Exclude<Type[PropertyKey], RemotableFunction<Function>> | SerializedRemotableFunction;
};

export interface RawHeadersInterface extends Array<string> {
    get: (name: string) => string | undefined;
    set: (name: string, value: string) => void;
    has: (name: string, value?: string) => boolean;
    add: (name: string, value: string) => void;
    remove: (name: string) => void;
    toHeaderPairs: () => readonly [string, string][];
}

export const HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type BaseRequest = {
    rawHeaders: RawHeadersInterface;
    url: string;
    body?: any;
    method: HttpMethod;
};

export type Request = BaseRequest & {
    id: string;
    timestamp: number;
    gqlBody?: GQLRequestBody | undefined;
    jwt?: any | undefined;
};

export type Response = {
    rawHeaders?: RawHeadersInterface;
    status?: number;
    body?: any;
    timestamp?: number;
};

export type LogEntry = {
    originalRequest: Request;
    labels?: string[] | undefined;
    mockRuleId?: string;
    originalResponse?: Response;
    modifiedRequest?: Request;
    modifiedResponse?: Response;
};

export type RuleMatchFunction = (request: Request) => RuleMatchResult;
export type RequestManipulationFn = (request: Request) => Request;
export type ResponseManipulationFn = (request: Request, response: Response) => Response;
export type ResponseGenerationFn = (request: Request) => Response;

export type Actions =
    | {
          proxyPass: true;
          mockResponse?: undefined;
          modifyRequest?: undefined;
          modifyResponse?: undefined;
      }
    | {
          mockResponse: Response | ResponseGenerationFn;
          proxyPass?: undefined;
          modifyRequest?: undefined;
          modifyResponse?: undefined;
      }
    | {
          modifyRequest: RequestManipulationFn;
          modifyResponse?: ResponseManipulationFn;
          proxyPass?: true | undefined;
          mockResponse?: undefined;
      }
    | {
          modifyRequest?: RequestManipulationFn;
          modifyResponse: ResponseManipulationFn;
          proxyPass?: true | undefined;
          mockResponse?: undefined;
      };

export type Rule = {
    id: string;
    priority?: number;
    matches: RuleMatchFunction; // function for picking request to process
    labels?: string[]; // groupping req/res pairs for searching later e.g. ['exoclick', 'testId123']
    actions: Actions;
    disableAfterUse?: boolean | number; // disable after rule is triggered n-times
    removeAfterUse?: boolean | number; // disable after rule is triggered n-times
    ttlSeconds: number;
    storeTraffic?: boolean;
    isEnabled?: boolean;
};

export type DeployedRule = Omit<Rule, 'disableAfterUse' | 'removeAfterUse' | 'ttlSeconds'>;

export type SerializableRule = WithRemotableFunctions<Rule>;
export type SerializedRule = WithSerializedFunctions<SerializableRule>;

export type LiveRule = Rule & {
    counter: number;
    createdTimestamp: number;
};

export type GQLRequestBody = {
    operationName: string;
    variables?: any;
    query: string;
    type: 'query' | 'mutation';
    methodName?: string;
};

export type WebGuiConfig = {
    disabled: boolean;
};

export type ApiConfig =
    | { disabled: true }
    | {
          port: number;
          disabled: false;
          apiKeyReadWrite: string | null;
          apiKeyReadOnly: string | null;
      };

export type ClientConfig = {
    protocol: 'http' | 'https';
    host: string;
    port: number;
    timeout: number;
    apiKey?: string;
};

export type MockConfig = {
    domain: string;
    port: number;
    httpsPort?: number;
    httpsKey?: string;
    httpsCert?: string;
    timeout: number;
    externalDns: string[];
    rulesPath: string;
    disableProxy?: boolean;
};

export type StorageConfig = {
    limitCount: number;
    limitSize: number;
    ttl: number;
};

export type Config = {
    webgui: WebGuiConfig;
    api: ApiConfig;
    mock: MockConfig;
    storage: {
        traffic: StorageConfig;
    };
    client: ClientConfig;
};

export interface RuleExecutorInterface {
    addRule: (rule: Rule, overwrite?: boolean) => Promise<LiveRule>;
    removeRule: (id: string) => Promise<void>;
    enableRule: (id: string) => void;
    disableRule: (id: string) => void;
    findMatchingRule: (request: Request) => Promise<LiveRule | null>;
    getRules: () => Promise<readonly LiveRule[]>;
    getRule: (id: string) => Promise<LiveRule | undefined>;
}
