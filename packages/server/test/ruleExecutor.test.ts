import type * as Stuntman from '@stuntman/shared';
import { expect, test, jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { getRuleExecutor } from '../src/ruleExecutor';

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
    ruleExecutor.disableRule(randomRules[5] as Stuntman.Rule);
    ruleExecutor.disableRule(randomRules[9] as Stuntman.Rule);
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.arrayContaining(
            randomRules.map((r, index) =>
                expect.objectContaining({
                    id: r.id,
                    isEnabled: ![5, 9].includes(index),
                })
            )
        )
    );
    for (const randomRule of randomRules) {
        await ruleExecutor.disableRule(randomRule.id);
    }
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.arrayContaining(
            randomRules.map((r) =>
                expect.objectContaining({
                    id: r.id,
                    isEnabled: false,
                })
            )
        )
    );

    ruleExecutor.enableRule(randomRules[3] as Stuntman.Rule);
    ruleExecutor.enableRule(randomRules[8] as Stuntman.Rule);
    expect(ruleExecutor['enabledRules']).toEqual(
        expect.arrayContaining(
            randomRules.map((r, index) =>
                expect.objectContaining({
                    id: r.id,
                    isEnabled: [3, 8].includes(index),
                })
            )
        )
    );
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
    const randomRules = await fillWithRules(ruleExecutor, 3);
    const randomRule = randomRules[Math.floor(Math.random() * randomRules.length)] as Stuntman.Rule;
    const existingRules = await ruleExecutor.getRules();
    await expect(async () => await ruleExecutor.addRule(randomRule)).rejects.toThrow();
    expect(await ruleExecutor.getRules()).toEqual(existingRules);
    const overwrittenRule = await ruleExecutor.addRule({ ...randomRule, ttlSeconds: randomRule.ttlSeconds + 10 }, true);
    expect(overwrittenRule).toEqual(expect.objectContaining({ id: randomRule.id, ttlSeconds: randomRule.ttlSeconds + 10 }));
    const overwrittenRules = [...existingRules.filter((rule) => rule.id !== randomRule.id), overwrittenRule];
    expect(await ruleExecutor.getRules()).toEqual(overwrittenRules);
});

// TODO findMatchingRule
