import { defineConfig, devices } from '@playwright/test';

/**
 * 파일에서 환경 변수를 읽습니다.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * https://playwright.dev/docs/test-configuration 참조
 */
export default defineConfig({
  testDir: './tests',
  /* 파일 내 테스트를 병렬로 실행 */
  fullyParallel: true,
  /* 소스 코드에 test.only를 실수로 남겨두면 CI에서 빌드를 실패시킵니다. */
  forbidOnly: !!process.env.CI,
  /* CI에서만 재시도 */
  retries: process.env.CI ? 2 : 0,
  /* CI에서 병렬 테스트를 선택 해제합니다. */
  workers: process.env.CI ? 1 : undefined,
  /* 사용할 리포터. https://playwright.dev/docs/test-reporters 참조 */
  reporter: 'html',
  /* 아래 모든 프로젝트에 대한 공유 설정. https://playwright.dev/docs/api/class-testoptions 참조 */
  use: {
    /* `await page.goto('')`와 같은 액션에서 사용할 기본 URL. */
    baseURL: 'http://localhost:3000',

    /* 실패한 테스트를 재시도할 때 추적을 수집합니다. https://playwright.dev/docs/trace-viewer 참조 */
    trace: 'on-first-retry',
  },

  /* 주요 브라우저에 대한 프로젝트 구성 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* 모바일 뷰포트에 대해 테스트합니다. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* 브랜드 브라우저에 대해 테스트합니다. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* 테스트를 시작하기 전에 로컬 개발 서버를 실행합니다 */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
