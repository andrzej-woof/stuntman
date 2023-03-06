import { DEFAULT_RULE_PRIORITY } from '@stuntman/shared';

export default {
    id: 'rule2a-ts',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY,
    actions: {
        mockResponse: { status: 404 },
    },
};

export const rule2b = {
    id: 'rule2b-ts',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY,
    actions: {
        mockResponse: { status: 404 },
    },
};
