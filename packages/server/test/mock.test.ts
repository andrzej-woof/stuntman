import type * as Stuntman from '@stuntman/shared';
import { v4 as uuidv4 } from 'uuid';
import { getMockReq as _getMockReq } from '@jest-mock/express';
import { test, expect, describe, jest } from '@jest/globals';
import { Mock } from '../src/mock';
import { stuntmanConfig } from '@stuntman/shared';
import { RawHeaders } from '@stuntman/shared';
import { MockRequest } from '@jest-mock/express/dist/src/request';

const getMockReq = (input: MockRequest) => {
    const values: MockRequest = {
        ...input,
    };
    if (input.url) {
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
    if (input.rawHeaders) {
        values.headers = RawHeaders.toHeadersRecord(input.rawHeaders);
        values.rawHeaders = new RawHeaders(...input.rawHeaders);
    }
    return _getMockReq(values);
};

test('TODO', async () => {
    const mock = new Mock(stuntmanConfig);
    expect(mock).toHaveProperty('start');
});

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

    // TODO protocol, port
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
});

test('stop', async () => {
    const mock = new Mock(stuntmanConfig);
    expect(() => mock.stop()).toThrow();
    Reflect.set(mock, 'server', { close: jest.fn() });
    mock.stop();
    expect(mock['server']?.close).toBeCalled();
});
