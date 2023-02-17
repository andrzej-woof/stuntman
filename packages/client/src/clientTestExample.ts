import type * as Stuntman from '@stuntman/shared';
import { Client } from './apiClient';
import { ruleBuilder } from './ruleBuilder';

const client = new Client();

const uniqueQaUserEmail = 'unique_qa_email@example.com';
const rule = ruleBuilder()
    .limitedUse(2)
    .onAnyRequest()
    .withBodyJson('test', 'value')
    .mockResponse({
        localFn: (req: Stuntman.Request) => {
            if (JSON.parse(req.body).email !== uniqueQaUserEmail) {
                return {
                    status: 500,
                };
            }
            return { status: 201 };
        },
        localVariables: { uniqueQaUserEmail },
    });

client.addRule(rule).then((x) => console.log(x));
