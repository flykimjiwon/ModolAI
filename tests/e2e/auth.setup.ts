import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate via login page', async ({ page }) => {
  await page.goto('/login');

  // Wait for login form
  await page.waitForSelector('[data-testid="login-form"]', { timeout: 15_000 });

  // Fill credentials
  await page.fill('[data-testid="login-email"]', 'flykimjiwon@kakao.com');
  await page.fill('[data-testid="login-password"]', '12wndgml');

  // Submit
  await page.click('[data-testid="login-submit"]');

  // Wait for redirect to main page (successful login)
  await page.waitForURL('/', { timeout: 15_000 });

  // Verify token is stored
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();

  // Save auth state
  await page.context().storageState({ path: authFile });

  console.log('Auth setup complete - token acquired');
});
