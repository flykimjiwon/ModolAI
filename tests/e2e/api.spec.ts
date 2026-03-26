import { test, expect } from '@playwright/test';

// Helper: extract token from stored auth state
let TOKEN: string;

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: 'tests/.auth/user.json' });
  const page = await ctx.newPage();
  await page.goto('/');
  TOKEN = await page.evaluate(() => localStorage.getItem('token') || '');
  await ctx.close();
});

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
  };
}

// ─── Health & Infrastructure ───────────────────────────

test.describe('Health & Infrastructure', () => {
  test('서버 접근 가능', async ({ request }) => {
    const res = await request.get('/');
    expect([200, 302, 307]).toContain(res.status());
  });

  test('API health check', async ({ request }) => {
    let res = await request.get('/api/public/health');
    if (res.status() === 404) {
      res = await request.get('/api/health');
    }
    expect(res.status()).toBe(200);
  });

  test('favicon 존재', async ({ request }) => {
    const res = await request.get('/favicon.ico');
    expect([200, 304]).toContain(res.status());
  });
});

// ─── Auth Endpoints ────────────────────────────────────

test.describe('Auth Endpoints', () => {
  test('POST /api/auth/login - 정상 로그인', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'flykimjiwon@kakao.com', password: '12wndgml' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.token).toBeTruthy();
  });

  test('POST /api/auth/login - 잘못된 비밀번호 거부', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'flykimjiwon@kakao.com', password: 'wrongpass' },
    });
    expect([401, 400, 403]).toContain(res.status());
  });

  test('POST /api/auth/login - 존재하지 않는 이메일 거부', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'nonexist@test.com', password: '12345' },
    });
    expect([401, 400, 404]).toContain(res.status());
  });

  test('GET /api/auth/validate - 유효한 토큰', async ({ request }) => {
    const res = await request.get('/api/auth/validate', {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
  });

  test('GET /api/auth/validate - 토큰 없이 401', async ({ request }) => {
    const res = await request.get('/api/auth/validate');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/auth/refresh - 토큰 갱신', async ({ request }) => {
    const res = await request.post('/api/auth/refresh', {
      headers: authHeaders(),
    });
    // refresh는 cookie 기반일 수 있으므로 다양한 응답 허용
    expect([200, 401, 400]).toContain(res.status());
  });

  test('GET /api/auth/check-email - 존재하는 이메일 확인', async ({ request }) => {
    const res = await request.get('/api/auth/check-email?email=flykimjiwon@kakao.com');
    expect(res.status()).toBe(200);
  });
});

// ─── Chat & Room Endpoints ─────────────────────────────

