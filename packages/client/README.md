# Stuntman API client

[![npm](https://img.shields.io/npm/v/@stuntman/client.svg)][npmjs]
[![Build Status](https://img.shields.io/github/actions/workflow/status/andrzej-woof/stuntman/ci.yaml)][build]
[![Coverage Status](https://coveralls.io/repos/github/andrzej-woof/stuntman/badge.svg)][coverage]
![License](https://img.shields.io/github/license/andrzej-woof/stuntman)

[npmjs]: https://www.npmjs.com/package/@stuntman/client
[build]: https://github.com/andrzej-woof/stuntman/actions/workflows/ci.yaml
[coverage]: https://coveralls.io/github/andrzej-woof/stuntman

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

Check [example app](https://github.com/andrzej-woof/stuntman/tree/master/apps/example#readme) for more samples
