'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from '@/components/icons';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/useTranslation';

export default function BoardWritePage() {
  const router = useRouter();
  const { alert } = useAlert();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState('user');
  const [isNotice, setIsNotice] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }
    try {
      const payload = decodeJWTPayload(token);
      setUserRole(payload.role || 'user');
    } catch (error) {
      console.error('토큰 파싱 실패:', error);
      localStorage.removeItem('token');
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
    }
  }, [router]);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setBoardEnabled(
          data.boardEnabled !== undefined ? data.boardEnabled : true
        );
      })
      .catch(() => {});
  }, []);

  const submitPost = async () => {
    if (!title.trim() || !content.trim()) {
      alert(t('common.title_content_required'), 'warning', t('common.input_required'));
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/board/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          isNotice: userRole === 'admin' ? isNotice : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t('board.post_create_error'));
      }

      alert(t('board.post_created'), 'success', t('common.complete'));
      router.push('/board');
    } catch (error) {
      console.error('게시글 등록 실패:', error);
      alert(error.message || t('board.post_create_failed'), 'error', t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (!boardEnabled) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='w-full max-w-4xl mx-auto p-6'>
          <div className='flex items-center gap-4 mb-6'>
            <Button
              onClick={() => router.push('/board')}
              variant='ghost'
              size='icon'
              title={t('common.go_back')}
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <h1 className='text-2xl font-bold text-foreground'>
              {t('board.title')}
            </h1>
          </div>
          <Card>
            <CardContent className='p-6 text-center text-sm text-muted-foreground'>
              {t('board.disabled')}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background'>
      <div className='w-full max-w-4xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <Button
              onClick={() => router.push('/board')}
              variant='ghost'
              size='icon'
              title={t('common.go_back')}
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <h1 className='text-2xl font-bold text-foreground'>
              {t('board.write_title')}
            </h1>
          </div>
          <Button
            onClick={submitPost}
            disabled={saving}
          >
            <Save className='h-4 w-4' />
            {saving ? t('common.saving') : t('common.submit')}
          </Button>
        </div>

        <Card>
          <CardContent className='p-6 space-y-4'>
            <div>
              <Label className='mb-2'>
                {t('common.title_label')}
              </Label>
              <Input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
              <p className='text-xs text-muted-foreground mt-1'>
                {t('common.char_count', { current: title.length, max: 200 })}
              </p>
            </div>

            <div>
              <Label className='mb-2'>
                {t('common.content_label')}
              </Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className='min-h-[220px]'
                maxLength={10000}
              />
              <p className='text-xs text-muted-foreground mt-1'>
                {t('common.char_count', { current: content.length, max: '10,000' })}
              </p>
            </div>

            {userRole === 'admin' && (
              <div className='flex items-center justify-between border border-border rounded-lg p-4 bg-muted'>
                <div>
                  <p className='text-sm font-medium text-foreground'>
                    {t('board.notice_register')}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {t('board.notice_register_desc')}
                  </p>
                </div>
                <Switch
                  checked={isNotice}
                  onCheckedChange={setIsNotice}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
