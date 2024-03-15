import { test, expect } from '@jest/globals';
import { Client } from '../src/apiClient';

test('TODO', async () => {
    const client = new Client();
    expect(client).toHaveProperty('addRule');
});
