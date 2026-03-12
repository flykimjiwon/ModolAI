'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Search,
  Eye,
} from '@/components/icons';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/hooks/useTranslation';

export default function BoardPage() {
  const router = useRouter();
  const { alert, confirm } = useAlert();
  const { t } = useTranslation();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userRole, setUserRole] = useState('user');
  const [userId, setUserId] = useState('');
  const [boardEnabled, setBoardEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const fetchBoardEnabled = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const data = await res.json();
      setBoardEnabled(
        data.boardEnabled !== undefined ? data.boardEnabled : true
      );
    } catch (error) {
      console.warn('자유게시판 설정 조회 실패:', error);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
      });
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      const response = await fetch(
        `/api/board/posts?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t('board.fetch_error'));
      }

      const data = await response.json();
      setPosts(data.posts || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('자유게시판 조회 실패:', error);
      alert(t('board.fetch_failed'), 'error', t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [alert, currentPage, router, searchTerm, t]);

  useEffect(() => {
    fetchBoardEnabled();
  }, [fetchBoardEnabled]);

  useEffect(() => {
    if (boardEnabled) {
      fetchPosts();
    } else {
      setLoading(false);
    }
  }, [boardEnabled, fetchPosts]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const canManagePost = (post) => {
    if (!post?.userId) return false;
    return userRole === 'admin' || post.userId === userId;
  };

  const deletePost = async (post) => {
    const confirmed = await confirm(
      t('board.delete_post_confirm', { title: post.title }),
      t('board.delete_post_confirm_title')
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/board/posts/${post.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t('board.post_delete_error'));
      }

      alert(t('board.post_deleted'), 'success', t('common.delete_complete'));
      fetchPosts();
    } catch (error) {
      console.error('게시글 삭제 실패:', error);
      alert(t('board.post_delete_failed'), 'error', t('common.delete_failed'));
    }
  };

  if (!boardEnabled) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
          <div className='flex items-center gap-4 mb-6'>
            <Button
              onClick={() => router.push('/')}
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
            <CardContent className='p-8 text-center'>
              <MessageSquare className='mx-auto h-12 w-12 text-muted-foreground' />
              <p className='mt-4 text-sm text-muted-foreground'>
                {t('board.disabled')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-background transition-colors duration-200'>
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <Button
              onClick={() => router.push('/')}
              variant='ghost'
              size='icon'
              title={t('common.go_back')}
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <div>
              <h1 className='text-2xl font-bold text-foreground flex items-center gap-2'>
                <MessageSquare className='h-6 w-6' />
                {t('board.title')}
              </h1>
              <p className='text-muted-foreground mt-1'>
                {t('board.subtitle')}
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                type='text'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('board.search_placeholder')}
                className='pl-9'
              />
            </div>
            <Button
              onClick={() => router.push('/board/write')}
            >
              <Plus className='h-4 w-4' />
              {t('common.write')}
            </Button>
          </div>
        </div>

        <Card className='overflow-hidden'>
          <CardContent className='p-0'>
            {loading ? (
              <div className='flex items-center justify-center h-32'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
              </div>
            ) : posts.length === 0 ? (
              <div className='text-center py-12'>
                <MessageSquare className='mx-auto h-12 w-12 text-muted-foreground' />
                <h3 className='mt-2 text-sm font-medium text-foreground'>
                  {t('board.no_posts')}
                </h3>
                <p className='mt-1 text-sm text-muted-foreground'>
                  {searchTerm ? t('board.no_search_results') : t('board.first_post_hint')}
                </p>
              </div>
            ) : (
              <div className='divide-y divide-border'>
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className='p-6 hover:bg-accent transition-colors cursor-pointer'
                    onClick={() => router.push(`/board/${post.id}`)}
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1 min-w-0 mr-4'>
                        <div className='flex items-center gap-2 mb-2'>
                          <h3
                            className='text-lg font-semibold text-foreground hover:text-primary transition-colors'
                          >
                            {post.title}
                          </h3>
                          {post.isNotice && (
                            <Badge variant='destructive'>
                              {t('common.notice_badge')}
                            </Badge>
                          )}
                          {post.commentCount > 0 && (
                            <span className='text-xs text-muted-foreground'>
                              {t('board.comment_count', { count: post.commentCount })}
                            </span>
                          )}
                        </div>

                        <div className='flex flex-wrap items-center gap-4 text-xs text-muted-foreground'>
                          <span>{post.author?.name || t('common.anonymous')}</span>
                          {post.author?.department && (
                      <span>{post.author.department.replaceAll('부서', '그룹')}</span>
                          )}
                          <span>{formatDate(post.createdAt)}</span>
                          <span className='flex items-center gap-1'>
                            <Eye className='h-3 w-3' />
                            {post.views ?? 0}
                          </span>
                        </div>
                      </div>

                      {canManagePost(post) && (
                        <div className='flex items-center gap-2'>
                          <Button
                            onClick={(event) => {
                              event.stopPropagation();
                              router.push(`/board/edit/${post.id}`);
                            }}
                            variant='ghost'
                            size='icon'
                            className='text-primary bg-primary/10 hover:bg-primary/20'
                            title={t('board.edit_post')}
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                          <Button
                            onClick={(event) => {
                              event.stopPropagation();
                              deletePost(post);
                            }}
                            variant='ghost'
                            size='icon'
                            className='text-destructive bg-destructive/10 hover:bg-destructive/20'
                            title={t('board.delete_post')}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className='flex items-center justify-center gap-2 mt-6'>
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              variant='outline'
              size='sm'
            >
              {t('common.previous')}
            </Button>
            <span className='text-sm text-muted-foreground'>
              {currentPage} / {totalPages}
            </span>
            <Button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              variant='outline'
              size='sm'
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
