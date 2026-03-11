'use client';

// 정적 프리렌더를 건너뛰고 런타임 렌더링만 수행
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// global-error는 LanguageProvider 바깥에서 렌더링되므로
// localStorage에서 직접 언어를 읽어야 합니다.
function getTranslation() {
  try {
    const lang = typeof window !== 'undefined'
      ? localStorage.getItem('modolai-lang') || 'ko'
      : 'ko';
    const translations = {
      ko: {
        title: '심각한 오류가 발생했습니다',
        retry: '다시 시도',
        home: '홈으로 이동',
      },
      en: {
        title: 'A critical error occurred',
        retry: 'Try Again',
        home: 'Go Home',
      },
    };
    return translations[lang] || translations.ko;
  } catch {
    return { title: '심각한 오류가 발생했습니다', retry: '다시 시도', home: '홈으로 이동' };
  }
}

// Next.js 공식 예시 형태로 최소 구현
export default function GlobalError({ reset }) {
  const txt = getTranslation();

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
        <h2 style={{ margin: 0 }}>{txt.title}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type='button'
            onClick={() => reset?.()}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#171717',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {txt.retry}
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
            {txt.home}
          </a>
        </div>
      </body>
    </html>
  );
}
