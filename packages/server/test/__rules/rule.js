import { DEFAULT_RULE_PRIORITY } from '@stuntman/shared';

export const rule = {
    id: 'rule-js',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY,
    actions: {
        mockResponse: { status: 403 },
    },
};
