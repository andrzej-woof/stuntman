import { expect, test } from '@jest/globals';
import { stringify } from '../src/stringify';

test('stringify', async () => {
    for (const value of [undefined, null, 123, 5.123, true, false, 'dasdasd', [], ['123', 'sad'], {}, { test: 'string' }]) {
        expect(stringify(value)).toEqual(JSON.stringify(value));
    }
    for (const value of [() => true, /test/i]) {
        expect(stringify(value)).toEqual(JSON.stringify(value.toString()));
    }
    expect(stringify({ some: { prop: { regex: /test/, func: () => false } } })).toEqual(
        '{"some":{"prop":{"regex":"/test/","func":"() => false"}}}'
    );
});
