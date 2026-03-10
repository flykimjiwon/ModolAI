'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export default function BoardEditPage() {
  const router = useRouter();
  const params = useParams();
  const { alert } = useAlert();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');
  const [userId, setUserId] = useState('');
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
      setUserId(payload.sub || '');
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

  const fetchPost = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/board/posts/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '게시글 조회 실패');
      }

      const data = await response.json();
      const post = data.post;
      if (!post) {
        throw new Error('게시글을 찾을 수 없습니다.');
      }

      if (userRole !== 'admin' && post.userId !== userId) {
        alert('수정 권한이 없습니다.', 'error', '권한 없음');
        router.push('/board');
        return;
      }

      setTitle(post.title);
      setContent(post.content);
      setIsNotice(Boolean(post.isNotice));
    } catch (error) {
      console.error('게시글 조회 실패:', error);
      alert(error.message || '게시글을 불러오는데 실패했습니다.', 'error', '오류');
    } finally {
      setLoading(false);
    }
  }, [alert, params.id, router, userId, userRole]);

  useEffect(() => {
    if (boardEnabled && userId) {
      fetchPost();
    }
  }, [boardEnabled, fetchPost, userId]);

  const submitUpdate = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.', 'warning', '입력 필요');
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/board/posts/${params.id}`, {
        method: 'PUT',
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
        throw new Error(data.error || '게시글 수정 실패');
      }

      alert('게시글이 수정되었습니다.', 'success', '완료');
      router.push(`/board/${params.id}`);
    } catch (error) {
      console.error('게시글 수정 실패:', error);
      alert(error.message || '게시글 수정에 실패했습니다.', 'error', '오류');
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
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <h1 className='text-2xl font-bold text-foreground'>
              자유게시판
            </h1>
          </div>
          <Card>
            <CardContent className='p-6 text-center text-sm text-muted-foreground'>
              자유게시판이 비활성화되어 있습니다.
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
              onClick={() => router.push(`/board/${params.id}`)}
              variant='ghost'
              size='icon'
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <h1 className='text-2xl font-bold text-foreground'>
              글 수정
            </h1>
          </div>
          <Button
            onClick={submitUpdate}
            disabled={saving}
          >
            <Save className='h-4 w-4' />
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>

        <Card>
          <CardContent className='p-6 space-y-4'>
            {loading ? (
              <div className='flex items-center justify-center h-32'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
              </div>
            ) : (
              <>
                <div>
                  <Label className='mb-2'>
                    제목
                  </Label>
                  <Input
                    type='text'
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                  <p className='text-xs text-muted-foreground mt-1'>
                    {title.length}/200자
                  </p>
                </div>

                <div>
                  <Label className='mb-2'>
                    내용
                  </Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className='min-h-[220px]'
                    maxLength={10000}
                  />
                  <p className='text-xs text-muted-foreground mt-1'>
                    {content.length}/10,000자
                  </p>
                </div>

                {userRole === 'admin' && (
                  <div className='flex items-center justify-between border border-border rounded-lg p-4 bg-muted'>
                    <div>
                      <p className='text-sm font-medium text-foreground'>
                        공지 등록
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        공지로 등록하면 목록 상단에 고정됩니다.
                      </p>
                    </div>
                    <Switch
                      checked={isNotice}
                      onCheckedChange={setIsNotice}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
