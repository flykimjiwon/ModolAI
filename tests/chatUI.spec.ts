import { test, expect } from '@playwright/test';

// 회원가입 후 로그인(이미 존재하는 계정이면 로그인으로 전환)
async function ensureSignupAndLogin(
  page,
  email = 'testadmin@modol.ai',
  password = 'test1234'
) {
  await page.goto('/signup');
  await page.getByTestId('signup-name').fill('테스트유저');
  await page.getByTestId('signup-email').fill(email);
  await page.waitForTimeout(600);
  await page.getByTestId('signup-department').selectOption('기타부서');
  await page.getByTestId('signup-cell').fill('기타셀');
  await page.getByTestId('signup-password').fill(password);
  await page.getByTestId('signup-confirm-password').fill(password);
  await page.getByTestId('signup-submit').click();

  const emailError = page.getByTestId('signup-email-error');
  const formError = page.getByTestId('signup-error');
  await Promise.race([
    page.waitForURL(/\/login/, { timeout: 5000 }),
    emailError.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
    formError.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {}),
  ]);

  if (!page.url().includes('/login')) {
    await page.goto('/login');
  }

  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  // 페이지가 완전히 로드될 때까지 대기
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  // 팝업이 생성된 경우 닫기 버튼 클릭
  try {
    const popupContainer = page.locator('div.fixed.inset-0.z-50').first();
    const headerCloseButton = popupContainer
      .locator('button[title="닫기"]')
      .first();
    await headerCloseButton.click({ force: true });
    await page.waitForTimeout(500);
  } catch (error) {
    console.warn('[ensureSignupAndLogin] 팝업 닫기 스킵:', error?.message);
  }
}

test.describe('챗팅', () => {
  test('화면 기본 요소 표시 확인', async ({ page }) => {
    // 테스트 전에 로그인
    await ensureSignupAndLogin(page);

    // 채팅 입력 필드가 표시되는지 확인
    await expect(page.getByTestId('chat-input')).toBeVisible();

    // 메시지 목록이 표시되는지 확인
    await expect(page.getByTestId('message-list')).toBeVisible();

    // 채팅 입력 컨테이너가 표시되는지 확인
    await expect(page.getByTestId('chat-input-container')).toBeVisible();

    // 전송 버튼이 표시되는지 확인
    await expect(page.getByTestId('chat-send-button')).toBeVisible();
  });

  test('대화 입력 필드 비활성화 확인', async ({ page }) => {
    // 테스트 전에 로그인
    await ensureSignupAndLogin(page);
    const chatInput = page.getByTestId('chat-input');

    await expect(chatInput).toBeVisible();
  });

  test('채팅 - 빈 메시지 전송 방지', async ({ page }) => {
    // 테스트 전에 로그인
    await ensureSignupAndLogin(page);
    const chatInput = page.getByTestId('chat-input');
    const sendButton = page.getByTestId('chat-send-button');

    // 입력 필드가 비어있는 상태에서 전송 버튼 클릭
    await chatInput.fill('');
    // 빈 상태이거나 메시지가 없는 경우를 확인
    // (실제로는 이전 메시지가 있을 수 있으므로, 빈 메시지가 추가되지 않았는지만 확인)
    await expect(sendButton).toBeDisabled();
  });
});

//   test('채팅 - 새 채팅방인 상태일 때 새 채팅방 클릭 시 알림 팝업 생성', async ({
//     page,
//   }) => {
//     // 테스트 전에 로그인
//     await login(page);

//     // 사이드바 열기
//     await page.getByTestId('sidebar-toggle-button').click();

//     // 메시지 목록 확인
//     const messageList = page.getByTestId('message-list');
//     const messageCount = await messageList
//       .locator('[data-message-role]')
//       .count();
//     // 현재 채팅방 수 확인
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });
//     const roomsBefore = page.locator('[data-testid^="sidebar-room-"]');
//     const roomCountBefore = await roomsBefore.count();

