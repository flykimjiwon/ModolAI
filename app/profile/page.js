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
} from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { AlertModal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useTranslation();
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
    { value: '디지털서비스개발부', label: t('signup.group_digital') },
    { value: '글로벌서비스개발부', label: t('signup.group_global') },
    { value: '금융서비스개발부', label: t('signup.group_finance') },
    { value: '정보서비스개발부', label: t('signup.group_info') },
    { value: 'Tech혁신Unit', label: t('signup.group_tech') },
    { value: '기타부서', label: t('signup.group_other') },
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
        throw new Error(errorData.error || t('profile.fetch_failed'));
      }

      const data = await response.json();
      setName(data.user.name || '');
      setEmail(data.user.email || '');
      setDepartment(data.user.department || '');
      setCell(data.user.cell || '');
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      setErrorModal({
        isOpen: true,
        title: t('profile.fetch_failed'),
        message: error.message || t('profile.fetch_error_message'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  // 프로필 업데이트
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    // 비밀번호 변경 시 검증
    if (changePassword) {
      if (!currentPassword) {
        setErrorModal({
          isOpen: true,
          title: t('profile.input_error'),
          message: t('profile.enter_current_password'),
          type: 'warning',
        });
        setSaving(false);
        return;
      }

      if (newPassword.length < 6) {
        setErrorModal({
          isOpen: true,
          title: t('profile.input_error'),
          message: t('profile.new_password_too_short'),
          type: 'warning',
        });
        setSaving(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorModal({
          isOpen: true,
          title: t('profile.input_error'),
          message: t('profile.new_password_mismatch'),
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
        throw new Error(errorData.error || t('profile.update_failed'));
      }

      setSuccessModal({
        isOpen: true,
        title: t('profile.update_complete'),
        message: t('profile.update_success'),
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
      console.error('Profile update failed:', error);
      setErrorModal({
        isOpen: true,
        title: t('profile.update_failed'),
        message: error.message || t('profile.update_failed'),
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
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background transition-colors duration-200 pb-8'>
      <div className='w-full max-w-full md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl mx-auto px-4 pt-8 pb-16'>
        {/* 헤더 */}
        <div className='mb-8'>
          <Button
            variant='ghost'
            onClick={() => router.push('/')}
            className='mb-4'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            {t('profile.back_to_chat')}
          </Button>
          <h1 className='text-3xl font-bold text-foreground'>
            {t('profile.title')}
          </h1>
          <p className='text-muted-foreground mt-1'>
            {t('profile.subtitle')}
          </p>
        </div>

        {/* 프로필 폼 */}
        <Card className='py-0 gap-0'>
          <CardContent className='p-6'>
            <form onSubmit={handleSubmit} className='space-y-6'>
              {/* 기본 정보 섹션 */}
              <div className='space-y-4'>
                <h3 className='text-lg font-medium text-foreground pb-2'>
                  {t('profile.basic_info')}
                </h3>
                <Separator className='-mt-2' />

                {/* 이름 */}
                <div className='space-y-2'>
                  <Label>{t('profile.name')}</Label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='text'
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className='pl-10'
                      placeholder={t('profile.name_placeholder')}
                    />
                  </div>
                </div>

                {/* 이메일 (읽기 전용) */}
                <div className='space-y-2'>
                  <Label>{t('profile.email')}</Label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='email'
                      value={email}
                      readOnly
                      className='pl-10 bg-muted text-muted-foreground cursor-not-allowed'
                      placeholder={t('profile.email')}
                    />
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {t('profile.email_read_only')}
                  </p>
                </div>

                {/* 부서 */}
                <div className='space-y-2'>
                  <Label>{t('signup.group')}</Label>
                  <div className='relative'>
                    <Building className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <select
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className='flex h-9 w-full rounded-md border border-input bg-transparent pl-10 pr-4 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'
                    >
                      <option value=''>{t('signup.group_placeholder')}</option>
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
                  <Label>{t('profile.cell')}</Label>
                  <div className='relative'>
                    <Phone className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                    <Input
                      type='text'
                      required
                      value={cell}
                      onChange={(e) => setCell(e.target.value)}
                      className='pl-10'
                      placeholder={t('profile.cell_placeholder')}
                    />
                  </div>
                </div>
              </div>

              {/* 비밀번호 변경 섹션 */}
              <div className='space-y-4'>
                <div className='flex items-center justify-between pb-2'>
                  <h3 className='text-lg font-medium text-foreground'>
                    {t('profile.change_password')}
                  </h3>
                  <Button
                    type='button'
                    variant='link'
                    size='sm'
                    onClick={() => setChangePassword(!changePassword)}
                  >
                    {changePassword ? t('common.cancel') : t('profile.change_password')}
                  </Button>
                </div>
                <Separator className='-mt-2' />

                {changePassword && (
                  <div className='space-y-4 bg-muted p-4 rounded-lg'>
                    {/* 현재 비밀번호 */}
                    <div className='space-y-2'>
                      <Label>{t('profile.current_password')}</Label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                        <Input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className='pl-10 pr-10'
                          placeholder={t('profile.current_password_placeholder')}
                        />
                        <button
                          type='button'
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                          className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
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
                      <Label>{t('profile.new_password')}</Label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                        <Input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className='pl-10 pr-10'
                          placeholder={t('profile.new_password_placeholder')}
                        />
                        <button
                          type='button'
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                        >
                          {showNewPassword ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </button>
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        {t('profile.password_min_length')}
                      </p>
                    </div>

                    {/* 새 비밀번호 확인 */}
                    <div className='space-y-2'>
                      <Label>{t('profile.confirm_password')}</Label>
                      <div className='relative'>
                        <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground' />
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className='pl-10 pr-10'
                          placeholder={t('profile.confirm_password_placeholder')}
                        />
                        <button
                          type='button'
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                          className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                        >
                          {showConfirmPassword ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p className='text-xs text-destructive'>
                          {t('profile.password_mismatch')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 저장 버튼 */}
              <Separator />
              <div className='flex justify-end'>
                <Button
                  type='submit'
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2'></div>
                      {t('profile.saving')}
                    </>
                  ) : (
                    <>
                      <Save className='h-4 w-4 mr-2' />
                      {t('profile.save_changes')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
