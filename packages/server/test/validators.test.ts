import type * as Stuntman from '@stuntman/shared';
import { MAX_RULE_TTL_SECONDS, MIN_RULE_TTL_SECONDS } from '@stuntman/shared';
import { test, describe, expect } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { validateDeserializedRule, validateSerializedRuleProperties } from '../src/api/validators';

const validSerializedRule1: Stuntman.SerializedRule = {
    id: uuidv4(),
    actions: {
        proxyPass: true,
    },
    matches: {
        localFn: '() => true',
        remoteFn: '// TODO',
    },
    ttlSeconds: 600,
    disableAfterUse: false,
};

const getTestValues = (exclude?: {
    _undefined?: boolean;
    _null?: boolean;
    arrayEmpty?: boolean;
    arrayString?: boolean;
    arrayNumber?: boolean;
    objectEmpty?: boolean;
    objectAny?: boolean;
    numeric?: boolean;
    bool?: boolean;
    stringEmpty?: boolean;
    stringWhitespace?: boolean;
    stringAny?: boolean;
}): any[] => {
    const output: any = [];
    if (!exclude?._undefined) {
        output.push(undefined);
    }
    if (!exclude?._null) {
        output.push(null);
    }
    if (!exclude?.arrayEmpty) {
        output.push([]);
    }
    if (!exclude?.arrayString) {
        output.push(['string']);
    }
    if (!exclude?.arrayNumber) {
        output.push([1234, 5678]);
    }
    if (!exclude?.objectEmpty) {
        output.push({});
    }
    if (!exclude?.objectAny) {
        output.push({ some: 'string' });
    }
    if (!exclude?.numeric) {
        output.push(1234);
    }
    if (!exclude?.bool) {
        output.push(true);
    }
    if (!exclude?.stringEmpty) {
        output.push('');
    }
    if (!exclude?.stringWhitespace) {
        output.push('     ');
    }
    if (!exclude?.stringAny) {
        output.push('string');
    }
    return output;
};

