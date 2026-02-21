/**
 * Playwright E2E Test: Hanzo Platform Login Flow
 * Tests: platform.hanzo.ai → hanzo.id OAuth → platform.hanzo.ai
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = '/tmp/hanzo-platform-login-test';

// Ensure screenshots directory exists
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
    // Launch browser
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();

    // Step 1: Navigate to platform.hanzo.ai
    console.log('\n=== STEP 1: Navigate to platform.hanzo.ai ===');
    try {
      await page.goto('https://platform.hanzo.ai', { waitUntil: 'domcontentloaded', timeout: 15000 });
      let currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      testResult.steps.push({
        step: 1,
        action: 'Navigate to platform.hanzo.ai',
        url: currentUrl,
        timestamp: new Date().toISOString()
      });

      // Take screenshot of initial page
      const step1Screenshot = path.join(SCREENSHOTS_DIR, '01-platform-initial.png');
      await page.screenshot({ path: step1Screenshot, fullPage: true });
      console.log(`Screenshot saved: ${step1Screenshot}`);
    } catch (e) {
      console.error(`Navigation error: ${e.message}`);
      testResult.errors.push(`Navigation failed: ${e.message}`);
    }

    // Step 2: Check if redirected to login
    console.log('\n=== STEP 2: Check current page (login check) ===');
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log(`Page title: ${pageTitle}`);
    console.log(`Page URL: ${pageUrl}`);

    testResult.steps.push({
      step: 2,
      action: 'Check page state',
      url: pageUrl,
      title: pageTitle
    });

    // Step 3: Look for login button
    console.log('\n=== STEP 3: Look for sign-in buttons ===');

    // Try various selectors for login button
    const buttonSelectors = [
      'button:has-text("Sign in with Hanzo")',
      'a:has-text("Sign in with Hanzo")',
      'button:has-text("Sign In with Hanzo")',
      'a:has-text("Sign In with Hanzo")',
      'text=Sign in with Hanzo',
      'text=Sign In with Hanzo',
      'button:has-text("Sign in")',
      'a:has-text("Sign in")',
    ];

    let foundButton = null;
    for (const selector of buttonSelectors) {
      try {
        const elem = await page.locator(selector).first();
        const isVisible = await elem.isVisible().catch(() => false);
        if (isVisible) {
          const text = await elem.textContent();
          console.log(`Found button: "${text}" with selector: ${selector}`);
          foundButton = { selector, text };
          break;
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

    if (!foundButton) {
      console.log('No sign-in button found with primary selectors.');
      // Try to find any button on the page
      const allButtons = await page.locator('button').all();
      console.log(`Found ${allButtons.length} total buttons on page`);
      for (let i = 0; i < Math.min(5, allButtons.length); i++) {
        const text = await allButtons[i].textContent();
        console.log(`  Button ${i}: "${text}"`);
      }
    }

    // Take screenshot of login page
    const step3Screenshot = path.join(SCREENSHOTS_DIR, '02-login-page.png');
    await page.screenshot({ path: step3Screenshot, fullPage: true });
    console.log(`Screenshot saved: ${step3Screenshot}`);

    // Step 4: Click Hanzo sign-in button if found
    if (foundButton) {
      console.log('\n=== STEP 4: Click "Sign in with Hanzo" button ===');
      try {
        const button = await page.locator(foundButton.selector).first();
        await button.click();
        console.log('Button clicked, waiting for redirect...');

        // Wait for navigation
        try {
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (e) {
          console.log('Navigation event not triggered, waiting for URL change...');
          await page.waitForTimeout(2000);
        }

        const redirectUrl = page.url();
        console.log(`Redirected to: ${redirectUrl}`);

        testResult.steps.push({
          step: 4,
          action: 'Click Hanzo sign-in button',
          redirectUrl,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        console.error(`Error clicking button: ${e.message}`);
        testResult.errors.push(`Click button error: ${e.message}`);
      }
    }

    // Step 5: Check if we're at hanzo.id login
    console.log('\n=== STEP 5: Check if at hanzo.id login page ===');
    let currentPageUrl = page.url();
    console.log(`Current URL: ${currentPageUrl}`);

    testResult.steps.push({
      step: 5,
      action: 'Check current page after potential redirect',
      url: currentPageUrl
    });

    if (currentPageUrl.includes('hanzo.id') || currentPageUrl.includes('login')) {
      console.log('At login page, attempting credential entry...');

      // Look for email input
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[name="username"]',
        'input[placeholder*="email"]',
        'input[placeholder*="Email"]'
      ];
      let emailInput = null;

      for (const selector of emailSelectors) {
        try {
          const elem = await page.locator(selector).first();
          const isVisible = await elem.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`Found email input with selector: ${selector}`);
            emailInput = elem;
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      if (emailInput) {
        console.log('\n=== STEP 6: Fill email field ===');
        await emailInput.fill('z@hanzo.ai');
        console.log('Email entered: z@hanzo.ai');

        // Take screenshot after email entry
        const step6Screenshot = path.join(SCREENSHOTS_DIR, '03-email-entered.png');
        await page.screenshot({ path: step6Screenshot, fullPage: true });

        // Look for next button or password field
        await page.waitForTimeout(1000);
        const nextButtonSelectors = [
          'button:has-text("Next")',
          'button:has-text("Continue")',
          'button[type="submit"]'
        ];
        let nextButton = null;

        for (const selector of nextButtonSelectors) {
          try {
            const elem = await page.locator(selector).first();
            const isVisible = await elem.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`Found next/continue button: ${selector}`);
              await elem.click();
              console.log('Next button clicked');
              await page.waitForTimeout(1500);
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }

      // Step 7: Look for password field
      console.log('\n=== STEP 7: Look for password field ===');
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[placeholder*="password"]'
      ];
      let passwordInput = null;

      for (const selector of passwordSelectors) {
        try {
          const elem = await page.locator(selector).first();
          const isVisible = await elem.isVisible().catch(() => false);
          if (isVisible) {
            console.log(`Found password input with selector: ${selector}`);
            passwordInput = elem;
            break;
          }
        } catch (e) {
          // Continue
        }
      }

      if (passwordInput) {
        console.log('\n=== STEP 8: Fill password field ===');
        await passwordInput.fill('IloveHanzo2026!!!');
        console.log('Password entered');

        // Take screenshot after password entry
        const step8Screenshot = path.join(SCREENSHOTS_DIR, '04-password-entered.png');
        await page.screenshot({ path: step8Screenshot, fullPage: true });

        // Step 9: Submit login form
        console.log('\n=== STEP 9: Submit login form ===');
        const submitButtonSelectors = [
          'button:has-text("Sign in")',
          'button:has-text("Sign In")',
          'button:has-text("Login")',
          'button[type="submit"]'
        ];
        let submitButton = null;

        for (const selector of submitButtonSelectors) {
          try {
            const elem = await page.locator(selector).first();
            const isVisible = await elem.isVisible().catch(() => false);
            if (isVisible) {
              console.log(`Found submit button: ${selector}`);
              await elem.click();
              console.log('Submit button clicked, waiting for redirect...');

              // Wait for navigation with longer timeout for OAuth flow
              try {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
              } catch (navError) {
                console.log(`Navigation timeout or not triggered: ${navError.message}`);
                await page.waitForTimeout(2000);
              }
              break;
            }
          } catch (e) {
            console.error(`Error with submit button: ${e.message}`);
          }
        }
      }
    }

    // Step 10: Wait for final redirect and check result
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

    if (finalUrl.includes('platform.hanzo.ai') && !finalUrl.includes('login')) {
      testResult.success = true;
      console.log('\nSUCCESS: Login flow completed and back at platform.hanzo.ai');
    } else if (finalUrl.includes('login') || finalUrl.includes('auth')) {
      console.log('\nWARNING: Still on login page or auth page');
      testResult.errors.push('Did not complete login - still on auth page');
    }

    // Take final screenshot
    const finalScreenshot = path.join(SCREENSHOTS_DIR, '05-final-result.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`Final screenshot saved: ${finalScreenshot}`);

  } catch (error) {
    console.error(`\nTEST ERROR: ${error.message}`);
    console.error(error.stack);
    testResult.errors.push(`Test error: ${error.message}`);

    // Take error screenshot
    try {
      const errorScreenshot = path.join(SCREENSHOTS_DIR, 'error.png');
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`Error screenshot saved: ${errorScreenshot}`);
    } catch (screenshotError) {
      console.error(`Could not take screenshot: ${screenshotError.message}`);
    }
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();

    // Save test result
    const resultPath = path.join(SCREENSHOTS_DIR, 'test-result.json');
    fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
    console.log(`\nTest result saved: ${resultPath}`);
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);
    console.log(`Success: ${testResult.success}`);
    if (testResult.errors.length > 0) {
      console.log(`Errors: ${testResult.errors.join(', ')}`);
    }
  }
}

runTest().catch(console.error);