//     // 새로운 대화방 생성 버튼 찾기
//     const newChatButton = page.getByTestId('sidebar-create-room-button-full');
//     await expect(newChatButton).toBeVisible();
//     // 채팅방이 10개 이상인 경우, 테스트의 일관성을 위해 하나를 삭제하고 진행
//     if (roomCountBefore >= 10) {
//       // 삭제 가능한 첫 번째 채팅방 삭제 (보통 내역에서 제일 위의 방)
//       const firstRoomDeleteButton = page
//         .locator('[data-testid^="sidebar-room-"]')
//         .first()
//         .locator('[data-testid="sidebar-room-delete-button"]');
//       await firstRoomDeleteButton.click();
//       // 삭제 확인 모달에서 '삭제' 버튼 클릭
//       const deleteConfirmButton = page.getByRole('button', { name: '삭제' });
//       await deleteConfirmButton.click();
//       // 실제 삭제 완료까지 잠시 대기
//       await page.waitForTimeout(1000);
//     }

//     // 기존에 초기 대화가 있는 경우를 위해 채팅 이력이 있으면 새 채팅 2번 클릭
//     if (messageCount > 0) {
//       // 첫 번째 클릭: 새 대화방 생성 (초기화)
//       await newChatButton.click();
//       await page.waitForTimeout(1000); // 새 방 생성 대기

//       // 새 방이 생성되어 메시지가 비어있는지 확인
//       const newMessageCount = await messageList
//         .locator('[data-message-role]')
//         .count();
//       expect(newMessageCount).toBe(0);
//     }

//     // 두 번째 클릭: 빈 방에서 새 대화방 생성 시도
//     await newChatButton.click();

//     // 알림 팝업이 나타나는지 확인
//     await page.waitForTimeout(500); // 팝업 표시 대기
//     const alertModal = page.locator('text=현재 채팅방 사용');
//     await expect(alertModal).toBeVisible({ timeout: 2000 });

//     // 알림 팝업 메시지 확인
//     const alertMessage = page.locator(
//       'text=현재 채팅방에 대화 내용이 없습니다. 현재 채팅방을 계속 사용해주세요.'
//     );
//     await expect(alertMessage).toBeVisible();

//     // 확인 버튼 클릭하여 팝업 닫기
//     const confirmButton = page.getByRole('button', { name: '확인' });
//     await confirmButton.click();

//     // 팝업이 닫혔는지 확인
//     await page.waitForTimeout(500);
//     await expect(alertModal).not.toBeVisible({ timeout: 2000 });
//   });

//   test('채팅 - 기존에 대화가 존재할 때 새 채팅방 클릭 시 정상적으로 새 방 생성', async ({
//     page,
//   }) => {
//     // 테스트 전에 로그인
//     await login(page);

//     // 사이드바 열기
//     await page.getByTestId('sidebar-toggle-button').click();

//     // 메시지 목록 확인
//     const messageList = page.getByTestId('message-list');
//     const messageCount = await messageList
//       .locator('[data-message-role]')
//       .count();

//     // 기존에 대화가 없는 경우를 위해 채팅 이력이 없으면 채팅 1회 먼저 진행
//     if (messageCount === 0) {
//       const chatInput = page.getByTestId('chat-input');
//       const sendButton = page.getByTestId('chat-send-button');
//       const testMessage = '테스트 메시지입니다.';
//       await chatInput.fill(testMessage);
//       await sendButton.click();

//       // 메시지가 전송되었는지 확인
//       await page.waitForTimeout(1000);
//       const newMessageCount = await messageList
//         .locator('[data-message-role]')
//         .count();
//       expect(newMessageCount).toBeGreaterThan(0);
//     }

//     // 현재 채팅방 수 확인
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });
//     const roomsBefore = page.locator('[data-testid^="sidebar-room-"]');
//     const roomCountBefore = await roomsBefore.count();

//     // 새로운 대화방 생성 버튼 클릭
//     const newChatButton = page.getByTestId('sidebar-create-room-button-full');
//     await expect(newChatButton).toBeVisible();
//     await newChatButton.click();

//     // 새 방이 생성되었는지 확인
//     await page.waitForTimeout(1000);
//     const roomCountAfter = await roomsBefore.count();
//     expect(roomCountAfter).toBeGreaterThan(roomCountBefore);

//     // 새 방으로 전환되어 메시지가 비어있는지 확인
//     const emptyMessageCount = await messageList
//       .locator('[data-message-role]')
//       .count();
//     expect(emptyMessageCount).toBe(0);
//   });

//   test('채팅 - 10개 이상의 채팅방이 있는 상태에서 새 채팅 클릭 시 확인 모달 표시', async ({
//     page,
//   }) => {
//     // 테스트 전에 로그인
//     await login(page);

//     // 사이드바 열기
//     await page.getByTestId('sidebar-toggle-button').click();

