'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Send, Eye } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';

export default function BoardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { alert, confirm } = useAlert();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('user');
  const [userId, setUserId] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [savingComment, setSavingComment] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

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
      setPost(data.post);
      setComments(data.comments || []);
    } catch (error) {
      console.error('게시글 조회 실패:', error);
      alert('게시글을 불러오는데 실패했습니다.', 'error', '오류');
    } finally {
      setLoading(false);
    }
  }, [alert, params.id, router]);

  useEffect(() => {
    if (boardEnabled) {
      fetchPost();
    } else {
      setLoading(false);
    }
  }, [boardEnabled, fetchPost]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    });
  };

  const canManagePost = post && (userRole === 'admin' || post.userId === userId);

  const deletePost = async () => {
    if (!post) return;
    const confirmed = await confirm(
      `'${post.title}' 글을 삭제하시겠습니까?`,
      '게시글 삭제 확인'
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/board/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '게시글 삭제 실패');
      }

      alert('게시글이 삭제되었습니다.', 'success', '삭제 완료');
      router.push('/board');
    } catch (error) {
      console.error('게시글 삭제 실패:', error);
      alert('게시글 삭제에 실패했습니다.', 'error', '삭제 실패');
    }
  };

  const submitComment = async () => {
    if (!commentInput.trim()) {
      alert('댓글 내용을 입력해주세요.', 'warning', '입력 필요');
      return;
    }

    try {
      setSavingComment(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/board/comments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: post.id,
          content: commentInput.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '댓글 등록 실패');
      }

      setCommentInput('');
      fetchPost();
    } catch (error) {
      console.error('댓글 등록 실패:', error);
      alert('댓글 등록에 실패했습니다.', 'error', '오류');
    } finally {
      setSavingComment(false);
    }
  };

  const deleteComment = async (comment) => {
    const confirmed = await confirm('댓글을 삭제하시겠습니까?', '댓글 삭제');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/board/comments/${comment.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '댓글 삭제 실패');
      }
      fetchPost();
    } catch (error) {
      console.error('댓글 삭제 실패:', error);
      alert('댓글 삭제에 실패했습니다.', 'error', '오류');
    }
  };

  const startEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const saveEditComment = async (comment) => {
    if (!editingCommentText.trim()) {
      alert('댓글 내용을 입력해주세요.', 'warning', '입력 필요');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/board/comments/${comment.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editingCommentText.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '댓글 수정 실패');
      }

      cancelEditComment();
      fetchPost();
    } catch (error) {
      console.error('댓글 수정 실패:', error);
      alert('댓글 수정에 실패했습니다.', 'error', '오류');
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
      <div className='w-full max-w-4xl mx-auto p-6 space-y-6'>
        <div className='flex items-center justify-between'>
          <button
            onClick={() => router.push('/board')}
            className='flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
          >
            <ArrowLeft className='h-5 w-5' />
            목록으로
          </button>
          {canManagePost && (
            <div className='flex items-center gap-2'>
              <button
                onClick={() => router.push(`/board/edit/${post.id}`)}
                className='btn-secondary flex items-center gap-2 text-sm px-3 py-1.5'
              >
                <Edit className='h-4 w-4' />
                수정
              </button>
              <button
                onClick={deletePost}
                className='btn-danger flex items-center gap-2 text-sm px-3 py-1.5'
              >
                <Trash2 className='h-4 w-4' />
                삭제
              </button>
            </div>
          )}
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
          {loading || !post ? (
            <div className='flex items-center justify-center h-32'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
          ) : (
            <>
              <div className='flex items-center gap-2 mb-2'>
                <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {post.title}
                </h1>
                {post.isNotice && (
                  <span className='px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full'>
                    공지
                  </span>
                )}
              </div>
              <div className='text-xs text-gray-500 dark:text-gray-400 mb-4 flex flex-wrap gap-3'>
                <span>{post.author?.name || '익명'}</span>
                {post.author?.department && (
                  <span>{post.author.department}</span>
                )}
                <span>{formatDate(post.createdAt)}</span>
                <span className='flex items-center gap-1'>
                  <Eye className='h-3 w-3' />
                  {post.views ?? 0}
                </span>
              </div>
              <div className='markdown-content text-gray-900 dark:text-gray-100'>
                <MarkdownPreview
                  source={post.content}
                  className='text-gray-900 dark:text-gray-100'
                  style={{ padding: 0, backgroundColor: 'transparent', color: 'inherit' }}
                />
              </div>
            </>
          )}
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4'>
          <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
            댓글 {comments.length}
          </h2>

          <div className='space-y-3'>
            {comments.length === 0 ? (
              <p className='text-sm text-gray-500 dark:text-gray-400'>
                아직 댓글이 없습니다.
              </p>
            ) : (
              comments.map((comment) => {
                const canDelete =
                  userRole === 'admin' || comment.userId === userId;
                return (
                  <div
                    key={comment.id}
                    className='border border-gray-200 dark:border-gray-700 rounded-lg p-3'
                  >
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                          {comment.author?.name || '익명'}
                        </div>
                        <div className='text-xs text-gray-500 dark:text-gray-400'>
                          {formatDate(comment.createdAt)}
                        </div>
                      </div>
                      {canDelete && (
                        <div className='flex items-center gap-2 text-xs'>
                          <button
                            onClick={() => startEditComment(comment)}
                            className='text-blue-600 hover:text-blue-800'
                          >
                            수정
                          </button>
                          <button
                            onClick={() => deleteComment(comment)}
                            className='text-red-600 hover:text-red-800'
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className='mt-2 space-y-2'>
                        <textarea
                          value={editingCommentText}
                          onChange={(e) => setEditingCommentText(e.target.value)}
                          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[80px]'
                          maxLength={2000}
                        />
                        <div className='flex items-center gap-2 text-xs'>
                          <button
                            onClick={() => saveEditComment(comment)}
                            className='px-2 py-1 rounded bg-blue-600 text-white'
                          >
                            저장
                          </button>
                          <button
                            onClick={cancelEditComment}
                            className='px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className='mt-2 text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap'>
                        {comment.content}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className='border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2'>
            <textarea
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[90px]'
              placeholder='댓글을 입력하세요.'
              maxLength={2000}
            />
            <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400'>
              <span>{commentInput.length}/2,000자</span>
              <button
                onClick={submitComment}
                disabled={savingComment}
                className='btn-primary flex items-center gap-2 text-sm px-3 py-1.5'
              >
                <Send className='h-4 w-4' />
                {savingComment ? '등록 중...' : '댓글 등록'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
