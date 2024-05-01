import type * as Stuntman from '@stuntman/shared';
import { v4 as uuidv4 } from 'uuid';
import { getMockReq as _getMockReq, getMockRes } from '@jest-mock/express';
import { test, expect, describe, jest } from '@jest/globals';
import { Mock } from '../src/mock';
import { stuntmanConfig } from '@stuntman/shared';
import { RawHeaders } from '@stuntman/shared';
import { MockRequest } from '@jest-mock/express/dist/src/request';
import express from 'express';
import https from 'https';
import { RequestContext } from '../src/requestContext';

jest.mock('express', () => () => ({
    use: jest.fn(),
    listen: jest.fn((_port, callback: any) => {
        callback();
        return {
            close: () => jest.fn(),
        };
    }),
    all: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    raw: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
express.json = jest.fn();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
express.text = jest.fn();

jest.mock('https', () => ({
    createServer: jest.fn(() => ({ listen: jest.fn() })),
}));

const getMockReq = (input?: MockRequest) => {
    const values: MockRequest = {
        ...input,
    };
    if (input?.url) {
        const url = new URL(input.url);
        values.host ??= url.host;
        values.hostname ??= url.hostname;
        values.path ??= url.pathname;
        values.protocol ??= url.protocol.replace(':', '');
        values.originalUrl ??= `${url.pathname}${input.url.indexOf('?') ? url.search : ''}`;
        values.params ??= Array.from(url.searchParams.entries()).reduce(
            (acc, [key, value]) => {
                acc[key] = value;
                return acc;
            },
            {} as Record<string, string>
        );
        values.query = values.params;
    }
    if (input?.rawHeaders) {
        values.headers = RawHeaders.toHeadersRecord(input.rawHeaders);
        values.rawHeaders = new RawHeaders(...input.rawHeaders);
    }
    return _getMockReq(values);
};

describe('mock constructor', () => {
    test('missing https cert/key', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { httpsCert, httpsKey, ...noCertNoKeyConfig } = stuntmanConfig.mock;
        expect(() => new Mock({ ...stuntmanConfig, mock: { ...noCertNoKeyConfig, httpsPort: 443, httpsCert: '123' } })).toThrow();
        expect(() => new Mock({ ...stuntmanConfig, mock: { ...noCertNoKeyConfig, httpsPort: 443, httpsKey: '123' } })).toThrow();
    });

    test('https', async () => {
        new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, httpsPort: 443, httpsCert: '123', httpsKey: '123' } });
    });

    test('no external dns', async () => {
        new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, externalDns: [] } });
    });

    test('api disabled', async () => {
        const mock = new Mock({ ...stuntmanConfig, api: { disabled: true } });
        expect(mock['apiServer']).toBeNull();
    });

    test('get ruleExecutor', async () => {
        const mock = new Mock(stuntmanConfig);
        expect(mock.ruleExecutor).toHaveProperty('findMatchingRule');
    });
});

