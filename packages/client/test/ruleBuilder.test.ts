import { describe, test, expect } from '@jest/globals';
import type * as Stuntman from '@stuntman/shared';
import { RawHeaders, naiveGQLParser } from '@stuntman/shared';
import { ruleBuilder } from '../src/ruleBuilder';
import serializeJavascript from 'serialize-javascript';

const callRemotableFunction = (
    // eslint-disable-next-line @typescript-eslint/ban-types
    fn: Stuntman.RemotableFunction<Function>,
    request: Stuntman.Request,
    response?: Stuntman.Response,
    serialized?: boolean
) => {
    if (!serialized) {
        return fn.localFn.bind(fn.localVariables)(request, response, fn.localVariables);
    }
    const stringifiedVars = Object.entries(fn.localVariables || {}).map(([key, value]) => [key, serializeJavascript(value)]);
    const newFn = new Function(
        'request',
        'response',
        stringifiedVars.map(([key, value]) => `const ${key} = eval(${value});`).join('\n') +
            '\nconst sourceFunction = ' +
            fn.localFn.toString() +
            ';\nreturn sourceFunction(request, response);'
    );
    return newFn.call(null, request, response);
};

const matchingRequestBody = {
    root: {
        child: {
            property: 'value',
        },
        child2: {
            array: ['value1', 'value2', 'value3'],
        },
        child3: undefined,
        child4: null,
        child5: {
            prop1: 123,
            prop2: true,
            prop3: false,
            prop5: null,
            prop6: '123',
        },
        child6: {
            prop1: '123',
            prop2: false,
            prop3: true,
            prop5: 0,
            prop6: 123,
        },
    },
};

const matchingRequest: Stuntman.Request = {
    id: 'test-1234',
    method: 'GET',
    rawHeaders: new RawHeaders('content-type', 'application/json', 'host', 'www.some.server.example.com', 'x-something', 'val'),
    timestamp: Date.now(),
    url: 'http://www.some.server.example.com/somepath?param1=valueone&param2=value2',
    body: JSON.stringify(matchingRequestBody),
};

const receivedResponse: Stuntman.Response = {
    status: 404,
    rawHeaders: new RawHeaders('content-type', 'application/json', 'x-test-header', 'somevalue'),
    body: JSON.stringify({
        data: {
            response: { something: ['message', 'another'] },
        },
    }),
};

test('falsey path', async () => {
    const builder = ruleBuilder().onAnyRequest();
    (builder['rule'].matches.localVariables as any).matchBuilderVariables.bodyJson = [{ key: 'groot.' }];
    expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: '{ "groot": null }' })).toEqual({
        description: '$.groot. != "undefined"',
        result: false,
    });
});

test('wrong matcher', async () => {
    const builder = ruleBuilder().onAnyRequest();
    (builder['rule'].matches.localVariables as any).matchBuilderVariables.filter = { some: 'object' };
    expect(() => callRemotableFunction(builder['rule'].matches, matchingRequest)).toThrow();
    (builder['rule'].matches.localVariables as any).matchBuilderVariables.filter = 1234;
    expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
        description: "url http://www.some.server.example.com/somepath?param1=valueone&param2=value2 doesn't match 1234",
        result: false,
    });
});

