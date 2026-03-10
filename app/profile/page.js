'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Building,
  Phone,
  Lock,
  Save,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AlertModal } from '@/components/ui/modal';

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 기본 정보
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [cell, setCell] = useState('');

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePassword, setChangePassword] = useState(false);

  const departments = [
    { value: '디지털서비스개발부', label: '디지털서비스개발부' },
    { value: '글로벌서비스개발부', label: '글로벌서비스개발부' },
    { value: '금융서비스개발부', label: '금융서비스개발부' },
    { value: '정보서비스개발부', label: '정보서비스개발부' },
    { value: 'Tech혁신Unit', label: 'Tech혁신Unit' },
    { value: '기타부서', label: '기타부서' },
  ];

  // 현재 사용자 정보 조회
  const fetchUserInfo = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      const response = await fetch('/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '사용자 정보 조회 실패');
      }

      const data = await response.json();
      setName(data.user.name || '');
      setEmail(data.user.email || '');
      setDepartment(data.user.department || '');
      setCell(data.user.cell || '');
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      setErrorModal({
        isOpen: true,
        title: '사용자 정보 조회 실패',
        message: error.message || '사용자 정보를 불러오는데 실패했습니다.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [router]);

  // 프로필 업데이트
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // 비밀번호 변경 시 검증
    if (changePassword) {
      if (!currentPassword) {
        setErrorModal({
          isOpen: true,
          title: '입력 오류',
          message: '현재 비밀번호를 입력해주세요.',
          type: 'warning',
        });
        setSaving(false);
        return;
      }

      if (newPassword.length < 6) {
        setErrorModal({
          isOpen: true,
          title: '입력 오류',
          message: '새 비밀번호는 최소 6자 이상이어야 합니다.',
          type: 'warning',
        });
        setSaving(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorModal({
          isOpen: true,
          title: '입력 오류',
          message: '새 비밀번호가 일치하지 않습니다.',
          type: 'warning',
        });
        setSaving(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const updateData = {
        name,
        department,
        cell,
      };

      // 비밀번호 변경이 요청된 경우
      if (changePassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '프로필 업데이트 실패');
      }

      setSuccessModal({
        isOpen: true,
        title: '업데이트 완료',
        message: '프로필이 성공적으로 업데이트되었습니다.',
        type: 'success',
      });

      // 비밀번호 변경 폼 초기화
      if (changePassword) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setChangePassword(false);
      }
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
      setErrorModal({
        isOpen: true,
        title: '프로필 업데이트 실패',
        message: error.message || '프로필 업데이트에 실패했습니다.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200 pb-8'>
      <div className='w-full max-w-full md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto px-4 pt-8 pb-16'>
        {/* 헤더 */}
        <div className='mb-8'>
          <button
            onClick={() => router.push('/')}
            className='inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            뒤로 가기
          </button>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
            프로필 수정
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            개인 정보를 수정할 수 있습니다.
          </p>
        </div>

        {/* 프로필 폼 */}
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700'>
          <div className='p-6'>
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* 기본 정보 섹션 */}
              <div className='space-y-4'>
                <h3 className='text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2'>
                  기본 정보
                </h3>

                {/* 이름 */}
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
                      className='w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                      placeholder='이름을 입력하세요'
                    />
                  </div>
                </div>

                {/* 이메일 (읽기 전용) */}
                <div className='space-y-2'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                    이메일
                  </label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                    <input
                      type='email'
                      value={email}
                      readOnly
                      className='w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      placeholder='이메일'
                    />
                  </div>
                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                    이메일은 변경할 수 없습니다.
                  </p>
                </div>

                {/* 부서 */}
                <div className='space-y-2'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                    부서
                  </label>
                  <div className='relative'>
                    <Building className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                    <select
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className='w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                    >
                      <option value=''>부서를 선택하세요</option>
                      {departments.map((dept) => (
                        <option key={dept.value} value={dept.value}>
                          {dept.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cell */}
                <div className='space-y-2'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                    Cell (팀/파트)
                  </label>
                  <div className='relative'>
                    <Phone className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                    <input
                      type='text'
                      required
                      value={cell}
                      onChange={(e) => setCell(e.target.value)}
                      className='w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                      placeholder='예: 디지털라이프셀, 디지털뱅킹셀'
                    />
                  </div>
                </div>
              </div>

              {/* 비밀번호 변경 섹션 */}
              <div className='space-y-4'>
                <div className='flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2'>
                  <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                    비밀번호 변경
                  </h3>
                  <button
                    type='button'
                    onClick={() => setChangePassword(!changePassword)}
                    className='text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                  >
                    {changePassword ? '취소' : '비밀번호 변경'}
                  </button>
                </div>

                {changePassword && (
                  <div className='space-y-4 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg'>
                    {/* 현재 비밀번호 */}
                    <div className='space-y-2'>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        현재 비밀번호
                      </label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className='w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                          placeholder='현재 비밀번호를 입력하세요'
                        />
                        <button
                          type='button'
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
                        >
                          {showCurrentPassword ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 새 비밀번호 */}
                    <div className='space-y-2'>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        새 비밀번호
                      </label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className='w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                          placeholder='새 비밀번호를 입력하세요'
                        />
                        <button
                          type='button'
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
                        >
                          {showNewPassword ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </button>
                      </div>
                      <p className='text-xs text-gray-500 dark:text-gray-400'>
                        최소 6자 이상
                      </p>
                    </div>

                    {/* 새 비밀번호 확인 */}
                    <div className='space-y-2'>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        새 비밀번호 확인
                      </label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400' />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className='w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                          placeholder='새 비밀번호를 다시 입력하세요'
                        />
                        <button
                          type='button'
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className='absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600'
                        >
                          {showConfirmPassword ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className='text-xs text-red-500'>
                          비밀번호가 일치하지 않습니다.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 저장 버튼 */}
              <div className='flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700'>
                <button
                  type='submit'
                  disabled={saving}
                  className='inline-flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors'
                >
                  {saving ? (
                    <>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className='h-4 w-4 mr-2' />
                      저장하기
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* 에러 모달 */}
      <AlertModal
        isOpen={errorModal.isOpen}
        onClose={() =>
          setErrorModal({
            isOpen: false,
            title: '',
            message: '',
            type: 'error',
          })
        }
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
      />

      {/* 성공 모달 */}
      <AlertModal
        isOpen={successModal.isOpen}
        onClose={() =>
          setSuccessModal({
            isOpen: false,
            title: '',
            message: '',
            type: 'success',
          })
        }
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />
    </div>
  );
}
