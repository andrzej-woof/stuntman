import { expect, test } from '@jest/globals';
import config from '../src/config';
import { INDEX_DTS } from '../src/index';

test('INDEX_DTS', async () => {
    expect(INDEX_DTS).toMatch(/export type Rule/);
});

test('defaults', async () => {
    expect(config).toEqual({
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