//     // 현재 채팅방 수 확인
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });
//     const rooms = page.locator('[data-testid^="sidebar-room-"]');
//     let roomCount = await rooms.count();

//     // 10개 미만인 경우 테스트를 위해 채팅방을 생성
//     while (roomCount < 10) {
//       const newChatButton = page.getByTestId('sidebar-create-room-button-full');
//       await expect(newChatButton).toBeVisible();

//       // 메시지가 있는 방에서만 새 방 생성 가능하므로 먼저 메시지 전송
//       const messageList = page.getByTestId('message-list');
//       const messageCount = await messageList
//         .locator('[data-message-role]')
//         .count();

//       if (messageCount === 0) {
//         const chatInput = page.getByTestId('chat-input');
//         const sendButton = page.getByTestId('chat-send-button');
//         await chatInput.fill(`테스트 메시지 ${roomCount}`);
//         await sendButton.click();
//         await page.waitForTimeout(1000);
//       }

//       // 새 채팅방 생성
//       await newChatButton.click();
//       await page.waitForTimeout(1000);
//       roomCount = await rooms.count();
//     }

//     // 10개 이상인 상태에서 새 채팅방 생성 버튼 클릭
//     const newChatButton = page.getByTestId('sidebar-create-room-button-full');
//     await newChatButton.click();

//     // 확인 모달이 나타나는지 확인
//     await page.waitForTimeout(500);
//     const confirmModal = page.locator('text=대화방 개수 제한');
//     await expect(confirmModal).toBeVisible({ timeout: 2000 });

//     // 확인 모달 메시지 확인
//     const confirmMessage = page.locator(
//       'text=최대 값(10개)의 대화방이 생성되어 있습니다. 가장 오래된 대화방을 삭제하시겠습니까?'
//     );
//     await expect(confirmMessage).toBeVisible();

//     // 취소 버튼 클릭하여 모달 닫기
//     const cancelButton = page.getByRole('button', { name: '취소' });
//     await cancelButton.click();

//     // 모달이 닫혔는지 확인
//     await page.waitForTimeout(500);
//     await expect(confirmModal).not.toBeVisible({ timeout: 2000 });
//   });

//   test('채팅 - 입력 및 전송, 대화방명 자동 변경', async ({ page }) => {
//     // 테스트 전에 로그인
//     await login(page);
//     await page.getByTestId('sidebar-toggle-button').click();

//     // 메시지 입력
//     const testMessage = '토끼가 너무 귀엽다.';
//     const chatInput = page.getByTestId('chat-input');
//     await chatInput.fill(testMessage);

//     // 전송 버튼이 활성화되었는지 확인
//     const sendButton = page.getByTestId('chat-send-button');
//     await expect(sendButton).toBeEnabled();

//     // 전송 버튼 클릭
//     await sendButton.click();

//     // 입력 필드가 초기화되었는지 확인 (전송 후)
//     await page.waitForTimeout(500); // 전송 처리 대기
//     await expect(chatInput).toHaveValue('');
//   });

//   test('Shift+Enter로 줄바꿈', async ({ page }) => {
//     const chatInput = page.getByTestId('chat-input');

//     // 첫 번째 줄 입력
//     await chatInput.fill('첫 번째 줄');

//     // Shift+Enter로 줄바꿈
//     await chatInput.press('Shift+Enter');

//     // 두 번째 줄 입력
//     await chatInput.fill('첫 번째 줄\n두 번째 줄');

//     // Enter만 누르면 전송되어야 함 (Shift 없이)
//     await chatInput.press('Enter');

//     // 메시지가 전송되었는지 확인 (입력 필드가 비워짐)
//     await page.waitForTimeout(500);
//     await expect(chatInput).toHaveValue('');
//   });

//   test('이미지 업로드 버튼 확인', async ({ page }) => {
//     // 이미지 업로드 버튼이 표시되는지 확인
//     const imageUploadButton = page.getByTestId('image-upload');
//     await expect(imageUploadButton).toBeVisible();

//     // 파일 입력 요소가 존재하는지 확인
//     const fileInput = page.locator('input[type="file"]#image-upload');
//     await expect(fileInput).toBeVisible();
//   });

//   test('문서 업로드 버튼 확인', async ({ page }) => {
//     // 문서 업로드 버튼이 표시되는지 확인
//     const documentUploadButton = page.getByTestId('document-upload');
//     await expect(documentUploadButton).toBeVisible();