describe('rule.matches', () => {
    test('default matchBuilderVariables', () => {
        const builder = ruleBuilder();
        expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({});
    });

    describe('onRequestToHostname', () => {
        test('exact', () => {
            const hostname = new URL(matchingRequest.url).hostname;
            const builder = ruleBuilder().onRequestToHostname(hostname);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ hostname });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/^http:\/\//, 'http://a'),
                })
            ).toEqual({
                description: "hostname awww.some.server.example.com doesn't match www.some.server.example.com",
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/\.com\//, '.coma/'),
                })
            ).toEqual({
                description: "hostname www.some.server.example.coma doesn't match www.some.server.example.com",
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/www\./, ''),
                })
            ).toEqual({
                description: "hostname some.server.example.com doesn't match www.some.server.example.com",
                result: false,
            });
        });

        test('regex', () => {
            const builder = ruleBuilder().onRequestToHostname(/.*\.server\.example\.com$/);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({
                hostname: /.*\.server\.example\.com$/,
            });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/www\./, ''),
                })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/^http:\/\//, 'http://a'),
                })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/\.com\//, '.coma/'),
                })
            ).toEqual({
                description: "hostname www.some.server.example.coma doesn't match /.*\\.server\\.example\\.com$/",
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace(/server\./, ''),
                })
            ).toEqual({
                description: "hostname www.some.example.com doesn't match /.*\\.server\\.example\\.com$/",
                result: false,
            });
        });
    });

    test('onAnyRequest', () => {
        const builder = ruleBuilder().onAnyRequest();
        expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({});
        expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({ description: 'match', result: true });
    });

    test('onAnyRequest - serialized function call', () => {
        const builder = ruleBuilder().onAnyRequest();
        expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({});
        expect(callRemotableFunction(builder['rule'].matches, matchingRequest, undefined, true)).toEqual({
            description: 'match',
            result: true,
        });
    });

    describe('onRequestTo', () => {
        test('exact', () => {
            const builder = ruleBuilder().onRequestTo(matchingRequest.url);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ filter: matchingRequest.url });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, { ...matchingRequest, url: `${matchingRequest.url}a` })
            ).toEqual({
                description:
                    "url http://www.some.server.example.com/somepath?param1=valueone&param2=value2a doesn't match http://www.some.server.example.com/somepath?param1=valueone&param2=value2",
                result: false,
            });
        });

        test('regex', () => {
            const builder = ruleBuilder().onRequestTo(/param1=valueone/i);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ filter: /param1=valueone/i });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, { ...matchingRequest, url: `${matchingRequest.url}a` })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('valueone', 'valueOneTwo'),
                })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('valueone', 'valuetwo'),
                })
            ).toEqual({
                description:
                    "url http://www.some.server.example.com/somepath?param1=valuetwo&param2=value2 doesn't match /param1=valueone/i",
                result: false,
            });
        });
    });

    describe('onRequestToPathname', () => {
        test('exact', () => {
            const pathname = new URL(matchingRequest.url).pathname;
            const builder = ruleBuilder().onRequestToPathname(pathname);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ pathname });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('example', 'another'),
                })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('somepath', 'somepath2'),
                })
            ).toEqual({ description: "pathname /somepath2 doesn't match /somepath", result: false });
        });

        test('regex', () => {
            const builder = ruleBuilder().onRequestToPathname(/^\/somepath.*/);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ pathname: /^\/somepath.*/ });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('example', 'another'),
                })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('somepath', 'somepath2'),
                })
            ).toEqual({ description: 'match', result: true });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('/somepath', '/test/somepath'),
                })
            ).toEqual({ description: "pathname /test/somepath doesn't match /^\\/somepath.*/", result: false });
        });
    });

    describe('onRequestToPort', () => {
        test('exact', () => {
            let builder = ruleBuilder().onRequestToPort(80);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ port: 80 });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('http://', 'https://'),
                })
            ).toEqual({ description: "port 443 doesn't match 80", result: false });

            builder = ruleBuilder().onRequestToPort(443);
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: matchingRequest.url.replace('http://', 'https://'),
                })
            ).toEqual({ description: 'match', result: true });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: "port 80 doesn't match 443",
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: 'https://www.example.com:2015/test?something',
                })
            ).toEqual({ description: "port 2015 doesn't match 443", result: false });

            builder = ruleBuilder().onRequestToPort('80');
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
        });

        test('regex', () => {
            const builder = ruleBuilder().onRequestToPort(/.*80$/);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ port: /.*80$/ });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: 'http://something.example.com:8080/test',
                })
            ).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    url: 'http://something.example.com:8090/test',
                })
            ).toEqual({
                description: "port 8090 doesn't match /.*80$/",
                result: false,
            });
        });
    });
});

