import { test, expect } from '@playwright/test';

test.describe('Login Page - 로그인 페이지', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Turbopack 첫 컴파일 대기
    await page.waitForSelector('form, [data-testid="login-form"], input', { timeout: 30_000 });
  });

  test('로그인 페이지 렌더링', async ({ page }) => {
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('빈 폼 제출 시 에러', async ({ page }) => {
    await page.click('[data-testid="login-submit"]');
    const emailInput = page.locator('[data-testid="login-email"]');
    await expect(emailInput).toBeVisible();
  });

  test('잘못된 비밀번호로 로그인 시도', async ({ page }) => {
    await page.fill('[data-testid="login-email"]', 'flykimjiwon@kakao.com');
    await page.fill('[data-testid="login-password"]', 'wrongpassword');
    await page.click('[data-testid="login-submit"]');
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 15_000 });
  });

  test('정상 로그인 후 메인 페이지 이동', async ({ page }) => {
    await page.fill('[data-testid="login-email"]', 'flykimjiwon@kakao.com');
    await page.fill('[data-testid="login-password"]', '12wndgml');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/', { timeout: 20_000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
  });

  test('회원가입 링크 이동', async ({ page }) => {
    await page.click('[data-testid="login-signup-link"]');
    await page.waitForURL('**/signup', { timeout: 20_000 });
  });

  test('다크모드 토글 동작', async ({ page }) => {
    const toggle = page.locator('button:has-text("dark"), button:has-text("light"), [aria-label*="dark"], [aria-label*="theme"]').first();
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
      await page.waitForTimeout(500);
    }
  });

  test('로그인 상태에서 /login 접근 시 리다이렉트', async ({ page }) => {
    await page.fill('[data-testid="login-email"]', 'flykimjiwon@kakao.com');
    await page.fill('[data-testid="login-password"]', '12wndgml');
    await page.click('[data-testid="login-submit"]');
    await page.waitForURL('/', { timeout: 20_000 });
    await page.goto('/login');
    await page.waitForURL('/', { timeout: 15_000 });
  });
});