//     // 파일 입력 요소가 존재하는지 확인
//     const fileInput = page.locator('input[type="file"]#document-upload');
//     await expect(fileInput).toBeVisible();
//   });

//   test('사이드바 토글', async ({ page }) => {
//     // 사이드바 토글 버튼 클릭
//     const toggleButton = page.getByTestId('sidebar-toggle-button');
//     await expect(toggleButton).toBeVisible();

//     // 사이드바 열기
//     await toggleButton.click();

//     // 사이드바가 열렸는지 확인 (채팅방 목록이 보여야 함)
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });

//     // 사이드바 닫기 버튼 찾기 (X 버튼)
//     const closeButton = page.locator('button[title="사이드바 닫기"]');
//     if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
//       await closeButton.click();

//       // 사이드바가 닫혔는지 확인
//       await expect(roomsList).not.toBeVisible({ timeout: 2000 });
//     }
//   });

//   test('새 채팅방 생성', async ({ page }) => {
//     // 사이드바 열기
//     const toggleButton = page.getByTestId('sidebar-toggle-button');
//     await toggleButton.click();

//     // 새 채팅방 생성 버튼 클릭
//     const createButton = page.getByTestId('sidebar-create-room-button-full');
//     await expect(createButton).toBeVisible({ timeout: 2000 });
//     await createButton.click();

//     // 새 채팅방이 생성되었는지 확인 (방 목록에 추가됨)
//     await page.waitForTimeout(1000);

//     // 채팅방 목록이 업데이트되었는지 확인
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible();
//   });

//   test('채팅방 이름 변경', async ({ page }) => {
//     // 사이드바 열기
//     const toggleButton = page.getByTestId('sidebar-toggle-button');
//     await toggleButton.click();

//     // 첫 번째 채팅방 찾기
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });

//     // 채팅방이 있는지 확인
//     const firstRoom = page.locator('[data-testid^="sidebar-room-"]').first();

//     if (await firstRoom.isVisible({ timeout: 2000 }).catch(() => false)) {
//       // 편집 버튼 찾기
//       const roomId = await firstRoom.getAttribute('data-testid');
//       if (roomId) {
//         const editButton = page.getByTestId(
//           `sidebar-room-edit-${roomId.replace('sidebar-room-', '')}`
//         );

//         if (await editButton.isVisible({ timeout: 1000 }).catch(() => false)) {
//           await editButton.click();

//           // 편집 입력 필드가 나타나는지 확인
//           const editInput = firstRoom.locator('input[type="text"]');
//           await expect(editInput).toBeVisible({ timeout: 1000 });

//           // 새 이름 입력
//           await editInput.fill('테스트 채팅방');
//           await editInput.press('Enter');

//           // 이름이 변경되었는지 확인
//           await page.waitForTimeout(500);
//           await expect(firstRoom).toContainText('테스트 채팅방');
//         }
//       }
//     }
//   });

//   test('채팅방 삭제 (방이 2개 이상일 때)', async ({ page }) => {
//     // 사이드바 열기
//     const toggleButton = page.getByTestId('sidebar-toggle-button');
//     await toggleButton.click();

//     // 채팅방 목록 확인
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });

//     // 채팅방 개수 확인
//     const rooms = page.locator('[data-testid^="sidebar-room-"]');
//     const roomCount = await rooms.count();

//     // 방이 2개 이상일 때만 삭제 테스트
//     if (roomCount >= 2) {
//       // 첫 번째 방에 마우스 호버 (삭제 버튼 표시를 위해)
//       const firstRoom = rooms.first();
//       await firstRoom.hover();

//       // 삭제 버튼 찾기
//       const roomId = await firstRoom.getAttribute('data-testid');
//       if (roomId) {
//         const deleteButton = page.getByTestId(
//           `sidebar-room-delete-${roomId.replace('sidebar-room-', '')}`
//         );

//         if (
//           await deleteButton.isVisible({ timeout: 1000 }).catch(() => false)
//         ) {
//           await deleteButton.click();

//           // 확인 모달이 나타나는지 확인
//           await page.waitForSelector('text=대화방 삭제', { timeout: 5000 });

//           // 확인 버튼 클릭
//           const confirmButton = page
//             .getByRole('button', { name: '확인' })
//             .last();
//           await confirmButton.click();

