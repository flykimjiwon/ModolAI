'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Mail, Lock, Loader2, AlertTriangle } from 'lucide-react';
import DarkModeToggle from '@/components/DarkModeToggle';

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
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-blue-600' />
      </div>
    );
  }

  if (hasAdmin) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4'>
        <div className='text-center'>
          <AlertTriangle className='h-12 w-12 text-yellow-500 mx-auto mb-4' />
          <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2'>
            이미 관리자가 존재합니다
          </h2>
          <p className='text-gray-600 dark:text-gray-400 mb-4'>
            기존 관리자에게 계정 권한을 요청하세요.
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-500'>
            잠시 후 로그인 페이지로 이동합니다...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col'>
      <div className='flex-1 flex items-center justify-center px-4 relative'>
        <div className='absolute top-4 right-4'>
          <DarkModeToggle />
        </div>
        <div className='w-full max-w-md'>
          <div className='text-center mb-8'>
            <div className='flex justify-center mb-4'>
              <div className='h-14 w-14 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center'>
                <ShieldCheck className='h-8 w-8 text-blue-600 dark:text-blue-400' />
              </div>
            </div>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
              초기 설정
            </h1>
            <p className='text-gray-600 dark:text-gray-400'>
              첫 번째 관리자 계정을 생성합니다
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className='card p-6 space-y-4 dark:bg-gray-800'
          >
            {error && (
              <div
                role='alert'
                className='p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400'
              >
                {error}
              </div>
            )}

            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                이름
              </label>
              <div className='relative'>
                <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  type='text'
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='이름을 입력하세요'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                이메일
              </label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  type='email'
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='이메일을 입력하세요'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                비밀번호
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  type='password'
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='비밀번호 (6자 이상)'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                비밀번호 확인
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  type='password'
                  required
                  minLength={6}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='비밀번호를 다시 입력하세요'
                />
              </div>
            </div>

            <button
              type='submit'
              disabled={loading}
              className='btn-primary w-full flex items-center justify-center gap-2'
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
            </button>

            <div className='text-center pt-4 border-t border-gray-200 dark:border-gray-700'>
              <a
                href='/login'
                className='text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-500'
              >
                로그인 페이지로 돌아가기
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
