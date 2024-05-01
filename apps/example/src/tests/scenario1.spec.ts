import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { StuntmanClient, ruleBuilder } from '@stuntman/client';

const stuntmanClient = new StuntmanClient();

test('Pass through - external', async ({ page }) => {
    const externalSignup = page.locator('#signup_referral');
    const signupButton = page.locator('#signup_button');
    const signupOk = page.locator('#signup_ok');
    const email = page.locator('#email');
    const backButton = page.locator('#back');

    await page.goto('http://localhost:8080/home');
    const uniqueEmail = `${uuidv4()}@example.invalid`;
    const storeTrafficRule = ruleBuilder()
        .singleUse()
        .onAnyRequest()
        // .withBodyJson('body', uniqueEmail)
        .withBodyText(uniqueEmail)
        .storeTraffic()
        .proxyPass();
    await stuntmanClient.addRule(storeTrafficRule);
    await externalSignup.click();
    await signupButton.click();
    await expect(signupOk).toBeAttached();
    await expect(await stuntmanClient.getTraffic(storeTrafficRule.id)).toEqual([]);
    await backButton.click();
    await externalSignup.click();
    await email.clear();
    await email.fill(uniqueEmail);
    await signupButton.click();
    await expect(signupOk).toBeAttached();
    await expect(await stuntmanClient.getTraffic(storeTrafficRule.id)).toHaveLength(1);
    await backButton.click();
    await externalSignup.click();
    await email.clear();
    await email.fill(uniqueEmail);
    await signupButton.click();
    await expect(signupOk).toBeAttached();
    await expect(await stuntmanClient.getTraffic(storeTrafficRule.id)).toHaveLength(1);
});
