import type * as Stuntman from '@stuntman/shared';
import { expect, test, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { getRuleExecutor } from '../src/ruleExecutor';
import { DEFAULT_RULE_PRIORITY, RawHeaders } from '@stuntman/shared';
import { describe } from 'node:test';

const makeRule = (rule?: Partial<Stuntman.Rule>): Stuntman.Rule => {
    return {
        ...rule,
        id: rule?.id ?? uuidv4(),
        actions: rule?.actions ?? {
            mockResponse: { status: 200 },
        },
        matches: rule?.matches ?? (() => true),
        ttlSeconds: rule?.ttlSeconds ?? 600,
        storeTraffic: rule?.storeTraffic ?? true,
    };
};

const fillWithRules = async (ruleExecutor: Stuntman.RuleExecutorInterface, count: number): Promise<Stuntman.Rule[]> => {
    const randomRules: Stuntman.Rule[] = [...new Array(count)].map(() => makeRule());
    for (const rule of randomRules) {
        await ruleExecutor.addRule(rule);
    }
    return randomRules;
};

test('default rules', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const defaultRules = await ruleExecutor.getRules();
    expect(defaultRules[0]?.id).toEqual('internal/catch-all');
    expect(defaultRules[1]?.id).toEqual('internal/echo');
});

test('no rules', async () => {
    expect(getRuleExecutor(uuidv4(), [])['_rules']).toEqual([]);
    // @ts-expect-error null rules
    expect(getRuleExecutor(uuidv4(), null)['_rules']).toEqual([]);
});

test('add / get', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const rule = makeRule();
    const addResult = await ruleExecutor.addRule(rule);
    expect(addResult).toEqual(
        expect.objectContaining({
            ...rule,
            counter: 0,
            isEnabled: true,
        })
    );
    expect(await ruleExecutor.getRule(rule.id)).toEqual(addResult);
});

test('add isEnabled', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const ruleEnabled = makeRule({ isEnabled: true });
    const ruleDisabled = makeRule({ isEnabled: false });
    await ruleExecutor.addRule(ruleEnabled);
    await ruleExecutor.addRule(ruleDisabled);
    expect(ruleExecutor['_rules']).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                id: ruleEnabled.id,
                isEnabled: true,
            }),
            expect.objectContaining({
                id: ruleDisabled.id,
                isEnabled: false,
            }),
        ])
    );
});

test('enabled rules', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const randomRules = await fillWithRules(ruleExecutor, 10);
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.arrayContaining(
            randomRules.map((r) =>
                expect.objectContaining({
                    id: r.id,
                    isEnabled: true,
                })
            )
        )
    );
    ruleExecutor.disableRule((randomRules[5] as Stuntman.Rule).id);
    ruleExecutor.disableRule(randomRules[9] as Stuntman.Rule);
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.arrayContaining(
            randomRules
                .filter((_r, index) => ![5, 9].includes(index))
                .map((r) =>
                    expect.objectContaining({
                        id: r.id,
                        isEnabled: true,
                    })
                )
        )
    );
    for (const randomRule of randomRules) {
        await ruleExecutor.disableRule(randomRule.id);
    }
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.not.arrayContaining(
            randomRules.map((r) =>
                expect.objectContaining({
                    id: r.id,
                })
            )
        )
    );

    ruleExecutor.enableRule((randomRules[3] as Stuntman.Rule).id);
    ruleExecutor.enableRule(randomRules[8] as Stuntman.Rule);
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.not.arrayContaining([
            expect.objectContaining({
                isEnabled: false,
            }),
        ])
    );
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.arrayContaining(
            randomRules
                .filter((_r, index) => [3, 8].includes(index))
                .map((r) =>
                    expect.objectContaining({
                        id: r.id,
                        isEnabled: true,
                    })
                )
        )
    );

    // @ts-expect-error uninitialized _rules
    ruleExecutor['_rules'] = undefined;
    expect(ruleExecutor['enabledRules']).toEqual([]);
});

