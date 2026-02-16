# Stuntman server

[![npm](https://img.shields.io/npm/v/@stuntman/server.svg)][npmjs]
[![Build Status](https://img.shields.io/github/actions/workflow/status/andrzej-woof/stuntman/ci.yaml)][build]
[![Coverage Status](https://coveralls.io/repos/github/andrzej-woof/stuntman/badge.svg)][coverage]
![License](https://img.shields.io/github/license/andrzej-woof/stuntman)

[npmjs]: https://www.npmjs.com/package/@stuntman/server
[build]: https://github.com/andrzej-woof/stuntman/actions/workflows/ci.yaml
[coverage]: https://coveralls.io/github/andrzej-woof/stuntman

Stuntman is a proxy/mock server that can be deployed remotely together with your application under test, working as either pass-through proxy allowing you to inspect traffic or proxy/mock which can intercept requests/responses and modify them or stub with predefined ones.

It offers API and client library that can be used for example within E2E functional test scripts to dynamically alter it's behaviour for specific traffic matching set of rules of your definition.

In order to get more familiar with the concept and how to use it please refer to [example app](https://github.com/andrzej-woof/stuntman/tree/master/apps/example#readme)

## Building from source

### Prerequisites

-   [pnpm](https://github.com/pnpm/pnpm) package manager
-   [nvm](https://github.com/nvm-sh/nvm) node version manager (optional)

```bash
nvm use
pnpm install
pnpm build
```

### Start server

```bash
pnpm stuntman
```

## Configuration

Stuntman uses [config](https://github.com/node-config/node-config)

You can create `config/default.json` with settings of your liking matching `Stuntman.Config` type

## Running as a package

### Install with package manager of your choice

```bash
npm install @stuntman/server
yarn add @stuntman/server
pnpm add @stuntman/server
```

### Run from bin

```bash
stuntman
yarn stuntman
node ./node_modules/.bin/stuntman
```

### Run programatically

```ts
import { Mock } from '../mock';
import { stuntmanConfig } from '@stuntman/shared';

const mock = new Mock(stuntmanConfig);

mock.start();
```

### Point domain to localhost

Add some domains with `.stuntman` suffix (or `.stuntmanhttp` / `.stuntmanhttps` depending where you want to direct the traffic in proxy mode) to your `/etc/hosts` for example

```text
127.0.0.1 www.example.com.stuntman
```

### Try in browser

go to your browser and visit `http://www.example.com.stuntman:2015/` to see the proxied page
for local playground you can also use `http://www.example.com.localhost:2015`

### Take a look at client

Mind the scope of `Stuntman.RemotableFunction` like `matches`, `modifyRequest`, `modifyResponse`.
`Stuntman.RemotableFunction.localFn` contains the function, but since it'll be executed on a remote mock server it cannot access any variables outside it's body. In order to pass variable values into the function use `Stuntman.RemotableFunction.variables` for example:

```ts
    matches: {
        localFn: (req) => {
            // you might need to ignore typescript errors about undefined variables in this scope
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return /http:\/\/[^/]+\/somepath$/.test(req.url) && req.url.includes(`?someparam=${myVar}`);
        },
        localVariables: { myVar: 'myValue' },
    }
```

You can build the rules using fluentish `ruleBuilder`

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

### Take a look at PoC of WebGUI

....just don't look to closely, it's very much incomplete and hacky

-   http://stuntman:1985/webgui/rules - rule viewer/editor
-   http://stuntman:1985/webgui/traffic - traffic viewer for the rules that store traffic
