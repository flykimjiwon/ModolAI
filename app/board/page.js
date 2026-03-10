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
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';

export default function BoardPage() {
  const router = useRouter();
  const { alert, confirm } = useAlert();
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
        throw new Error(data.error || '자유게시판 조회 실패');
      }

      const data = await response.json();
      setPosts(data.posts || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('자유게시판 조회 실패:', error);
      alert('자유게시판을 불러오는데 실패했습니다.', 'error', '오류');
    } finally {
      setLoading(false);
    }
  }, [alert, currentPage, router, searchTerm]);

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
      `'${post.title}' 글을 삭제하시겠습니까?`,
      '게시글 삭제 확인'
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
        throw new Error(data.error || '게시글 삭제 실패');
      }

      alert('게시글이 삭제되었습니다.', 'success', '삭제 완료');
      fetchPosts();
    } catch (error) {
      console.error('게시글 삭제 실패:', error);
      alert('게시글 삭제에 실패했습니다.', 'error', '삭제 실패');
    }
  };

  if (!boardEnabled) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
          <div className='flex items-center gap-4 mb-6'>
            <button
              onClick={() => router.push('/')}
              className='p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
              자유게시판
            </h1>
          </div>
          <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center'>
            <MessageSquare className='mx-auto h-12 w-12 text-gray-400' />
            <p className='mt-4 text-sm text-gray-600 dark:text-gray-400'>
              자유게시판이 비활성화되어 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200'>
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => router.push('/')}
              className='p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <div>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
                <MessageSquare className='h-6 w-6' />
                자유게시판
              </h1>
              <p className='text-gray-600 dark:text-gray-400 mt-1'>
                자유롭게 질문하고 의견을 나눠보세요.
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
              <input
                type='text'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='제목/내용 검색'
                className='pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
            </div>
            <button
              onClick={() => router.push('/board/write')}
              className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
            >
              <Plus className='h-4 w-4' />
              글쓰기
            </button>
          </div>
        </div>

        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
          {loading ? (
            <div className='flex items-center justify-center h-32'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
          ) : posts.length === 0 ? (
            <div className='text-center py-12'>
              <MessageSquare className='mx-auto h-12 w-12 text-gray-400' />
              <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
                게시글이 없습니다
              </h3>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                {searchTerm ? '검색 결과가 없습니다.' : '첫 글을 작성해보세요.'}
              </p>
            </div>
          ) : (
            <div className='divide-y divide-gray-200 dark:divide-gray-600'>
              {posts.map((post) => (
                <div
                  key={post.id}
                  className='p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer'
                  onClick={() => router.push(`/board/${post.id}`)}
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1 min-w-0 mr-4'>
                      <div className='flex items-center gap-2 mb-2'>
                        <h3
                          className='text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
                        >
                          {post.title}
                        </h3>
                        {post.isNotice && (
                          <span className='px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full'>
                            공지
                          </span>
                        )}
                        {post.commentCount > 0 && (
                          <span className='text-xs text-gray-500 dark:text-gray-400'>
                            댓글 {post.commentCount}
                          </span>
                        )}
                      </div>

                      <div className='flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400'>
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
                    </div>

                    {canManagePost(post) && (
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            router.push(`/board/edit/${post.id}`);
                          }}
                          className='p-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg transition-all'
                          title='게시글 수정'
                        >
                          <Edit className='h-4 w-4' />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            deletePost(post);
                          }}
                          className='p-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg transition-all'
                          title='게시글 삭제'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className='flex items-center justify-center gap-2 mt-6'>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className='px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50'
            >
              이전
            </button>
            <span className='text-sm text-gray-600 dark:text-gray-400'>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className='px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50'
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
