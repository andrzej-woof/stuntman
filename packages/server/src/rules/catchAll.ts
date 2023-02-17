import { CATCH_ALL_RULE_PRIORITY, CATCH_RULE_NAME } from '@stuntman/shared';
import type * as Stuntman from '@stuntman/shared';

export const catchAllRule: Stuntman.DeployedRule = {
    id: CATCH_RULE_NAME,
    matches: () => true,
    priority: CATCH_ALL_RULE_PRIORITY,
    actions: {
        mockResponse: (req: Stuntman.Request) => ({
            body: `Request received by Stuntman mock <pre>${JSON.stringify(req, null, 4)}</pre>`,
            status: 200,
        }),
    },
};
