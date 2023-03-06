import type * as Stuntman from '@stuntman/shared';
import { DEFAULT_RULE_PRIORITY } from '@stuntman/shared';

export const rule: Stuntman.DeployedRule = {
    id: 'rule-ts',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY,
    actions: {
        mockResponse: { status: 404 },
    },
};
