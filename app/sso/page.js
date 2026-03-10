'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, User, Lock, Loader2, AlertCircle, X } from 'lucide-react';
import NoticePopup from '../components/NoticePopup';
import DarkModeToggle from '@/components/DarkModeToggle';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 브라우저 정보 파싱
function getBrowserInfo() {
  const ua = navigator.userAgent || '';

  let browserName = 'Unknown';
  let browserVersion = '';

  if (ua.includes('Edg/')) {
    browserName = 'Edge';
    const match = ua.match(/Edg\/(\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Chrome/')) {
    browserName = 'Chrome';
    const match = ua.match(/Chrome\/(\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Firefox/')) {
    browserName = 'Firefox';
    const match = ua.match(/Firefox\/(\d+)/);
    browserVersion = match ? match[1] : '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browserName = 'Safari';
    const match = ua.match(/Version\/(\d+)/);
    browserVersion = match ? match[1] : '';
  }

  let osName = 'Unknown';
  let osVersion = '';

  if (ua.includes('Windows')) {
    osName = 'Windows';
    if (ua.includes('Windows NT 10.0')) osVersion = '10';
    else if (ua.includes('Windows NT 11.0')) osVersion = '11';
  } else if (ua.includes('Mac OS X')) {
    osName = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    osVersion = match ? match[1].replace('_', '.') : '';
  } else if (ua.includes('Linux')) {
    osName = 'Linux';
  } else if (ua.includes('Android')) {
    osName = 'Android';
    const match = ua.match(/Android (\d+)/);
    osVersion = match ? match[1] : '';
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    osName = 'iOS';
  }

  let deviceType = 'Desktop';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    deviceType = /iPad/i.test(ua) ? 'Tablet' : 'Mobile';
  }

  return {
    browserName,
    browserVersion,
    osName,
    osVersion,
    deviceType,
    userAgent: ua,
  };
}

// localStorage 사용 가능 여부 체크
function checkLocalStorageAvailable() {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

function ErrorPopup({ error, onClose }) {
  if (!error) return null;

  const getErrorTitle = (errorCode) => {
    switch (errorCode) {
      case 'VALIDATION_ERROR': return '입력 오류';
      case 'AUTH_FAILED': return '인증 실패';
      case 'LOGIN_DENIED': return '로그인 거부';
      case 'SSO_SYSTEM_ERROR': return 'SSO 시스템 오류';
      case 'SSO_SERVER_ERROR': return 'SSO 서버 오류';
      case 'SSO_CONNECTION_ERROR': return 'SSO 연결 오류';
      case 'CLIENT_STORAGE_ERROR': return '브라우저 저장소 오류';
      default: return '로그인 오류';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div className="bg-destructive px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive-foreground font-medium">
            <AlertCircle className="h-5 w-5" />
            {getErrorTitle(error.errorCode)}
          </div>
          <button onClick={onClose} className="text-destructive-foreground/80 hover:text-destructive-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-foreground mb-3">{error.message}</p>
          {error.errorCode && (
            <p className="text-xs text-muted-foreground mb-2">
              오류 코드: {error.errorCode}
            </p>
          )}
          {error.detail && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              상세: {error.detail}
            </p>
          )}
          <Button
            onClick={onClose}
            className="mt-4 w-full"
          >
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SSOLoginPage() {
  const router = useRouter();

  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorPopup, setErrorPopup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loginNotice, setLoginNotice] = useState(null);
  const [supportContacts, setSupportContacts] = useState([]);
  const [supportContactsEnabled, setSupportContactsEnabled] = useState(true);
  const [browserBlockedMessage, setBrowserBlockedMessage] = useState('');
  const [browserInfoMessage, setBrowserInfoMessage] = useState('');
  const [browserAllowed, setBrowserAllowed] = useState(true);
  const [browserInfo, setBrowserInfo] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('[SSO useEffect] 토큰 체크:', { exists: !!token, length: token?.length });
    if (token) {
      try {
        const payload = decodeJWTPayload(token);
        console.log('[SSO useEffect] 토큰 파싱 성공:', { email: payload.email, exp: payload.exp });
        if (payload?.exp && Date.now() >= payload.exp * 1000) {
          console.log('[SSO useEffect] 토큰 만료됨 → 삭제');
          localStorage.removeItem('token');
          return;
        }
        console.log('[SSO useEffect] 유효한 토큰 → 메인으로 이동');
        router.replace('/');
      } catch (error) {
        console.error('[SSO useEffect] 토큰 파싱 실패 → 삭제:', error, { tokenPreview: token?.substring(0, 100) });
        localStorage.removeItem('token');
      }
    }
  }, [router]);

  useEffect(() => {
    const info = getBrowserInfo();
    setBrowserInfo(info);

    const isChromium =
      info.browserName === 'Chrome' || info.browserName === 'Edge';
    const browserVersion = parseInt(info.browserVersion, 10);
    const hasValidVersion = Number.isInteger(browserVersion);
    const isSupported = isChromium && hasValidVersion && browserVersion >= 111;

    if (!isSupported) {
      const message = isChromium
        ? `${info.browserName} ${hasValidVersion ? browserVersion : '알 수 없음'} 버전에서는 사용이 원활하지 않을 수 있습니다. ${info.browserName} 111 이상을 권장합니다.`
        : '현재 브라우저에서는 일부 기능이 원활하지 않을 수 있습니다. Chrome/Edge 111 이상을 권장합니다.';
      setBrowserBlockedMessage(message);
      setBrowserAllowed(true);
      setBrowserInfoMessage('');
    } else {
      setBrowserBlockedMessage('');
      setBrowserAllowed(true);
      setBrowserInfoMessage(
        `현재 ${info.browserName} ${info.browserVersion} 버전으로 접속 중입니다.`
      );
    }
  }, []);

  // 공지사항 조회
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

  // 담당자 정보 조회
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

  // 클라이언트 에러 로깅
  async function logClientError(employeeNo, errorType, errorMessage) {
    try {
      await fetch('/api/admin/sso-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeNo,
          browserInfo,
          clientError: { type: errorType, message: errorMessage },
          localStorageAvailable: checkLocalStorageAvailable(),
          loginSuccess: false,
        }),
      });
    } catch (e) {
      console.error('[SSO] 클라이언트 에러 로깅 실패:', e);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorPopup(null);

    try {
      const res = await fetch('/api/auth/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeNo, password, browserInfo }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorPopup({
          message: data.error || 'SSO 로그인에 실패했습니다.',
          errorCode: data.errorCode,
          detail: data.detail,
        });
        setError(data.error || 'SSO 로그인에 실패했습니다.');
        return;
      }

      if (!checkLocalStorageAvailable()) {
        const errorMsg = '브라우저 저장소를 사용할 수 없습니다. 시크릿 모드를 해제하거나 브라우저 설정을 확인해주세요.';
        await logClientError(employeeNo, 'LOCAL_STORAGE_UNAVAILABLE', errorMsg);
        setErrorPopup({
          message: errorMsg,
          errorCode: 'CLIENT_STORAGE_ERROR',
        });
        return;
      }

      try {
        console.log('[SSO] 토큰 저장 시작...', { tokenLength: data.token?.length });
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        const savedToken = localStorage.getItem('token');
        console.log('[SSO] 토큰 저장 확인:', {
          saved: !!savedToken,
          savedLength: savedToken?.length,
          match: savedToken === data.token
        });

        if (!savedToken || savedToken !== data.token) {
          throw new Error('토큰 저장 후 검증 실패');
        }
      } catch (storageError) {
        console.error('[SSO] localStorage 저장 실패:', storageError);
        await logClientError(employeeNo, 'LOCAL_STORAGE_WRITE_ERROR', storageError.message);
        setErrorPopup({
          message: '로그인 정보를 저장하는 데 실패했습니다. 브라우저 저장소 용량을 확인해주세요.',
          errorCode: 'CLIENT_STORAGE_ERROR',
          detail: storageError.message,
        });
        return;
      }

      console.log('[SSO] 메인 페이지로 이동 시작...');
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/');
    } catch (err) {
      await logClientError(employeeNo, 'NETWORK_ERROR', err.message);
      setErrorPopup({
        message: '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.',
        errorCode: 'NETWORK_ERROR',
        detail: err.message,
      });
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
            <h1 className='text-3xl font-bold text-foreground mb-2'>
              modol AI
            </h1>
            <div className='flex items-center justify-center gap-3 mt-4'>
              <span className='text-3xl font-bold text-foreground'>
                SSO 로그인
              </span>
            </div>
          </div>

          {/* SSO Login Form */}
          <Card>
            <form onSubmit={handleSubmit}>
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
                {error && !errorPopup && (
                  <Alert variant='destructive'>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='sso-employee-no'>
                    사번
                  </Label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='sso-employee-no'
                      type='text'
                      required
                      value={employeeNo}
                      onChange={(e) => setEmployeeNo(e.target.value)}
                      className='pl-10'
                      placeholder='사번을 입력하세요'
                      autoComplete='username'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='sso-password'>
                    비밀번호
                  </Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='sso-password'
                      type='password'
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className='pl-10'
                      placeholder='비밀번호를 입력하세요'
                      autoComplete='current-password'
                    />
                  </div>
                </div>

                <Button
                  type='submit'
                  disabled={loading}
                  className='w-full'
                  size='lg'
                >
                  {loading ? (
                    <>
                      <Loader2 className='h-5 w-5 animate-spin' />
                      인증 중...
                    </>
                  ) : (
                    <>
                      <LogIn className='h-5 w-5' />
                      SSO 로그인
                    </>
                  )}
                </Button>
              </CardContent>

              <CardFooter className='justify-center border-t border-border'>
                <p className='text-sm text-muted-foreground'>
                  SSO 전용 로그인입니다.
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      {/* 담당자 정보 */}
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

      <ErrorPopup error={errorPopup} onClose={() => setErrorPopup(null)} />
    </div>
  );
}
