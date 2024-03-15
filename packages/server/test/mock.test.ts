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
express.raw = jest.fn();
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
        values.params ??= Array.from(url.searchParams.entries()).reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, string>);
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
        expect(
            () => new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, httpsPort: 443, httpsCert: '123' } })
        ).toThrow();
        expect(
            () => new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, httpsPort: 443, httpsKey: '123' } })
        ).toThrow();
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
        const mock = new Mock({ ...stuntmanConfig, api: { disabled: true } });
        mock.start();
        expect(mock['mockApp']?.listen).toBeCalled();
        expect(https.createServer).not.toBeCalled();
        expect(() => mock.start()).toThrow();
    });

    test('http & https', async () => {
        const mock = new Mock({
            ...stuntmanConfig,
            mock: { ...stuntmanConfig.mock, httpsPort: 443, httpsCert: '123', httpsKey: '123' },
            api: { disabled: true },
        });
        mock.start();
        expect(mock['mockApp']?.listen).toBeCalled();
        expect(https.createServer).toBeCalled();
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
    const mock = new Mock({ ...stuntmanConfig, mock: { ...stuntmanConfig.mock, domain: 'mydomain', port: 2015 } });
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
        mock: { ...stuntmanConfig.mock, port: 2015, httpsPort: 1955, httpsCert: '123', httpsKey: '123' },
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
