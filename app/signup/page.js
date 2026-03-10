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
} from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();

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
    { value: '', label: '부서를 선택하세요' },
    { value: '디지털서비스개발부', label: '디지털서비스개발부' },
    { value: '글로벌서비스개발부', label: '글로벌서비스개발부' },
    { value: '금융서비스개발부', label: '금융서비스개발부' },
    { value: '정보서비스개발부', label: '정보서비스개발부' },
    { value: 'Tech혁신Unit', label: 'Tech혁신Unit' },
    { value: '기타부서', label: '기타부서' },
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
      console.error('이메일 검증 오류:', error);
    } finally {
      setCheckingEmail(false);
    }
  };

  // 이메일 입력 핸들러
  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError('');

    // 디바운스를 위해 타이머 사용
    clearTimeout(window.emailCheckTimer);
    window.emailCheckTimer = setTimeout(() => {
      checkEmailDuplicate(value);
    }, 500);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 비밀번호 확인 검증
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다.');
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
        // API 가 반환한 에러 메시지를 그대로 보여줍니다.
        throw new Error(data.error || '회원가입에 실패했습니다.');
      }

      // 성공하면 로그인 페이지로 이동
      router.push('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 transition-colors duration-200 flex flex-col dark:bg-gray-900'>
      <div className='flex-1 flex items-center justify-center px-4 py-8'>
        <div className='w-full max-w-md'>
          {/* Logo/Title */}
          <div className='text-center mb-8'>
            <h1 className='text-3xl font-bold text-gray-900 mb-2 dark:text-gray-100'>
              Tech그룹 AI
            </h1>
            <p className='text-gray-600 dark:text-gray-400'>
              새 계정을 만드세요
            </p>
          </div>

          {/* Signup Form */}
          <form
            id='signup-form'
            data-testid='signup-form'
            onSubmit={handleSubmit}
            className='card p-6 space-y-4 dark:bg-gray-800'
          >
            {error && (
              <div
                id='signup-error'
                data-testid='signup-error'
                className='p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg'
              >
                {error}
              </div>
            )}

            <div className='space-y-2'>
              <label
                htmlFor='signup-name'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                이름
              </label>
              <div className='relative'>
                <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='signup-name'
                  data-testid='signup-name'
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
              <label
                htmlFor='signup-email'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                이메일
              </label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='signup-email'
                  data-testid='signup-email'
                  type='email'
                  required
                  value={email}
                  onChange={handleEmailChange}
                  className={`input-primary pl-10 pr-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 ${emailError ? 'border-red-500 dark:border-red-500' : ''
                    }`}
                  placeholder='이메일을 입력하세요'
                />
                {checkingEmail && (
                  <Loader2
                    data-testid='signup-email-checking'
                    className='absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin'
                  />
                )}
              </div>
              {emailError && (
                <p
                  id='signup-email-error'
                  data-testid='signup-email-error'
                  className='text-sm text-red-600 dark:text-red-400 mt-1'
                >
                  {emailError}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='signup-department'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                부서
              </label>
              <div className='relative'>
                <Building className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <select
                  id='signup-department'
                  data-testid='signup-department'
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                >
                  {departments.map((dept) => (
                    <option
                      key={dept.value}
                      value={dept.value}
                      className='dark:bg-gray-700'
                    >
                      {dept.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='signup-position'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                직급
              </label>
              <div className='relative'>
                <Briefcase className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='signup-position'
                  data-testid='signup-position'
                  type='text'
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='직급을 입력하세요 (예: 프로, 팀장)'
                />
              </div>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='signup-password'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                비밀번호
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='signup-password'
                  data-testid='signup-password'
                  type='password'
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='비밀번호를 입력하세요 (최소 6자)'
                />
              </div>
              <p
                id='signup-password-hint'
                data-testid='signup-password-hint'
                className='text-xs text-gray-500 dark:text-gray-400'
              >
                비밀번호는 최소 6자 이상이어야 합니다.
              </p>
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='signup-confirm-password'
                className='block text-sm font-medium text-gray-700 dark:text-gray-300'
              >
                비밀번호 확인
              </label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                <input
                  id='signup-confirm-password'
                  data-testid='signup-confirm-password'
                  type='password'
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className='input-primary pl-10 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
                  placeholder='비밀번호를 다시 입력하세요'
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p
                  id='signup-password-mismatch'
                  data-testid='signup-password-mismatch'
                  className='text-xs text-red-500'
                >
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
            </div>

            <button
              id='signup-submit'
              data-testid='signup-submit'
              type='submit'
              disabled={loading || emailError || checkingEmail}
              className='btn-primary w-full flex items-center justify-center gap-2'
            >
              {loading ? (
                <>
                  <Loader2
                    data-testid='signup-submit-loading'
                    className='h-5 w-5 animate-spin'
                  />
                  처리 중...
                </>
              ) : (
                <>
                  <UserPlus className='h-5 w-5' />
                  회원가입
                </>
              )}
            </button>

            <div className='text-center pt-4 border-t border-gray-200 dark:border-gray-700'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                이미 계정이 있나요?{' '}
                <a
                  id='signup-login-link'
                  data-testid='signup-login-link'
                  href='/login'
                  className='text-blue-600 hover:text-blue-700 font-medium dark:text-blue-400 dark:hover:text-blue-500'
                >
                  로그인
                </a>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
