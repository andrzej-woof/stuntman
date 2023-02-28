import { test } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { getRuleExecutor } from '../src/ruleExecutor';

// TODO
test('rule executor', async () => {
    const ruleExecutor = getRuleExecutor(uuidv4());
    ruleExecutor.addRule({
        id: uuidv4(),
        actions: {
            mockResponse: { status: 200 },
        },
        matches: () => true,
        ttlSeconds: 5,
        storeTraffic: true,
    });
});
