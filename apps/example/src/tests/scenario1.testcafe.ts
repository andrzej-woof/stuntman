import { Selector, fixture } from 'testcafe';
import { v4 as uuidv4 } from 'uuid';
import { StuntmanClient, ruleBuilder } from '@stuntman/client';

fixture('Scenario 1').beforeEach(async (browser) => {
    await browser.navigateTo('http://localhost:8080/home');
});

const externalSignup = Selector('#signup_referral');
const signupButton = Selector('#signup_button');
const signupOk = Selector('#signup_ok');
const email = Selector('#email');
const backButton = Selector('#back');

const stuntmanClient = new StuntmanClient();

test('Pass through - external', async (browser) => {
    const uniqueEmail = `${uuidv4()}@example.invalid`;
    const storeTrafficRule = ruleBuilder()
        .singleUse()
        .onAnyRequest()
        // .withBodyJson('body', uniqueEmail)
        .withBodyText(uniqueEmail)
        .storeTraffic()
        .proxyPass();
    await stuntmanClient.addRule(storeTrafficRule);
    await browser.click(externalSignup).click(signupButton).expect(signupOk.exists).ok();
    await browser.expect(await stuntmanClient.getTraffic(storeTrafficRule.id)).eql({}, 'no traffic should be stored by default');
    await browser.click(backButton);
    await browser.click(externalSignup);
    await browser.typeText(email, uniqueEmail, { replace: true, paste: true }).click(signupButton).expect(signupOk.exists).ok();
    await browser
        .expect(Object.values(await stuntmanClient.getTraffic(storeTrafficRule.id)).length)
        .eql(1, 'traffic should be recorded for matching requests');
    await browser.click(backButton);
    await browser.click(externalSignup);
    await browser.typeText(email, uniqueEmail, { replace: true, paste: true }).click(signupButton).expect(signupOk.exists).ok();
    await browser
        .expect(Object.values(await stuntmanClient.getTraffic(storeTrafficRule.id)).length)
        .eql(1, 'traffic should not be recorded for subsequent requests');
});
