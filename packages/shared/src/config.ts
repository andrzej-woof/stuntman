import {
    RecursivePartial,
    ServerConfig,
    DEFAULT_API_PORT,
    DEFAULT_MOCK_DOMAIN,
    EXTERNAL_DNS,
    DEFAULT_MOCK_PORT,
    DEFAULT_PROXY_TIMEOUT,
    DEFAULT_CACHE_MAX_ENTRIES,
    DEFAULT_CACHE_MAX_SIZE,
    DEFAULT_CACHE_TTL,
} from '.';
import config from 'config';
import defaults from 'defaults';

// TODO safeguards & defaults

const defaultConfig: ServerConfig = {
    api: {
        disabled: false,
        port: DEFAULT_API_PORT,
    },
    mock: {
        domain: DEFAULT_MOCK_DOMAIN,
        externalDns: EXTERNAL_DNS,
        port: DEFAULT_MOCK_PORT,
        timeout: DEFAULT_PROXY_TIMEOUT,
    },
    storage: {
        traffic: {
            limitCount: DEFAULT_CACHE_MAX_ENTRIES,
            limitSize: DEFAULT_CACHE_MAX_SIZE,
            ttl: DEFAULT_CACHE_TTL,
        },
    },
    webgui: {
        disabled: false,
    },
};

let configFromFile: RecursivePartial<ServerConfig> = {};
try {
    configFromFile = config.get<RecursivePartial<ServerConfig>>('stuntman');
} catch (error) {
    // eslint-disable-next-line no-console
    console.warn('unable to find correct config - starting with defaults');
}

export const serverConfig = defaults(configFromFile, defaultConfig) as ServerConfig;