test('clean up expired', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const randomRules: Stuntman.Rule[] = [...new Array(100)].map(() =>
        makeRule({
            ttlSeconds: Math.random() < 0.5 ? Math.floor(Math.random() * 50) : Math.floor(Math.random() * 50) + 70,
        })
    );
    expect(randomRules.some((r) => r.ttlSeconds < 60)).toEqual(true);
    expect(randomRules.some((r) => r.ttlSeconds > 60)).toEqual(true);
    for (const rule of randomRules) {
        await ruleExecutor.addRule(rule);
    }
    const now = Date.now();
    const dateNowSpy = jest.spyOn(global.Date, 'now').mockImplementation(() => {
        return now + 60 * 1000;
    });
    await ruleExecutor['cleanUpExpired']();
    dateNowSpy.mockRestore();
    expect(ruleExecutor['_rules']).toEqual(
        expect.arrayContaining(randomRules.filter((r) => r.ttlSeconds > 60).map((r) => expect.objectContaining({ id: r.id })))
    );
    expect(ruleExecutor['_rules']).toEqual(
        expect.not.arrayContaining(randomRules.filter((r) => r.ttlSeconds < 60).map((r) => expect.objectContaining({ id: r.id })))
    );
});

test('remove', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const randomRules = await fillWithRules(ruleExecutor, 10);
    const randomRule = randomRules[Math.floor(Math.random() * randomRules.length)] as Stuntman.Rule;
    const existingRules = await ruleExecutor.getRules();
    await ruleExecutor.removeRule(randomRule);
    expect(await ruleExecutor.getRules()).toEqual(existingRules.filter((r) => r.id !== randomRule.id));
});

test('overwrite', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    const randomRules = await fillWithRules(ruleExecutor, 10);
    const randomRule = randomRules[Math.floor(Math.random() * randomRules.length)] as Stuntman.Rule;
    const existingRules = await ruleExecutor.getRules();
    await expect(async () => await ruleExecutor.addRule(randomRule)).rejects.toThrow();
    expect(await ruleExecutor.getRules()).toEqual(existingRules);
    const overwrittenRule = await ruleExecutor.addRule({ ...randomRule, ttlSeconds: randomRule.ttlSeconds + 10 }, true);
    expect(overwrittenRule).toEqual(expect.objectContaining({ id: randomRule.id, ttlSeconds: randomRule.ttlSeconds + 10 }));
    const overwrittenRules = [...existingRules.filter((rule) => rule.id !== randomRule.id), overwrittenRule];
    expect(await ruleExecutor.getRules()).toEqual(overwrittenRules);
});

