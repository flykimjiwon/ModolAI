'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Menu,
  LogOut,
  X,
  Bell,
  MessageSquare,
  Shield,
  User,
  Mail,
  Bot,
  Code,
  FileText,
  Sparkles,
  History,
  Presentation,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ui/modal';
import DirectMessageModal from '@/components/DirectMessageModal';

// 에이전트별 사이드바 메뉴 설정
const AGENT_SIDEBAR_MENUS = {
  '1': {
    title: 'AI 가상회의',
    items: [
      { id: 'meeting-history', label: '회의 히스토리', icon: History },
      { id: 'persona-templates', label: '페르소나 템플릿', icon: Bot },
      { id: 'topic-examples', label: '주제 예시', icon: Sparkles },
    ],
  },
  '2': {
    title: '코드 컨버터',
    items: [
      { id: 'convert-history', label: '변환 히스토리', icon: History },
      { id: 'language-list', label: '지원 언어 목록', icon: Code },
      { id: 'conversion-tips', label: '변환 팁', icon: Sparkles },
    ],
  },
  '3': {
    title: 'Text to SQL',
    items: [
      { id: 'query-history', label: '조회 히스토리', icon: History },
      { id: 'uploaded-files', label: '업로드 파일 관리', icon: FileText },
      { id: 'query-examples', label: '질문 예시', icon: Sparkles },
    ],
  },
  '4': {
    title: '텍스트 재작성',
    items: [
      { id: 'rewrite-history', label: '재작성 히스토리', icon: History },
      { id: 'tone-templates', label: '톤/목적 템플릿', icon: FileText },
      { id: 'writing-guide', label: '작성 가이드', icon: Sparkles },
    ],
  },
  '5': {
    title: '에러 해결 도우미',
    items: [
      { id: 'error-history', label: '해결 히스토리', icon: History },
      { id: 'common-errors', label: '자주 발생하는 에러', icon: Code },
      { id: 'debug-tips', label: '디버깅 팁', icon: Sparkles },
    ],
  },
  '6': {
    title: 'Solgit 리뷰어',
    items: [
      { id: 'review-history', label: '리뷰 히스토리', icon: History },
      { id: 'project-list', label: '프로젝트 목록', icon: Code },
      { id: 'review-guide', label: '리뷰 가이드', icon: Sparkles },
    ],
  },
  '7': {
    title: 'PPT 에이전트',
    items: [
      { id: 'ppt-compose', label: 'PPT 에이전트', icon: Presentation },
      { id: 'ppt-history', label: '생성 히스토리', icon: History },
    ],
  },
};

