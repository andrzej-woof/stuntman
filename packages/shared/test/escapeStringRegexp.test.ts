import { expect, test } from '@jest/globals';
import { escapeStringRegexp } from '../src/escapeStringRegexp';

test('escapeStringRegexp', async () => {
    expect(escapeStringRegexp('|\\{}()[]^$+*?./testing')).toEqual('\\|\\\\\\{\\}\\(\\)\\[\\]\\^\\$\\+\\*\\?\\./testing');
});