describe('findMatchingRule', () => {
    test('default', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', 'internal/catch-all');
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://echo/',
            })
        ).toHaveProperty('id', 'internal/echo');
    });

    test('disableAfterUse', async () => {
        const hitRequest: Stuntman.Request = {
            id: uuidv4(),
            method: 'GET',
            rawHeaders: new RawHeaders(),
            timestamp: Date.now(),
            url: 'http://www.example.com/hit',
        };

        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule = makeRule({
            matches: (req) => /hit/.test(req.url),
            disableAfterUse: true,
        });
        await ruleExecutor.addRule(rule);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', 'internal/catch-all');
        expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', rule.id);
        expect(ruleExecutor['_rules']).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule.id, isEnabled: false })])
        );
        expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', 'internal/catch-all');

        const rule2 = makeRule({
            matches: (req) => /hit/.test(req.url),
            disableAfterUse: 3,
        });
        await ruleExecutor.addRule(rule2);
        for (let i = 0; i < (rule2.disableAfterUse as number); i++) {
            expect(ruleExecutor['_rules']).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: rule2.id, isEnabled: true })])
            );
            expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', rule2.id);
        }
        expect(ruleExecutor['_rules']).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule2.id, isEnabled: false })])
        );
        expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', 'internal/catch-all');
    });

    test('removeAfterUse', async () => {
        const hitRequest: Stuntman.Request = {
            id: uuidv4(),
            method: 'GET',
            rawHeaders: new RawHeaders(),
            timestamp: Date.now(),
            url: 'http://www.example.com/hit',
        };

        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule = makeRule({
            matches: (req) => /hit/.test(req.url),
            removeAfterUse: true,
        });
        await ruleExecutor.addRule(rule);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', 'internal/catch-all');
        expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', rule.id);
        expect(ruleExecutor['_rules']).toEqual(expect.not.arrayContaining([expect.objectContaining({ id: rule.id })]));
        expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', 'internal/catch-all');

        const rule2 = makeRule({
            matches: (req) => /hit/.test(req.url),
            removeAfterUse: 3,
        });
        await ruleExecutor.addRule(rule2);
        for (let i = 0; i < (rule2.removeAfterUse as number); i++) {
            expect(ruleExecutor['_rules']).toEqual(
                expect.arrayContaining([expect.objectContaining({ id: rule2.id, isEnabled: true })])
            );
            expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', rule2.id);
        }
        expect(ruleExecutor['_rules']).toEqual(expect.not.arrayContaining([expect.objectContaining({ id: rule2.id })]));
        expect(await ruleExecutor.findMatchingRule(hitRequest)).toHaveProperty('id', 'internal/catch-all');
    });

    test('matches', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule = makeRule({
            matches: () => ({ result: true }),
        });
        await ruleExecutor.addRule(rule);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', rule.id);
    });

    test('matches throws', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule = makeRule({
            matches: () => {
                throw new Error('error');
            },
        });
        await ruleExecutor.addRule(rule);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', 'internal/catch-all');
        ruleExecutor['_rules'] = [];
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toBeNull();
    });

    test('matches', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        (ruleExecutor['_rules'][0] as Stuntman.LiveRule).counter = Number.POSITIVE_INFINITY;
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', 'internal/catch-all');
    });

    test('matches priority', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule1 = makeRule({
            matches: () => true,
            removeAfterUse: true,
            priority: DEFAULT_RULE_PRIORITY,
        });
        const rule2 = makeRule({
            matches: () => true,
            removeAfterUse: true,
            priority: DEFAULT_RULE_PRIORITY - 1,
        });
        await ruleExecutor.addRule(rule1);
        await ruleExecutor.addRule(rule2);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', rule2.id);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', rule1.id);

        await ruleExecutor.addRule(rule2);
        await ruleExecutor.addRule(rule1);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', rule2.id);
        expect(
            await ruleExecutor.findMatchingRule({
                id: uuidv4(),
                method: 'GET',
                rawHeaders: new RawHeaders(),
                timestamp: Date.now(),
                url: 'http://www.example.com/test',
            })
        ).toHaveProperty('id', rule1.id);
    });

    test('matches.disableRuleIds', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule1 = makeRule({
            matches: (req) => req.url !== 'http://www.example.com/test',
        });
        const rule2 = makeRule({
            matches: (req) => ({ result: req.url === 'http://www.example.com/test', disableRuleIds: [rule1.id] }),
        });
        await ruleExecutor.addRule(rule1);
        await ruleExecutor.addRule(rule2);

        expect(ruleExecutor['_rules']).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule1.id, isEnabled: true })])
        );
        await ruleExecutor.findMatchingRule({
            id: uuidv4(),
            method: 'GET',
            rawHeaders: new RawHeaders(),
            timestamp: Date.now(),
            url: 'http://www.example.com/test',
        });

        expect(ruleExecutor['_rules']).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule1.id, isEnabled: false })])
        );
    });

    test('matches.enableRuleIds', async () => {
        const ruleExecutor = getRuleExecutor(uuidv4());
        const rule1 = makeRule({
            matches: (req) => req.url !== 'http://www.example.com/test',
            isEnabled: false,
        });
        const rule2 = makeRule({
            matches: (req) => ({ result: req.url === 'http://www.example.com/test', enableRuleIds: [rule1.id] }),
        });
        await ruleExecutor.addRule(rule1);
        await ruleExecutor.addRule(rule2);

        expect(ruleExecutor['_rules']).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule1.id, isEnabled: false })])
        );
        await ruleExecutor.findMatchingRule({
            id: uuidv4(),
            method: 'GET',
            rawHeaders: new RawHeaders(),
            timestamp: Date.now(),
            url: 'http://www.example.com/test',
        });

        expect(ruleExecutor['_rules']).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule1.id, isEnabled: true })])
        );
    });
});
