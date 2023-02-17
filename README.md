# Stuntman

## Running on local

### Prerequisites

* [pnpm](https://github.com/pnpm/pnpm) package manager
* [nvm](https://github.com/nvm-sh/nvm) node version manager (optional)

```bash
nvm use
pnpm install --frozen-lockfile
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

Take a look at `./src/clientTestExample.ts`, you can use it to set up some rules

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
    .onRequestToHostname('itsup.com')
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

* http://stuntman:1985/webgui/rules - rule viewer/editor
* http://stuntman:1985/webgui/traffic - traffic viewer for the rules that store traffic
