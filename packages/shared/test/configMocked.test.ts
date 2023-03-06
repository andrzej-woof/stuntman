import { expect, test, jest } from '@jest/globals';
import config from '../src/config';

jest.mock('fs', () => ({
    readFileSync: jest.fn((fileName: string) => {
        if (/index\.d\.ts$/.test(fileName)) {
            return 'TYPE DEFINITIONS';
        }
        return '{}';
    }),
}));

jest.mock('config');

test('config module malfunction', async () => {
    expect(() => config.stuntmanConfig).toThrow();
});
