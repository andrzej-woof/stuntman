import { describe, expect, test } from '@jest/globals';
import type * as Stuntman from '@stuntman/shared';
import { RawHeaders } from '@stuntman/shared';
import { v4 as uuidv4 } from 'uuid';
import { deserializeRule, escapedSerialize, liveRuleToRule } from '../src/api/utils';

const remoteFnMatches = `return ((____arg0) => {
    const req = ____arg0;
    return (() => /^post$/i.test(req.method))(); })(____arg0)`;

const remoteFnMockResponse = `return ((____arg0) => {
    const req = ____arg0;
    return (() => ({ status: 403, body: 'mocked' }))(); })(____arg0)`;

const remoteFnModifyRequest = `return ((____arg0) => {
    const req = ____arg0;
    return (() => ({ ...req, url: 'http://modified/' }))(); })(____arg0)`;

const remoteFnModifyResponse = `return ((____arg0, ____arg1) => {
    const req = ____arg0;
    const res = ____arg1;
    return (() => ({ ...res, body: 'modified' }))(); })(____arg0, ____arg1)`;

const serializedRule = {
    id: uuidv4(),
    actions: {
        mockResponse: { status: 200 },
    },
    matches: {
        localFn: '(req) => /^post$/i.test(req.method)',
        localVariables: '{}',
        remoteFn: remoteFnMatches,
    },
    ttlSeconds: 10,
    storeTraffic: true,
};

const request: Stuntman.Request = {
    id: uuidv4(),
    method: 'POST',
    rawHeaders: new RawHeaders(),
    timestamp: Date.now(),
    url: 'http://someurl.invalid',
};