describe('rule properties', () => {
    test('customId', () => {
        const builder = ruleBuilder();
        expect(builder['rule'].id).toMatch(/^[0-9a-f]{8}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{4}\b-[0-9a-f]{12}$/i);
        builder.customId('my-id');
        expect(builder['rule'].id).toEqual('my-id');
    });

    test('customTtl', () => {
        const builder = ruleBuilder();
        expect(builder['rule'].ttlSeconds).toEqual(600);
        builder.customTtl(100);
        expect(builder['rule'].ttlSeconds).toEqual(100);
        expect(() => builder.customTtl(9)).toThrow();
        expect(() => builder.customTtl(3601)).toThrow();
        // @ts-expect-error invalid type
        expect(() => builder.customTtl('232')).toThrow();
    });

    test('decreasePriority', () => {
        let builder = ruleBuilder();
        expect(builder['rule'].priority).toEqual(100);
        builder.decreasePriority();
        expect(builder['rule'].priority).toEqual(101);
        expect(() => builder.decreasePriority()).toThrow();

        builder = ruleBuilder();
        expect(builder['rule'].priority).toEqual(100);
        builder.decreasePriority(99);
        expect(builder['rule'].priority).toEqual(199);
    });

    test('increasePriority', () => {
        let builder = ruleBuilder();
        expect(builder['rule'].priority).toEqual(100);
        builder.raisePriority();
        expect(builder['rule'].priority).toEqual(99);
        expect(() => builder.raisePriority()).toThrow();

        builder = ruleBuilder();
        expect(builder['rule'].priority).toEqual(100);
        builder.raisePriority(99);
        expect(builder['rule'].priority).toEqual(1);

        builder = ruleBuilder();
        expect(builder['rule'].priority).toEqual(100);
        expect(() => builder.raisePriority(100)).toThrow();
    });

    test('disabled', () => {
        const builder = ruleBuilder();
        expect(builder['rule'].isEnabled).toBeUndefined();
        builder.disabled();
        expect(builder['rule'].isEnabled).toEqual(false);
    });

    test('limtedUse', () => {
        let builder = ruleBuilder();
        expect(builder['rule'].removeAfterUse).toBeUndefined();

        expect(() => builder.limitedUse(0)).toThrow();
        expect(() => builder.limitedUse(1.5)).toThrow();
        expect(builder['rule'].removeAfterUse).toBeUndefined();

        builder.limitedUse(9);
        expect(builder['rule'].removeAfterUse).toEqual(9);
        expect(() => builder.limitedUse(9)).toThrow();

        builder = ruleBuilder();
        expect(builder['rule'].removeAfterUse).toBeUndefined();
        builder.singleUse();
        expect(builder['rule'].removeAfterUse).toEqual(1);
        expect(() => builder.singleUse()).toThrow();
    });

    test('storeTraffic', () => {
        const builder = ruleBuilder();
        expect(builder['rule'].storeTraffic).toBeUndefined();
        builder.storeTraffic();
        expect(builder['rule'].storeTraffic).toBe(true);
    });
});

