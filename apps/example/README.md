# Stuntman proxy/mock example app

Example app for [Stunman](https://github.com/andrzej-woof/stuntman#readme)

Main purpose of this app is to demonstrate a potential setup for Stuntman.

The example app code uses `node-fetch` with overriden DNS lookup that will resolve any `*.stuntman` domain to localhost.
Same solution could be integrated in your application code, but in a real life scenario you could use custom DNS on your test environment, which would point all `*.stuntman` subdomains to a Stuntman instance.

You could also override any other domain e.g. `jsonplaceholder.typicode.com` but keeping `.stuntman` makes it more visible that traffic will be proxied.

## Scenario 1

Let's asume you have an app server (`exampleApp`) that is deployed on a remote test environment.
Your application flow is as follows:

1. User enters `exampleApp` sign up page directly or via affiliate link (with specific referral code in query string)
2. User submits form with email to sign up
3. If user came from a referral `exampleApp` server needs to send request to third party affiliate at `jsonplaceholder.typicode.com` and process response

Say you want to test this flow, either manually or by writing some functional tests, so you can hook in Stuntman in between `exampleApp` and `jsonplaceholder.typicode.com`. Having this in place the traffic between them can be:

* isolated (no request will hit `jsonplaceholder.typicode.com`)