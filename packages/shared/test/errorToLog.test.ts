import { expect, test } from '@jest/globals';
import { errorToLog } from '../src/errorToLog';

test('app error', async () => {
    const error = new Error('test');
    expect(errorToLog(error)).toEqual(expect.objectContaining({ name: error.name, message: error.message, stack: error.stack }));
    // @ts-expect-error not Error instance
    expect(errorToLog()).toBeUndefined();
    // @ts-expect-error not Error instance
    expect(errorToLog('test')).toEqual('test');
    // @ts-expect-error not Error instance
    expect(errorToLog(['test'])).toEqual(['test']);
});
