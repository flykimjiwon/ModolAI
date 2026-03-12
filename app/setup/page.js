'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Mail, Lock, Loader2, AlertTriangle } from '@/components/icons';
import DarkModeToggle from '@/components/DarkModeToggle';
import { useTranslation } from '@/hooks/useTranslation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SetupPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/create-first-admin')
      .then((res) => res.json())
      .then((data) => {
        setHasAdmin(data.hasAdmin);
        setChecking(false);
        if (data.hasAdmin) {
          setTimeout(() => router.replace('/login'), 3000);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError(t('signup.password_mismatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('setup.password_min_length'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/create-first-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t('setup.create_failed'));
      }

      localStorage.setItem('token', data.token);
      router.push('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    );
  }

  if (hasAdmin) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center px-4'>
        <div className='text-center'>
          <AlertTriangle className='h-12 w-12 text-yellow-500 mx-auto mb-4' />
          <h2 className='text-xl font-semibold text-foreground mb-2'>
            {t('setup.admin_exists')}
          </h2>
          <p className='text-muted-foreground mb-4'>
            {t('setup.admin_exists_description')}
          </p>
          <p className='text-sm text-muted-foreground'>
            {t('setup.redirect_notice')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background flex flex-col'>
      <div className='flex-1 flex items-center justify-center px-4 relative'>
        <div className='absolute top-4 right-4'>
          <DarkModeToggle />
        </div>
        <div className='w-full max-w-md'>
          <div className='text-center mb-8'>
            <div className='flex justify-center mb-4'>
              <div className='h-14 w-14 bg-primary/10 rounded-full flex items-center justify-center'>
                <ShieldCheck className='h-8 w-8 text-primary' />
              </div>
            </div>
            <h1 className='text-3xl font-bold text-foreground mb-2'>
              {t('setup.title')}
            </h1>
            <p className='text-muted-foreground'>
              {t('setup.subtitle')}
            </p>
          </div>

          <Card>
            <form onSubmit={handleSubmit}>
              <CardContent className='space-y-4'>
                {error && (
                  <Alert variant='destructive'>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className='space-y-2'>
                  <Label>{t('signup.name')}</Label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
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
                  <Label>{t('auth.email')}</Label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='email'
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className='pl-10'
                      placeholder={t('auth.email_placeholder')}
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label>{t('auth.password')}</Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='password'
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className='pl-10'
                      placeholder={t('setup.password_placeholder')}
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label>{t('signup.password_confirm')}</Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='password'
                      required
                      minLength={6}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className='pl-10'
                      placeholder={t('signup.password_confirm_placeholder')}
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
                      {t('setup.creating')}
                    </>
                  ) : (
                    <>
                      <ShieldCheck className='h-5 w-5' />
                      {t('setup.create_admin')}
                    </>
                  )}
                </Button>
              </CardContent>

              <CardFooter className='justify-center border-t border-border'>
                <a
                  href='/login'
                  className='text-sm text-primary hover:text-primary/80'
                >
                  {t('setup.back_to_login')}
                </a>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
