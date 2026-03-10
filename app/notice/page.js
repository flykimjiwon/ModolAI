'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  User,
  ArrowLeft,
} from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';

export default function NoticePage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const { alert, confirm } = useAlert();

  // 사용자 권한 확인
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

  // 공지사항 목록 조회
  const fetchNotices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/notice?page=${currentPage}&limit=10`);

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      if (!response.ok) {
        throw new Error('공지사항 조회 실패');
      }

      const data = await response.json();
      setNotices(data.notices);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('공지사항 조회 실패:', error);
      alert('공지사항을 불러오는데 실패했습니다.', 'error', '오류');
    } finally {
      setLoading(false);
    }
  }, [currentPage, router, alert]);

  // 공지사항 삭제
  const deleteNotice = async (id, title) => {
    const confirmed = await confirm(
      `'${title}' 공지사항을 정말 삭제하시겠습니까?`,
      '공지사항 삭제 확인'
    );
    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notice/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      if (!response.ok) {
        throw new Error('공지사항 삭제 실패');
      }

      alert('공지사항이 삭제되었습니다.', 'success', '삭제 완료');
      fetchNotices();
    } catch (error) {
      console.error('공지사항 삭제 실패:', error);
      alert('공지사항 삭제에 실패했습니다.', 'error', '삭제 실패');
    }
  };

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

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

  const truncateContent = (content, maxLength = 200) => {
    // 마크다운에서 텍스트만 추출
    const textOnly = content.replace(/[#*`\[\]()]/g, '').trim();
    if (textOnly.length <= maxLength) return textOnly;
    return textOnly.substring(0, maxLength) + '...';
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200'>
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
        {/* 헤더 */}
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
                <Bell className='h-6 w-6' />
                공지사항
              </h1>
              <p className='text-gray-600 dark:text-gray-400 mt-1'>
                시스템 공지사항을 확인하세요.
              </p>
            </div>
          </div>

          {/* 관리자만 글쓰기 버튼 */}
          {userRole === 'admin' && (
            <button
              onClick={() => router.push('/notice/write')}
              className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
            >
              <Plus className='h-4 w-4' />
              글쓰기
            </button>
          )}
        </div>

        {/* 공지사항 목록 */}
        <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
          {loading ? (
            <div className='flex items-center justify-center h-32'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
            </div>
          ) : notices.length === 0 ? (
            <div className='text-center py-12'>
              <Bell className='mx-auto h-12 w-12 text-gray-400' />
              <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
                공지사항이 없습니다
              </h3>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                아직 등록된 공지사항이 없습니다.
              </p>
            </div>
          ) : (
            <div className='divide-y divide-gray-200 dark:divide-gray-600'>
              {notices.map((notice) => (
                <div
                  key={notice._id}
                  className='p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
                >
                  <div className='flex items-start justify-between'>
                    <div className='flex-1 min-w-0 mr-4'>
                      {/* 제목과 뱃지 */}
                      <div className='flex items-center gap-2 mb-2'>
                        <h3
                          className='text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors'
                          onClick={() => router.push(`/notice/${notice._id}`)}
                        >
                          {notice.title}
                        </h3>
                        {notice.isPopup && (
                          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'>
                            팝업
                          </span>
                        )}
                        {!notice.isActive && (
                          <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'>
                            비활성
                          </span>
                        )}
                      </div>

                      {/* 내용 미리보기 */}
                      <p className='text-gray-600 dark:text-gray-300 text-sm mb-3 line-clamp-3'>
                        {truncateContent(notice.content)}
                      </p>

                      {/* 메타 정보 */}
                      <div className='flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400'>
                        <div className='flex items-center gap-1'>
                          <User className='h-3 w-3' />
                          {notice.authorName}
                        </div>
                        <div className='flex items-center gap-1'>
                          <Calendar className='h-3 w-3' />
                          {formatDate(notice.createdAt)}
                        </div>
                        <div className='flex items-center gap-1'>
                          <Eye className='h-3 w-3' />
                          {notice.views}
                        </div>
                      </div>
                    </div>

                    {/* 관리자 액션 버튼 */}
                    {userRole === 'admin' && (
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={() =>
                            router.push(`/notice/edit/${notice._id}`)
                          }
                          className='p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors'
                          title='수정'
                        >
                          <Edit className='h-4 w-4' />
                        </button>
                        <button
                          onClick={() => deleteNotice(notice._id, notice.title)}
                          className='p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors'
                          title='삭제'
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

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className='flex items-center justify-center space-x-2 mt-6'>
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className='px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            >
              이전
            </button>

            <span className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className='px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
