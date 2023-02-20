# Stuntman proxy/mock example app

Example app for [Stunman](https://github.com/andrzej-woof/stuntman#readme)

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test:example
```

Main purpose of this app is to demonstrate a potential setup for Stuntman.

It contains `exampleApp` (that simulates your node application), `@stuntman/server` and example E2E tests written with [testcafe](https://github.com/DevExpress/testcafe#readme) utilizing `@stuntman/client` to interact with mock server.

The example app code uses `node-fetch` with overriden DNS lookup that will resolve any `*.stuntman`/`*.stuntmanhttp`/`*.stuntmans` domain to localhost.
Same solution could be integrated in your application code, but in a real life scenario you could use custom DNS on your test environment, which would point all `*.stuntman` subdomains to a Stuntman instance.

You could also override any other domain e.g. `jsonplaceholder.typicode.com` but keeping `.stuntman` makes it more visible that traffic will be proxied.

## Scenario 1

Let's asume you have an app server (`exampleApp`) that is deployed on a remote test environment.
Your application flow is as follows:

1. User enters `exampleApp` sign up page directly or via affiliate link (with specific referral code in query string)
2. User submits form with email to sign up
3. If user came from a referral `exampleApp` server needs to send request to third party affiliate at `jsonplaceholder.typicode.com` and process response

Say you want to test this flow, either manually or by writing some functional tests, so you can hook in Stuntman in between `exampleApp` and `jsonplaceholder.typicode.com` and point your `exampleApp` to `jsonplaceholder.typicode.com.stuntmanhttps:2015` instead.

Having this in place the traffic between them can be (depending on the rules you set up)

### isolated

No request will hit `jsonplaceholder.typicode.com`. Mock will intercept the request and reply based on the content of `rule.mockResponse` with a static stub of response, or response generated based on you request (if function is provided)

### pass-through

Mock will interecept the request and reissue same request to a target server (in this case `http://jsonplaceholder.typicode.com.stuntmanhttps:2015/*` will be forwarded to `https://jsonplaceholder.typicode.com/*`). Response from target server will be passed back to the client that made request to mock. If `rule.storeTraffic` flag is set request/response pair will be recoreded in mocks cache and available to be retrieved via API call or through web UI.

### modified

Similar to pass-through with a difference that both request to target server and response from target can be subject to modifications by using `rule.modifyRequest` and `rule.modifyResponse` functions that can alter headers and body.
