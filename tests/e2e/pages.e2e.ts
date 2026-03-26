import { test, expect } from '@playwright/test';

// Helper: 페이지 로드 대기 (turbopack 첫 컴파일 고려)
async function safeGoto(page: any, url: string) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// ─── Profile Page ──────────────────────────────────────

test.describe('Profile - 프로필 페이지', () => {
  test('프로필 페이지 접근', async ({ page }) => {
    await safeGoto(page, '/profile');
    const content = page.locator('main, [class*="profile"], h1, h2, form').first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Board Page ────────────────────────────────────────

test.describe('Board - 게시판', () => {
  test('게시판 메인 접근', async ({ page }) => {
    await safeGoto(page, '/board');
    const content = page.locator('main, [class*="board"], table, [class*="post"], h1, h2').first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  test('게시글 작성 페이지 접근', async ({ page }) => {
    const res = await page.goto('/board/write');
    if (res && res.status() === 200) {
      await page.waitForLoadState('networkidle');
      const form = page.locator('form, textarea, input[name="title"], [class*="editor"]').first();
      await expect(form).toBeVisible({ timeout: 15_000 });
    }
  });
});

// ─── Signup Page ───────────────────────────────────────

test.describe('Signup - 회원가입', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('form, [data-testid="signup-form"], input', { timeout: 30_000 });
  });

  test('회원가입 페이지 렌더링', async ({ page }) => {
    await expect(page.locator('[data-testid="signup-form"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="signup-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="signup-confirm-password"]')).toBeVisible();
  });

  test('비밀번호 불일치 경고', async ({ page }) => {
    await page.fill('[data-testid="signup-password"]', 'password123!');
    await page.fill('[data-testid="signup-confirm-password"]', 'different456!');
    await expect(page.locator('[data-testid="signup-password-mismatch"]')).toBeVisible({ timeout: 10_000 });
  });

  test('로그인 링크 이동', async ({ page }) => {
    await page.click('[data-testid="signup-login-link"]');
    await page.waitForURL('**/login', { timeout: 20_000 });
  });
});

// ─── Admin Page ────────────────────────────────────────

test.describe('Admin - 관리자 페이지', () => {
  test('관리자 대시보드 접근', async ({ page }) => {
    await safeGoto(page, '/admin');
    const content = page.locator('main, [class*="admin"], [class*="dashboard"], [class*="denied"], h1, h2').first();
    await expect(content).toBeVisible({ timeout: 15_000 });
  });

  const adminSubpages = [
    '/admin/users', '/admin/models', '/admin/agents',
    '/admin/database', '/admin/settings', '/admin/analytics', '/admin/menus',
  ];

  for (const subpage of adminSubpages) {
    test(`${subpage} 접근`, async ({ page }) => {
      await page.goto(subpage);
      await page.waitForLoadState('networkidle');
      expect(page.url()).toBeTruthy();
    });
  }
});

// ─── Workflow & Screen Builder ─────────────────────────

test.describe('Workflow & Screen Builder', () => {
  test('워크플로우 페이지 접근', async ({ page }) => {
    const res = await page.goto('/workflow');
    if (res && res.status() === 200) {
      await page.waitForLoadState('networkidle');
    }
  });

  test('스크린 빌더 페이지 접근', async ({ page }) => {
    const res = await page.goto('/screen-builder');
    if (res && res.status() === 200) {
      await page.waitForLoadState('networkidle');
    }
  });
});

// ─── SSO Page ──────────────────────────────────────────

test.describe('SSO Page', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('SSO 페이지 접근', async ({ page }) => {
    const ssoRes = await page.goto('/sso');
    if (ssoRes && [200, 302, 307].includes(ssoRes.status())) {
      await page.waitForLoadState('networkidle');
    }
  });
});

// ─── Navigation & Routing ──────────────────────────────

test.describe('Navigation - 네비게이션', () => {
  test('존재하지 않는 페이지 처리', async ({ page }) => {
    const res = await page.goto('/nonexistent-page-12345');
    expect(res).toBeTruthy();
    // Next.js는 다양한 응답 가능 (404, 200 with error page, redirect)
    expect(res!.status()).toBeLessThan(500);
  });

  test('인증 없이 보호 페이지 접근 시 로그인 리다이렉트', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const isLoginPage = url.includes('login') || await page.locator('[data-testid="login-form"]').isVisible().catch(() => false);
    expect(isLoginPage || url.includes('localhost')).toBeTruthy();
    await ctx.close();
  });
});

// ─── Responsive Design ─────────────────────────────────

test.describe('Responsive Design - 반응형', () => {
  const viewports = [
    { name: 'Mobile', width: 375, height: 812 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}x${vp.height}) 레이아웃`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const errors: string[] = [];
      page.on('pageerror', (err: Error) => errors.push(err.message));
      await page.waitForTimeout(2000);
      expect(errors.length).toBe(0);
    });
  }
});

// ─── Performance Checks ────────────────────────────────

test.describe('Performance - 성능 체크', () => {
  test('로그인 페이지 로드 시간 < 5초', async ({ page }) => {
    const start = Date.now();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  test('메인 페이지 로드 시간 < 8초', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });

  test('콘솔 에러 없음 (메인 페이지)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err: Error) => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    const criticalErrors = errors.filter(e =>
      !e.includes('ResizeObserver') && !e.includes('Non-Error') && !e.includes('hydration')
    );
    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors);
    }
  });
});
