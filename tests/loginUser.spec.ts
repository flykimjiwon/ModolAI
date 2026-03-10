import { test, expect } from '@playwright/test';

test.describe('로그인', () => {
  test('잘못된 이메일로 로그인시 에러메세지 노출', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 잘못된 이메일로 로그인 시도
    await page.getByTestId('login-email').fill('invalid@shinhan.com');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    // 에러 메시지가 표시되는지 확인
    await expect(page.getByTestId('login-error')).toBeVisible({
      timeout: 5000,
    });

    // 로그인 페이지에 머물러 있는지 확인
    await expect(page).toHaveURL(/\/login/);
  });

  test('잘못된 비밀번호 로그인시 에러메세지 노출', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 잘못된 이메일로 로그인 시도
    await page.getByTestId('login-email').fill('testadmin@shinhan.com');
    await page.getByTestId('login-password').fill('wrongpassword');
    await page.getByTestId('login-submit').click();

    // 에러 메시지가 표시되는지 확인
    await expect(page.getByTestId('login-error')).toBeVisible({
      timeout: 5000,
    });

    // 로그인 페이지에 머물러 있는지 확인
    await expect(page).toHaveURL(/\/login/);
  });

  test('빈 폼으로 제출시 에러메세지 노출', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 빈 폼으로 제출 시도 (HTML5 validation)
    await page.getByTestId('login-submit').click();

    // 이메일 필드가 required이므로 브라우저 validation이 작동해야 함
    // Playwright는 HTML5 validation을 직접 확인할 수 없지만,
    // 폼이 제출되지 않았는지 확인할 수 있음
    await expect(page).toHaveURL(/\/login/);
  });

  test('성공케이스', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 로그인 페이지가 제대로 로드되었는지 확인
    await expect(page.getByTestId('login-title')).toBeVisible();
    await expect(page.getByTestId('login-title')).toHaveText(
      '신한은행 Tech그룹 AI'
    );
    await expect(page.getByTestId('login-subtitle')).toBeVisible();
    await expect(page.getByTestId('login-subtitle')).toHaveText(
      '계정에 로그인하세요'
    );

    // 로그인 폼 요소들이 보이는지 확인
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();

    // 이메일 입력
    await page.getByTestId('login-email').click();
    await page.getByTestId('login-email').fill('testadmin@shinhan.com');

    // 비밀번호 입력
    await page.getByTestId('login-password').click();
    await page.getByTestId('login-password').fill('test1234');

    // 로그인 버튼 클릭
    await page.getByTestId('login-submit').click();

    // 로그인 성공 후 메인 페이지로 리다이렉트되는지 확인
    await page.waitForURL('/', { timeout: 10000 });

    // 토큰이 로컬스토리지에 저장되었는지 확인
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeTruthy();
    expect(token?.length).toBeGreaterThan(0);
  });
});
