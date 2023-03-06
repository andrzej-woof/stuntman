import { DEFAULT_RULE_PRIORITY } from '@stuntman/shared';

export const rule2a = {
    id: 'rule2a-js',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY,
    actions: {
        mockResponse: { status: 403 },
    },
};

export const rule2b = {
    id: 'rule2b-js',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY,
    actions: {
        mockResponse: { status: 403 },
    },
};
