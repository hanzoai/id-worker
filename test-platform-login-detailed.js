/**
 * Playwright E2E Test: Hanzo Platform Login Flow (Detailed)
 * Tests: platform.hanzo.ai → Sign in → hanzo.id OAuth → platform.hanzo.ai/dashboard
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/tmp/hanzo-platform-login-detailed';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runTest() {
  let browser;
  let page;

  let testResult = {
    steps: [],
    success: false,
    finalUrl: null,
    errors: []
  };

  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Step 1: Navigate to platform.hanzo.ai
    console.log('\n=== STEP 1: Navigate to platform.hanzo.ai ===');
    await page.goto('https://platform.hanzo.ai', { waitUntil: 'domcontentloaded', timeout: 15000 });
    let currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    testResult.steps.push({
      step: 1,
      action: 'Navigate to platform.hanzo.ai',
      url: currentUrl,
      timestamp: new Date().toISOString()
    });

    const step1Screenshot = path.join(SCREENSHOTS_DIR, '01-platform-landing.png');
    await page.screenshot({ path: step1Screenshot, fullPage: true });
    console.log(`Screenshot saved: ${step1Screenshot}`);

    // Step 2: Find and click "Sign in" button
    console.log('\n=== STEP 2: Look for Sign in button ===');
    const signInSelectors = [
      'button:has-text("Sign in")',
      'a:has-text("Sign in")',
      'button:has-text("Sign In")',
      'a:has-text("Sign In")',
      'text=Sign in'
    ];

    let signInButton = null;
    for (const selector of signInSelectors) {
      try {
        const elem = await page.locator(selector).first();
        const isVisible = await elem.isVisible().catch(() => false);
        if (isVisible) {
          const text = await elem.textContent();
          console.log(`Found Sign in button: "${text.trim()}" with selector: ${selector}`);
          signInButton = elem;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (signInButton) {
      console.log('\n=== STEP 3: Click Sign in button ===');
      await signInButton.click();
      console.log('Sign in button clicked');

      // Wait for navigation
      await page.waitForTimeout(2000);
      const redirectUrl = page.url();
      console.log(`Current URL after click: ${redirectUrl}`);

      testResult.steps.push({
        step: 3,
        action: 'Click Sign in button',
        url: redirectUrl,
        timestamp: new Date().toISOString()
      });

      const step3Screenshot = path.join(SCREENSHOTS_DIR, '02-after-signin-click.png');
      await page.screenshot({ path: step3Screenshot, fullPage: true });
    } else {
      console.log('ERROR: Sign in button not found');
      testResult.errors.push('Sign in button not found on landing page');
    }

    // Step 4: Check if we're at login page or OAuth provider
    console.log('\n=== STEP 4: Check current page after Sign in click ===');
    let currentPageUrl = page.url();
    console.log(`Current URL: ${currentPageUrl}`);

    testResult.steps.push({
      step: 4,
      action: 'Check page state after Sign in',
      url: currentPageUrl
    });

    // Step 5: Look for Hanzo OAuth button (if on platform login page)
    console.log('\n=== STEP 5: Look for Hanzo OAuth option ===');
    const hanzoOAuthSelectors = [
      'button:has-text("Sign in with Hanzo")',
      'a:has-text("Sign in with Hanzo")',
      'button:has-text("Hanzo")',
      '[data-provider="hanzo"]',
      'text=Sign in with Hanzo'
    ];

    let hanzoButton = null;
    for (const selector of hanzoOAuthSelectors) {
      try {
        const elem = await page.locator(selector).first();
        const isVisible = await elem.isVisible().catch(() => false);
        if (isVisible) {
          const text = await elem.textContent();
          console.log(`Found Hanzo OAuth button: "${text.trim()}"`);
          hanzoButton = elem;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    if (hanzoButton) {
      console.log('\n=== STEP 6: Click Hanzo OAuth button ===');
      await hanzoButton.click();
      console.log('Hanzo OAuth button clicked, waiting for redirect to IAM...');

      // Wait for navigation to hanzo.id
      try {
        await page.waitForURL('**/hanzo.id/**', { timeout: 10000 });
      } catch (e) {
        console.log('URL pattern match timeout, waiting for general navigation...');
        await page.waitForTimeout(2000);
      }

      const iamUrl = page.url();
      console.log(`Redirected to IAM: ${iamUrl}`);

      testResult.steps.push({
        step: 6,
        action: 'Click Hanzo OAuth button',
        redirectUrl: iamUrl,
        timestamp: new Date().toISOString()
      });

      const step6Screenshot = path.join(SCREENSHOTS_DIR, '03-at-iam-login.png');
      await page.screenshot({ path: step6Screenshot, fullPage: true });

      // Step 7: Fill in credentials at IAM
      console.log('\n=== STEP 7: Fill in IAM login credentials ===');

      // Find email field
      const emailInputs = await page.locator('input[type="email"], input[name="email"], input[name="username"]').all();
      console.log(`Found ${emailInputs.length} email/username input(s)`);

      if (emailInputs.length > 0) {
        console.log('Filling email field...');
        await emailInputs[0].fill('z@hanzo.ai');
        console.log('Email entered: z@hanzo.ai');

        const step7aScreenshot = path.join(SCREENSHOTS_DIR, '04-email-filled.png');
        await page.screenshot({ path: step7aScreenshot, fullPage: true });

        // Look for Continue/Next button
        await page.waitForTimeout(500);
        const nextBtns = await page.locator('button:has-text("Next"), button:has-text("Continue"), button[type="submit"]').all();
        if (nextBtns.length > 0) {
          await nextBtns[0].click();
          console.log('Clicked Next/Continue button');
          await page.waitForTimeout(1500);
        }
      }

      // Step 8: Look for password field
      console.log('\n=== STEP 8: Fill in password ===');
      const pwdInputs = await page.locator('input[type="password"]').all();
      console.log(`Found ${pwdInputs.length} password input(s)`);

      if (pwdInputs.length > 0) {
        console.log('Filling password field...');
        await pwdInputs[0].fill('IloveHanzo2026!!!');
        console.log('Password entered');

        const step8aScreenshot = path.join(SCREENSHOTS_DIR, '05-password-filled.png');
        await page.screenshot({ path: step8aScreenshot, fullPage: true });

        // Look for Sign in button
        await page.waitForTimeout(500);
        const submitBtns = await page.locator('button:has-text("Sign in"), button:has-text("Sign In"), button[type="submit"]').all();
        if (submitBtns.length > 0) {
          console.log('\n=== STEP 9: Submit login form ===');
          await submitBtns[0].click();
          console.log('Login form submitted');

          // Wait for redirect back to platform
          try {
            await page.waitForURL('**/platform.hanzo.ai/**', { timeout: 15000 });
          } catch (e) {
            console.log('Platform URL not reached, waiting for general navigation...');
            await page.waitForTimeout(3000);
          }
        }
      }
    } else {
      console.log('Note: Hanzo OAuth button not found - may be directly on IAM login or different auth flow');

      // Try to find email input directly (may already be at IAM)
      const emailInputs = await page.locator('input[type="email"], input[name="email"], input[name="username"]').all();
      if (emailInputs.length > 0) {
        console.log('Found email input - attempting direct IAM login');
        await emailInputs[0].fill('z@hanzo.ai');
        await page.waitForTimeout(500);

        const nextBtns = await page.locator('button[type="submit"], button:has-text("Next"), button:has-text("Continue")').all();
        if (nextBtns.length > 0) {
          await nextBtns[0].click();
          await page.waitForTimeout(1500);
        }

        const pwdInputs = await page.locator('input[type="password"]').all();
        if (pwdInputs.length > 0) {
          await pwdInputs[0].fill('IloveHanzo2026!!!');
          const submitBtns = await page.locator('button[type="submit"]').all();
          if (submitBtns.length > 0) {
            await submitBtns[submitBtns.length - 1].click();
            await page.waitForTimeout(3000);
          }
        }
      }
    }

    // Step 10: Final check
    console.log('\n=== STEP 10: Check final page state ===');
    await page.waitForTimeout(2000);
    const finalUrl = page.url();
    const finalTitle = await page.title();
    console.log(`Final URL: ${finalUrl}`);
    console.log(`Final page title: ${finalTitle}`);

    testResult.finalUrl = finalUrl;
    testResult.steps.push({
      step: 10,
      action: 'Final page check',
      url: finalUrl,
      title: finalTitle
    });

    // Check success criteria
    if ((finalUrl.includes('platform.hanzo.ai') && !finalUrl.includes('login')) || finalUrl.includes('dashboard')) {
      testResult.success = true;
      console.log('\nSUCCESS: Login completed and authenticated at platform.hanzo.ai');
    } else if (finalUrl.includes('login') || finalUrl.includes('auth')) {
      console.log('\nSTATUS: Still on login/auth page');
      console.log('This may indicate: login credentials failed, account locked, or additional auth required');
    } else {
      console.log('\nUNCLEAR STATUS: Not on expected platform or login page');
    }

    // Take final screenshot
    const finalScreenshot = path.join(SCREENSHOTS_DIR, '06-final-result.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`Final screenshot saved: ${finalScreenshot}`);

  } catch (error) {
    console.error(`\nTEST ERROR: ${error.message}`);
    testResult.errors.push(`Test error: ${error.message}`);

    try {
      const errorScreenshot = path.join(SCREENSHOTS_DIR, 'error.png');
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`Error screenshot saved: ${errorScreenshot}`);
    } catch (e) {
      // Continue
    }
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();

    const resultPath = path.join(SCREENSHOTS_DIR, 'test-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
    console.log(`\nTest result saved: ${resultPath}`);
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);
    console.log(`Success: ${testResult.success}`);
    if (testResult.errors.length > 0) {
      console.log(`Errors: ${testResult.errors.join('; ')}`);
    }
  }
}

runTest().catch(console.error);
