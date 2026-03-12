'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, User, Lock, Loader2, AlertCircle, X } from '@/components/icons';
import NoticePopup from '../components/NoticePopup';
import DarkModeToggle from '@/components/DarkModeToggle';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const { t } = useTranslation();
  if (!error) return null;

  const getErrorTitle = (errorCode) => {
    switch (errorCode) {
      case 'VALIDATION_ERROR': return t('sso.error_validation');
      case 'AUTH_FAILED': return t('sso.error_auth_failed');
      case 'LOGIN_DENIED': return t('sso.error_login_denied');
      case 'SSO_SYSTEM_ERROR': return t('sso.error_system');
      case 'SSO_SERVER_ERROR': return t('sso.error_server');
      case 'SSO_CONNECTION_ERROR': return t('sso.error_connection');
      case 'CLIENT_STORAGE_ERROR': return t('sso.error_storage');
      default: return t('sso.error_login');
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
              {t('sso.error_code_label')}: {error.errorCode}
            </p>
          )}
          {error.detail && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
              {t('sso.error_details_label')}: {error.detail}
            </p>
          )}
          <Button
            onClick={onClose}
            className="mt-4 w-full"
          >
            {t('common.close')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function SSOLoginPage() {
  const router = useRouter();
  const { t } = useTranslation();

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
    console.log('[SSO useEffect] Token check:', { exists: !!token, length: token?.length });
    if (token) {
      try {
        const payload = decodeJWTPayload(token);
        console.log('[SSO useEffect] Token parse success:', { email: payload.email, exp: payload.exp });
        if (payload?.exp && Date.now() >= payload.exp * 1000) {
          console.log('[SSO useEffect] Token expired -> removing');
          localStorage.removeItem('token');
          return;
        }
        console.log('[SSO useEffect] Valid token -> redirecting to home');
        router.replace('/');
      } catch (error) {
        console.error('[SSO useEffect] Token parse failed -> removing:', error, { tokenPreview: token?.substring(0, 100) });
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
        ? `${info.browserName} ${hasValidVersion ? browserVersion : 'unknown'} may not be fully supported. ${info.browserName} 111 or newer is recommended.`
        : 'Your browser may not fully support all features. Chrome/Edge 111 or newer is recommended.';
      setBrowserBlockedMessage(message);
      setBrowserAllowed(true);
      setBrowserInfoMessage('');
    } else {
      setBrowserBlockedMessage('');
      setBrowserAllowed(true);
      setBrowserInfoMessage(
        `You are currently using ${info.browserName} ${info.browserVersion}.`
      );
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
      console.error('[SSO] Failed to log client error:', e);
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
            message: data.error || t('sso.login_failed'),
            errorCode: data.errorCode,
            detail: data.detail,
          });
        setError(data.error || t('sso.login_failed'));
        return;
      }

      if (!checkLocalStorageAvailable()) {
        const errorMsg = t('sso.storage_unavailable');
        await logClientError(employeeNo, 'LOCAL_STORAGE_UNAVAILABLE', errorMsg);
        setErrorPopup({
          message: errorMsg,
          errorCode: 'CLIENT_STORAGE_ERROR',
        });
        return;
      }

      try {
        console.log('[SSO] Storing token...', { tokenLength: data.token?.length });
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        const savedToken = localStorage.getItem('token');
        console.log('[SSO] Token storage verification:', {
          saved: !!savedToken,
          savedLength: savedToken?.length,
          match: savedToken === data.token
        });

        if (!savedToken || savedToken !== data.token) {
          throw new Error('Token verification failed after storage.');
        }
      } catch (storageError) {
        console.error('[SSO] localStorage write failed:', storageError);
        await logClientError(employeeNo, 'LOCAL_STORAGE_WRITE_ERROR', storageError.message);
        setErrorPopup({
          message: t('sso.storage_save_failed'),
          errorCode: 'CLIENT_STORAGE_ERROR',
          detail: storageError.message,
        });
        return;
      }

      console.log('[SSO] Redirecting to home...');
      await new Promise(resolve => setTimeout(resolve, 100));
      router.push('/');
    } catch (err) {
      await logClientError(employeeNo, 'NETWORK_ERROR', err.message);
      setErrorPopup({
        message: t('sso.network_error'),
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
              {t('auth.login_title')}
            </h1>
            <div className='flex items-center justify-center gap-3 mt-4'>
              <span className='text-3xl font-bold text-foreground'>
                {t('sso.title')}
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
                    {t('sso.employee_id')}
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
                      placeholder={t('sso.employee_id_placeholder')}
                      autoComplete='username'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='sso-password'>
                    {t('auth.password')}
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
                      placeholder={t('auth.password_placeholder')}
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
                      {t('sso.authenticating')}
                    </>
                  ) : (
                    <>
                      <LogIn className='h-5 w-5' />
                      {t('sso.title')}
                    </>
                  )}
                </Button>
              </CardContent>

              <CardFooter className='justify-center border-t border-border'>
                <p className='text-sm text-muted-foreground'>
                  {t('sso.sso_only_notice')}
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>


      {supportContactsEnabled && supportContacts.length > 0 && (
        <div className='fixed bottom-4 right-4 z-40'>
          <div className='bg-card/95 border border-border rounded-lg shadow-lg px-4 py-3 text-xs text-foreground min-w-[220px]'>
            <div className='text-sm font-semibold mb-2'>{t('auth.support_contacts')}</div>
            <div className='space-y-2'>
              {supportContacts.map((contact, index) => (
                <div key={`support-${index}`}>
                  <div className='font-medium'>
                    {contact.department?.replaceAll('부서', '그룹') || t('auth.no_group')}
                  </div>
                  <div className='text-muted-foreground'>
                    {(contact.name || t('auth.no_name')) +
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
