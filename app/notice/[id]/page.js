'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, User, Eye, Edit } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';

export default function NoticeDetailPage() {
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { alert } = useAlert();

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

  // 공지사항 상세 조회
  useEffect(() => {
    const fetchNotice = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/notice/${id}`);

        if (response.status === 404) {
          alert('공지사항을 찾을 수 없습니다.', 'error', '오류');
          router.push('/notice');
          return;
        }

        if (!response.ok) {
          throw new Error('공지사항 조회 실패');
        }

        const data = await response.json();
        setNotice(data.notice);
      } catch (error) {
        console.error('공지사항 조회 실패:', error);
        alert('공지사항을 불러오는데 실패했습니다.', 'error', '오류');
        router.push('/notice');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchNotice();
    }
  }, [id, router, alert]);

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

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <div className='text-center'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            공지사항을 찾을 수 없습니다
          </h3>
          <button
            onClick={() => router.push('/notice')}
            className='mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200'
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200'>
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
        {/* 헤더 */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <button
              onClick={() => router.push('/notice')}
              className='p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'
              title='목록으로'
            >
              <ArrowLeft className='h-5 w-5' />
            </button>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
              공지사항
            </h1>
          </div>

          {/* 관리자만 수정 버튼 */}
          {userRole === 'admin' && (
            <button
              onClick={() => router.push(`/notice/edit/${id}`)}
              className='flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors'
            >
              <Edit className='h-4 w-4' />
              수정
            </button>
          )}
        </div>

        {/* 공지사항 내용 */}
        <article className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
          {/* 헤더 정보 */}
          <div className='p-6 border-b border-gray-200 dark:border-gray-700'>
            {/* 제목과 뱃지 */}
            <div className='flex items-center gap-2 mb-4'>
              <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
                {notice.title}
              </h1>
              {notice.isPopup && (
                <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'>
                  팝업
                </span>
              )}
              {!notice.isActive && (
                <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'>
                  비활성
                </span>
              )}
            </div>

            {/* 메타 정보 */}
            <div className='flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400'>
              <div className='flex items-center gap-2'>
                <User className='h-4 w-4' />
                <span>{notice.authorName}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Calendar className='h-4 w-4' />
                <span>{formatDate(notice.createdAt)}</span>
              </div>
              <div className='flex items-center gap-2'>
                <Eye className='h-4 w-4' />
                <span>조회 {notice.views}</span>
              </div>
              {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
                <div className='text-xs'>
                  수정: {formatDate(notice.updatedAt)}
                </div>
              )}
            </div>
          </div>

          {/* 본문 */}
          <div className='p-6'>
            <div className='prose prose-gray dark:prose-invert max-w-none'>
              <MarkdownPreview
                source={notice.content}
                style={{
                  backgroundColor: 'transparent',
                  color: 'inherit',
                }}
              />
            </div>
          </div>
        </article>

        {/* 하단 버튼 */}
        <div className='flex justify-center mt-6'>
          <button
            onClick={() => router.push('/notice')}
            className='px-6 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
          >
            목록으로
          </button>
        </div>
      </div>
    </div>
  );
}
