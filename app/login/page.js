'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import NoticePopup from '../components/NoticePopup';
import DarkModeToggle from '@/components/DarkModeToggle';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <div className='min-h-screen bg-background transition-colors duration-200 flex flex-col'>
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
              className='text-3xl font-bold text-foreground mb-2'
            >
              modol AI
            </h1>
            <p
              id='login-subtitle'
              data-testid='login-subtitle'
              className='text-muted-foreground'
            >
              계정에 로그인하세요
            </p>
          </div>

          {/* Login Form */}
          <Card>
            <form
              id='login-form'
              data-testid='login-form'
              onSubmit={handleSubmit}
            >
              <CardContent className='space-y-4'>
                {browserBlockedMessage && (
                  <Alert>
                    <AlertDescription className='text-sm text-amber-700 dark:text-amber-300'>
                      {browserBlockedMessage}
                    </AlertDescription>
                  </Alert>
                )}
                {!browserBlockedMessage && browserInfoMessage && (
                  <Alert>
                    <AlertDescription className='text-sm text-muted-foreground'>
                      {browserInfoMessage}
                    </AlertDescription>
                  </Alert>
                )}
                {error && (
                  <Alert variant='destructive'>
                    <AlertDescription
                      id='login-error'
                      data-testid='login-error'
                    >
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <div className='space-y-2'>
                  <Label
                    htmlFor='login-email'
                    id='login-email-label'
                    data-testid='login-email-label'
                  >
                    이메일
                  </Label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='login-email'
                      data-testid='login-email'
                      type='email'
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className='pl-10'
                      placeholder='이메일을 입력하세요'
                      aria-describedby='login-email-label'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label
                    htmlFor='login-password'
                    id='login-password-label'
                    data-testid='login-password-label'
                  >
                    비밀번호
                  </Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='login-password'
                      data-testid='login-password'
                      type='password'
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className='pl-10'
                      placeholder='비밀번호를 입력하세요'
                      aria-describedby='login-password-label'
                    />
                  </div>
                </div>

                <Button
                  id='login-submit'
                  data-testid='login-submit'
                  type='submit'
                  disabled={loading}
                  className='w-full'
                  size='lg'
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
                </Button>
              </CardContent>

              <CardFooter className='justify-center border-t border-border'>
                <p className='text-sm text-muted-foreground'>
                  계정이 없으신가요?{' '}
                  <a
                    id='login-signup-link'
                    data-testid='login-signup-link'
                    href='/signup'
                    className='text-primary hover:text-primary/80 font-medium'
                  >
                    회원가입
                  </a>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
      {supportContactsEnabled && supportContacts.length > 0 && (
        <div className='fixed bottom-4 right-4 z-40'>
          <div className='bg-card/95 border border-border rounded-lg shadow-lg px-4 py-3 text-xs text-foreground min-w-[220px]'>
            <div className='text-sm font-semibold mb-2'>담당자</div>
            <div className='space-y-2'>
              {supportContacts.map((contact, index) => (
                <div key={`support-${index}`}>
                  <div className='font-medium'>
                    {contact.department || '부서 미입력'}
                  </div>
                  <div className='text-muted-foreground'>
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
    <div className='min-h-screen bg-background transition-colors duration-200 flex items-center justify-center'>
      <div className='text-sm text-muted-foreground'>
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
