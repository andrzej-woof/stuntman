import { test } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { deserializeRule } from '../src/api/utils';

// TODO
test('deserialize rule', async () => {
    deserializeRule({
        id: uuidv4(),
        actions: {
            mockResponse: { status: 200 },
        },
        matches: {
            localFn: '() => true',
            localVariables: '{}',
            remoteFn: '() => true',
        },
        ttlSeconds: 10,
        storeTraffic: true,
    });
});
