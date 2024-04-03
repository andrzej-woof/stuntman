import {
    Config,
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
import path from 'path';

// TODO safeguards & defaults

const defaultConfig: Config = {
    api: {
        disabled: false,
        port: DEFAULT_API_PORT,
        apiKeyReadOnly: null,
        apiKeyReadWrite: null,
    },
    mock: {
        domain: DEFAULT_MOCK_DOMAIN,
        externalDns: EXTERNAL_DNS,
        port: DEFAULT_MOCK_PORT,
        timeout: DEFAULT_PROXY_TIMEOUT,
        rulesPath: path.join(process.cwd(), 'rules'),
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
    client: {
        timeout: 60000,
        host: 'localhost',
        protocol: 'http',
        port: DEFAULT_API_PORT,
    },
};

config.util.setModuleDefaults('stuntman', defaultConfig);
export default config.get<Config>('stuntman');
