import { expect, test, jest } from '@jest/globals';
import config from '../src/config';
import { INDEX_DTS } from '../src/index';

jest.mock('fs', () => ({
    readFileSync: jest.fn((fileName: string) => {
        if (/index\.d\.ts$/.test(fileName)) {
            return 'TYPE DEFINITIONS';
        }
        return '{}';
    }),
}));

test('defaults', async () => {
    expect(config.stuntmanConfig).toEqual({
        api: {
            apiKeyReadOnly: null,
            apiKeyReadWrite: null,
            disabled: false,
            port: 1985,
        },
        client: {
            host: 'localhost',
            port: 1985,
            protocol: 'http',
            timeout: 60000,
        },
        mock: {
            domain: 'stuntman',
            externalDns: ['8.8.8.8', '1.1.1.1'],
            port: 2015,
            rulesPath: `${process.cwd()}/rules`,
            timeout: 60000,
        },
        storage: {
            traffic: {
                limitCount: 500,
                limitSize: 524288000,
                ttl: 3600000,
            },
        },
        webgui: {
            disabled: false,
        },
    });
});

test('INDEX_DTS', async () => {
    expect(INDEX_DTS).toEqual('TYPE DEFINITIONS');
});
