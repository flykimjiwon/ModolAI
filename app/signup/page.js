'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Mail,
  Lock,
  Loader2,
  User,
  Building,
  Briefcase,
} from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignUpPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);

  const departments = [
    { value: '', label: t('signup.group_placeholder') },
    { value: '디지털서비스개발부', label: t('signup.group_digital') },
    { value: '글로벌서비스개발부', label: t('signup.group_global') },
    { value: '금융서비스개발부', label: t('signup.group_finance') },
    { value: '정보서비스개발부', label: t('signup.group_info') },
    { value: 'Tech혁신Unit', label: t('signup.group_tech') },
    { value: '기타부서', label: t('signup.group_other') },
  ];

  // 이메일 중복 검증 함수
  const checkEmailDuplicate = async (emailValue) => {
    if (!emailValue || !emailValue.includes('@')) return;

    setCheckingEmail(true);
    setEmailError('');

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue }),
      });

      const data = await response.json();

      if (!data.available) {
        setEmailError(data.message);
      }
    } catch (error) {
      console.error('Email validation error:', error);
    } finally {
      setCheckingEmail(false);
    }
  };

  // 이메일 입력 핸들러
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError('');

    clearTimeout(window.emailCheckTimer);
    window.emailCheckTimer = setTimeout(() => {
      checkEmailDuplicate(value);
    }, 500);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError(t('signup.password_mismatch'));
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError(t('signup.password_too_short'));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, department, position }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('signup.signup_failed'));
      }

      router.push('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-background transition-colors duration-200 flex flex-col'>
      <div className='flex-1 flex items-center justify-center px-4 py-8'>
        <div className='w-full max-w-md'>
          {/* Logo/Title */}
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-foreground mb-2'>
              {t('signup.title')}
            </h1>
            <p className='text-muted-foreground'>
              {t('signup.subtitle')}
            </p>
          </div>

          {/* Signup Form */}
          <Card>
            <form
              id='signup-form'
              data-testid='signup-form'
              onSubmit={handleSubmit}
            >
              <CardContent className='space-y-4'>
                {error && (
                  <Alert variant='destructive'>
                    <AlertDescription
                      id='signup-error'
                      data-testid='signup-error'
                    >
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <div className='space-y-2'>
                  <Label htmlFor='signup-name'>
                    {t('signup.name')}
                  </Label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='signup-name'
                      data-testid='signup-name'
                      type='text'
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className='pl-10'
                      placeholder={t('signup.name_placeholder')}
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-email'>
                    {t('auth.email')}
                  </Label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='signup-email'
                      data-testid='signup-email'
                      type='email'
                      required
                      value={email}
                      onChange={handleEmailChange}
                      className={`pl-10 pr-10 ${emailError ? 'border-destructive' : ''}`}
                      placeholder={t('auth.email_placeholder')}
                    />
                    {checkingEmail && (
                      <Loader2
                        data-testid='signup-email-checking'
                        className='absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin'
                      />
                    )}
                  </div>
                  {emailError && (
                    <p
                      id='signup-email-error'
                      data-testid='signup-email-error'
                      className='text-sm text-destructive mt-1'
                    >
                      {emailError}
                    </p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-department'>
                    {t('signup.group')}
                  </Label>
                  <div className='relative'>
                    <Building className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <select
                      id='signup-department'
                      data-testid='signup-department'
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm pl-10'
                    >
                      {departments.map((dept) => (
                        <option
                          key={dept.value}
                          value={dept.value}
                          className='bg-popover'
                        >
                          {dept.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-position'>
                    {t('signup.position')}
                  </Label>
                  <div className='relative'>
                    <Briefcase className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='signup-position'
                      data-testid='signup-position'
                      type='text'
                      required
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className='pl-10'
                      placeholder={t('signup.position_placeholder')}
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-password'>
                    {t('auth.password')}
                  </Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='signup-password'
                      data-testid='signup-password'
                      type='password'
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className='pl-10'
                      placeholder={t('signup.password_placeholder')}
                    />
                  </div>
                  <p
                    id='signup-password-hint'
                    data-testid='signup-password-hint'
                    className='text-xs text-muted-foreground'
                  >
                    {t('signup.password_hint')}
                  </p>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='signup-confirm-password'>
                    {t('signup.password_confirm')}
                  </Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      id='signup-confirm-password'
                      data-testid='signup-confirm-password'
                      type='password'
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className='pl-10'
                      placeholder={t('signup.password_confirm_placeholder')}
                    />
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p
                      id='signup-password-mismatch'
                      data-testid='signup-password-mismatch'
                      className='text-xs text-destructive'
                    >
                      {t('signup.password_mismatch')}
                    </p>
                  )}
                </div>

                <Button
                  id='signup-submit'
                  data-testid='signup-submit'
                  type='submit'
                  disabled={loading || emailError || checkingEmail}
                  className='w-full'
                  size='lg'
                >
                  {loading ? (
                    <>
                      <Loader2
                        data-testid='signup-submit-loading'
                        className='h-5 w-5 animate-spin'
                      />
                      {t('common.processing')}
                    </>
                  ) : (
                    <>
                      <UserPlus className='h-5 w-5' />
                      {t('signup.submit')}
                    </>
                  )}
                </Button>
              </CardContent>

              <CardFooter className='justify-center border-t border-border'>
                <p className='text-sm text-muted-foreground'>
                  {t('auth.has_account')}{' '}
                  <a
                    id='signup-login-link'
                    data-testid='signup-login-link'
                    href='/login'
                    className='text-primary hover:text-primary/80 font-medium'
                  >
                    {t('auth.sign_in')}
                  </a>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
