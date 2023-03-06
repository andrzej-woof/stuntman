import { test, expect } from '@jest/globals';
import { Mock } from '../src/mock';
import { stuntmanConfig } from '@stuntman/shared';

// TODO

test('TODO', async () => {
    const mock = new Mock(stuntmanConfig);
    expect(mock).toHaveProperty('start');
})
