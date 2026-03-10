'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageCircle,
  Menu,
  Plus,
  LogOut,
  Edit,
  X,
  Bell,
  MessageSquare,
  Shield,
  User,
  Key,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertModal, ConfirmModal } from '@/components/ui/modal';
import DirectMessageModal from '@/components/DirectMessageModal';

function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  rooms,
  currentRoom,
  switchRoom,
  createRoom,
  deleteRoom,
  renameRoom,
  userEmail,
  userRole,
  handleLogout,
  loading,
  messages = [],
  profileEditEnabled = true,
  boardEnabled = true,
}) {
  const router = useRouter();
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
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

        // 새 쪽지가 왔는지 확인 (이전보다 개수가 증가한 경우)
        if (newCount > prevUnreadCountRef.current && prevUnreadCountRef.current >= 0) {
          const diff = newCount - prevUnreadCountRef.current;
          setNewDmCount(diff);
          setShowDmNotification(true);

          // 5초 후 말풍선 자동 숨김
          setTimeout(() => {
            setShowDmNotification(false);
          }, 5000);
        }

        prevUnreadCountRef.current = newCount;
        setUnreadDmCount(newCount);
      }
    } catch (error) {
      console.error('읽지 않은 쪽지 개수 조회 실패:', error);
    }
  }, []);

  // 컴포넌트 마운트 시 및 주기적으로 쪽지 개수 조회
  useEffect(() => {
    fetchUnreadDmCount();

    // 60초마다 쪽지 개수 갱신
    const interval = setInterval(fetchUnreadDmCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadDmCount]);

  const startEditing = (room) => {
    setEditingRoom(room._id);
    setEditingName(room.name);
  };

  const saveEdit = async () => {
    if (editingName.trim() && editingName.trim().length <= 15) {
      await renameRoom(editingRoom, editingName.trim());
    }
    setEditingRoom(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingRoom(null);
    setEditingName('');
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = Math.max(0, now - date);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const koreaTimeOptions = { timeZone: 'Asia/Seoul' };

    // 오늘인 경우
    if (diffDays <= 0) {
      return date.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        ...koreaTimeOptions,
      });
    }
    // 7일 이내인 경우
    if (diffDays < 7) {
      return `${diffDays}일 전`;
    }
    // 그 외의 경우
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...koreaTimeOptions,
    });
  };

  // 햄버거 버튼 클릭 핸들러 (열기/닫기 토글)
  const handleHamburgerClick = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // 닫기 버튼 클릭 핸들러
  const handleCloseClick = () => {
    setSidebarOpen(false);
  };

  // 새 채팅방 생성 핸들러
  const handleCreateRoom = async () => {
    if (loading) return;

    // 현재 채팅방에 대화 내용이 없는 경우 모달 띄우기
    if (messages.length === 0 && currentRoom) {
      setAlertModal({
        isOpen: true,
        title: '현재 채팅방 사용',
        message:
          '현재 채팅방에 대화 내용이 없습니다. 현재 채팅방을 계속 사용해주세요.',
        type: 'info',
      });
      return;
    }

    // 20개 이상인 경우 확인창 띄우기 (빈 방 체크보다 먼저 확인)
    if (rooms.length >= 20) {
      setConfirmModal({
        isOpen: true,
        title: '대화방 개수 제한',
        message:
          '최대 값(20개)의 대화방이 생성되어 있습니다. 가장 오래된 대화방을 삭제하시겠습니까?',
        type: 'warning',
        onConfirm: async () => {
          // 가장 오래된 방 찾기 (createdAt 기준)
          const sortedRooms = [...rooms].sort((a, b) => {
            const dateA = new Date(a.createdAt || a.updatedAt || 0);
            const dateB = new Date(b.createdAt || b.updatedAt || 0);
            return dateA - dateB;
          });

          const oldestRoom = sortedRooms[0];

          if (oldestRoom) {
            // 가장 오래된 방 삭제
            const success = await deleteRoom(oldestRoom._id);
            // 삭제 성공한 경우에만 새 방 생성
            if (success) {
              await createRoom();
            }
          }
        },
      });
      return;
    }

    // 가장 최근 대화방 확인 (rooms는 이미 updatedAt 기준으로 정렬되어 있음)
    if (rooms.length > 0) {
      const mostRecentRoom = rooms[0];
      // 메시지가 없는 경우 (messageCount가 0이거나 undefined인 경우) - 빈 방이면 새 방을 만들지 않고 기존 방 사용
      if (!mostRecentRoom.messageCount || mostRecentRoom.messageCount === 0) {
        // 빈 방이 있으면 그 방으로 전환
        if (currentRoom !== mostRecentRoom._id) {
          switchRoom(mostRecentRoom._id);
        }
        return;
      }
    }

    // 새 방 생성
    await createRoom();
  };

  return (
    <>
      {/* 접힌 사이드바 (아이콘만) */}
      <div
        className={`
          fixed left-0 top-0 h-full w-16 bg-background border-r border-border z-40
          flex flex-col items-center py-4
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        {/* 메뉴 버튼 (열기/닫기 토글) */}
        <Button
          id='sidebar-toggle-button'
          data-testid='sidebar-toggle-button'
          variant='ghost'
          size='icon'
          onClick={handleHamburgerClick}
          className='mb-4'
          title='사이드바 열기'
        >
          <Menu className='h-5 w-5 text-muted-foreground' />
        </Button>

        {/* 채팅방 추가 */}
        <Button
          id='sidebar-create-room-button'
          data-testid='sidebar-create-room-button'
          variant='ghost'
          size='icon'
          onClick={handleCreateRoom}
          className='mb-4'
          title='새 채팅방'
          disabled={loading}
        >
          <Plus className='h-5 w-5 text-muted-foreground' />
        </Button>

        {/* 쪽지 */}
        <div className='relative'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => !loading && setShowDmModal(true)}
            className={`relative ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title='받은 쪽지'
            disabled={loading}
          >
            <Mail className='h-5 w-5 text-muted-foreground' />
            {unreadDmCount > 0 && (
              <span className='absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground'>
                {unreadDmCount > 99 ? '99+' : unreadDmCount}
              </span>
            )}
          </Button>

          {/* 새 쪽지 알림 말풍선 */}
          {showDmNotification && (
            <div className='absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 animate-bounce'>
              <div className='relative bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap'>
                <div className='absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[8px] border-r-primary'></div>
                새 쪽지 {newDmCount}개가 도착했습니다
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDmNotification(false);
                  }}
                  className='ml-2 hover:text-primary-foreground/70'
                >
                  <X className='h-3 w-3 inline' />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 로그아웃 */}
        <Button
          id='sidebar-logout-button'
          data-testid='sidebar-logout-button'
          variant='ghost'
          size='icon'
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
          className='mt-auto'
          title='로그아웃'
          disabled={loading}
        >
          <LogOut className='h-5 w-5 text-muted-foreground' />
        </Button>
      </div>

      {/* 펼쳐진 사이드바 */}
      <div
        className={`
          fixed left-0 top-0 h-full w-80 bg-background border-r border-border z-50
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 사이드바 헤더 */}
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold text-foreground'>
            채팅방
          </h2>
          <Button
            variant='ghost'
            size='icon-sm'
            onClick={handleCloseClick}
            title='사이드바 닫기'
          >
            <X className='h-5 w-5 text-muted-foreground' />
          </Button>
        </div>

        {/* 새 방 추가 버튼 */}
        <div className='p-4 border-b border-border flex-shrink-0'>
          <button
            id='sidebar-create-room-button-full'
            data-testid='sidebar-create-room-button-full'
            className='btn-primary w-full flex items-center justify-center gap-2'
            onClick={handleCreateRoom}
            disabled={loading}
          >
            <Plus className='h-4 w-4' />새 채팅방
          </button>
        </div>

        {/* 방 목록 (스크롤 가능 영역) */}
        <ScrollArea
          id='sidebar-rooms-list'
          data-testid='sidebar-rooms-list'
          className='flex-1 min-h-0'
        >
          <div className='p-4 space-y-2'>
            {rooms.map((room) => (
              <div
                key={room._id}
                id={`sidebar-room-${room._id}`}
                data-testid={`sidebar-room-${room._id}`}
                className={`
                  group flex items-center justify-between p-3 rounded-lg
                  transition-all duration-200
                  ${
                    room._id === currentRoom
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-muted hover:bg-accent text-foreground'
                  }
                  ${editingRoom === room._id ? '' : 'cursor-pointer'}
                  ${loading ? 'pointer-events-none opacity-50' : ''}
                `}
                onClick={() => {
                  if (!loading && editingRoom !== room._id) {
                    switchRoom(room._id);
                  }
                }}
              >
                <div className='flex items-center min-w-0 flex-1'>
                  <MessageCircle className='h-4 w-4 mr-3 flex-shrink-0' />
                  <div className='flex flex-col min-w-0 flex-1'>
                    {editingRoom === room._id ? (
                      <input
                        type='text'
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            saveEdit();
                          } else if (e.key === 'Escape') {
                            cancelEdit();
                          }
                        }}
                        onBlur={saveEdit}
                        className='flex-1 bg-background text-foreground px-2 py-1 rounded text-sm font-medium min-w-0'
                        maxLength={15}
                        autoFocus
                      />
                    ) : (
                      <>
                        <span
                          className={`truncate font-medium ${
                            room._id === currentRoom ? 'text-primary-foreground' : ''
                          }`}
                        >
                          {room.name}
                        </span>
                        {(room.createdAt || room.updatedAt) && (
                          <div
                            className={`flex flex-col gap-0.5 text-xs mt-0.5 ${
                              room._id === currentRoom
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {room.createdAt && (
                              <span>생성: {formatDate(room.createdAt)}</span>
                            )}
                            {room.updatedAt &&
                              room.createdAt !== room.updatedAt && (
                                <span>
                                  마지막: {formatDate(room.updatedAt)}
                                </span>
                              )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className='flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                  {editingRoom === room._id ? (
                    <>
                      <button
                        className='p-1.5 rounded-md transition-colors duration-200 text-green-600 hover:bg-green-100'
                        onClick={saveEdit}
                        aria-label='저장'
                      >
                        <Edit className='h-3 w-3' />
                      </button>
                      <button
                        className='p-1.5 rounded-md transition-colors duration-200 text-red-600 hover:bg-red-100'
                        onClick={cancelEdit}
                        aria-label='취소'
                      >
                        <X className='h-3 w-3' />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* 방 이름 편집 */}
                      <button
                        id={`sidebar-room-edit-${room._id}`}
                        data-testid={`sidebar-room-edit-${room._id}`}
                        className={`
                          p-1.5 rounded-md transition-colors duration-200
                          ${
                            room._id === currentRoom
                              ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                          }
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!loading) startEditing(room);
                        }}
                        disabled={loading}
                        aria-label='방 이름 편집'
                      >
                        <Edit className='h-3 w-3' />
                      </button>

                      {/* 삭제 (최소 1개 방 보장) */}
                      {rooms.length > 1 && (
                        <button
                          id={`sidebar-room-delete-${room._id}`}
                          data-testid={`sidebar-room-delete-${room._id}`}
                          className={`
                            p-1.5 rounded-md transition-colors duration-200
                            ${
                              room._id === currentRoom
                                ? 'text-primary-foreground/80 hover:text-primary-foreground hover:bg-destructive/20'
                                : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                            }
                          `}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!loading) {
                              setConfirmModal({
                                isOpen: true,
                                title: '대화방 삭제',
                                message: `"${room.name}" 방을 삭제하시겠습니까?`,
                                type: 'warning',
                                onConfirm: async () => {
                                  await deleteRoom(room._id);
                                },
                              });
                            }
                          }}
                          disabled={loading}
                          aria-label='방 삭제'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* 관리자/사용자 기능 버튼 */}
        <div className='p-4 space-y-2 border-t border-border flex-shrink-0'>
          {/* 공지사항 */}
          <Button
            variant='ghost'
            onClick={() => !loading && router.push('/notice')}
            className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium text-foreground ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            <Bell className='h-4 w-4' />
            공지사항
          </Button>

          {boardEnabled && (
            <Button
              variant='ghost'
              onClick={() => !loading && router.push('/board')}
              className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium text-foreground ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <MessageSquare className='h-4 w-4' />
              자유게시판
            </Button>
          )}

          <Button
            variant='ghost'
            onClick={() => !loading && router.push('/my-api-keys')}
            className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium text-foreground ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            <Key className='h-4 w-4' />내 API 키
          </Button>

          {/* 프로필 수정 */}
          {profileEditEnabled && (
            <Button
              variant='ghost'
              onClick={() => !loading && router.push('/profile')}
              className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium text-foreground ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <User className='h-4 w-4' />
              프로필 수정
            </Button>
          )}

          {/* 관리자 패널 (관리자만 표시) */}
          {userRole === 'admin' && (
            <Button
              id='sidebar-admin-button'
              data-testid='sidebar-admin-button'
              variant='ghost'
              onClick={() => !loading && router.push('/admin')}
              className={`w-full justify-start gap-3 px-3 py-2 text-sm font-medium text-primary hover:bg-accent ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <Shield className='h-4 w-4' />
              관리자 페이지
            </Button>
          )}
        </div>

        {/* 하단 사용자 정보 */}
        <div className='p-4 border-t border-border bg-muted flex-shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-foreground'>
                로그인 계정
              </p>
              <p className='text-xs text-muted-foreground truncate'>
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
                <Button
                  variant='ghost'
                  size='icon-sm'
                  onClick={() => !loading && setShowDmModal(true)}
                  className={`relative ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title='받은 쪽지'
                  disabled={loading}
                >
                  <Mail className='h-4 w-4 text-muted-foreground' />
                  {unreadDmCount > 0 && (
                    <span className='absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-destructive text-destructive-foreground'>
                      {unreadDmCount > 99 ? '99+' : unreadDmCount}
                    </span>
                  )}
                </Button>

                {/* 새 쪽지 알림 말풍선 */}
                {showDmNotification && (
                  <div className='absolute bottom-full mb-2 right-0 z-50 animate-bounce'>
                    <div className='relative bg-primary text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap'>
                      새 쪽지 {newDmCount}개가 도착했습니다
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDmNotification(false);
                        }}
                        className='ml-2 hover:text-primary-foreground/70'
                      >
                        <X className='h-3 w-3 inline' />
                      </button>
                      <div className='absolute -bottom-2 right-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary'></div>
                    </div>
                  </div>
                )}
              </div>
              {/* 로그아웃 버튼 */}
              <Button
                variant='ghost'
                size='icon-sm'
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
                className={`${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title='로그아웃'
                disabled={loading}
              >
                <LogOut className='h-4 w-4 text-muted-foreground' />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 알림 모달 */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

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

export default Sidebar;
