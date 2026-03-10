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
  History,
  Presentation,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ui/modal';
import DirectMessageModal from '@/components/DirectMessageModal';

const AGENT_SIDEBAR_MENUS = {
  '7': {
    title: 'PPT Maker',
    items: [
      { id: 'ppt-compose', label: 'PPT Maker', icon: Presentation },
      { id: 'ppt-history', label: 'Generation History', icon: History },
    ],
  },
};

function AgentSidebar({
  sidebarOpen,
  setSidebarOpen,
  agentId,
  agentName,
  agentDescription,
  agentColor = 'text-foreground',
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
    confirmText: 'Confirm',
    cancelText: 'Cancel',
  });

  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [showDmModal, setShowDmModal] = useState(false);
  const [showDmNotification, setShowDmNotification] = useState(false);
  const [newDmCount, setNewDmCount] = useState(0);
  const prevUnreadCountRef = useRef(0);

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
        console.warn('Failed to fetch unread message count:', error);
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
      <div
        className={`
          fixed left-0 top-0 h-full w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40
          flex flex-col items-center py-4
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        <button
          onClick={handleHamburgerClick}
          className='p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-4'
          title='Open sidebar'
        >
          <Menu className='h-5 w-5 text-gray-600 dark:text-gray-400' />
        </button>

        <div className='p-3 mb-4'>
          <Bot className={`h-5 w-5 ${agentColor}`} />
        </div>

        <div className='relative'>
          <button
            onClick={() => !loading && setShowDmModal(true)}
            className={`relative p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title='Messages'
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
                {newDmCount} new message(s) received
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

        <button
          onClick={() => {
            if (!loading) {
              setConfirmModal({
                isOpen: true,
                title: 'Confirm Logout',
                message: 'Are you sure you want to log out?',
                type: 'warning',
                onConfirm: () => {
                  handleLogout();
                },
                confirmText: 'Log out',
                cancelText: 'Cancel',
              });
            }
          }}
          className='p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-auto'
          title='Log out'
          disabled={loading}
        >
          <LogOut className='h-5 w-5 text-gray-600 dark:text-gray-400' />
        </button>
      </div>

      <div
        className={`
          fixed left-0 top-0 h-full w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-50
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
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
            title='Close sidebar'
          >
            <X className='h-5 w-5 text-gray-600 dark:text-gray-400' />
          </button>
        </div>

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

          <div className='mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg'>
            <p className='text-sm text-gray-600 dark:text-gray-400'>
              {agentDescription || 'Agent features are available.'}
            </p>
          </div>
        </div>

        <div className='p-4 space-y-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0'>
          <button
            onClick={() => !loading && router.push('/notice')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={loading}
          >
            <Bell className='h-4 w-4' />
            Notices
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
              Board
            </button>
          )}

          {profileEditEnabled && (
            <button
              onClick={() => !loading && router.push('/profile')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <User className='h-4 w-4' />
              Edit Profile
            </button>
          )}

          {userRole === 'admin' && (
            <button
              onClick={() => !loading && router.push('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={loading}
            >
              <Shield className='h-4 w-4' />
              Admin
            </button>
          )}
        </div>

        <div className='p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='min-w-0 flex-1'>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                Signed in as
              </p>
              <p className='text-xs text-gray-600 dark:text-gray-400 truncate'>
                {userEmail}
              </p>
              {userRole === 'admin' && (
                <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 mt-1'>
                  Admin
                </span>
              )}
            </div>
            <div className='flex items-center gap-1'>
              <div className='relative'>
                <button
                  onClick={() => !loading && setShowDmModal(true)}
                  className={`relative p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title='Messages'
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
                      {newDmCount} new message(s) received
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
              <button
                onClick={() => {
                  if (!loading) {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Confirm Logout',
                      message: 'Are you sure you want to log out?',
                      type: 'warning',
                      onConfirm: () => {
                        handleLogout();
                      },
                      confirmText: 'Log out',
                      cancelText: 'Cancel',
                    });
                  }
                }}
                className={`p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title='Log out'
                disabled={loading}
              >
                <LogOut className='h-4 w-4 text-gray-600 dark:text-gray-400' />
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({
            isOpen: false,
            title: '',
            message: '',
            type: 'warning',
            onConfirm: null,
            confirmText: 'Confirm',
            cancelText: 'Cancel',
          })
        }
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText || 'Confirm'}
        cancelText={confirmModal.cancelText || 'Cancel'}
      />

      <DirectMessageModal
        isOpen={showDmModal}
        onClose={() => setShowDmModal(false)}
        onUnreadCountChange={fetchUnreadDmCount}
      />
    </>
  );
}

export default AgentSidebar;