function AgentSidebar({
  sidebarOpen,
  setSidebarOpen,
  agentId,
  agentName,
  agentDescription,
  agentColor = 'text-blue-600 dark:text-blue-400',
  userEmail,
  userRole,
  handleLogout,
  loading,
  profileEditEnabled = true,
  boardEnabled = true,
  activeAgentMenu = '',
  onAgentMenuSelect = null,
}) {
  const router = useRouter();
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null,
    confirmText: '확인',
    cancelText: '취소',
  });

  // 쪽지 관련 상태
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [showDmModal, setShowDmModal] = useState(false);
  const [showDmNotification, setShowDmNotification] = useState(false);
  const [newDmCount, setNewDmCount] = useState(0);
  const prevUnreadCountRef = useRef(0);

  // 읽지 않은 쪽지 개수 조회
  const fetchUnreadDmCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/direct-messages/unread-count', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const newCount = data.count || 0;

        if (newCount > prevUnreadCountRef.current && prevUnreadCountRef.current >= 0) {
          const diff = newCount - prevUnreadCountRef.current;
          setNewDmCount(diff);
          setShowDmNotification(true);

          setTimeout(() => {
            setShowDmNotification(false);
          }, 5000);
        }

        prevUnreadCountRef.current = newCount;
        setUnreadDmCount(newCount);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('읽지 않은 쪽지 개수 조회 실패:', error);
      }
    }
  }, []);

  useEffect(() => {
    fetchUnreadDmCount();
    const interval = setInterval(fetchUnreadDmCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadDmCount]);

  const handleHamburgerClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCloseClick = () => {
    setSidebarOpen(false);
  };

  return (
    <>
      {/* 접힌 사이드바 (아이콘만) */}
      <div
        className={`
          fixed left-0 top-0 h-full w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40
          flex flex-col items-center py-4
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* 메뉴 버튼 */}
        <button
          onClick={handleHamburgerClick}
          className='p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4'
          title='사이드바 열기'
        >
          <Menu className='h-5 w-5 text-gray-600 dark:text-gray-400' />
        </button>

        {/* 에이전트 아이콘 */}
        <div className='p-3 mb-4'>
          <Bot className={`h-5 w-5 ${agentColor}`} />
        </div>

        {/* 쪽지 */}
        <div className='relative'>
          <button
            onClick={() => !loading && setShowDmModal(true)}
            className={`relative p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title='받은 쪽지'
            disabled={loading}
          >
            <Mail className='h-5 w-5 text-gray-600 dark:text-gray-400' />
            {unreadDmCount > 0 && (
              <span className='absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white'>
                {unreadDmCount > 99 ? '99+' : unreadDmCount}
              </span>
            )}
          </button>

          {showDmNotification && (
            <div className='absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 animate-bounce'>
              <div className='relative bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap'>
                <div className='absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-blue-600'></div>
                새 쪽지 {newDmCount}개가 도착했습니다
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDmNotification(false);
                  }}
                  className='ml-2 hover:text-blue-200'
                >
                  <X className='h-3 w-3 inline' />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 로그아웃 */}
        <button
          onClick={() => {
            if (!loading) {
              setConfirmModal({
                isOpen: true,
                title: '로그아웃 확인',
                message: '로그아웃 하시겠습니까?',
                type: 'warning',
                onConfirm: () => {
                  handleLogout();
                },
                confirmText: '로그아웃',
                cancelText: '취소',
              });
            }
          }}
          className='p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-auto'
          title='로그아웃'
          disabled={loading}
        >
          <LogOut className='h-5 w-5 text-gray-600 dark:text-gray-400' />
        </button>
      </div>

      {/* 펼쳐진 사이드바 */}
      <div
        className={`
          fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 사이드바 헤더 - 에이전트 정보 */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-3'>
            <Bot className={`h-6 w-6 ${agentColor}`} />
            <div>
              <h2 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>
                {agentName}
              </h2>
              {agentDescription && (
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  {agentDescription}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleCloseClick}
            className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            title='사이드바 닫기'
          >
            <X className='h-5 w-5 text-gray-600 dark:text-gray-400' />
          </button>
        </div>

        {/* 에이전트별 메뉴 영역 */}
        <div className='flex-1 overflow-y-auto p-4'>
          {AGENT_SIDEBAR_MENUS[agentId] && (
            <div className='space-y-2'>
              <h3 className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3'>
                {AGENT_SIDEBAR_MENUS[agentId].title}
              </h3>
              {AGENT_SIDEBAR_MENUS[agentId].items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (typeof onAgentMenuSelect === 'function') {
                        onAgentMenuSelect(item.id);
                        return;
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors ${
                      activeAgentMenu === item.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <ItemIcon className={`h-4 w-4 ${agentColor}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 에이전트 설명 */}
          <div className='mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              {agentDescription || '에이전트 기능을 사용할 수 있습니다.'}
            </p>
          </div>
        </div>

        {/* 메뉴 버튼들 */}
        <div className='p-4 space-y-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0'>
          {/* 공지사항 */}
          <button
            onClick={() => !loading && router.push('/notice')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            <Bell className='h-4 w-4' />
            공지사항
          </button>

          {boardEnabled && (
            <button
              onClick={() => !loading && router.push('/board')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <MessageSquare className='h-4 w-4' />
              자유게시판
            </button>
          )}

          {/* 프로필 수정 */}
          {profileEditEnabled && (
            <button
              onClick={() => !loading && router.push('/profile')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <User className='h-4 w-4' />
              프로필 수정
            </button>
          )}

          {/* 관리자 패널 */}
          {userRole === 'admin' && (
            <button
              onClick={() => !loading && router.push('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <Shield className='h-4 w-4' />
              관리자 페이지
            </button>
          )}
        </div>

        {/* 하단 사용자 정보 */}
        <div className='p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                로그인 계정
              </p>
              <p className='text-xs text-gray-600 dark:text-gray-400 truncate'>
                {userEmail}
              </p>
              {userRole === 'admin' && (
                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 mt-1'>
                  관리자
                </span>
              )}
            </div>
            <div className='flex items-center gap-1'>
              {/* 쪽지 버튼 */}
              <div className='relative'>
                <button
                  onClick={() => !loading && setShowDmModal(true)}
                  className={`relative p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title='받은 쪽지'
                  disabled={loading}
                >
                  <Mail className='h-4 w-4 text-gray-600 dark:text-gray-400' />
                  {unreadDmCount > 0 && (
                    <span className='absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-red-500 text-white'>
                      {unreadDmCount > 99 ? '99+' : unreadDmCount}
                    </span>
                  )}
                </button>

                {showDmNotification && (
                  <div className='absolute bottom-full mb-2 right-0 z-50 animate-bounce'>
                    <div className='relative bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap'>
                      새 쪽지 {newDmCount}개가 도착했습니다
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDmNotification(false);
                        }}
                        className='ml-2 hover:text-blue-200'
                      >
                        <X className='h-3 w-3 inline' />
                      </button>
                      <div className='absolute -bottom-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-blue-600'></div>
                    </div>
                  </div>
                )}
              </div>
              {/* 로그아웃 버튼 */}
              <button
                onClick={() => {
                  if (!loading) {
                    setConfirmModal({
                      isOpen: true,
                      title: '로그아웃 확인',
                      message: '로그아웃 하시겠습니까?',
                      type: 'warning',
                      onConfirm: () => {
                        handleLogout();
                      },
                      confirmText: '로그아웃',
                      cancelText: '취소',
                    });
                  }
                }}
                className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title='로그아웃'
                disabled={loading}
              >
                <LogOut className='h-4 w-4 text-gray-600 dark:text-gray-400' />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            title: '',
            message: '',
            type: 'warning',
            onConfirm: null,
            confirmText: '확인',
            cancelText: '취소',
          })
        }
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText || '확인'}
        cancelText={confirmModal.cancelText || '취소'}
      />

      {/* 쪽지 모달 */}
      <DirectMessageModal
        isOpen={showDmModal}
        onClose={() => setShowDmModal(false)}
        onUnreadCountChange={fetchUnreadDmCount}
      />
    </>
  );
}

export default AgentSidebar;
