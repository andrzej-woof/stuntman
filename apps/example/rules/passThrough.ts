import * as Stuntman from '@stuntman/shared';
import { DEFAULT_RULE_PRIORITY } from '@stuntman/shared';

export const passThroughRule: Stuntman.DeployedRule = {
    id: 'pass-through',
    matches: () => true,
    priority: DEFAULT_RULE_PRIORITY + 1, // higher value -> lower priority
    actions: { proxyPass: true },
};
