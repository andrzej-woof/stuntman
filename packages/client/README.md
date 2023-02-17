# Stuntman API client

Client for [Stuntman](https://github.com/andrzej-woof/stuntman) proxy/mock server API

## Example usage

```ts
import { Client } from './apiClient';
import { ruleBuilder } from './ruleBuilder';

const client = new Client();

const uniqueQaUserEmail = 'unique_qa_email@example.com';
const rule = ruleBuilder()
    .limitedUse(2)
    .onRequestToHostname('example.com')
    .withSearchParam('user', uniqueQaUserEmail)
    .mockResponse({
        localFn: (req) => {
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
```
