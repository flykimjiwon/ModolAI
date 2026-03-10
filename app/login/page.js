'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import NoticePopup from '../components/NoticePopup';
import DarkModeToggle from '@/components/DarkModeToggle';
import { decodeJWTPayload } from '@/lib/jwtUtils';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // redirect 쿼리 파라미터 검증 함수
  const getSafeRedirect = useCallback(() => {
    const redirect = searchParams.get('redirect');
    if (
      redirect &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//')
    ) {
      return redirect;
    }
    return '/';
  }, [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginNotice, setLoginNotice] = useState(null);
  const [supportContacts, setSupportContacts] = useState([]);
  const [supportContactsEnabled, setSupportContactsEnabled] = useState(true);
  const [browserBlockedMessage, setBrowserBlockedMessage] = useState('');
  const [browserInfoMessage, setBrowserInfoMessage] = useState('');
  const [browserAllowed, setBrowserAllowed] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = decodeJWTPayload(token);
        if (payload?.exp && Date.now() >= payload.exp * 1000) {
          localStorage.removeItem('token');
          return;
        }
        router.replace(getSafeRedirect());
      } catch (error) {
        localStorage.removeItem('token');
      }
    }
  }, [router, getSafeRedirect]);

  useEffect(() => {
    const ua = navigator.userAgent || '';
    const isEdge = ua.includes('Edg/');
    const edgeMatch = ua.match(/Edg\/(\d+)/);
    const edgeVersion = edgeMatch ? parseInt(edgeMatch[1], 10) : null;
    const chromeMatch = ua.match(/Chrome\/(\d+)/);
    const chromeVersion = chromeMatch ? parseInt(chromeMatch[1], 10) : null;
    const isChrome = !!chromeVersion && !isEdge;
    const browserName = isEdge ? 'Edge' : 'Chrome';
    const browserVersion = isEdge ? edgeVersion : chromeVersion;
    const isChromium = isChrome || isEdge;
    const isSupported = !!browserVersion && isChromium && browserVersion >= 111;

    if (!isSupported) {
      const message = isChromium
        ? `${browserName} ${browserVersion || '알 수 없음'} 버전에서는 사용이 원활하지 않을 수 있습니다. ${browserName} 111 이상을 권장합니다.`
        : '현재 브라우저에서는 일부 기능이 원활하지 않을 수 있습니다. Chrome/Edge 111 이상을 권장합니다.';
      setBrowserBlockedMessage(message);
      setBrowserAllowed(true);
      setBrowserInfoMessage('');
    } else {
      setBrowserBlockedMessage('');
      setBrowserAllowed(true);
      setBrowserInfoMessage(`현재 ${browserName} ${browserVersion} 버전으로 접속 중입니다.`);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/notice?showPopup=true&limit=1&popupTarget=login')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        if (data.notices && data.notices.length > 0) {
          setLoginNotice(data.notices[0]);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setSupportContacts(
          Array.isArray(data.supportContacts) ? data.supportContacts : []
        );
        setSupportContactsEnabled(
          data.supportContactsEnabled !== undefined
            ? data.supportContactsEnabled
            : true
        );
      })
      .catch(() => {});
  }, []);


  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '로그인에 실패했습니다.');
      }

      // JWT 를 브라우저 로컬스토리지에 저장
      localStorage.setItem('token', data.token);

      // 로그인 성공 → 메인 페이지(예: `/`) 로 이동
      router.push(getSafeRedirect());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 transition-colors duration-200 flex flex-col dark:bg-gray-900'>
      <div className='flex-1 flex items-center justify-center px-4 relative'>
        <div className='absolute top-4 right-4'>
          <DarkModeToggle />
        </div>
        <div className='w-full max-w-md'>
          {/* Logo/Title */}
          <div className='text-center mb-8'>
            <h1
              id='login-title'
              data-testid='login-title'
              className='text-3xl font-bold text-gray-900 mb-2 dark:text-gray-100'
            >
              신한은행 Tech그룹 AI
            </h1>
            <p
              id='login-subtitle'
              data-testid='login-subtitle'
              className='text-gray-600 dark:text-gray-400'
            >
              계정에 로그인하세요
            </p>
          </div>

          {/* Login Form */}
          <form
            id='login-form'
            data-testid='login-form'
            onSubmit={handleSubmit}
            className='card p-6 space-y-4 dark:bg-gray-800'
          >
            {browserBlockedMessage && (
              <div
                role='alert'
                className='p-3 text-sm text-amber-700 bg-amber-50 rounded-lg dark:bg-amber-900/20 dark:text-amber-300'
              >
                {browserBlockedMessage}
              </div>
            )}
            {!browserBlockedMessage && browserInfoMessage && (
              <div className='p-3 text-sm text-blue-700 bg-blue-50 rounded-lg dark:bg-blue-900/20 dark:text-blue-300'>
                {browserInfoMessage}
              </div>
            )}
            {error && (
              <div
                id='login-error'
                data-testid='login-error'
                role='alert'
                className='p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400'
              >
                {error}
              </div>
            )}

            <div className='space-y-2'>
              <label
                htmlFor='login-email'
                id='login-email-label'
                data-testid='login-email-label'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                이메일
              </label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='login-email'
                  data-testid='login-email'
                  type='email'
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='이메일을 입력하세요'
                  aria-describedby='login-email-label'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='login-password'
                id='login-password-label'
                data-testid='login-password-label'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                비밀번호
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='login-password'
                  data-testid='login-password'
                  type='password'
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='비밀번호를 입력하세요'
                  aria-describedby='login-password-label'
                />
              </div>
            </div>

            <button
              id='login-submit'
              data-testid='login-submit'
              type='submit'
              disabled={loading}
              className='btn-primary w-full flex items-center justify-center gap-2'
            >
              {loading ? (
                <>
                  <Loader2
                    data-testid='login-submit-loading'
                    className='h-5 w-5 animate-spin'
                  />
                  처리 중...
                </>
              ) : (
                <>
                  <LogIn className='h-5 w-5' />
                  로그인
                </>
              )}
            </button>

            <div className='text-center pt-4 border-t border-gray-200 dark:border-gray-700'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                계정이 없으신가요?{' '}
                <a
                  id='login-signup-link'
                  data-testid='login-signup-link'
                  href='/signup'
                  className='text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-500'
                >
                  회원가입
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
      {supportContactsEnabled && supportContacts.length > 0 && (
        <div className='fixed bottom-4 right-4 z-40'>
          <div className='bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-4 py-3 text-xs text-gray-700 dark:text-gray-200 min-w-[220px]'>
            <div className='text-sm font-semibold mb-2'>담당자</div>
            <div className='space-y-2'>
              {supportContacts.map((contact, index) => (
                <div key={`support-${index}`}>
                  <div className='font-medium'>
                    {contact.department || '부서 미입력'}
                  </div>
                  <div className='text-gray-600 dark:text-gray-400'>
                    {(contact.name || '이름 미입력') +
                      (contact.phone ? ` · ${contact.phone}` : '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <NoticePopup target='login' initialNotice={loginNotice} />
    </div>
  );
}

function LoginPageFallback() {
  return (
    <div className='min-h-screen bg-gray-50 transition-colors duration-200 flex items-center justify-center dark:bg-gray-900'>
      <div className='text-sm text-gray-600 dark:text-gray-300'>
        로그인 페이지를 불러오는 중입니다...
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