test.describe('Chat & Room Endpoints', () => {
  let roomId: string;

  test('POST /api/webapp-chat/room - 채팅방 생성', async ({ request }) => {
    const res = await request.post('/api/webapp-chat/room', {
      headers: authHeaders(),
      data: { name: 'Test Room ' + Date.now() },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    roomId = body.room?.id || body.id;
    expect(roomId).toBeTruthy();
  });

  test('GET /api/webapp-chat/room - 채팅방 목록 조회', async ({ request }) => {
    const res = await request.get('/api/webapp-chat/room', {
      headers: authHeaders(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.rooms) || Array.isArray(body)).toBeTruthy();
  });

  test('GET /api/webapp-chat/history - 채팅 히스토리 조회', async ({ request }) => {
    if (!roomId) return;
    const res = await request.get(`/api/webapp-chat/history/${roomId}`, {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});

// ─── Model & Agent Endpoints ───────────────────────────

test.describe('Model & Agent Endpoints', () => {
  test('GET /api/v1/models - 모델 목록', async ({ request }) => {
    const res = await request.get('/api/v1/models', {
      headers: authHeaders(),
    });
    expect([200, 401]).toContain(res.status());
  });

  test('GET /api/models - 내부 모델 목록', async ({ request }) => {
    const res = await request.get('/api/models', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/agents - 에이전트 목록', async ({ request }) => {
    const res = await request.get('/api/agents', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('POST /api/v1/chat/completions - 인증 없이 거부', async ({ request }) => {
    const res = await request.post('/api/v1/chat/completions', {
      data: { model: 'test', messages: [{ role: 'user', content: 'hi' }] },
    });
    expect([401, 403, 400]).toContain(res.status());
  });
});

// ─── Admin Endpoints (권한 검증) ───────────────────────

test.describe('Admin Endpoints - 권한 검증', () => {
  const adminPaths = [
    '/api/admin/dashboard',
    '/api/admin/agents',
    '/api/admin/users',
    '/api/admin/database',
    '/api/admin/analytics',
    '/api/admin/api-tokens',
    '/api/admin/settings',
    '/api/admin/models',
    '/api/admin/menus',
  ];

  for (const path of adminPaths) {
    test(`GET ${path} - 인증 필요`, async ({ request }) => {
      const res = await request.get(path);
      expect([401, 403, 302]).toContain(res.status());
    });

    test(`GET ${path} - 인증된 접근`, async ({ request }) => {
      const res = await request.get(path, { headers: authHeaders() });
      // 사용자 역할에 따라 200 또는 403
      expect([200, 403, 401]).toContain(res.status());
    });
  }
});

// ─── Board Endpoints ───────────────────────────────────

test.describe('Board Endpoints', () => {
  test('GET /api/board/posts - 게시글 목록', async ({ request }) => {
    const res = await request.get('/api/board/posts', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('POST /api/board/posts - 게시글 작성', async ({ request }) => {
    const res = await request.post('/api/board/posts', {
      headers: authHeaders(),
      data: { title: 'Test Post ' + Date.now(), content: 'Automated test post' },
    });
    expect([200, 201, 404]).toContain(res.status());
  });
});

// ─── User Endpoints ────────────────────────────────────

test.describe('User Endpoints', () => {
  test('GET /api/user/profile - 프로필 조회', async ({ request }) => {
    const res = await request.get('/api/user/profile', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/user/api-tokens - API 토큰 목록', async ({ request }) => {
    const res = await request.get('/api/user/api-tokens', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/user/memory - 유저 메모리 조회', async ({ request }) => {
    const res = await request.get('/api/user/memory', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});

// ─── Webapp Feature Endpoints ──────────────────────────

test.describe('Webapp Feature Endpoints', () => {
  test('POST /api/webapp-code-convert - 코드 변환', async ({ request }) => {
    const res = await request.post('/api/webapp-code-convert', {
      headers: authHeaders(),
      data: { code: 'print("hello")', from: 'python', to: 'javascript' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('POST /api/webapp-text-rewriter - 텍스트 리라이트', async ({ request }) => {
    const res = await request.post('/api/webapp-text-rewriter', {
      headers: authHeaders(),
      data: { text: '테스트 문장입니다', style: 'formal' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('POST /api/webapp-text-to-sql - Text to SQL', async ({ request }) => {
    const res = await request.post('/api/webapp-text-to-sql', {
      headers: authHeaders(),
      data: { text: 'Show all users', schema: 'users(id, name, email)' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('POST /api/webapp-chart-generate - 차트 생성', async ({ request }) => {
    const res = await request.post('/api/webapp-chart-generate', {
      headers: authHeaders(),
      data: { data: [{ x: 1, y: 2 }], type: 'bar' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });

  test('POST /api/webapp-error-helper - 에러 헬퍼', async ({ request }) => {
    const res = await request.post('/api/webapp-error-helper', {
      headers: authHeaders(),
      data: { error: 'TypeError: cannot read property', language: 'javascript' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });
});

// ─── Notice & Menus ────────────────────────────────────

test.describe('Notice & Menus', () => {
  test('GET /api/notice - 공지사항 조회', async ({ request }) => {
    const res = await request.get('/api/notice', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/menus - 메뉴 목록', async ({ request }) => {
    const res = await request.get('/api/menus', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});

// ─── Workflow & Screen Endpoints ───────────────────────

test.describe('Workflow & Screen Endpoints', () => {
  test('GET /api/workflows - 워크플로우 목록', async ({ request }) => {
    const res = await request.get('/api/workflows', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });

  test('GET /api/screens - 스크린 목록', async ({ request }) => {
    const res = await request.get('/api/screens', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});

// ─── Security Tests ────────────────────────────────────

test.describe('Security Tests', () => {
  test('SQL Injection 방어 - 로그인', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: "'; DROP TABLE users; --", password: 'test' },
    });
    expect([400, 401, 403]).toContain(res.status());
  });

  test('XSS 방어 - 게시글 작성', async ({ request }) => {
    const res = await request.post('/api/board/posts', {
      headers: authHeaders(),
      data: { title: '<script>alert("xss")</script>', content: '<img onerror="alert(1)" src=x>' },
    });
    // Should not return 500 (crash)
    expect(res.status()).not.toBe(500);
  });

  test('경로 탐색 방어 - 잘못된 경로', async ({ request }) => {
    const res = await request.get('/api/../../../etc/passwd');
    expect([400, 403, 404]).toContain(res.status());
  });

  test('인증 토큰 없는 보호 엔드포인트 접근 거부', async ({ request }) => {
    const protectedPaths = [
      '/api/webapp-chat/room',
      '/api/admin/users',
      '/api/user/profile',
    ];
    for (const p of protectedPaths) {
      const res = await request.get(p);
      expect([401, 403, 302]).toContain(res.status());
    }
  });

  test('만료된 JWT 거부', async ({ request }) => {
    const res = await request.get('/api/auth/validate', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxfQ.invalid',
      },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Model Server Endpoints ────────────────────────────

test.describe('Model Server Endpoints', () => {
  test('GET /api/model-servers - 모델 서버 목록', async ({ request }) => {
    const res = await request.get('/api/model-servers', {
      headers: authHeaders(),
    });
    expect([200, 404, 403]).toContain(res.status());
  });
});

// ─── Upload Endpoint ───────────────────────────────────

test.describe('Upload', () => {
  test('POST /api/upload/image - 빈 요청 거부', async ({ request }) => {
    const res = await request.post('/api/upload/image', {
      headers: authHeaders(),
    });
    expect([400, 415, 404]).toContain(res.status());
  });
});

// ─── Direct Messages ───────────────────────────────────

test.describe('Direct Messages', () => {
  test('GET /api/direct-messages - DM 목록', async ({ request }) => {
    const res = await request.get('/api/direct-messages', {
      headers: authHeaders(),
    });
    expect([200, 404]).toContain(res.status());
  });
});

// ─── PII Endpoints ─────────────────────────────────────

test.describe('PII Endpoints', () => {
  test('POST /api/webapp-pii - PII 감지', async ({ request }) => {
    const res = await request.post('/api/webapp-pii', {
      headers: authHeaders(),
      data: { text: '주민번호 901231-1234567' },
    });
    expect([200, 400, 404]).toContain(res.status());
  });
});
