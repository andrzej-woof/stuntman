import type * as Stuntman from '@stuntman/shared';
import { test, expect } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { catchAllRule } from '../src/rules/catchAll';
import { RawHeaders } from '@stuntman/shared';
import { echoRule } from '../src/rules/echo';

const request = {
    id: uuidv4(),
    method: 'POST',
    rawHeaders: new RawHeaders(),
    timestamp: Date.now(),
    url: 'http://any.url.invalid',
};

test('catchAll', async () => {
    expect(catchAllRule.matches(request)).toEqual(true);
    expect((catchAllRule.actions.mockResponse as Stuntman.ResponseGenerationFn)(request)).toEqual({
        status: 200,
        body: `Request received by Stuntman mock <pre>${JSON.stringify(request, null, 4)}</pre>`,
    });
});

test('echo', async () => {
    const url = 'https://echo/';
    expect(echoRule.matches({ ...request, url })).toEqual(true);
    expect((echoRule.actions.mockResponse as Stuntman.ResponseGenerationFn)({ ...request, url })).toEqual({
        status: 200,
        body: { ...request, url },
    });
});
