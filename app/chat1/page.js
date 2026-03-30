'use client';
import { useState } from 'react';
import { useChatPage } from '@/hooks/useChatPage';

// Component Imports
import dynamic from 'next/dynamic';
const Sidebar = dynamic(() => import('@/components/chat/Sidebar'), { ssr: false });
import ChatHeader from '@/components/chat/ChatHeader';
const MessageList = dynamic(() => import('@/components/chat/MessageList'), { ssr: false });
import ScrollButtons from '@/components/chat/ScrollButtons';
import ChatLayout from '@/components/chat/ChatLayout';
const ChatInput = dynamic(() => import('@/components/chat/ChatInput'), { ssr: false });
const NoticePopup = dynamic(() => import('@/components/NoticePopup'), { ssr: false });
const AgentSelector = dynamic(() => import('@/components/AgentSelector'), { ssr: false });
import { X, Loader2, ChevronDown } from '@/components/icons';

/* ---------- 메인 컴포넌트 ---------- */
export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    // Auth
    userRole,
    authChecked,
    userEmail,
    // App state
    selectedImages,
    setSelectedImages,
    maxImagesPerMessage,
    imageHistoryByRoom,
    profileEditEnabled,
    boardEnabled,
    // UI state
    showScrollButtons,
    isAtBottom,
    // Refs
    bottomRef,
    inputRef,
    listRef,
    // useChat
    rooms,
    currentRoom,
    messages,
    chatLoading,
    createRoom,
    renameRoom,
    deleteRoom,
    switchRoom,
    // useModelManager
    modelOptions,
    modelConfig,
    selectedModel,
    setSelectedModelWithRoom,
    modelsLoading,
    userDefaultModelId,
    saveUserDefaultModel,
    // useChatSender
    input,
    setInput,
    loading,
    sendMessage,
    handleKeyDown,
    stopStreaming,
    // Handlers
    handleLogout,
    scrollToBottom,
  } = useChatPage();

  const isUIBusy = loading;

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
      <AgentSelector />
      <ChatHeader />
      <MessageList
        messages={messages}
        bottomRef={bottomRef}
        modelOptions={modelOptions}
        currentRoom={currentRoom}
        imageHistoryByRoom={imageHistoryByRoom}
        listRef={listRef}
      />
      <ScrollButtons show={showScrollButtons} containerRef={listRef} />
      <div
        id='chat-input-container'
        data-testid='chat-input-container'
        className={`fixed bottom-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out left-16 ${sidebarOpen ? 'lg:left-80' : 'lg:left-16'
          } right-0 ${loading ? 'relative' : ''}`}
      >
        {/* 맨 아래로 스크롤 버튼 - 응답 끝나고 맨 아래가 아닐 때 표시 */}
        {!loading && !isAtBottom && (
          <div className='flex justify-center'>
            <button
              onClick={scrollToBottom}
              className='absolute -top-12 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full shadow-lg border border-gray-200 dark:border-gray-600 transition-all flex items-center gap-1.5 text-sm'
              aria-label='맨 아래로 스크롤'
            >
              <ChevronDown className='h-4 w-4' />
              <span>새 메시지</span>
            </button>
          </div>
        )}
        {loading && (
          <div
            id='chat-loading-overlay'
            data-testid='chat-loading-overlay'
            className='absolute top-0 bottom-0 -left-16 lg:-left-80 right-0 bg-white dark:bg-gray-900 z-40 flex items-center justify-center'
          >
            <div className='w-full px-4'>
              <div className='flex flex-col items-center gap-2 w-full'>
                <div className='flex items-center gap-3'>
                  <Loader2
                    data-testid='chat-loading-spinner'
                    className='h-5 w-5 text-blue-600 animate-spin'
                  />
                  <span
                    id='chat-loading-text'
                    data-testid='chat-loading-text'
                    className='text-gray-600 dark:text-gray-400 text-sm'
                  >
                    응답 생성 중...
                  </span>
                </div>
                <button
                  id='chat-stop-button'
                  data-testid='chat-stop-button'
                  onClick={stopStreaming}
                  className='btn-danger flex items-center gap-1 text-xs py-1 px-2'
                >
                  <X className='h-3 w-3' />
                  중단
                </button>
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
        />
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-1.5">
          ModolAI는 실수를 할 수 있습니다. AI 생성된 답변이니 중요한 정보는 재차 확인하세요
        </p>
        <NoticePopup target='main' />
      </div>
    </ChatLayout>
  );
}
