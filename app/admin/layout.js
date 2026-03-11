'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TokenManager } from '@/lib/tokenManager';
import { useAlert } from '@/contexts/AlertContext';
import DarkModeToggle from '@/components/DarkModeToggle';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Cpu,
  Server,
  GripVertical,
  Edit3,
  Save,
  RotateCcw,
  Edit2,
  Check,
  XIcon,
  Key,
  Terminal,
  Shield,
  Mail,
  Bot,
  ChevronRight,
} from '@/components/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 드래그 가능한 메뉴 아이템 컴포넌트
function SortableNavItem({
  id,
  item,
  isReorderMode,
  isEditMode,
  editingItemId,
  editingName,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onEditingNameChange,
  pathname,
  isExpanded,
  onToggleExpand,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const isCurrentlyEditing = editingItemId === id;
  const hasChildren = item.children && item.children.length > 0;
  const isActive = hasChildren
    ? item.children.some(
        (child) =>
          pathname === child.href ||
          (child.href !== '/' && pathname?.startsWith(child.href))
      )
    : pathname === item.href ||
    (item.href !== '/' && pathname?.startsWith(item.href));
  return (
    <div ref={setNodeRef} style={style}>
      {/* Main row */}
      <div
      className={`group flex items-center rounded-md ${isReorderMode
            ? 'bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 py-2 px-2 mb-1 text-gray-700 dark:text-gray-300'
            : isEditMode
            ? 'bg-gray-50 dark:bg-gray-700 border border-blue-200 dark:border-blue-600 py-2 px-2 mb-1 text-gray-700 dark:text-gray-300'
            : isActive
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-2 py-2'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-2'
        }`}
        data-testid={`admin-menu-item-${id}`}
      >
        {isReorderMode && (
          <div
            {...attributes}
            {...listeners}
            className='mr-2 cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600'
          >
            <GripVertical className='h-4 w-4' />
          </div>
        )}
      <div className='flex items-center flex-1'>
          <item.icon
          className={`mr-3 h-5 w-5 shrink-0 ${isActive && !isReorderMode && !isEditMode
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400 group-hover:text-gray-500'
            }`}
          />

          {hasChildren ? (
            // 부모 항목 (하위메뉴 펼침/접기)
            <div className='flex items-center justify-between flex-1'>
              <button
                onClick={!isReorderMode && !isEditMode ? onToggleExpand : undefined}
                className={`text-sm font-medium text-left flex-1 ${
                  isReorderMode || isEditMode ? 'pointer-events-none' : ''
                }`}
                data-testid={`admin-sidebar-menu-link-${item.id}`}
              >
                {item.name}
              </button>
              {isEditMode ? (
                <button
                  onClick={() => onStartEditing(id, item.name)}
                  className='opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600'
                  data-testid={`admin-menu-edit-button-${id}`}
                >
                  <Edit2 className='h-4 w-4' />
                </button>
              ) : !isReorderMode && (
                <ChevronRight
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${
                    isExpanded ? 'rotate-90' : ''
                  }`}
                />
              )}
            </div>
          ) : isCurrentlyEditing ? (
            // 메뉴명 편집 모드
            <div className='flex items-center flex-1 gap-2'>
              <input
                type='text'
                value={editingName}
                onChange={(e) => onEditingNameChange(e.target.value)}
                className='flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                autoFocus
                data-testid={`admin-menu-edit-input-${id}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onSaveEdit(id);
                  } else if (e.key === 'Escape') {
                    onCancelEdit();
                  }
                }}
              />
              <button
                onClick={() => onSaveEdit(id)}
                className='p-1 text-green-600 hover:text-green-700'
                data-testid={`admin-menu-save-button-${id}`}
              >
                <Check className='h-4 w-4' />
              </button>
              <button
                onClick={onCancelEdit}
                className='p-1 text-red-600 hover:text-red-700'
                data-testid={`admin-menu-cancel-button-${id}`}
              >
                <XIcon className='h-4 w-4' />
              </button>
            </div>
          ) : (
            // 일반 항목
            <div className='flex items-center justify-between flex-1'>
              <a
                href={isReorderMode || isEditMode ? undefined : item.href}
              className={`text-sm font-medium ${isReorderMode || isEditMode ? 'pointer-events-none' : ''
                }`}
                onClick={
                  isReorderMode || isEditMode
                    ? (e) => e.preventDefault()
                    : undefined
                }
                data-testid={`admin-sidebar-menu-link-${item.id}`}
              >
                {item.name}
              </a>
            {isEditMode && (
                <button
                  onClick={() => onStartEditing(id, item.name)}
                  className='opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600'
                  data-testid={`admin-menu-edit-button-${id}`}
                >
                  <Edit2 className='h-4 w-4' />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 하위메뉴 리스트 */}
      {hasChildren && isExpanded && !isReorderMode && (
        <div className='ml-8 mt-1 mb-2 space-y-0.5'>
          {item.children.map((child) => {
            const isChildActive =
              pathname === child.href ||
              (child.href !== '/' && pathname?.startsWith(child.href));
            return (
              <a
                key={child.id}
                href={isEditMode ? undefined : child.href}
                className={`flex items-center px-2 py-1.5 text-sm rounded-md ${
                  isChildActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                data-testid={`admin-sidebar-menu-link-${child.id}`}
              >
                {child.name}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout({ children }) {
  const { alert, confirm } = useAlert();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [navigation, setNavigation] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({});

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 기본 메뉴 구조 (useMemo로 메모이제이션)
  const defaultNavigation = useMemo(
    () => [
      {
        id: 'dashboard',
        name: '대시보드',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
      },
      { id: 'users', name: '사용자 관리', href: '/admin/users', icon: Users },
      {
        id: 'modelServers',
        name: '모델 서버 관리',
        href: '/admin/modelServers',
        icon: Server,
      },
      { id: 'models', name: '모델 관리', href: '/admin/models', icon: Cpu },
      {
        id: 'messages',
        name: '메시지 관리',
        href: '/admin/messages',
        icon: MessageSquare,
      },
      {
        id: 'direct-messages',
        name: '쪽지 관리',
        href: '/admin/direct-messages',
        icon: Mail,
      },
      {
        id: 'agents',
        name: '에이전트 관리',
        href: '/admin/agents',
        icon: Bot,
      },

      {
        id: 'external-api-logs',
        name: 'API 로깅',
        href: '/admin/external-api-logs',
        icon: Terminal,
      },
      {
        id: 'api-keys',
        name: 'API 키 관리',
        href: '/admin/api-keys',
        icon: Key,
      },
      {
        id: 'security-logs',
        name: '보안 로그',
        icon: Shield,
        children: [
          { id: 'pii-logs', name: 'PII 로그', href: '/admin/pii-logs' },
          { id: 'pii-test', name: 'PII 테스트', href: '/admin/pii-test' },
          { id: 'sso-logs', name: 'SSO 로그인 로그', href: '/admin/sso-logs' },
        ],
      },
      {
        id: 'analytics',
        name: '통계 분석',
        href: '/admin/analytics',
        icon: BarChart3,
      },
      { id: 'settings', name: '설정', href: '/admin/settings', icon: Settings },
      { id: 'home', name: '메인으로', href: '/', icon: Home },
    ],
    []
  );

  // 메뉴 순서 및 이름 초기화
  useEffect(() => {
    const savedOrder = localStorage.getItem('adminMenuOrder');
    const savedNames = localStorage.getItem('adminMenuNames');

    let customNames = {};
    if (savedNames) {
      try {
        customNames = JSON.parse(savedNames);
      } catch (error) {
        console.error('메뉴 이름 로드 실패:', error);
      }
    }

    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const orderedNavigation = orderIds
          .map((id) => {
            const item = defaultNavigation.find((nav) => nav.id === id);
            return item
              ? {
                  ...item,
                  name: customNames[id] || item.name, // 커스텀 이름이 있으면 사용
                }
              : null;
          })
          .filter(Boolean);

        // 새로운 메뉴 항목이 추가된 경우 처리
        const existingIds = orderedNavigation.map((item) => item.id);
        const newItems = defaultNavigation
          .filter((item) => !existingIds.includes(item.id))
          .map((item) => ({
            ...item,
            name: customNames[item.id] || item.name,
          }));

        setNavigation([...orderedNavigation, ...newItems]);
      } catch (error) {
        console.error('메뉴 순서 로드 실패:', error);
        const navigationWithNames = defaultNavigation.map((item) => ({
          ...item,
          name: customNames[item.id] || item.name,
        }));
        setNavigation(navigationWithNames);
      }
    } else {
      const navigationWithNames = defaultNavigation.map((item) => ({
        ...item,
        name: customNames[item.id] || item.name,
      }));
      setNavigation(navigationWithNames);
    }
  }, [defaultNavigation]);

  // 현재 경로에 하위 메뉴가 포함된 그룹은 자동 펼침
  useEffect(() => {
    const newExpanded = {};
    navigation.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) =>
            pathname === child.href ||
            (child.href !== '/' && pathname?.startsWith(child.href))
        );
        if (hasActiveChild) {
          newExpanded[item.id] = true;
        }
      }
    });
    if (Object.keys(newExpanded).length > 0) {
      setExpandedGroups((prev) => ({ ...prev, ...newExpanded }));
    }
  }, [pathname, navigation]);

  // TokenManager를 사용한 관리자 권한 확인 및 자동 토큰 검증
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsValidating(true);

        // 토큰 존재 확인
        const token = localStorage.getItem('token');
        if (!token) {
          const loginUrl = await TokenManager.getLoginUrl(pathname);
          router.replace(loginUrl);
          return;
        }

        // 토큰 유효성 검증
        const result = await TokenManager.validateToken();
        if (!result.valid) {
          console.log('토큰이 유효하지 않습니다:', result.reason);
          // 토큰이 유효하지 않으면 localStorage 직접 정리하고 로그인 페이지로
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          const loginUrl = await TokenManager.getLoginUrl(pathname);
          router.replace(loginUrl);
          return;
        }

        // 관리자 권한 확인
        if (result.user.role !== 'admin') {
          alert('관리자 권한이 필요합니다.', 'warning', '권한 오류');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.replace('/');
          return;
        }

        // 사용자 정보 설정
        setUser({
          ...result.user,
          name: result.user.name || '관리자',
        });

        // 토큰 자동 갱신 + 글로벌 401 인터셉터 시작
        await TokenManager.initializeTokenValidation();
      } catch (error) {
        console.error('인증 초기화 실패:', error);
        TokenManager.logout();
      } finally {
        setIsValidating(false);
      }
    };

    initializeAuth();

    // 컴포넌트 언마운트 시 주기적 검증 중단
    return () => {
      TokenManager.stopPeriodicValidation();
    };
  }, [router, alert, confirm]);

  const handleLogout = async () => {
    const confirmed = await confirm(
      '로그아웃 하시겠습니까?',
      '로그아웃 확인',
      'warning'
    );
    if (confirmed) {
      TokenManager.logout();
    }
  };

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 드래그 앤 드롭 핸들러
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setNavigation((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newOrder = arrayMove(items, oldIndex, newIndex);

        // localStorage에 순서 저장
        const orderIds = newOrder.map((item) => item.id);
        localStorage.setItem('adminMenuOrder', JSON.stringify(orderIds));

        return newOrder;
      });
    }
  };

  // 순서 편집 모드 토글
  const toggleReorderMode = () => {
    setIsReorderMode(!isReorderMode);
  };

  // 순서 초기화
  const resetMenuOrder = () => {
    setNavigation(defaultNavigation);
    localStorage.removeItem('adminMenuOrder');
    setIsReorderMode(false);
  };

  // 순서 저장
  const saveMenuOrder = () => {
    setIsReorderMode(false);
    // 이미 handleDragEnd에서 저장하고 있으므로 추가 작업 불요
  };

  // 메뉴명 편집 모드 토글
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    if (isEditMode) {
      // 편집 모드 종료 시 편집 상태 초기화
      setEditingItemId(null);
      setEditingName('');
    }
  };

  // 메뉴명 편집 시작
  const startEditingName = (itemId, currentName) => {
    setEditingItemId(itemId);
    setEditingName(currentName);
  };

  // 메뉴명 편집 저장
  const saveMenuName = (itemId) => {
    if (editingName.trim()) {
      const updatedNavigation = navigation.map((item) =>
        item.id === itemId ? { ...item, name: editingName.trim() } : item
      );
      setNavigation(updatedNavigation);

      // localStorage에 메뉴명 저장
      const savedNames = localStorage.getItem('adminMenuNames');
      let customNames = {};
      if (savedNames) {
        try {
          customNames = JSON.parse(savedNames);
        } catch (error) {
          console.error('기존 메뉴명 로드 실패:', error);
        }
      }
      customNames[itemId] = editingName.trim();
      localStorage.setItem('adminMenuNames', JSON.stringify(customNames));
    }

    setEditingItemId(null);
    setEditingName('');
  };

  // 메뉴명 편집 취소
  const cancelEditingName = () => {
    setEditingItemId(null);
    setEditingName('');
  };

  // 메뉴명 초기화
  const resetMenuNames = () => {
    const resetNavigation = navigation.map((item) => {
      const defaultItem = defaultNavigation.find(
        (defaultNav) => defaultNav.id === item.id
      );
      if (!defaultItem) return item;
      return {
        ...item,
        name: defaultItem.name,
        // 하위메뉴 이름도 초기화
        children: item.children
          ? item.children.map((child) => {
              const defaultChild = defaultItem.children?.find(
                (dc) => dc.id === child.id
              );
              return defaultChild ? { ...child, name: defaultChild.name } : child;
            })
          : item.children,
      };
    });
    setNavigation(resetNavigation);
    localStorage.removeItem('adminMenuNames');
    setIsEditMode(false);
    setEditingItemId(null);
    setEditingName('');
  };

  if (isValidating || !user) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center'>
        <div className='flex flex-col items-center gap-4'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <p className='text-gray-600 dark:text-gray-400'>
            {isValidating ? '인증 확인 중...' : '사용자 정보 로드 중...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-300 ease-in-out'>
      {/* 접힌 사이드바 (아이콘만) */}
      <div
        className={`
          fixed left-0 top-0 h-full w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40
          flex flex-col items-center py-4
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
        data-testid='admin-sidebar-collapsed'
      >
        {/* 메뉴 버튼 (열기/닫기 토글) */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className='p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mb-2'
          title='사이드바 열기'
          data-testid='admin-sidebar-toggle-button'
        >
          <Menu className='h-5 w-5 text-gray-600 dark:text-gray-400' />
        </button>

        {/* 다크모드 토글 */}
        <div className='mb-4'>
          <DarkModeToggle />
        </div>

        {/* 메뉴 아이콘들 */}
        <div className='flex-1 overflow-y-auto w-full flex flex-col items-center gap-2'>
          {navigation.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const isActive = hasChildren
              ? item.children.some(
                  (child) =>
                    pathname === child.href ||
                    (child.href !== '/' && pathname?.startsWith(child.href))
                )
              : pathname === item.href ||
                (item.href !== '/' && pathname?.startsWith(item.href));
            if (hasChildren) {
              return (
                <button
                  key={item.id}
                  onClick={() => setSidebarOpen(true)}
                  className={`p-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                  title={item.name}
                  data-testid={`admin-sidebar-menu-icon-${item.id}`}
                >
                  <item.icon className='h-5 w-5' />
                </button>
              );
            }
            return (
              <a
                key={item.id}
                href={item.href}
                className={`p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
                title={item.name}
                data-testid={`admin-sidebar-menu-icon-${item.id}`}
              >
                <item.icon className='h-5 w-5' />
              </a>
            );
          })}
        </div>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className='p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors mt-auto'
          title='로그아웃'
          data-testid='admin-sidebar-logout-button'
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
        data-testid='admin-sidebar-expanded'
      >
        {/* 사이드바 헤더 */}
        <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
          <h2
            className='text-lg font-semibold text-gray-800 dark:text-gray-200'
            data-testid='admin-sidebar-title'
          >
            관리자 패널
          </h2>
          <div className='flex items-center gap-2'>
            <DarkModeToggle />
            <button
              onClick={() => setSidebarOpen(false)}
              className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
              title='사이드바 닫기'
              data-testid='admin-sidebar-close-button'
            >
              <X className='h-5 w-5 text-gray-600 dark:text-gray-400' />
            </button>
          </div>
        </div>

        {/* 메뉴 목록 (스크롤 가능 영역) */}
        <div className='flex-1 overflow-y-auto min-h-0 px-2 py-4'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={navigation.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <nav className='space-y-1'>
                {navigation.map((item) => (
                  <SortableNavItem
                    key={item.id}
                    id={item.id}
                    item={item}
                    isReorderMode={isReorderMode}
                    isEditMode={isEditMode}
                    editingItemId={editingItemId}
                    editingName={editingName}
                    onStartEditing={startEditingName}
                    onSaveEdit={saveMenuName}
                    onCancelEdit={cancelEditingName}
                    onEditingNameChange={setEditingName}
                    pathname={pathname}
                    isExpanded={!!expandedGroups[item.id]}
                    onToggleExpand={() => toggleGroup(item.id)}
                  />
                ))}
              </nav>
            </SortableContext>
          </DndContext>

          {/* 메뉴 편집 버튼들 */}
          <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2'>
            {!isReorderMode && !isEditMode ? (
              <>
                <button
                  onClick={toggleReorderMode}
                  className='w-full flex items-center justify-start gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md'
                  data-testid='admin-menu-reorder-button'
                >
                  <Edit3 className='h-4 w-4' />
                  순서 변경
                </button>
                <button
                  onClick={toggleEditMode}
                  className='w-full flex items-center justify-start gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md'
                  data-testid='admin-menu-edit-mode-button'
                >
                  <Edit2 className='h-4 w-4' />
                  메뉴명 편집
                </button>
              </>
            ) : isReorderMode ? (
              <>
                <button
                  onClick={saveMenuOrder}
                  className='w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md'
                  data-testid='admin-menu-save-order-button'
                >
                  <Save className='h-4 w-4' />
                  저장
                </button>
                <button
                  onClick={resetMenuOrder}
                  className='w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md'
                  data-testid='admin-menu-reset-order-button'
                >
                  <RotateCcw className='h-4 w-4' />
                  초기화
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleEditMode}
                  className='w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md'
                  data-testid='admin-menu-finish-edit-button'
                >
                  <Check className='h-4 w-4' />
                  편집 완료
                </button>
                <button
                  onClick={resetMenuNames}
                  className='w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md'
                  data-testid='admin-menu-reset-names-button'
                >
                  <RotateCcw className='h-4 w-4' />
                  메뉴명 초기화
                </button>
              </>
            )}
          </div>
        </div>

        {/* 사용자 정보 및 로그아웃 */}
        <div className='flex shrink-0 border-t border-gray-200 dark:border-gray-700 p-4'>
          <div className='group block w-full shrink-0'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  {user.name}
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  관리자
                </p>
              </div>
              <button
                onClick={handleLogout}
                className='p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                data-testid='admin-sidebar-logout-button-bottom'
              >
                <LogOut className='h-4 w-4' />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'pl-0 lg:pl-80' : 'pl-0 lg:pl-16'
        }`}
      >
        {/* Page content */}
        <main className='py-6'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