describe('start', () => {
    test('http', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { httpsPort, ...noHttpsConfig } = stuntmanConfig.mock;
        const mock = new Mock({ ...stuntmanConfig, api: { disabled: true }, mock: { ...noHttpsConfig, port: 2017 } });
        mock.start();
        setTimeout(() => {
            expect(mock['mockApp']?.listen).toBeCalled();
            expect(https.createServer).not.toBeCalled();
            expect(() => mock.start()).toThrow();
        }, 5000);
    });

    test('http & https', async () => {
        const mock = new Mock({
            ...stuntmanConfig,
            mock: {
                ...stuntmanConfig.mock,
                port: 2018,
                httpsPort: 443,
                httpsCert:
                    '-----BEGIN CERTIFICATE-----\nMIIC7jCCAdYCCQDHj59tQDx5iTANBgkqhkiG9w0BAQsFADA5MREwDwYDVQQKDAhz\ndHVudG1hbjERMA8GA1UECwwIc3R1bnRtYW4xETAPBgNVBAMMCHN0dW50bWFuMB4X\nDTIzMDIxNjE1MzQzNFoXDTI0MDIxNjE1MzQzNFowOTERMA8GA1UECgwIc3R1bnRt\nYW4xETAPBgNVBAsMCHN0dW50bWFuMREwDwYDVQQDDAhzdHVudG1hbjCCASIwDQYJ\nKoZIhvcNAQEBBQADggEPADCCAQoCggEBAK23MCp+grcLiyFzxvSU9iOFReIKZRVN\n0+DTlxl/sN4pvYlt7Hji7n/Yh55m7ACF1j8LRjaU6MOYIGofF4lbgA3nEbZVNJoH\nAtlSjk/JZc4LnDFinAWWxna2FpwrpfEnknIJ2B7fjtk5dM/WzSMn1MdPiC9V9Ee0\nPFe0PlpFl/hQSd4/VXfLxNy3bzW5AXa5CuTVRaEmts21TbL4VYe6KNPMkbTe+NJh\nwBrwVqS5lB3Z5racxOn5Dw5g5NuHgSA6LvUxdKhdkPs7y7e87XADadakibd9u02j\nimJwQih31O4rPJINLDYhVj5muyPGw9lpxEQ7UthxRxuzodm4F+5ZM1ECAwEAATAN\nBgkqhkiG9w0BAQsFAAOCAQEAhqISsPYrM+G37vw8I6YCWNSW0dJrpvfNpiz6oXal\nicIxOJz06qg0HsEXoWhdneo9PSA66KAmdcTplwPJtZ486izwD3F46+TZLkesOuCS\nDW9ihEPY5XPyjZDSz2J4EwBD4pH0AFeXSVFDIyXCSoWypSKjSq5lm7hOQuCOLkkm\ntlsptc4R3MGuvNYKSDBvxCjTy76jlXpMWINdVV18M4bVmRnVj+vYlQbYP5tCYGUm\nnzlFVi0dCLdvS2LGiKhARLQILP9YzC86a9UDPyWs703Zvqm5cnknCLEpjaR8dhd8\njAcDPHUe1RkR8wGrGwkkrIQfe8r8ovEylJgLT8HtNLqEXg==\n-----END CERTIFICATE-----\n',
                httpsKey:
                    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEArbcwKn6CtwuLIXPG9JT2I4VF4gplFU3T4NOXGX+w3im9iW3s\neOLuf9iHnmbsAIXWPwtGNpTow5ggah8XiVuADecRtlU0mgcC2VKOT8llzgucMWKc\nBZbGdrYWnCul8SeScgnYHt+O2Tl0z9bNIyfUx0+IL1X0R7Q8V7Q+WkWX+FBJ3j9V\nd8vE3LdvNbkBdrkK5NVFoSa2zbVNsvhVh7oo08yRtN740mHAGvBWpLmUHdnmtpzE\n6fkPDmDk24eBIDou9TF0qF2Q+zvLt7ztcANp1qSJt327TaOKYnBCKHfU7is8kg0s\nNiFWPma7I8bD2WnERDtS2HFHG7Oh2bgX7lkzUQIDAQABAoIBAH+L7GKXBvTNFfeW\n4XK9WMgV14yzIyr0POhrkxrWxY8pSI/6VNEhlgnqexET8p4jpn4dkg0LYqgSL2Kb\nt5VTyH7stPWSNBAPq8jTM8hjUEtr/N/JzlLQNKH+6jT6W1noOz9d+QAaFvFpnVnp\nFi+E1FcPDyfqTXTEYjXnEo0HYiCf5RAIw64VYRR3OfmCWFHjwz3sDbhvTW1bYfZA\nddwViTIoELfebF3cCLg4zWVkyCeZRpmbRJaeyttrqgOLbjD6tn7SFkZVJ8v4BBoK\nZSdRaFrzPrRxBYcLRbXlIaNp0QeM/NkSBZIg63vhwZydR+Y3wDE4mCzZ8UqiOyLC\nGIdHky0CgYEA1yY1WJ1ubOB67w4dckWMw9SOw00AP/i5o0j4kFz8nkcWhx8W6rJW\nrZrPq6yAZ6ffzR4aIwrq0W22nHB20sOvamO7UH7TzG3BuM787ChMqB0bEy98hKHZ\nHTAOKyqG9A50N+QNicUS9gXDWk67/i3j19bw8rLWMrNsQDM9SZHYvaMCgYEAzrMB\nz+ofYQ04z7gIKmlOK+lG9pT3JyNVdnLnHFhil4Q4AKMDDIsoKkDqjE2jJeTNzE+G\nIGlZyiBK6sArTJdNthrvrJLmvJJfVEGWpSnShNxDf+gzIJeUoA/TCJvUac1CXd8g\nHwnhR3Dp1I3SZwm32Hig/vzxe8Dd+YONPoNm8nsCgYBJ1pcgXodzXmdSe+mnOi9h\nViXY6ShYzCgJ3hVQllksiQE2Rnk6+xG8axEyvfUjnf21C8u0kx6b2ad+cSqWkwo0\n3R2ANsbBtjlyD7fF5N7KI5MTNozpiBJXbhKuxd2jDQLd26q5yaUEQl4VNEhYp682\neFIhOTdCF0njjrJN+XwFOQKBgF6j2aWQBhQS0LtTAPIiSzeR1PscE9notL3KOIVi\n9ql3UYkBGmlI4fgOxxW8ioHUNGJi2v/GHOWOSZ8Yo/qqoFtMFAdJL7qRrnJOoaI3\n9vr8Oy+6aoZ2wQdUl4SujOBwqf1/Jx7vECX8ziOTWA3zhijoepalzA+krD4NfMNt\nuNo3AoGBAISjSwEUrpR3II4uj8UuPZaVFNvACujaJLWnKcGwFvQsn/2GTcfzdzm/\nTxwHwpRZLJhFFpboFGVW5pX7g9leqdZERGlqPpTkCSAiQ0eFRbHsIhX7TS9VyYMz\n7iLq9dccEn5DDnUVXWkZxz2h0yG8/nTlNGli0BL2O+DEWZ9b32xE\n-----END RSA PRIVATE KEY-----\n',
            },
            api: { disabled: true },
        });
        mock.start();
        setTimeout(() => {
            expect(mock['mockApp']?.listen).toBeCalled();
            expect(https.createServer).toBeCalled();
        }, 5000);
    });
});

