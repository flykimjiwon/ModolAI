'use client';

import { useState, useEffect } from 'react';
import { X, Eye, Bell } from 'lucide-react';

export default function NoticePopup({ target = 'main', initialNotice = null }) {
  const [notice, setNotice] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  // 초기 공지 주입 (로그인 페이지 등에서 사용)
  useEffect(() => {
    if (!initialNotice) return;

    // 안보기 설정 확인
    const hideSettings = getHideSettings();
    const noticeId = initialNotice._id;

    // 영구 안보기 체크
    if (hideSettings.permanent.includes(noticeId)) {
      setLoading(false);
      return;
    }

    // 하루 안보기 체크
    const oneDayHide = hideSettings.oneDay[noticeId];
    if (oneDayHide && new Date(oneDayHide) > new Date()) {
      setLoading(false);
      return;
    }

    setNotice(initialNotice);
    setIsVisible(true);
    setLoading(false);
  }, [initialNotice]);

  // 팝업 공지사항 조회
  useEffect(() => {
    if (initialNotice) return;
    const fetchPopupNotice = async () => {
      try {
        const response = await fetch(
          `/api/notice?showPopup=true&limit=1&popupTarget=${target}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.notices && data.notices.length > 0) {
            const latestNotice = data.notices[0];

            // 안보기 설정 확인
            const hideSettings = getHideSettings();
            const noticeId = latestNotice._id;

            // 영구 안보기 체크
            if (hideSettings.permanent.includes(noticeId)) {
              setLoading(false);
              return;
            }

            // 하루 안보기 체크
            const oneDayHide = hideSettings.oneDay[noticeId];
            if (oneDayHide && new Date(oneDayHide) > new Date()) {
              setLoading(false);
              return;
            }

            setNotice(latestNotice);
            setIsVisible(true);
          }
        }
      } catch (error) {
        console.error('팝업 공지사항 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    // 메인/로그인 모두 설정 조건만 충족하면 표시
    fetchPopupNotice();
  }, []);

  const getHideSettingsKey = () => `noticeHideSettings:${target}`;

  // 안보기 설정 가져오기
  const getHideSettings = () => {
    const settings = localStorage.getItem(getHideSettingsKey());
    return settings ? JSON.parse(settings) : { permanent: [], oneDay: {} };
  };

  // 안보기 설정 저장
  const saveHideSettings = (settings) => {
    localStorage.setItem(getHideSettingsKey(), JSON.stringify(settings));
  };

  // 하루 안보기
  const hideForOneDay = () => {
    const settings = getHideSettings();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // 다음날 자정까지

    settings.oneDay[notice._id] = tomorrow.toISOString();
    saveHideSettings(settings);
    setIsVisible(false);
  };

  // 계속 안보기
  const hidePermanently = () => {
    const settings = getHideSettings();
    if (!settings.permanent.includes(notice._id)) {
      settings.permanent.push(notice._id);
    }
    saveHideSettings(settings);
    setIsVisible(false);
  };

  // 팝업 닫기
  const closePopup = () => {
    setIsVisible(false);
  };

  // 상세보기로 이동
  const goToDetail = () => {
    window.open(`/notice/${notice._id}`, '_blank');
    setIsVisible(false);
  };

  // 내용 자르기 (50-200자)
  const truncateContent = (content, minLength = 50, maxLength = 200) => {
    // 마크다운에서 텍스트만 추출
    const textOnly = content.replace(/[#*`\[\]()!]/g, '').trim();

    if (textOnly.length <= minLength) {
      return textOnly;
    }

    if (textOnly.length <= maxLength) {
      return textOnly;
    }

    // maxLength에서 단어 경계까지 자르기
    let truncated = textOnly.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > minLength) {
      truncated = truncated.substring(0, lastSpace);
    }

    return truncated + '...';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Seoul',
    });
  };

  // 로딩 중이거나 공지사항이 없거나 표시 안함 상태
  if (loading || !notice || !isVisible) {
    return null;
  }

  // 동적 사이즈 스타일 계산
  const modalStyle = {
    maxWidth: notice.popupWidth ? `${notice.popupWidth}px` : '512px',
    maxHeight: notice.popupHeight ? `${notice.popupHeight}px` : '80vh',
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* 배경 오버레이 */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
        onClick={closePopup}
      />

      {/* 모달 */}
      <div
        className='relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full overflow-hidden transform transition-all duration-300 scale-100'
        style={modalStyle}
      >
        {/* 헤더 */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20'>
          <div className='flex items-center gap-2'>
            <Bell className='h-5 w-5 text-blue-600 dark:text-blue-400' />
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              공지사항
            </h3>
          </div>
          <button
            onClick={closePopup}
            className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
            title='닫기'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* 내용 */}
        <div className='p-6 overflow-y-auto max-h-[50vh]'>
          {/* 제목 */}
          <h4 className='text-xl font-bold text-gray-900 dark:text-white mb-2'>
            {notice.title}
          </h4>

          {/* 메타 정보 */}
          <div className='text-sm text-gray-500 dark:text-gray-400 mb-4'>
            {notice.authorName} • {formatDate(notice.createdAt)}
          </div>

          {/* 내용 미리보기 */}
          <div className='text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line'>
            {truncateContent(notice.content)}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className='p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'>
          <div className='flex items-center justify-between flex-wrap gap-3'>
            <div className='flex gap-2'>
              <button
                onClick={hideForOneDay}
                className='px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              >
                하루 안보기
              </button>
              <button
                onClick={hidePermanently}
                className='px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              >
                계속 안보기
              </button>
            </div>

            <div className='flex gap-2'>
              <button
                onClick={closePopup}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              >
                닫기
              </button>
              <button
                onClick={goToDetail}
                className='flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors'
              >
                <Eye className='h-4 w-4' />
                자세히 보기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
