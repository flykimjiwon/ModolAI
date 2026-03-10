'use client';

// 정적 프리렌더를 건너뛰고 런타임 렌더링만 수행
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Next.js 공식 예시 형태로 최소 구현
export default function GlobalError({ reset }) {
  return (
    <html lang='ko'>
      <body
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <h2 style={{ margin: 0 }}>문제가 발생했습니다.</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type='button'
            onClick={() => reset?.()}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href='/'
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              background: '#374151',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            홈으로 이동
          </a>
        </div>
      </body>
    </html>
  );
}