test('bindRequestContext', async () => {
    const mock = new Mock(stuntmanConfig);
    const nextFunction = jest.fn();
    const req = {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mock['bindRequestContext'](req, {}, nextFunction);
    expect(req).toEqual({});
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(RequestContext.get(req)).toEqual(
        expect.objectContaining({
            mockUuid: mock.mockUuid,
            uuid: expect.stringMatching(/^[0-9a-f]{8}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{12}$/i),
        })
    );
    expect(nextFunction).toBeCalled();
});

test('errorHandler', async () => {
    const mock = new Mock(stuntmanConfig);
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    mock['errorHandler'](new Error('my error'), {}, res);
    expect(res.status).toBeCalledWith(500);
    expect(json).toBeCalledWith({
        error: {
            message: 'my error',
            httpCode: 500,
            uuid: expect.stringMatching(/^[0-9a-f]{8}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{12}$/i),
        },
    });
});

test('unproxyRequest', async () => {
    const mock = new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, domain: 'mydomain' } });
    expect(
        mock['unproxyRequest'](
            getMockReq({
                url: 'http://www.example.com.mydomain:2015/somethingelse/path?query=param',
                rawHeaders: [
                    'Origin',
                    'http://www.example.com.mydomain',
                    'Referer',
                    'http://www.example.com.mydomain/something?and=param',
                    'Host',
                    'www.example.com.mydomain:2015',
                ],
                method: 'gEt',
                body: Buffer.from('http://www.example.com.mydomain:2015/ something in the body'),
            })
        )
    ).toEqual({
        url: 'http://www.example.com/somethingelse/path?query=param',
        rawHeaders: new RawHeaders(
            'Origin',
            'http://www.example.com',
            'Referer',
            'http://www.example.com/something?and=param',
            'Host',
            'www.example.com'
        ),
        method: 'GET',
        body: 'http://www.example.com.mydomain:2015/ something in the body',
    });

    expect(
        mock['unproxyRequest'](
            getMockReq({
                url: 'http://www.example.com:2015/somethingelse/path?query=param',
                rawHeaders: [
                    'Origin',
                    'http://www.example.com',
                    'Referer',
                    'http://www.example.com/something?and=param',
                    'Host',
                    'www.example.com:80',
                ],
                method: 'gEt',
                body: Buffer.from('http://www.example.com/ something in the body'),
            })
        )
    ).toEqual({
        url: 'http://www.example.com/somethingelse/path?query=param',
        rawHeaders: new RawHeaders(
            'Origin',
            'http://www.example.com',
            'Referer',
            'http://www.example.com/something?and=param',
            'Host',
            'www.example.com:80'
        ),
        method: 'GET',
        body: 'http://www.example.com/ something in the body',
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    expect(() => mock['unproxyRequest'](getMockReq({ method: 'INVALID' }))).toThrow();

    expect(
        mock['unproxyRequest'](
            getMockReq({
                url: 'http://www.example.com.mydomainhttp:2015/somethingelse/path?query=param',
                rawHeaders: [
                    'Origin',
                    'http://www.example.com.mydomainhttp',
                    'Referer',
                    'http://www.example.com.mydomainhttp/something?and=param',
                    'Host',
                    'www.example.com.mydomainhttp:2015',
                ],
                method: 'gEt',
                body: Buffer.from('http://www.example.com.mydomainhttp:2015/ something in the body'),
            })
        )
    ).toEqual({
        url: 'http://www.example.com/somethingelse/path?query=param',
        rawHeaders: new RawHeaders(
            'Origin',
            'http://www.example.com',
            'Referer',
            'http://www.example.com/something?and=param',
            'Host',
            'www.example.com'
        ),
        method: 'GET',
        body: 'http://www.example.com.mydomainhttp:2015/ something in the body',
    });

    expect(
        mock['unproxyRequest'](
            getMockReq({
                url: 'http://www.example.com.mydomainhttps:2015/somethingelse/path?query=param',
                rawHeaders: [
                    'Origin',
                    'http://www.example.com.mydomainhttps',
                    'Referer',
                    'http://www.example.com.mydomainhttps/something?and=param',
                    'Host',
                    'www.example.com.mydomainhttps:2015',
                ],
                method: 'gEt',
                body: Buffer.from('http://www.example.com.mydomainhttps:2015/ something in the body'),
            })
        )
    ).toEqual({
        url: 'https://www.example.com/somethingelse/path?query=param',
        rawHeaders: new RawHeaders(
            'Origin',
            'https://www.example.com',
            'Referer',
            'https://www.example.com/something?and=param',
            'Host',
            'www.example.com'
        ),
        method: 'GET',
        body: 'http://www.example.com.mydomainhttps:2015/ something in the body',
    });

    expect(
        mock['unproxyRequest'](
            getMockReq({
                url: 'http://www.example.com.8080.mydomainhttp:2015/somethingelse/path?query=param',
                rawHeaders: [
                    'Origin',
                    'http://www.example.com.8080.mydomainhttp',
                    'Referer',
                    'http://www.example.com.8080.mydomainhttp/something?and=param',
                    'Host',
                    'www.example.com.8080.mydomainhttp:2015',
                ],
                method: 'gEt',
                body: Buffer.from('http://www.example.com.8080.mydomainhttp:2015/ something in the body'),
            })
        )
    ).toEqual({
        url: 'http://www.example.com:8080/somethingelse/path?query=param',
        rawHeaders: new RawHeaders(
            'Origin',
            // TODO unsure if port should be added to headers
            'http://www.example.com',
            'Referer',
            // TODO unsure if port should be added to headers
            'http://www.example.com/something?and=param',
            'Host',
            'www.example.com'
        ),
        method: 'GET',
        body: 'http://www.example.com.8080.mydomainhttp:2015/ something in the body',
    });
});

