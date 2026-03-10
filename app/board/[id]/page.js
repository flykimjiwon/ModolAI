'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Send, Eye } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

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
      <div className='w-full max-w-4xl mx-auto p-6 space-y-6'>
        <div className='flex items-center justify-between'>
          <Button
            onClick={() => router.push('/board')}
            variant='ghost'
          >
            <ArrowLeft className='h-5 w-5' />
            목록으로
          </Button>
          {canManagePost && (
            <div className='flex items-center gap-2'>
              <Button
                onClick={() => router.push(`/board/edit/${post.id}`)}
                variant='secondary'
                size='sm'
              >
                <Edit className='h-4 w-4' />
                수정
              </Button>
              <Button
                onClick={deletePost}
                variant='destructive'
                size='sm'
              >
                <Trash2 className='h-4 w-4' />
                삭제
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardContent className='p-6'>
            {loading || !post ? (
              <div className='flex items-center justify-center h-32'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
              </div>
            ) : (
              <>
                <div className='flex items-center gap-2 mb-2'>
                  <h1 className='text-2xl font-bold text-foreground'>
                    {post.title}
                  </h1>
                  {post.isNotice && (
                    <Badge variant='destructive'>
                      공지
                    </Badge>
                  )}
                </div>
                <div className='text-xs text-muted-foreground mb-4 flex flex-wrap gap-3'>
                  <span>{post.author?.name || '익명'}</span>
                  {post.author?.department && (
                      <span>{post.author.department.replaceAll('부서', '그룹')}</span>
                  )}
                  <span>{formatDate(post.createdAt)}</span>
                  <span className='flex items-center gap-1'>
                    <Eye className='h-3 w-3' />
                    {post.views ?? 0}
                  </span>
                </div>
                <div className='markdown-content text-foreground'>
                  <MarkdownPreview
                    source={post.content}
                    className='text-foreground'
                    style={{ padding: 0, backgroundColor: 'transparent', color: 'inherit' }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6 space-y-4'>
            <h2 className='text-lg font-semibold text-foreground'>
              댓글 {comments.length}
            </h2>

            <div className='space-y-3'>
              {comments.length === 0 ? (
                <p className='text-sm text-muted-foreground'>
                  아직 댓글이 없습니다.
                </p>
              ) : (
                comments.map((comment) => {
                  const canDelete =
                    userRole === 'admin' || comment.userId === userId;
                  return (
                    <div
                      key={comment.id}
                      className='border border-border rounded-lg p-3'
                    >
                      <div className='flex items-start justify-between'>
                        <div>
                          <div className='text-sm font-medium text-foreground'>
                            {comment.author?.name || '익명'}
                          </div>
                          <div className='text-xs text-muted-foreground'>
                            {formatDate(comment.createdAt)}
                          </div>
                        </div>
                        {canDelete && (
                          <div className='flex items-center gap-2 text-xs'>
                            <Button
                              onClick={() => startEditComment(comment)}
                              variant='link'
                              size='xs'
                              className='text-primary'
                            >
                              수정
                            </Button>
                            <Button
                              onClick={() => deleteComment(comment)}
                              variant='link'
                              size='xs'
                              className='text-destructive'
                            >
                              삭제
                            </Button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className='mt-2 space-y-2'>
                          <Textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            className='min-h-[80px]'
                            maxLength={2000}
                          />
                          <div className='flex items-center gap-2 text-xs'>
                            <Button
                              onClick={() => saveEditComment(comment)}
                              size='xs'
                            >
                              저장
                            </Button>
                            <Button
                              onClick={cancelEditComment}
                              variant='outline'
                              size='xs'
                            >
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className='mt-2 text-sm text-foreground whitespace-pre-wrap'>
                          {comment.content}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <Separator />

            <div className='space-y-2'>
              <Textarea
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className='min-h-[90px]'
                placeholder='댓글을 입력하세요.'
                maxLength={2000}
              />
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>{commentInput.length}/2,000자</span>
                <Button
                  onClick={submitComment}
                  disabled={savingComment}
                  size='sm'
                >
                  <Send className='h-4 w-4' />
                  {savingComment ? '등록 중...' : '댓글 등록'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
