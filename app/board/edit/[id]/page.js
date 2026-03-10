'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';

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
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='w-full max-w-4xl mx-auto p-6'>
          <div className='flex items-center gap-4 mb-6'>
            <button
              onClick={() => router.push('/board')}
              className='p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
              자유게시판
            </h1>
          </div>
          <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-600 dark:text-gray-400'>
            자유게시판이 비활성화되어 있습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
      <div className='w-full max-w-4xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => router.push(`/board/${params.id}`)}
              className='p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
              글 수정
            </h1>
          </div>
          <button
            onClick={submitUpdate}
            disabled={saving}
            className='btn-primary flex items-center gap-2 text-sm px-4 py-2'
          >
            <Save className='h-4 w-4' />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4'>
          {loading ? (
            <div className='flex items-center justify-center h-32'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
          ) : (
            <>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  제목
                </label>
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  maxLength={200}
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  {title.length}/200자
                </p>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  내용
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[220px]'
                  maxLength={10000}
                />
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  {content.length}/10,000자
                </p>
              </div>

              {userRole === 'admin' && (
                <div className='flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800'>
                  <div>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>
                      공지 등록
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      공지로 등록하면 목록 상단에 고정됩니다.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsNotice(!isNotice)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                      isNotice ? 'bg-red-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                        isNotice ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