test('removeProxyPort', async () => {
    const mock = new Mock({
        ...stuntmanConfig,
        mock: { ...stuntmanConfig.mock, httpsPort: 1955, httpsCert: '123', httpsKey: '123' },
    });
    const req: Stuntman.Request = {
        id: uuidv4(),
        method: 'GET',
        rawHeaders: new RawHeaders(
            'Origin',
            'http://www.example.com.stuntman',
            'Referer',
            'http://www.example.com.stuntman/something?and=param',
            'Host',
            'www.example.com.stuntman:2015'
        ),
        timestamp: Date.now(),
        url: 'http://www.example.com.stuntman:2015/somethingelse/path?query=param',
    };
    const reqClone: Stuntman.Request = {
        ...JSON.parse(JSON.stringify(req)),
        rawHeaders: new RawHeaders(...req.rawHeaders),
        url: 'http://www.example.com.stuntman/somethingelse/path?query=param',
    };
    reqClone.rawHeaders.set('host', 'www.example.com.stuntman');
    mock['removeProxyPort'](req);
    expect(req).toEqual({ ...reqClone });

    req.rawHeaders.set('host', 'www.example.com.stuntman:1955');
    req.url = 'http://www.example.com.stuntman:1955/somethingelse/path?query=param';
    mock['removeProxyPort'](req);
    expect(req).toEqual({ ...reqClone });

    req.rawHeaders.remove('host');
    req.url = 'http://www.example.com.stuntman:1955/somethingelse/path?query=param';
    mock['removeProxyPort'](req);
    reqClone.rawHeaders.remove('host');
    expect(req).toEqual(reqClone);
});

