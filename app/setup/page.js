'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Mail, Lock, Loader2, AlertTriangle } from '@/components/icons';
import DarkModeToggle from '@/components/DarkModeToggle';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SetupPage() {
  const router = useRouter();

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
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
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
        throw new Error(data.error || '계정 생성에 실패했습니다.');
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
            이미 관리자가 존재합니다
          </h2>
          <p className='text-muted-foreground mb-4'>
            기존 관리자에게 계정 권한을 요청하세요.
          </p>
          <p className='text-sm text-muted-foreground'>
            잠시 후 로그인 페이지로 이동합니다...
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
              초기 설정
            </h1>
            <p className='text-muted-foreground'>
              첫 번째 관리자 계정을 생성합니다
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
                  <Label>이름</Label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='text'
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className='pl-10'
                      placeholder='이름을 입력하세요'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label>이메일</Label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='email'
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className='pl-10'
                      placeholder='이메일을 입력하세요'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label>비밀번호</Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='password'
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className='pl-10'
                      placeholder='비밀번호 (6자 이상)'
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label>비밀번호 확인</Label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='password'
                      required
                      minLength={6}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className='pl-10'
                      placeholder='비밀번호를 다시 입력하세요'
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
                      생성 중...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className='h-5 w-5' />
                      관리자 계정 생성
                    </>
                  )}
                </Button>
              </CardContent>

              <CardFooter className='justify-center border-t border-border'>
                <a
                  href='/login'
                  className='text-sm text-primary hover:text-primary/80'
                >
                  로그인 페이지로 돌아가기
                </a>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
