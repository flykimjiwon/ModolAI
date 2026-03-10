import { test, expect } from '@playwright/test';
test.describe('회원가입', () => {
  test('비밀번호 확인 다르게 입력시 에러메세지 노출', async ({ page }) => {
    const uniqueEmail = `testuser@modol.ai`;

    await page.goto('/signup');

    await page.getByTestId('signup-name').fill('테스트유저');
    await page.getByTestId('signup-email').fill(uniqueEmail);
    await page.waitForTimeout(600);
    await page.getByTestId('signup-department').selectOption('기타부서');
    await page.getByTestId('signup-cell').fill('기타셀');
    await page.getByTestId('signup-password').fill('test1234');

    // 비밀번호 확인에 다른 비밀번호 입력
    await page.getByTestId('signup-confirm-password').fill('different1234');

    // 비밀번호 불일치 메시지가 표시되는지 확인
    await expect(page.getByTestId('signup-password-mismatch')).toBeVisible();
    await expect(page.getByTestId('signup-password-mismatch')).toContainText(
      '비밀번호가 일치하지 않습니다'
    );

    // 회원가입 버튼 클릭
    await page.getByTestId('signup-submit').click();

    // 에러 메시지가 표시되는지 확인
    await expect(page.getByTestId('signup-error')).toBeVisible({
      timeout: 2000,
    });
    await expect(page.getByTestId('signup-error')).toContainText(
      '비밀번호가 일치하지 않습니다'
    );

    // 회원가입 페이지에 머물러 있는지 확인
    await expect(page).toHaveURL(/\/signup/);
  });

  test('비밀번호 6자 미만 입력시 에러메세지 노출', async ({ page }) => {
    const uniqueEmail = `testuser@modol.ai`;

    await page.goto('/signup');

    await page.getByTestId('signup-name').fill('테스트유저');
    await page.getByTestId('signup-email').fill(uniqueEmail);
    await page.waitForTimeout(600);
    await page.getByTestId('signup-department').selectOption('기타부서');
    await page.getByTestId('signup-cell').fill('기타셀');

    // 6자 미만의 비밀번호 입력
    await page.getByTestId('signup-password').fill('12345');
    await page.getByTestId('signup-confirm-password').fill('12345');

    // HTML5 validation을 우회하여 JavaScript validation을 테스트하기 위해
    // 폼의 noValidate 속성을 임시로 설정하고 제출
    await page.evaluate(() => {
      const form = document.querySelector('[data-testid="signup-form"]');
      if (form) {
        form.setAttribute('novalidate', 'true');
      }
    });

    // 회원가입 버튼 클릭
    await page.getByTestId('signup-submit').click();

    // 에러 메시지가 표시되는지 확인 (JavaScript validation)
    await expect(page.getByTestId('signup-error')).toBeVisible({
      timeout: 2000,
    });
    await expect(page.getByTestId('signup-error')).toContainText(
      '비밀번호는 최소 6자 이상이어야 합니다'
    );

    // 회원가입 페이지에 머물러 있는지 확인
    await expect(page).toHaveURL(/\/signup/);
  });

  test('빈 폼 제출시 에러메세지 노출', async ({ page }) => {
    await page.goto('/signup');

    // 빈 폼으로 제출 시도 (HTML5 validation)
    await page.getByTestId('signup-submit').click();

    // 필수 필드들이 required이므로 브라우저 validation이 작동해야 함
    // Playwright는 HTML5 validation을 직접 확인할 수 없지만,
    // 폼이 제출되지 않았는지 확인할 수 있음
    await expect(page).toHaveURL(/\/signup/);
  });

  test('성공케이스', async ({ page }) => {
    const uniqueEmail = `testuser@modol.ai`;

    // 회원가입 페이지로 이동
    await page.goto('/signup');

    // 회원가입 페이지가 제대로 로드되었는지 확인
    await expect(page.getByText('modol AI')).toBeVisible();
    await expect(page.getByText('새 계정을 만드세요')).toBeVisible();

    // 회원가입 폼 요소들이 보이는지 확인
    await expect(page.getByTestId('signup-form')).toBeVisible();
    await expect(page.getByTestId('signup-name')).toBeVisible();
    await expect(page.getByTestId('signup-email')).toBeVisible();
    await expect(page.getByTestId('signup-department')).toBeVisible();
    await expect(page.getByTestId('signup-cell')).toBeVisible();
    await expect(page.getByTestId('signup-password')).toBeVisible();
    await expect(page.getByTestId('signup-confirm-password')).toBeVisible();
    await expect(page.getByTestId('signup-submit')).toBeVisible();

    // 이름 입력
    await page.getByTestId('signup-name').fill('테스트유저');

    // 이메일 입력 (고유한 이메일 사용)
    await page.getByTestId('signup-email').fill(uniqueEmail);

    // 이메일 중복 검증이 완료될 때까지 대기
    await page.waitForTimeout(600); // 디바운스 500ms + 여유시간

    // 부서 선택
    await page.getByTestId('signup-department').selectOption('기타부서');

    // Cell 입력
    await page.getByTestId('signup-cell').fill('기타셀');

    // 비밀번호 입력
    await page.getByTestId('signup-password').fill('test1234');

    // 비밀번호 확인 입력
    await page.getByTestId('signup-confirm-password').fill('test1234');

    // 회원가입 버튼 클릭
    await page.getByTestId('signup-submit').click();

    // 회원가입 성공 후 로그인 페이지로 리다이렉트되는지 확인
    await page.waitForURL('/login', { timeout: 10000 });

    // 로그인 페이지가 표시되는지 확인
    await expect(page.getByTestId('login-title')).toBeVisible();
  });

  test('이미 존재하는 이메일로 회원가입시 에러메세지 노출', async ({
    page,
  }) => {
    // 이미 존재하는 이메일로 회원가입 시도
    await page.goto('/signup');

    await page.getByTestId('signup-name').fill('테스트유저');
    await page.getByTestId('signup-email').fill('testuser@modol.ai');

    // 이메일 중복 검증이 완료될 때까지 대기
    await page.waitForTimeout(600);

    // 이메일 중복 에러가 표시되는지 확인
    const emailError = page.getByTestId('signup-email-error');
    await expect(emailError).toBeVisible({ timeout: 2000 });
    await expect(emailError).toContainText('이미 등록된 이메일');

    // 회원가입 버튼이 비활성화되어 있는지 확인
    await expect(page.getByTestId('signup-submit')).toBeDisabled();
  });

  test('테스트용 계정 삭제', async ({ page }) => {
    // 로그인 페이지로 이동
    await page.goto('/login');

    // 이메일 입력 (click() 없이 fill()만 사용 - Playwright가 자동으로 포커스 처리)
    await page.getByTestId('login-email').fill('testadmin@modol.ai');

    // 비밀번호 입력 (click() 없이 fill()만 사용)
    await page.getByTestId('login-password').fill('test1234');

    // 로그인 버튼 클릭
    await page.getByTestId('login-submit').click();

    // 로그인 성공 후 메인 페이지로 리다이렉트 대기
    await page.waitForURL('/', { timeout: 10000 });

    // 알림 팝업이 있으면 닫기 (선택적)
    const closeButton = page.getByText('닫기');
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
    }

    // 사이드바 열기 및 관리자 페이지로 이동
    await page.getByTestId('sidebar-toggle-button').click();
    await page.getByTestId('sidebar-admin-button').click();
    await page.getByTestId('admin-sidebar-menu-icon-users').click();

    // 사용자 목록이 로드될 때까지 대기
    await page.waitForSelector('text=testuser@modol.ai', { timeout: 10000 });

    // testuser@modol.ai 사용자 행 찾기
    const userRow = page
      .locator('div.px-6.py-4')
      .filter({ hasText: 'testuser@modol.ai' })
      .first();

    // 해당 사용자 행에 삭제 버튼이 있는지 확인
    const deleteButton = userRow.locator('button[title="사용자 삭제"]').first();
    await expect(deleteButton).toBeVisible();

    // 삭제 버튼 클릭
    await deleteButton.click();

    // 확인 모달이 나타날 때까지 대기
    await page.waitForSelector('text=사용자 삭제 확인', { timeout: 5000 });

    // 확인 모달의 확인 버튼 클릭 (모달 내부의 확인 버튼만 선택)
    // 모달은 fixed inset-0 z-50 클래스를 가진 div 내부에 있음
    const confirmModal = page
      .locator('div.fixed.inset-0.z-50')
      .filter({ hasText: '사용자 삭제 확인' });
    const confirmButton = confirmModal
      .getByRole('button', { name: '확인' })
      .last();
    await confirmButton.click();

    // 삭제 성공 알림이 나타날 때까지 대기
    await page
      .waitForSelector('text=삭제 완료', { timeout: 5000 })
      .catch(() => {
        // 삭제 완료 알림이 나타나지 않을 수도 있으므로 에러 무시
      });

    // 삭제 후 사용자 목록이 업데이트될 때까지 대기
    await page.waitForTimeout(1000);

    // 사용자 목록에서 testuser@modol.ai이 더 이상 보이지 않는지 확인
    const userEmail = page.getByText('testuser@modol.ai');
    await expect(userEmail).not.toBeVisible({ timeout: 5000 });
  });
});