describe('validateSerializedRuleProperties', () => {
    test('valid1', async () => {
        validateSerializedRuleProperties(validSerializedRule1);
    });

    describe('invalid', () => {
        test('no rule', async () => {
            // @ts-expect-error invalid rule
            expect(() => validateSerializedRuleProperties()).toThrow();
        });

        test('id', async () => {
            for (const value of getTestValues({ stringAny: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, id: value })).toThrow();
            }
        });

        test('ttlSeconds', async () => {
            for (const value of getTestValues({ numeric: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, ttlSeconds: value })).toThrow();
            }
            expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, ttlSeconds: -1 })).toThrow();
            expect(() =>
                validateSerializedRuleProperties({ ...validSerializedRule1, ttlSeconds: MAX_RULE_TTL_SECONDS + 1 })
            ).toThrow();
            expect(() =>
                validateSerializedRuleProperties({ ...validSerializedRule1, ttlSeconds: MIN_RULE_TTL_SECONDS - 1 })
            ).toThrow();
        });

        test('labels', async () => {
            for (const value of getTestValues({ _undefined: true, arrayEmpty: true, arrayString: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, labels: value })).toThrow();
            }
        });

        test('disableAfterUse', async () => {
            for (const value of getTestValues({ numeric: true, bool: true, _undefined: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, disableAfterUse: value })).toThrow();
            }
            expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, disableAfterUse: -1 })).toThrow();
        });

        test('removeAfterUse', async () => {
            for (const value of getTestValues({ numeric: true, bool: true, _undefined: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, removeAfterUse: value })).toThrow();
            }
            expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, removeAfterUse: -1 })).toThrow();
        });

        test('isEnabled', async () => {
            for (const value of getTestValues({ bool: true, _undefined: true })) {
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, isEnabled: value })).toThrow();
            }
        });

        test('storeTraffic', async () => {
            for (const value of getTestValues({ bool: true, _undefined: true })) {
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, storeTraffic: value })).toThrow();
            }
        });

        test('priority', async () => {
            for (const value of getTestValues({ numeric: true, _undefined: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, priority: value })).toThrow();
            }
            expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, priority: -1 })).toThrow();
        });

        test('matches', async () => {
            for (const value of getTestValues()) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, matches: value })).toThrow();
            }
            for (const value of getTestValues({ stringAny: true })) {
                expect(() =>
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    validateSerializedRuleProperties({ ...validSerializedRule1, matches: { remoteFn: value } })
                ).toThrow();
            }
        });

        test('actions', async () => {
            for (const value of getTestValues()) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, actions: value })).toThrow();
            }
        });

        test('actions.mockResponse', async () => {
            for (const value of getTestValues({ objectEmpty: true, _undefined: true })) {
                expect(() =>
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { mockResponse: value } })
                ).toThrow();
            }
            expect(() =>
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                validateSerializedRuleProperties({
                    ...validSerializedRule1,
                    actions: { mockResponse: { remoteFn: '() => true', status: 200 } },
                })
            ).toThrow();
            expect(() =>
                validateSerializedRuleProperties({
                    ...validSerializedRule1,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    actions: { mockResponse: { remoteFn: '() => true', rawHeaders: [] } },
                })
            ).toThrow();
            expect(() =>
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                validateSerializedRuleProperties({
                    ...validSerializedRule1,
                    actions: { mockResponse: { remoteFn: '() => true', body: '' } },
                })
            ).toThrow();
        });

        test('actions.mockResponse & actions.modifyResponse', async () => {
            expect(() =>
                validateSerializedRuleProperties({
                    ...validSerializedRule1,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    actions: { mockResponse: { remoteFn: '() => true' }, modifyResponse: { remoteFn: '() => true' } },
                })
            ).toThrow();
        });

        test('actions.mockResponse.remoteFn', async () => {
            for (const value of getTestValues({ stringAny: true })) {
                expect(() =>
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { mockResponse: { remoteFn: value } } })
                ).toThrow();
            }
        });

        test('actions.mockResponse.status', async () => {
            for (const value of getTestValues({ numeric: true })) {
                expect(() =>
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { mockResponse: { status: value } } })
                ).toThrow();
            }
        });

        test('actions.mockResponse.rawHeaders', async () => {
            for (const value of getTestValues({ _undefined: true, arrayEmpty: true })) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() =>
                    validateSerializedRuleProperties({
                        ...validSerializedRule1,
                        actions: { mockResponse: { status: 200, rawHeaders: value } },
                    })
                ).toThrow();
            }
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            expect(() =>
                validateSerializedRuleProperties({
                    ...validSerializedRule1,
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    actions: { mockResponse: { status: 200, rawHeaders: [1234, 5678] } },
                })
            ).toThrow();
        });

        test('actions.mockResponse.body', async () => {
            for (const value of getTestValues({ _undefined: true, stringAny: true, stringEmpty: true, stringWhitespace: true })) {
                expect(() =>
                    validateSerializedRuleProperties({
                        ...validSerializedRule1,
                        actions: { mockResponse: { status: 200, body: value } },
                    })
                ).toThrow();
            }
        });

        test('actions.modifyRequest.remoteFn', async () => {
            for (const value of getTestValues({ stringAny: true })) {
                expect(() =>
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { modifyRequest: { remoteFn: value } } })
                ).toThrow();
            }
        });

        test('actions.modifyResponse.remoteFn', async () => {
            for (const value of getTestValues({ stringAny: true })) {
                expect(() =>
                    validateSerializedRuleProperties({
                        ...validSerializedRule1,
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        actions: { modifyResponse: { remoteFn: value } },
                    })
                ).toThrow();
            }
        });
    });
});

describe('validateDeserializedRule', () => {
    const validRule: Stuntman.Rule = {
        id: uuidv4(),
        actions: { proxyPass: true },
        matches: () => true,
        ttlSeconds: 600,
    };

    test('valid', async () => {
        expect(validateDeserializedRule(validRule)).toBeUndefined();
        expect(validateDeserializedRule({ ...validRule, matches: () => false })).toBeUndefined();
        expect(validateDeserializedRule({ ...validRule, matches: () => ({ result: true }) })).toBeUndefined();
        expect(validateDeserializedRule({ ...validRule, matches: () => ({ result: false }) })).toBeUndefined();
    });

    test('invalid', async () => {
        // @ts-expect-error invalid return value
        expect(() => validateDeserializedRule({ ...validRule, matches: () => null })).toThrow();
        // @ts-expect-error invalid return value
        expect(() => validateDeserializedRule({ ...validRule, matches: () => ({ result: null }) })).toThrow();
        expect(() =>
            validateDeserializedRule({
                ...validRule,
                matches: () => {
                    throw new Error('error');
                },
            })
        ).toThrow();
    });
});
