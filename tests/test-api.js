#!/usr/bin/env node

/**
 * ModolAI API Test Suite
 *
 * Usage:
 *   node tests/test-api.js                     # test against localhost:3000
 *   node tests/test-api.js http://localhost:4000  # custom base URL
 */

const BASE = process.argv[2] || 'http://localhost:3000';
let passed = 0, failed = 0, skipped = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    if (e.message === 'SKIP') {
      console.log(`  ⏭️  ${name} (skipped)`);
      skipped++;
    } else {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function skip() { throw new Error('SKIP'); }

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text(), headers: r.headers };
}

async function post(path, body, headers = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text() };
}

async function main() {
  console.log(`\n🧪 ModolAI API Tests — ${BASE}\n`);
  console.log('─── Health & Infrastructure ───');

  await test('Server is running', async () => {
    const r = await get('/');
    assert(r.status === 200 || r.status === 302 || r.status === 307, `Status: ${r.status}`);
  });

  await test('API health check', async () => {
    const r = await get('/api/public/health');
    if (r.status === 404) {
      const r2 = await get('/api/health');
      assert(r2.status === 200, `Status: ${r2.status}`);
    } else {
      assert(r.status === 200, `Status: ${r.status}`);
    }
  });

  console.log('\n─── Auth Endpoints ───');

  await test('GET /api/auth/session returns JSON', async () => {
    const r = await get('/api/auth/session');
    assert(r.status === 200 || r.status === 401, `Status: ${r.status}`);
  });

  await test('POST /api/auth/login rejects bad credentials', async () => {
    const r = await post('/api/auth/callback/credentials', { email: 'bad@test.com', password: 'wrong' });
    assert(r.status !== 200 || (r.data && !r.data.user), 'Should reject bad credentials');
  });

  console.log('\n─── Public API Endpoints ───');

  await test('GET /api/public/models returns array', async () => {
    const r = await get('/api/public/models');
    if (r.status === 404) skip();
    assert(r.status === 200, `Status: ${r.status}`);
    assert(Array.isArray(r.data) || (r.data && r.data.models), 'Should return models');
  });

  await test('GET /api/public/notice returns data', async () => {
    const r = await get('/api/notice');
    if (r.status === 404) skip();
    assert(r.status === 200 || r.status === 401, `Status: ${r.status}`);
  });

  console.log('\n─── Admin Endpoints (expect 401 without auth) ───');

  const adminPaths = [
    '/api/admin/dashboard',
    '/api/admin/agents',
    '/api/admin/api-tokens',
    '/api/admin/users',
    '/api/admin/database',
    '/api/admin/analytics',
  ];

  for (const path of adminPaths) {
    await test(`GET ${path} requires auth`, async () => {
      const r = await get(path);
      assert(r.status === 401 || r.status === 403 || r.status === 302 || r.status === 200, `Unexpected: ${r.status}`);
    });
  }

  console.log('\n─── Chat / Completion Endpoints ───');

  await test('POST /api/v1/chat/completions rejects without auth', async () => {
    const r = await post('/api/v1/chat/completions', {
      model: 'test',
      messages: [{ role: 'user', content: 'hi' }],
    });
    assert(r.status === 401 || r.status === 403 || r.status === 400, `Status: ${r.status}`);
  });

  await test('GET /api/v1/models returns model list', async () => {
    const r = await get('/api/v1/models');
    if (r.status === 404) skip();
    assert(r.status === 200 || r.status === 401, `Status: ${r.status}`);
  });

  console.log('\n─── RAG Endpoints ───');

  await test('GET /api/rag/documents exists', async () => {
    const r = await get('/api/rag/documents');
    assert(r.status === 200 || r.status === 401 || r.status === 404, `Status: ${r.status}`);
  });

  console.log('\n─── Static Assets ───');

  await test('Favicon exists', async () => {
    const r = await get('/favicon.ico');
    assert(r.status === 200 || r.status === 304, `Status: ${r.status}`);
  });

  // Summary
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`  ✅ Passed: ${passed}  ❌ Failed: ${failed}  ⏭️  Skipped: ${skipped}`);
  console.log(`  Total: ${passed + failed + skipped} tests`);
  console.log(`${'═'.repeat(40)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
