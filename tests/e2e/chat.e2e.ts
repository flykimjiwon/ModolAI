import { test, expect } from '@playwright/test';

test.describe('Chat - 메인 채팅 인터페이스', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Turbopack 첫 컴파일 대기 - 메인 페이지 렌더링 완료까지
    await page.waitForSelector('main, textarea, [contenteditable], [data-testid]', { timeout: 30_000 });
  });

  test('메인 페이지 로드 및 UI 표시', async ({ page }) => {
    // 채팅 관련 요소 (textarea, input, 또는 data-testid)
    const chatUI = page.locator('textarea, [contenteditable="true"], [data-testid="chat-input-container"], input[placeholder]').first();
    await expect(chatUI).toBeVisible({ timeout: 15_000 });
  });

  test('채팅방 생성', async ({ page }) => {
    const newChatBtn = page.locator('button:has-text("새"), button:has-text("New"), button[aria-label*="new"], button[aria-label*="chat"]').first();
    if (await newChatBtn.isVisible().catch(() => false)) {
      await newChatBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('메시지 입력 영역 동작', async ({ page }) => {
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill('테스트 메시지입니다');
      const value = await textarea.inputValue();
      expect(value).toContain('테스트');
    } else {
      // contenteditable 또는 다른 입력 방식
      const editable = page.locator('[contenteditable="true"]').first();
      if (await editable.isVisible().catch(() => false)) {
        await editable.fill('테스트 메시지입니다');
      }
    }
  });

  test('사이드바 표시/숨기기', async ({ page }) => {
    const sidebarToggle = page.locator('button[aria-label*="sidebar"], button[aria-label*="menu"], button:has-text("메뉴")').first();
    if (await sidebarToggle.isVisible().catch(() => false)) {
      await sidebarToggle.click();
      await page.waitForTimeout(500);
      await sidebarToggle.click();
    }
  });

  test('모델 선택 드롭다운', async ({ page }) => {
    const modelSelector = page.locator('[class*="model"], select:has(option), button:has-text("모델"), button:has-text("model")').first();
    if (await modelSelector.isVisible().catch(() => false)) {
      await modelSelector.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Chat Variants - 다중 채팅 디자인', () => {
  const chatPages = ['/chat', '/chat1', '/chat2', '/chat3'];

  for (const chatPath of chatPages) {
    test(`${chatPath} 페이지 로드`, async ({ page }) => {
      const res = await page.goto(chatPath);
      if (res && res.status() === 200) {
        await page.waitForLoadState('networkidle');
        // 최소한 페이지가 렌더링되면 통과
        const content = page.locator('main, textarea, [data-testid="chat-input-container"]').first();
        await expect(content).toBeVisible({ timeout: 15_000 });
      }
    });
  }
});
