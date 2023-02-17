import { DEFAULT_RULE_PRIORITY } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

export const echoRule: Stuntman.DeployedRule = {
    id: 'internal/echo',
    priority: DEFAULT_RULE_PRIORITY + 1,
    matches: (req: Stuntman.Request) => /https?:\/\/echo\/.*/.test(req.url),
    actions: {
        mockResponse: (req: Stuntman.Request) => ({
            body: req,
            status: 200,
        }),
    },
};
