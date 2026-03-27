'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/hooks/useChat';
import { logger } from '@/lib/logger';
import { useModelManager } from '@/hooks/useModelManager';
import { useChatSender } from '@/hooks/useChatSender';
import { detectClientIP } from '@/lib/clientIP';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { useAlert } from '@/contexts/AlertContext';
import { useTranslation } from '@/hooks/useTranslation';
import { TokenManager } from '@/lib/tokenManager';
import { loadRoomModel } from '@/hooks/useModelManager';

// Component Imports
import Sidebar from '@/components/chat/Sidebar';
import ChatHeader from '@/components/chat/ChatHeader';
import MessageList from '@/components/chat/MessageList';
import ScrollButtons from '@/components/chat/ScrollButtons';
import ChatLayout from '@/components/chat/ChatLayout';
import ChatInput from '@/components/chat/ChatInput';
import NoticePopup from '@/components/NoticePopup';
import { Button } from '@/components/ui/button';
import { X, Loader2, ChevronDown } from '@/components/icons';

/* ---------- 메인 컴포넌트 ---------- */
export default function Home() {
  const router = useRouter();
  const { alert } = useAlert();
  const { t } = useTranslation();

  // ---------- Core Hooks ----------
  const {
    rooms,
    currentRoom,
    messages,
    setMessages,
    loading: chatLoading,
    createRoom,
    renameRoom: originalRenameRoom,
    deleteRoom: originalDeleteRoom,
    switchRoom,
    clearSession,
    loadRooms,
  } = useChat();

  // renameRoom 래퍼 - 에러를 모달로 처리
  const renameRoom = async (roomId, newName) => {
    try {
      await originalRenameRoom(roomId, newName);
    } catch (error) {
      alert(error.message, 'error', t('sidebar.room_rename_failed'));
    }
  };

  // deleteRoom 래퍼 - 에러를 모달로 처리
  const deleteRoom = async (roomId) => {
    try {
      return await originalDeleteRoom(roomId);
    } catch (error) {
      // 404 에러는 이미 삭제된 방이므로 조용히 처리
      const is404Error =
        error?.status === 404 ||
        (typeof error?.message === 'string' &&
          (error.message.includes('404') ||
            error.message.includes('채팅방을 찾을 수 없습니다')));

      if (is404Error) {
        // 404 에러는 조용히 처리 (이미 삭제된 방)
        return true;
      }

      const errorType = error.type || 'error';
      alert(
        error.message,
        errorType,
        errorType === 'warning' ? t('common.warning') : t('errors.title')
      );
      return false;
    }
  };
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('user');
  const {
    modelOptions,
    modelConfig,
    selectedModel,
    setSelectedModel,
    setSelectedModelWithRoom,
    restoreRoomModel,
    modelsLoading,
    userDefaultModelId,
    saveUserDefaultModel,
  } = useModelManager(userRole);
  // ---------- UI & App State ----------
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientIP, setClientIP] = useState(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [maxImagesPerMessage, setMaxImagesPerMessage] = useState(5);
  const [imageAnalysisModel, setImageAnalysisModel] = useState('');
  const [imageAnalysisPrompt, setImageAnalysisPrompt] = useState(
    t('chat.image_analysis_prompt')
  );
  const [imageHistoryByRoom, setImageHistoryByRoom] = useState({});
  const [profileEditEnabled, setProfileEditEnabled] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);
  const [maxUserQuestionLength, setMaxUserQuestionLength] = useState(300000);
  const [drawMode, setDrawMode] = useState(false);
  const [drawEnabled, setDrawEnabled] = useState(false);
  const [drawSystemPrompt, setDrawSystemPrompt] = useState(
    "Generate a complete HTML page based on the user's request. Always wrap the response in a ```html code block. Only Tailwind CSS CDN (https://cdn.tailwindcss.com) is allowed. No other external libraries. Implement charts with Canvas API and diagrams with SVG."
  );
  const [authChecked, setAuthChecked] = useState(false);

  // ---------- Refs for UI manipulation ----------
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [isAtBottom, setIsAtBottom] = useState(true); // 스크롤이 맨 아래에 있는지 추적
  const lastRestoredRoomRef = useRef(null);

  // ---------- Chat Sender Hook ----------
  const {
    input,
    setInput,
    loading,
    sendMessage,
    handleKeyDown,
    stopStreaming,
  } = useChatSender({
    currentRoom,
    messages,
    setMessages,
    modelOptions,
    selectedModel,
    modelsLoading,
    clientIP,
    inputRef,
    renameRoom,
    rooms,
    loadRooms,
    selectedImages,
    setSelectedImages,
    imageHistoryByRoom,
    setImageHistoryByRoom,
    imageAnalysisModel,
    imageAnalysisPrompt,
    maxUserQuestionLength,
    drawMode,
    drawSystemPrompt,
  });

  const isUIBusy = loading;

  // ---------- Effects ----------
  useEffect(() => {
    if (!currentRoom) return;
    if (loading || chatLoading || modelsLoading) return;
    inputRef.current?.focus();
  }, [loading, chatLoading, modelsLoading, currentRoom]);

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const checkScrollbar = () => {
      setShowScrollButtons(container.scrollHeight > container.clientHeight);
    };

    checkScrollbar();
    container.addEventListener('scroll', checkScrollbar, { passive: true });
    window.addEventListener('resize', checkScrollbar);
    return () => {
      container.removeEventListener('scroll', checkScrollbar);
      window.removeEventListener('resize', checkScrollbar);
    };
  }, [messages]);

  useEffect(() => {
    detectClientIP()
      .then(setClientIP)
      .catch((err) => logger.error('클라이언트 IP 감지 실패:', err));
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[Main] 인증 체크 시작...');
      const token = localStorage.getItem('token');
      console.log('[Main] 토큰 상태:', {
        exists: !!token,
        length: token?.length,
        preview: token ? token.substring(0, 50) + '...' : null
      });

      if (!token) {
        console.log('[Main] 토큰 없음 → 로그인 페이지로 리다이렉트');
        const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
        router.replace(loginUrl);
        return;
      }
      try {
        // UTF-8 안전한 JWT 페이로드 디코딩
        const payload = decodeJWTPayload(token);
        console.log('[Main] 토큰 파싱 성공:', {
          email: payload.email,
          name: payload.name,
          exp: payload.exp,
          expDate: new Date(payload.exp * 1000).toISOString()
        });
        setUserEmail(payload.email || '');
        setUserRole(payload.role || 'user');
        setAuthChecked(true);
      } catch (error) {
        console.error('[Main] 토큰 파싱 실패:', error, { token: token?.substring(0, 100) });
        logger.error('토큰 파싱 실패:', error);
        const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
        router.replace(loginUrl);
      }
    };
    checkAuth();
  }, [router]);

  // 맨 아래 버튼 노출 여부: bottomRef가 화면(또는 스크롤 컨테이너) 안에 있는지로 판정
  useEffect(() => {
    const container = listRef.current || null;
    const target = bottomRef.current;
    if (!target || typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      const handleScroll = () => {
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const atBottom = scrollHeight - scrollTop - clientHeight < 50;
        setIsAtBottom(atBottom);
      };
      container?.addEventListener('scroll', handleScroll, { passive: true });
      return () => container?.removeEventListener('scroll', handleScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setIsAtBottom(entry.isIntersecting);
        }
      },
      {
        root: container,
        rootMargin: '0px 0px 50px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [messages]);

  // 맨 아래로 스크롤 함수
  const scrollToBottom = () => {
    const container = listRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
      setIsAtBottom(true);
    }
  };


  useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !isMounted) return;
        setMaxImagesPerMessage(data.maxImagesPerMessage || 5);
        setImageAnalysisModel(data.imageAnalysisModel || '');
        setImageAnalysisPrompt(
          data.imageAnalysisPrompt || t('chat.image_analysis_prompt')
        );
        setMaxUserQuestionLength(data.maxUserQuestionLength || 300000);
        setProfileEditEnabled(
          data.profileEditEnabled !== undefined ? data.profileEditEnabled : false
        );
        setBoardEnabled(
          data.boardEnabled !== undefined ? data.boardEnabled : true
        );
        setDrawEnabled(
          data.drawEnabled !== undefined ? data.drawEnabled : false
        );
        setDrawSystemPrompt(
          data.drawSystemPrompt ||
            "Generate a complete HTML page based on the user's request. Always wrap the response in a ```html code block. Only Tailwind CSS CDN (https://cdn.tailwindcss.com) is allowed. No other external libraries. Implement charts with Canvas API and diagrams with SVG."
        );
      })
      .catch((error) =>
        logger.error('이미지 설정 로드 실패:', error.message)
      );
    return () => {
      isMounted = false;
    };
  }, []);

  // 방 변경 시 해당 방의 마지막 모델 복원
  useEffect(() => {
    if (currentRoom && modelOptions.length > 0 && !modelsLoading) {
      if (lastRestoredRoomRef.current === currentRoom) return;
      const savedModel = loadRoomModel(currentRoom);
      if (savedModel && savedModel === selectedModel) {
        lastRestoredRoomRef.current = currentRoom;
        return;
      }
      const availableModelIds = modelOptions.map((m) => m.id);
      restoreRoomModel(currentRoom, availableModelIds);
      lastRestoredRoomRef.current = currentRoom;
    }
  }, [currentRoom, modelOptions, modelsLoading, restoreRoomModel, selectedModel]);

  useEffect(() => {
    setSelectedImages([]);
    setImageHistoryByRoom({});
  }, [currentRoom]);

  const handleLogout = async () => {
    clearSession();
    await TokenManager.logout();
  };

  if (!authChecked) {
    return null;
  }

  return (
    <ChatLayout sidebarOpen={sidebarOpen}>
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        rooms={rooms}
        currentRoom={currentRoom}
        switchRoom={switchRoom}
        createRoom={createRoom}
        deleteRoom={deleteRoom}
        renameRoom={renameRoom}
        userEmail={userEmail}
        userRole={userRole}
        handleLogout={handleLogout}
        loading={isUIBusy || chatLoading}
        messages={messages}
        profileEditEnabled={profileEditEnabled}
        boardEnabled={boardEnabled}
      />
      <ChatHeader />
      <MessageList
        messages={messages}
        bottomRef={bottomRef}
        modelOptions={modelOptions}
        currentRoom={currentRoom}
        imageHistoryByRoom={imageHistoryByRoom}
        listRef={listRef}
        loading={loading}
        DrawPreviewPanelComponent={null}
      />
      <ScrollButtons show={showScrollButtons} containerRef={listRef} />
      <div
        id='chat-input-container'
        data-testid='chat-input-container'
        className={`fixed bottom-0 z-30 bg-background border-t border-border transition-all duration-300 ease-in-out left-16 ${sidebarOpen ? 'lg:left-80' : 'lg:left-16'
          } right-0 ${loading ? 'relative' : ''}`}
      >
        {/* 맨 아래로 스크롤 버튼 - 응답 끝나고 맨 아래가 아닐 때 표시 */}
        {!loading && !isAtBottom && (
          <div className='flex justify-center'>
            <Button
              variant='outline'
              onClick={scrollToBottom}
              className='absolute -top-12 rounded-full shadow-lg'
              aria-label={t('chat.scroll_to_bottom')}
            >
              <ChevronDown className='h-4 w-4' />
              <span>{t('chat.new_message')}</span>
            </Button>
          </div>
        )}
        {loading && (
          <div
            id='chat-loading-overlay'
            data-testid='chat-loading-overlay'
            className='absolute top-0 bottom-0 -left-16 lg:-left-80 right-0 bg-background z-40 flex items-center justify-center'
          >
            <div className='w-full px-4'>
              <div className='flex flex-col items-center gap-2 w-full'>
                <div className='flex items-center gap-3'>
                  <Loader2
                    data-testid='chat-loading-spinner'
                    className='h-5 w-5 text-primary animate-spin'
                  />
                  <span
                    id='chat-loading-text'
                    data-testid='chat-loading-text'
                    className='text-muted-foreground text-sm'
                  >
                    {t('chat.generating')}
                  </span>
                </div>
                <Button
                  id='chat-stop-button'
                  data-testid='chat-stop-button'
                  variant='destructive'
                  size='xs'
                  onClick={stopStreaming}
                >
                  <X className='h-3 w-3' />
                  {t('chat.stop')}
                </Button>
              </div>
            </div>
          </div>
        )}
        <ChatInput
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          loading={isUIBusy}
          modelsLoading={modelsLoading}
          handleKeyDown={handleKeyDown}
          selectedModel={selectedModel}
          setSelectedModel={(modelId) =>
            setSelectedModelWithRoom(modelId, currentRoom)
          }
          modelOptions={modelOptions}
          modelConfig={modelConfig}
          inputRef={inputRef}
          currentRoom={currentRoom}
          selectedImages={selectedImages}
          setSelectedImages={setSelectedImages}
          maxImagesPerMessage={maxImagesPerMessage}
          userDefaultModelId={userDefaultModelId}
          onSetUserDefault={saveUserDefaultModel}
          drawEnabled={drawEnabled}
          drawMode={drawMode}
          onDrawModeToggle={() => setDrawMode((prev) => !prev)}
        />
        <NoticePopup target='main' />
      </div>
    </ChatLayout>
  );
}
