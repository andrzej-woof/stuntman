import type * as Stuntman from '@stuntman/shared';
import { MAX_RULE_TTL_SECONDS, MIN_RULE_TTL_SECONDS } from '@stuntman/shared';
import { test, describe, expect } from '@jest/globals';
import { v4 as uuid } from 'uuid';
import { validateSerializedRuleProperties } from '../src/api/validators';

const validSerializedRule1: Stuntman.SerializedRule = {
    id: uuid(),
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

const getTestValues = (...exclude: any[]): any[] =>
    [undefined, null, [], ['string'], {}, { some: 'string' }, 1234, true, '', '    ', 'string'].filter((v) => {
        if (!exclude) {
            return true;
        }
        if (exclude?.some((e: any) => typeof e === 'object' && !Array.isArray(e)) && typeof v === 'object' && !Array.isArray(v)) {
            return false;
        }
        return !exclude.includes(v);
    });

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
            for (const value of getTestValues('string')) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, id: value })).toThrow();
            }
        });

        test('ttlSeconds', async () => {
            for (const value of getTestValues(1234)) {
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

        test('disableAfterUse', async () => {
            for (const value of getTestValues(1234, true, undefined)) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, disableAfterUse: value })).toThrow();
            }
            expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, disableAfterUse: -1 })).toThrow();
        });

        test('removeAfterUse', async () => {
            for (const value of getTestValues(1234, true, undefined)) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, removeAfterUse: value })).toThrow();
            }
            expect(() => validateSerializedRuleProperties({ ...validSerializedRule1, removeAfterUse: -1 })).toThrow();
        });

        test('priority', async () => {
            for (const value of getTestValues(1234, undefined)) {
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
            for (const value of getTestValues('string')) {
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
            for (const value of getTestValues(undefined, {})) {
                expect(() =>
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { mockResponse: value } })
                ).toThrow();
            }
        });

        test('actions.mockResponse.remoteFn', async () => {
            for (const value of getTestValues('string')) {
                expect(() =>
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { mockResponse: { remoteFn: value } } })
                ).toThrow();
            }
        });

        test('actions.mockResponse.status', async () => {
            for (const value of getTestValues(1234)) {
                expect(() =>
                    validateSerializedRuleProperties({ ...validSerializedRule1, actions: { mockResponse: { status: value } } })
                ).toThrow();
            }
        });

        test('actions.mockResponse.rawHeaders', async () => {
            for (const value of getTestValues([], undefined)) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                expect(() =>
                    validateSerializedRuleProperties({
                        ...validSerializedRule1,
                        actions: { mockResponse: { rawHeaders: value } },
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
                    actions: { mockResponse: { rawHeaders: [1234, 5678] } },
                })
            ).toThrow();
        });
    });
});
