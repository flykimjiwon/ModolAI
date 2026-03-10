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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <div className='min-h-screen bg-background transition-colors duration-200'>
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6'>
        {/* 헤더 */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <Button
              onClick={() => router.push('/')}
              variant='ghost'
              size='icon'
              title='뒤로 가기'
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <div>
              <h1 className='text-2xl font-bold text-foreground flex items-center gap-2'>
                <Bell className='h-6 w-6' />
                공지사항
              </h1>
              <p className='text-muted-foreground mt-1'>
                시스템 공지사항을 확인하세요.
              </p>
            </div>
          </div>

          {/* 관리자만 글쓰기 버튼 */}
          {userRole === 'admin' && (
            <Button
              onClick={() => router.push('/notice/write')}
            >
              <Plus className='h-4 w-4' />
              글쓰기
            </Button>
          )}
        </div>

        {/* 공지사항 목록 */}
        <Card className='overflow-hidden'>
          <CardContent className='p-0'>
            {loading ? (
              <div className='flex items-center justify-center h-32'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
              </div>
            ) : notices.length === 0 ? (
              <div className='text-center py-12'>
                <Bell className='mx-auto h-12 w-12 text-muted-foreground' />
                <h3 className='mt-2 text-sm font-medium text-foreground'>
                  공지사항이 없습니다
                </h3>
                <p className='mt-1 text-sm text-muted-foreground'>
                  아직 등록된 공지사항이 없습니다.
                </p>
              </div>
            ) : (
              <div className='divide-y divide-border'>
                {notices.map((notice) => (
                  <div
                    key={notice._id}
                    className='p-6 hover:bg-accent transition-colors'
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1 min-w-0 mr-4'>
                        {/* 제목과 뱃지 */}
                        <div className='flex items-center gap-2 mb-2'>
                          <h3
                            className='text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors'
                            onClick={() => router.push(`/notice/${notice._id}`)}
                          >
                            {notice.title}
                          </h3>
                          {notice.isPopup && (
                            <Badge variant='destructive'>
                              팝업
                            </Badge>
                          )}
                          {!notice.isActive && (
                            <Badge variant='secondary'>
                              비활성
                            </Badge>
                          )}
                        </div>

                        {/* 내용 미리보기 */}
                        <p className='text-muted-foreground text-sm mb-3 line-clamp-3'>
                          {truncateContent(notice.content)}
                        </p>

                        {/* 메타 정보 */}
                        <div className='flex items-center gap-4 text-xs text-muted-foreground'>
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
                          <Button
                            onClick={() =>
                              router.push(`/notice/edit/${notice._id}`)
                            }
                            variant='ghost'
                            size='icon'
                            className='text-primary hover:bg-primary/10'
                            title='수정'
                          >
                            <Edit className='h-4 w-4' />
                          </Button>
                          <Button
                            onClick={() => deleteNotice(notice._id, notice.title)}
                            variant='ghost'
                            size='icon'
                            className='text-destructive hover:bg-destructive/10'
                            title='삭제'
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

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className='flex items-center justify-center space-x-2 mt-6'>
            <Button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              variant='outline'
              size='sm'
            >
              이전
            </Button>

            <span className='px-4 py-2 text-sm font-medium text-muted-foreground'>
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
              다음
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
