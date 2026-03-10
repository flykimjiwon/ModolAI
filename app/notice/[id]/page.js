'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Calendar, User, Eye, Edit } from 'lucide-react';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function NoticeDetailPage() {
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const params = useParams();
  const { id } = params;
  const { alert } = useAlert();

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
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='text-center'>
          <h3 className='text-lg font-medium text-foreground'>
            공지사항을 찾을 수 없습니다
          </h3>
          <Button
            onClick={() => router.push('/notice')}
            variant='link'
            className='mt-4'
          >
            목록으로 돌아가기
          </Button>
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
              onClick={() => router.push('/notice')}
              variant='ghost'
              size='icon'
              title='목록으로'
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <h1 className='text-2xl font-bold text-foreground'>
              공지사항
            </h1>
          </div>

          {userRole === 'admin' && (
            <Button
              onClick={() => router.push(`/notice/edit/${id}`)}
              variant='ghost'
            >
              <Edit className='h-4 w-4' />
              수정
            </Button>
          )}
        </div>

        <Card className='overflow-hidden'>
          <CardContent className='p-0'>
            <div className='p-6 border-b border-border'>
              <div className='flex items-center gap-2 mb-4'>
                <h1 className='text-2xl font-bold text-foreground'>
                  {notice.title}
                </h1>
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

              <div className='flex items-center gap-6 text-sm text-muted-foreground'>
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

            <div className='p-6'>
              <div className='prose prose-neutral dark:prose-invert max-w-none'>
                <MarkdownPreview
                  source={notice.content}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'inherit',
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='flex justify-center mt-6'>
          <Button
            onClick={() => router.push('/notice')}
            variant='outline'
          >
            목록으로
          </Button>
        </div>
      </div>
    </div>
  );
}