describe('stop', () => {
    test('not started', async () => {
        const mock = new Mock(stuntmanConfig);
        await expect(async () => mock.stop()).rejects.toThrow();
    });

    test('http', async () => {
        const mock = new Mock(stuntmanConfig);
        const serverClose = jest.fn((cb: any) => cb());
        Reflect.set(mock, 'server', { close: serverClose });
        await mock.stop();
        expect(serverClose).toBeCalled();
    });

    test('http & https', async () => {
        const mock = new Mock(stuntmanConfig);
        const serverClose = jest.fn((cb: any) => cb());
        const serverHttpsClose = jest.fn((cb: any) => cb());
        Reflect.set(mock, 'server', { close: serverClose });
        Reflect.set(mock, 'serverHttps', { close: serverHttpsClose });
        await mock.stop();
        expect(serverClose).toBeCalled();
        expect(serverHttpsClose).toBeCalled();
    });
});

describe('requestHandler', () => {
    test('catch-all', async () => {
        const mock = new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, externalDns: ['1.1.1.1'] } });
        // TODO expect
        mock['requestHandler'](getMockReq({ method: 'GET', url: 'http://www.example.com' }), getMockRes().res);
    });

    test('TODO', async () => {
        const mock = new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, externalDns: ['1.1.1.1'] } });
        Reflect.set(mock, 'proxyRequest', async () => {
            return Promise.resolve({
                timestamp: Date.now(),
                body: Buffer.from('response body'),
                status: 200,
                rawHeaders: new RawHeaders(),
            });
        });
        jest.spyOn(Mock.prototype, 'ruleExecutor', 'get').mockReturnValue({
            findMatchingRule: async (): Promise<Stuntman.LiveRule> =>
                Promise.resolve({
                    id: '1234',
                    priority: 0,
                    counter: 0,
                    createdTimestamp: Date.now(),
                    matches: () => true,
                    ttlSeconds: 60,
                    actions: {
                        proxyPass: true,
                    },
                }),
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            addRule: jest.fn(),
        });
        // TODO expect
        mock['requestHandler'](getMockReq({ method: 'GET', url: 'http://www.fbi.com' }), getMockRes().res);
    });
});

describe('proxyRequest', () => {
    test('TODO', async () => {
        const mock = new Mock(stuntmanConfig);
        const logEntry: Stuntman.WithRequiredProperty<Stuntman.LogEntry, 'modifiedRequest'> = {
            originalRequest: {
                id: '1234',
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://example.com.stuntman',
            },
            modifiedRequest: {
                id: '1234',
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://example.com',
            },
        };
        // TODO expect
        mock['proxyRequest'](getMockReq({ method: 'GET' }), logEntry, {});
    });
});