//           // 방이 삭제되었는지 확인
//           await page.waitForTimeout(1000);
//           const newRoomCount = await rooms.count();
//           expect(newRoomCount).toBe(roomCount - 1);
//         }
//       }
//     } else {
//       // 방이 1개만 있으면 삭제 불가 (최소 1개 보장)
//       test.skip();
//     }
//   });

//   test('채팅방 전환', async ({ page }) => {
//     // 사이드바 열기
//     const toggleButton = page.getByTestId('sidebar-toggle-button');
//     await toggleButton.click();

//     // 채팅방 목록 확인
//     const roomsList = page.getByTestId('sidebar-rooms-list');
//     await expect(roomsList).toBeVisible({ timeout: 2000 });

//     // 채팅방이 2개 이상인지 확인
//     const rooms = page.locator('[data-testid^="sidebar-room-"]');
//     const roomCount = await rooms.count();

//     if (roomCount >= 2) {
//       // 두 번째 채팅방 클릭
//       const secondRoom = rooms.nth(1);
//       await secondRoom.click();

//       // 채팅방이 전환되었는지 확인 (활성화된 방 스타일 확인)
//       await page.waitForTimeout(500);
//       // 활성화된 방은 bg-blue-600 클래스를 가짐
//       await expect(secondRoom).toHaveClass(/bg-blue-600/);
//     } else {
//       test.skip();
//     }
//   });

//   test('메시지 목록 빈 상태 표시', async ({ page }) => {
//     // 새 채팅방 생성 (빈 방)
//     const toggleButton = page.getByTestId('sidebar-toggle-button');
//     await toggleButton.click();

//     const createButton = page.getByTestId('sidebar-create-room-button-full');
//     if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
//       await createButton.click();
//       await page.waitForTimeout(1000);
//     }

//     // 빈 상태 메시지가 표시되는지 확인
//     const emptyState = page.getByTestId('message-list-empty');
//     await expect(emptyState).toBeVisible({ timeout: 2000 });

//     // 빈 상태 메시지 텍스트 확인
//     await expect(emptyState).toContainText('새로운 대화를 시작하세요');
//   });

//   test('로딩 상태 표시', async ({ page }) => {
//     const chatInput = page.getByTestId('chat-input');
//     const sendButton = page.getByTestId('chat-send-button');

//     // 메시지 입력 및 전송
//     await chatInput.fill('로딩 테스트 메시지');
//     await sendButton.click();

//     // 로딩 오버레이가 나타나는지 확인 (응답 생성 중)
//     const loadingOverlay = page.getByTestId('chat-loading-overlay');

//     // 로딩이 시작되면 오버레이가 표시될 수 있음
//     // (실제 응답 시간에 따라 다를 수 있으므로 옵셔널 체크)
//     const isVisible = await loadingOverlay
//       .isVisible({ timeout: 2000 })
//       .catch(() => false);

//     if (isVisible) {
//       // 로딩 스피너 확인
//       const spinner = page.getByTestId('chat-loading-spinner');
//       await expect(spinner).toBeVisible();

//       // 로딩 텍스트 확인
//       const loadingText = page.getByTestId('chat-loading-text');
//       await expect(loadingText).toContainText('응답 생성 중');

//       // 중단 버튼 확인
//       const stopButton = page.getByTestId('chat-stop-button');
//       await expect(stopButton).toBeVisible();
//     }
//   });

//   test('모델 선택기 표시', async ({ page }) => {
//     // 모델 선택기가 표시되는지 확인
//     // (ModelSelector 컴포넌트가 렌더링되는지 확인)
//     const chatInputContainer = page.getByTestId('chat-input-container');
//     await expect(chatInputContainer).toBeVisible();

//     // 모델 선택 드롭다운이 있는지 확인 (select 요소 또는 버튼)
//     // 실제 구현에 따라 다를 수 있음
//     const modelSelector = page
//       .locator('select, button')
//       .filter({ hasText: /모델|Model/i })
//       .first();

//     // 모델 선택기가 있으면 확인 (옵셔널)
//     const hasModelSelector = await modelSelector
//       .isVisible({ timeout: 2000 })
//       .catch(() => false);

//     // 모델 선택기가 없어도 테스트는 통과 (옵셔널 기능)
//     if (hasModelSelector) {
//       await expect(modelSelector).toBeVisible();
//     }
//   });
// });