describe('rule initialized', () => {
    describe('mockResponse', () => {
        test('static', () => {
            const builder = ruleBuilder().onAnyRequest();
            expect(builder['rule'].actions).toEqual({ mockResponse: { status: 200 } });
            builder.mockResponse({});
        });

        test('dynamic', () => {
            const builder = ruleBuilder().onAnyRequest();
            builder.mockResponse((request: Stuntman.Request): Stuntman.Response => {
                return {
                    status: 201,
                    body: request,
                };
            });
            expect(builder['rule'].actions.mockResponse).toHaveProperty('localFn');
            expect(builder['rule'].actions.mockResponse).toHaveProperty('localVariables');
            expect(
                callRemotableFunction(
                    builder['rule'].actions.mockResponse as Stuntman.RemotableFunction<Stuntman.ResponseGenerationFn>,
                    matchingRequest
                )
            ).toEqual({ status: 201, body: matchingRequest });
        });

        test('invalid', async () => {
            const builder = ruleBuilder().onAnyRequest();
            expect(() =>
                builder.mockResponse(
                    {
                        // @ts-expect-error invalid args
                        status: 201,
                    },
                    { var: 'value' }
                )
            ).toThrow();
        });
    });

    test('modifyRequest', () => {
        const builder = ruleBuilder().onAnyRequest();
        builder.modifyRequest((request: Stuntman.Request): Stuntman.Request => {
            return {
                ...request,
                body: request,
            };
        });
        expect(builder['rule'].actions.modifyRequest).toHaveProperty('localFn');
        expect(builder['rule'].actions.modifyRequest).toHaveProperty('localVariables');
        expect(
            callRemotableFunction(
                builder['rule'].actions.modifyRequest as Stuntman.RemotableFunction<Stuntman.RequestManipulationFn>,
                matchingRequest
            )
        ).toEqual({ ...matchingRequest, body: matchingRequest });

        builder.modifyRequest({
            localFn: (request: Stuntman.Request): Stuntman.Request => {
                return {
                    ...request,
                    body: request,
                };
            },
            localVariables: { var: 'any' },
        });
        expect(builder['rule'].actions.modifyRequest?.localVariables).toEqual({ var: 'any' });

        expect(() =>
            builder.modifyRequest(
                {
                    localFn: (request: Stuntman.Request): Stuntman.Request => ({
                        ...request,
                        body: request,
                    }),
                },
                { var: 'any' }
            )
        ).toThrow();
    });

    test('modifyResponse', () => {
        let builder = ruleBuilder().onAnyRequest();
        builder.modifyResponse((request: Stuntman.Request, response: Stuntman.Response): Stuntman.Response => {
            return {
                ...response,
                body: {
                    request,
                    response,
                },
            };
        });
        expect(builder['rule'].actions.modifyResponse).toHaveProperty('localFn');
        expect(builder['rule'].actions.modifyResponse).toHaveProperty('localVariables');
        expect(
            callRemotableFunction(
                builder['rule'].actions.modifyResponse as Stuntman.RemotableFunction<Stuntman.ResponseManipulationFn>,
                matchingRequest,
                receivedResponse
            )
        ).toEqual({ ...receivedResponse, body: { request: matchingRequest, response: receivedResponse } });

        builder.modifyResponse({
            localFn: (request: Stuntman.Request, response: Stuntman.Response): Stuntman.Response => ({
                ...response,
                body: {
                    request,
                    response,
                },
            }),
            localVariables: { var: 'any' },
        });
        expect(builder['rule'].actions.modifyResponse?.localVariables).toEqual({ var: 'any' });

        expect(() =>
            builder.modifyResponse(
                {
                    localFn: (request: Stuntman.Request, response: Stuntman.Response): Stuntman.Response => ({
                        ...response,
                        body: {
                            request,
                            response,
                        },
                    }),
                },
                { var: 'any' }
            )
        ).toThrow();

        builder = ruleBuilder().onAnyRequest();
        builder.modifyRequest((req) => req);
        // @ts-expect-error empty actions
        builder['rule'].actions = undefined;
        builder.modifyResponse((req) => req);
    });

    test('proxyPass', () => {
        const builder = ruleBuilder().onAnyRequest();
        builder.proxyPass();
        expect(builder['rule'].actions).toEqual({ proxyPass: true });
    });

    describe('with', () => {
        test('hostname', () => {
            let builder = ruleBuilder().onAnyRequest();
            builder.withHostname('something.example.com');
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ hostname: 'something.example.com' });

            builder = ruleBuilder().onRequestToHostname('www.something.com');
            expect(() => builder.withHostname('www.example.com')).toThrow();
        });

        test('pathname', () => {
            let builder = ruleBuilder().onAnyRequest();
            builder.withPathname('/test/something');
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ pathname: '/test/something' });

            builder = ruleBuilder().onRequestToPathname('/anything');
            expect(() => builder.withPathname('/otherpath')).toThrow();
        });

        test('port', () => {
            const builder = ruleBuilder().onAnyRequest();
            builder.withPort(8090);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ port: 8090 });
            expect(() => builder.withPort(80)).toThrow();
        });

        test('header', () => {
            let builder = ruleBuilder().onAnyRequest();
            builder.withHeader('x-something');
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ headers: ['x-something'] });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders('x-somethingelse', 'x-something'),
                })
            ).toEqual({
                description: 'headers.has("x-something")',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withHeader('x-something', 'val');
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders('x-somethingelse', 'x-something'),
                })
            ).toEqual({
                description: 'headers.has("x-something")',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withHeader('x-something', 'val');
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders('x-something', 'val1'),
                })
            ).toEqual({
                description: 'headerMatcher.get("x-something") = "val"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withHeader(/x-some.*/);
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders('x-som', 'val1'),
                })
            ).toEqual({
                description: 'headers.keys matches /x-some.*/',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withHeader('x-something', /va.*/);
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders('x-something', 'v'),
                })
            ).toEqual({
                description: 'headerMatcher.get("x-something") = "/va.*/"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder
                .withHeader('x-something1')
                .withHeader(/x-something2/)
                .withHeader('x-something3', 'x-value')
                .withHeader('x-something4', /x-value/);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({
                headers: [
                    'x-something1',
                    /x-something2/,
                    { key: 'x-something3', value: 'x-value' },
                    { key: 'x-something4', value: /x-value/ },
                ],
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders(
                        'x-something1',
                        'value1',
                        'x-something2',
                        'value2',
                        'x-something3',
                        'x-value',
                        'x-something4',
                        'x-value4'
                    ),
                })
            ).toEqual({
                description: 'match',
                result: true,
            });
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({
                headers: [
                    'x-something1',
                    /x-something2/,
                    { key: 'x-something3', value: 'x-value' },
                    { key: 'x-something4', value: /x-value/ },
                ],
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    rawHeaders: new RawHeaders(
                        'x-something1',
                        'value1',
                        'x-something2',
                        'value2',
                        'x-something3',
                        'x-value',
                        'x-something4',
                        'x-val'
                    ),
                })
            ).toEqual({
                description: 'headerMatcher.get("x-something4") = "/x-value/"',
                result: false,
            });
            expect(() => builder.withHeader('')).toThrow();
            // @ts-expect-error unsupported params
            expect(() => builder.withHeader(/test/, /test/)).toThrow();
        });

        test('headers', () => {
            const builder = ruleBuilder().onAnyRequest();
            builder.withHeaders(
                'x-something1',
                /x-something2/,
                { key: 'x-something3' },
                { key: 'x-something4', value: 'x-value' },
                { key: 'x-something5', value: /x-value/ }
            );
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({
                headers: [
                    'x-something1',
                    /x-something2/,
                    'x-something3',
                    { key: 'x-something4', value: 'x-value' },
                    { key: 'x-something5', value: /x-value/ },
                ],
            });
        });

        test('searchparam', () => {
            let builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam('param1');
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam(/PaRam/i);
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam('param1', 'valueone');
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam('param1', /ValUEone/i);
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam('param10');
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'searchParams.has("param10")',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam('param10', /.*/i);
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'searchParams.has("param10")',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam(/param[^0-9]+/);
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'searchParams.keys() matches /param[^0-9]+/',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withSearchParam('param100', 'something');
            expect(
                callRemotableFunction(builder['rule'].matches, { ...matchingRequest, url: `${matchingRequest.url}&param100` })
            ).toEqual({
                description: 'searchParams.get("param100") = "something"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            // @ts-expect-error invalid args
            expect(() => builder.withSearchParam()).toThrow();
            // @ts-expect-error invalid args
            expect(() => builder.withSearchParam(/test/, /test/)).toThrow();
        });

        test('searchparams', () => {
            const builder = ruleBuilder().onAnyRequest();
            builder.withSearchParams([
                'param1',
                /ParAm/i,
                { key: 'param1' },
                { key: 'param1', value: 'valueone' },
                { key: 'param1', value: /vAlue/i },
            ]);
            expect(builder['rule'].matches.localVariables).toEqual({
                matchBuilderVariables: {
                    searchParams: [
                        'param1',
                        /ParAm/i,
                        'param1',
                        {
                            key: 'param1',
                            value: 'valueone',
                        },
                        {
                            key: 'param1',
                            value: /vAlue/i,
                        },
                    ],
                },
            });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
        });

        test('without body', () => {
            let builder = ruleBuilder().onAnyRequest();
            builder.withoutBody();
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ bodyText: null });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: undefined })).toEqual({
                description: 'match',
                result: true,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: '' })).toEqual({
                description: 'match',
                result: true,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: ' ' })).toEqual({
                description: 'empty body',
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'empty body',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyText('1234');
            expect(() => builder.withoutBody()).toThrow();
        });

        test('body text', () => {
            let builder = ruleBuilder().onAnyRequest();
            builder.withBodyText('"value1","value2"');
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ bodyText: '"value1","value2"' });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: undefined })).toEqual({
                description: 'empty body',
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: '' })).toEqual({
                description: 'empty body',
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: ' ' })).toEqual({
                description: 'body text doesn\'t include ""value1","value2""',
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: '"value1","value2' })).toEqual({
                description: 'body text doesn\'t include ""value1","value2""',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyText(/VaLue1/i);
            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({ bodyText: /VaLue1/i });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: undefined })).toEqual({
                description: 'empty body',
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: '' })).toEqual({
                description: 'empty body',
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: ' ' })).toEqual({
                description: "body text doesn't match /VaLue1/i",
                result: false,
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...matchingRequest, body: '"valuea1","value2' })).toEqual({
                description: "body text doesn't match /VaLue1/i",
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyText('1234');
            expect(() => builder.withBodyText('5678')).toThrow();

            builder = ruleBuilder().onAnyRequest();
            builder.withoutBody();
            expect(() => builder.withBodyText('5678')).toThrow();
        });

        test('body json', () => {
            const builder = ruleBuilder().onAnyRequest();
            builder
                .withBodyJson('root.child4')
                .withBodyJson('root.child.property', 'value')
                .withBodyJson('root.child2.array.[1]', 'value2')
                .withBodyJson('root.child2.array.[]', 'value3')
                .withBodyJson('root.child2.array.[]', /^[^t]+/i)
                .withBodyJson({ key: 'root.child5.prop1', value: 123 })
                .withBodyJson('root.child5.prop2', true)
                .withBodyJson('root.child5.prop3', false)
                .withBodyJson('root.child5.prop5', null)
                .withBodyJson('root.child5.prop6', '123');

            expect(builder['rule'].matches.localVariables?.matchBuilderVariables).toEqual({
                bodyJson: [
                    {
                        key: 'root.child4',
                        value: undefined,
                    },
                    {
                        key: 'root.child.property',
                        value: 'value',
                    },
                    {
                        key: 'root.child2.array.[1]',
                        value: 'value2',
                    },
                    {
                        key: 'root.child2.array.[]',
                        value: 'value3',
                    },
                    {
                        key: 'root.child2.array.[]',
                        value: /^[^t]+/i,
                    },
                    {
                        key: 'root.child5.prop1',
                        value: 123,
                    },
                    {
                        key: 'root.child5.prop2',
                        value: true,
                    },
                    {
                        key: 'root.child5.prop3',
                        value: false,
                    },
                    {
                        key: 'root.child5.prop5',
                        value: null,
                    },
                    {
                        key: 'root.child5.prop6',
                        value: '123',
                    },
                ],
            });
            expect(callRemotableFunction(builder['rule'].matches, matchingRequest)).toEqual({
                description: 'match',
                result: true,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: undefined,
                })
            ).toEqual({
                description: 'unparseable json',
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: '',
                })
            ).toEqual({
                description: 'unparseable json',
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: '{}',
                })
            ).toEqual({
                description: '$.root.child4 != "undefined"',
                result: false,
            });
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: '[]',
                })
            ).toEqual({
                description: '$.root.child4 != "undefined"',
                result: false,
            });

            let modifiedBody: any = JSON.parse(matchingRequest.body);
            modifiedBody.root = {};
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child4 != "undefined"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child.property = 'value2';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child.property != "value"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child = 'test';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child.property != "value"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child.property = 'value2';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child.property != "value"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child2.array[1] = 'value22';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child2.array.[1] != "value2"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child2.array = [];
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child2.array.[1] != "value2"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child2.array = { not: 'array' };
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child2.array.[1] != "value2"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child2.array[2] = 'value33';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child2.array.[] != "value3"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child2.array.push('test');
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: 'match',
                result: true,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child5.prop1 = '123';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child5.prop1 != "123"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child5.prop2 = false;
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child5.prop2 != "true"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child5.prop2 = 'true';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child5.prop2 != "true"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child5.prop5 = 'null';
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child5.prop5 != "null"',
                result: false,
            });

            modifiedBody = JSON.parse(matchingRequest.body);
            modifiedBody.root.child5.prop6 = 123;
            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: JSON.stringify(modifiedBody),
                })
            ).toEqual({
                description: '$.root.child5.prop6 != "123"',
                result: false,
            });

            expect(
                callRemotableFunction(builder['rule'].matches, {
                    ...matchingRequest,
                    body: 'null',
                })
            ).toEqual({
                description: 'empty json object',
                result: false,
            });

            expect(() => builder.withBodyJson('dumbkey!')).toThrow();
            // @ts-expect-error invalid arguments
            expect(() => builder.withBodyJson({ key: 'test' }, 'something')).toThrow();
            expect(() => builder.withBodyJson({ key: 'dumbkey!' })).toThrow();
        });

        test('body gql', () => {
            const queryBody = {
                query: 'query myOperation ($someId: String) { author(input: { id: $someId }) { id name } }',
                operationName: 'myOperation',
                variables: { $someId: '666777test' },
            };
            const gqlRequest: Stuntman.Request = {
                id: '12345',
                method: 'post',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://test.invalid/graphql',
                body: JSON.stringify(queryBody),
            };
            gqlRequest.gqlBody = naiveGQLParser(gqlRequest.body);

            let builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                operationName: 'myOperation',
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'match',
                result: true,
            });

            expect(() =>
                builder.withBodyGql({
                    operationName: 'myOperation',
                })
            ).toThrow();

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                operationName: 'myOperation2',
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'operationName "myOperation2" !== "myOperation"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                type: 'query',
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                type: 'mutation',
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'type "mutation" !== "query"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId' }],
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId2' }],
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'GQL variable $someId2 != "undefined". Detail: $someId2=undefined',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId', value: '666777test' }],
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId', value: '666777test2' }],
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'GQL variable $someId != "666777test2". Detail: $someId === "666777test"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId', value: /[0-9]+[A-Z]+/i }],
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'match',
                result: true,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId', value: /test[0-9]+nomatch/i }],
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'GQL variable $someId != "/test[0-9]+nomatch/i". Detail: $someId === "666777test"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                variables: [{ key: '$someId', value: /test[0-9]+nomatch/i }],
            });
            expect(callRemotableFunction(builder['rule'].matches, { ...gqlRequest, gqlBody: undefined })).toEqual({
                description: 'not a gql body',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                methodName: 'something',
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description: 'methodName "something" !== "author"',
                result: false,
            });

            builder = ruleBuilder().onAnyRequest();
            builder.withBodyGql({
                query: 'test',
            });
            expect(callRemotableFunction(builder['rule'].matches, gqlRequest)).toEqual({
                description:
                    'query "test" !== "query myOperation ($someId: String) { author(input: { id: $someId }) { id name } }"',
                result: false,
            });
        });
    });
});