describe('deserializeRule', () => {
    // test('calls validateSerializedRuleProperties', async () => {
    //     const validateSerializedRulePropertiesSpy = jest
    //         .spyOn(validators, 'validateSerializedRuleProperties')
    //         .mockImplementationOnce(() => undefined);
    //     deserializeRule(serializedRule);
    //     expect(validateSerializedRulePropertiesSpy).toHaveBeenCalledWith(serializedRule);
    //     validateSerializedRulePropertiesSpy.mockRestore();
    // });

    test('default', async () => {
        const deserializedRule = deserializeRule(serializedRule);
        expect(deserializedRule).toEqual({
            ...serializedRule,
            matches: expect.any(Function),
        });
    });

    test('matches', async () => {
        const deserializedRule = deserializeRule(serializedRule);
        expect(deserializedRule).toEqual({
            ...serializedRule,
            matches: expect.any(Function),
        });
        expect(deserializedRule.matches(request)).toBe(true);
        expect(
            deserializedRule.matches({
                ...request,
                method: 'GET',
            })
        ).toBe(false);
    });

    test('disableAfterUse', async () => {
        deserializeRule(serializedRule);
        expect(
            deserializeRule({
                ...serializedRule,
                disableAfterUse: true,
            })
        ).toEqual({
            ...serializedRule,
            disableAfterUse: true,
            matches: expect.any(Function),
        });

        expect(
            deserializeRule({
                ...serializedRule,
                disableAfterUse: false,
            })
        ).toEqual({
            ...serializedRule,
            disableAfterUse: false,
            matches: expect.any(Function),
        });

        expect(
            deserializeRule({
                ...serializedRule,
                disableAfterUse: 21,
            })
        ).toEqual({
            ...serializedRule,
            disableAfterUse: 21,
            matches: expect.any(Function),
        });
    });

    test('removeAfterUse', async () => {
        expect(
            deserializeRule({
                ...serializedRule,
                removeAfterUse: true,
            })
        ).toEqual({
            ...serializedRule,
            removeAfterUse: true,
            matches: expect.any(Function),
        });

        expect(
            deserializeRule({
                ...serializedRule,
                removeAfterUse: false,
            })
        ).toEqual({
            ...serializedRule,
            removeAfterUse: false,
            matches: expect.any(Function),
        });

        expect(
            deserializeRule({
                ...serializedRule,
                removeAfterUse: 42,
            })
        ).toEqual({
            ...serializedRule,
            removeAfterUse: 42,
            matches: expect.any(Function),
        });
    });

    test('labels', async () => {
        expect(
            deserializeRule({
                ...serializedRule,
                labels: ['test', 'test2'],
            })
        ).toEqual({
            ...serializedRule,
            labels: ['test', 'test2'],
            matches: expect.any(Function),
        });
    });

    test('priority', async () => {
        expect(
            deserializeRule({
                ...serializedRule,
                priority: 16,
            })
        ).toEqual({
            ...serializedRule,
            priority: 16,
            matches: expect.any(Function),
        });
    });

    test('isEnabled', async () => {
        expect(
            deserializeRule({
                ...serializedRule,
                isEnabled: true,
            })
        ).toEqual({
            ...serializedRule,
            isEnabled: true,
            matches: expect.any(Function),
        });

        expect(
            deserializeRule({
                ...serializedRule,
                isEnabled: false,
            })
        ).toEqual({
            ...serializedRule,
            isEnabled: false,
            matches: expect.any(Function),
        });
    });

    test('storeTraffic', async () => {
        expect(
            deserializeRule({
                ...serializedRule,
                storeTraffic: true,
            })
        ).toEqual({
            ...serializedRule,
            storeTraffic: true,
            matches: expect.any(Function),
        });

        expect(
            deserializeRule({
                ...serializedRule,
                storeTraffic: false,
            })
        ).toEqual({
            ...serializedRule,
            storeTraffic: false,
            matches: expect.any(Function),
        });
    });

    describe('actions', () => {
        test('mockResponse', async () => {
            expect(
                deserializeRule({
                    ...serializedRule,
                    actions: { mockResponse: { status: 404 } },
                })
            ).toEqual({
                ...serializedRule,
                actions: { mockResponse: { status: 404 } },
                matches: expect.any(Function),
            });

            const deserializedRule = deserializeRule({
                ...serializedRule,
                actions: { mockResponse: { remoteFn: remoteFnMockResponse, localFn: '' } },
            });
            expect(deserializedRule).toEqual({
                ...serializedRule,
                actions: { mockResponse: expect.any(Function) },
                matches: expect.any(Function),
            });
            expect((deserializedRule.actions.mockResponse as Stuntman.ResponseGenerationFn)(request)).toEqual({
                status: 403,
                body: 'mocked',
            });
        });

        test('modifyRequest', async () => {
            const deserializedRule = deserializeRule({
                ...serializedRule,
                actions: { modifyRequest: { remoteFn: remoteFnModifyRequest, localFn: '' } },
            });
            expect(deserializedRule).toEqual({
                ...serializedRule,
                actions: { modifyRequest: expect.any(Function) },
                matches: expect.any(Function),
            });
            expect((deserializedRule.actions.modifyRequest as Stuntman.RequestManipulationFn)(request)).toEqual({
                ...request,
                url: 'http://modified/',
            });
        });

        test('modifyResponse', async () => {
            const deserializedRule = deserializeRule({
                ...serializedRule,
                actions: { modifyResponse: { remoteFn: remoteFnModifyResponse, localFn: '' } },
            });
            expect(deserializedRule).toEqual({
                ...serializedRule,
                actions: { modifyResponse: expect.any(Function) },
                matches: expect.any(Function),
            });
            expect(
                (deserializedRule.actions.modifyResponse as Stuntman.ResponseManipulationFn)(request, {
                    body: 'something',
                    status: 201,
                    rawHeaders: new RawHeaders(),
                    timestamp: 1678109392555,
                })
            ).toEqual({ status: 201, body: 'modified', rawHeaders: new RawHeaders(), timestamp: 1678109392555 });
        });
    });
});

test('liveRuleToRule', () => {
    const rule: Required<Stuntman.Rule> = {
        actions: { proxyPass: true },
        id: '1234',
        matches: () => true,
        ttlSeconds: 600,
        disableAfterUse: false,
        isEnabled: false,
        labels: ['dasd', 'dasd'],
        priority: 100,
        removeAfterUse: false,
        storeTraffic: false,
    };
    const liveRule: Required<Stuntman.LiveRule> = {
        ...rule,
        createdTimestamp: Date.now(),
        counter: 20,
    };
    expect(liveRuleToRule(liveRule)).toEqual(rule);
});

test('escapedSerialize', async () => {
    expect(
        escapedSerialize({
            func: () => true,
            regex: /test/i,
            str: 'dsad\n',
            arr: ['dsad', 213],
            obj: { something: '\\test\\\ntest\n\n\\ntest' },
        })
    ).toEqual(
        '{"func":() => true,"regex":new RegExp("test", "i"),"str":"dsad\\\\n","arr":["dsad",213],"obj":{"something":"\\\\\\\\test\\\\\\\\\\\\ntest\\\\n\\\\n\\\\\\\\ntest"}}'
    );
});
