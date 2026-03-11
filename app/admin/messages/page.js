'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  MessageCircle,
  Filter,
  Download,
  Eye,
  Trash2,
  User,
  Clock,
  Bot,
  Calendar,
  Building,
  X,
  RefreshCw,
  Pause,
  Play,
  ThumbsUp,
  ThumbsDown,
  Hash,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  XCircle,
  BarChart3,
} from '@/components/icons';
import MarkdownPreview from '@uiw/react-markdown-preview';
import { useAlert } from '@/contexts/AlertContext';

export default function MessagesPage() {
  const { alert, confirm } = useAlert();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedUser, setSelectedUser] = useState(''); // 사용자(이름/이메일) 필터
  const [dateRange, setDateRange] = useState('7d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageViewMode, setMessageViewMode] = useState('markdown'); // 'markdown' or 'raw'
  const [hasMessageOverflow, setHasMessageOverflow] = useState(false);
  const messageContentRef = useRef(null);
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showFilters, setShowFilters] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'card'

  const DEFAULT_DEPTS = [
    '디지털서비스개발부',
    'Tech혁신Unit',
    '글로벌서비스개발부',
    '금융서비스개발부',
    '정보서비스개발부',
    '기타부서',
  ];

  const dateRangeOptions = [
    { value: '1d', label: '오늘' },
    { value: '7d', label: '최근 7일' },
    { value: '30d', label: '최근 30일' },
    { value: '90d', label: '최근 3개월' },
    { value: '365d', label: '최근 1년' },
    { value: 'all', label: '전체' },
    { value: 'custom', label: '기간 지정' },
  ];

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/departments', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then(({ departments: rows = [] }) => {
        const seen = new Map();
        rows.forEach(({ department, auth_type }) => {
          seen.set(
          `${department}|${auth_type}`,
          auth_type === 'sso'
            ? `${department.replaceAll('부서', '그룹')}(SSO)`
            : `${department.replaceAll('부서', '그룹')}(일반)`
        );
        });
        DEFAULT_DEPTS.forEach((dept) => {
          if (!seen.has(`${dept}|local`)) seen.set(`${dept}|local`, `${dept}(일반)`);
        });
        setDepartments(
          Array.from(seen.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
        );
      })
      .catch(() => {
      setDepartments(
        DEFAULT_DEPTS.map((d) => ({
          value: `${d}|local`,
          label: `${d.replaceAll('부서', '그룹')}(일반)`,
        }))
      );
      });
  }, []);

  // 메시지 목록 조회
  const fetchMessages = useCallback(
    async (silentRefresh = false) => {
      try {
        if (!silentRefresh) {
          setLoading(true);
        }
        const token = localStorage.getItem('token');
        const [deptName, authType] = deptFilter ? deptFilter.split('|') : ['', ''];
        const params = new URLSearchParams({
          page: currentPage.toString(),
          search: searchTerm,
          department: deptName,
          model: selectedModel,
          role: selectedRole,
          dateRange: dateRange,
        });
        if (dateRange === 'custom') {
          if (customStartDate) params.append('startDate', customStartDate);
          if (customEndDate) params.append('endDate', customEndDate);
        }
        // 피드백 필터가 선택된 경우에만 파라미터 추가
        if (authType) params.set('authType', authType);
        if (selectedFeedback) {
          params.append('feedback', selectedFeedback);
        }
        // 채팅방 ID 필터가 입력된 경우에만 파라미터 추가
        if (selectedRoomId) {
          params.append('roomId', selectedRoomId);
        }
        // 사용자(이름/이메일) 필터가 입력된 경우에만 파라미터 추가
        if (selectedUser) {
          params.append('user', selectedUser);
        }

        const response = await fetch(`/api/admin/messages?${params}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('메시지 데이터 조회 실패');
        }

        const data = await response.json();
        setMessages(data.messages);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
        setLastRefresh(new Date());
      } catch (error) {
        console.error('메시지 조회 실패:', error);
        if (!silentRefresh) {
          alert(
            '메시지 데이터를 불러오는데 실패했습니다.',
            'error',
            '조회 실패'
          );
        }
      } finally {
        if (!silentRefresh) {
          setLoading(false);
        }
      }
    },
    [
      currentPage,
      searchTerm,
      deptFilter,
      selectedModel,
      selectedRole,
      selectedFeedback,
      selectedRoomId,
      selectedUser,
      dateRange,
      customStartDate,
      customEndDate,
      alert,
      setLoading,
      setMessages,
      setTotalPages,
      setTotalCount,
      setLastRefresh,
    ]
  );

  // 메시지 삭제
  const deleteMessage = async (messageId) => {
    const confirmed = await confirm(
      '이 메시지를 정말 삭제하시겠습니까?',
      '메시지 삭제 확인'
    );
    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('메시지 삭제 실패');
      }

      fetchMessages();
      alert('메시지가 삭제되었습니다.', 'success', '삭제 완료');
    } catch (error) {
      console.error('메시지 삭제 실패:', error);
      alert('메시지 삭제에 실패했습니다.', 'error', '삭제 실패');
    }
  };

  // 데이터 내보내기
  const exportData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [deptName, authType] = deptFilter ? deptFilter.split('|') : ['', ''];
      const params = new URLSearchParams({
        search: searchTerm,
        department: deptName,
        model: selectedModel,
        role: selectedRole,
        dateRange: dateRange,
        export: 'true',
      });
      if (authType) params.set('authType', authType);
      // 채팅방 ID 필터가 입력된 경우에만 파라미터 추가
      if (selectedRoomId) {
        params.append('roomId', selectedRoomId);
      }
      // 사용자 필터가 입력된 경우에만 파라미터 추가
      if (selectedUser) {
        params.append('user', selectedUser);
      }

      const response = await fetch(`/api/admin/messages?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('데이터 내보내기 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `messages_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
      alert('데이터 내보내기에 실패했습니다.', 'error', '내보내기 실패');
    }
  };

  // 검색 및 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    deptFilter,
    selectedModel,
    selectedRole,
    selectedRoomId,
    selectedUser,
    dateRange,
    customStartDate,
    customEndDate,
  ]);

  // 데이터 로드
  useEffect(() => {
    fetchMessages();
  }, [
    currentPage,
    searchTerm,
    deptFilter,
    selectedModel,
    selectedRole,
    selectedFeedback,
    selectedRoomId,
    selectedUser,
    dateRange,
    customStartDate,
    customEndDate,
    fetchMessages,
  ]);

  // 폴링 설정 - 30초마다 자동 새로고침
  useEffect(() => {
    if (!isPollingEnabled) return;

    const interval = setInterval(() => {
      // 현재 첫 번째 페이지이고 검색 필터가 없을 때만 자동 새로고침
      if (
        currentPage === 1 &&
        !searchTerm &&
        !deptFilter &&
        !selectedModel &&
        !selectedRole &&
        !selectedRoomId &&
        !selectedUser &&
        dateRange === '7d'
      ) {
        fetchMessages(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [
    isPollingEnabled,
    currentPage,
    searchTerm,
    deptFilter,
    selectedModel,
    selectedRole,
    selectedRoomId,
    selectedUser,
    dateRange,
    fetchMessages,
  ]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => setIsPollingEnabled(false);
  }, []);

  // 페이지 visibility 변경 시 폴링 상태 관리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 페이지가 숨겨지면 폴링 일시 중지
        setIsPollingEnabled(false);
      } else {
        // 페이지가 다시 보이면 폴링 재시작 및 즉시 새로고침
        setIsPollingEnabled(true);
        fetchMessages(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchMessages]);

  // 모달이 열렸을 때 배경 스크롤 방지
  useEffect(() => {
    if (showMessageModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showMessageModal]);

  useEffect(() => {
    if (!showMessageModal || !messageContentRef.current) {
      setHasMessageOverflow(false);
      return;
    }
    const el = messageContentRef.current;
    setHasMessageOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [showMessageModal, selectedMessage, messageViewMode]);

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

  // 활성 필터 개수 계산
  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (deptFilter) count++;
    if (selectedModel) count++;
    if (selectedRole) count++;
    if (selectedFeedback) count++;
    if (selectedRoomId) count++;
    if (selectedUser) count++;
    if (dateRange === 'custom') {
      if (customStartDate || customEndDate) count++;
    } else if (dateRange !== '7d') {
      count++;
    }
    return count;
  };

  // 모든 필터 초기화
  const clearAllFilters = () => {
    setSearchTerm('');
    setDeptFilter('');
    setSelectedModel('');
    setSelectedRole('');
    setSelectedFeedback('');
    setSelectedRoomId('');
    setSelectedUser('');
    setDateRange('7d');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  // 시스템 메시지인지 확인하는 헬퍼 함수
  const isSystemMessage = (text) => {
    return (
      text && typeof text === 'string' && text.includes('[방제목 생성 요청]')
    );
  };

  // 역할에 따른 표시 이름 반환
  const getRoleLabel = (role, text = '') => {
    if (isSystemMessage(text)) {
      return '시스템';
    }
    return role === 'user' ? '사용자' : 'AI';
  };

  // 역할에 따른 아이콘 반환
  const getRoleIcon = (role, text = '') => {
    if (isSystemMessage(text)) {
      return <Bot className='h-5 w-5 text-primary' />;
    }
    return role === 'user' ? (
      <User className='h-5 w-5 text-primary' />
    ) : (
      <Bot className='h-5 w-5 text-primary' />
    );
  };

  const getRoleBadge = (role, text = '') => {
    // 시스템 요청 메시지 확인 (방제목 생성 요청 등)
    if (isSystemMessage(text)) {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
          <Bot className='h-3 w-3 mr-1' />
          시스템
        </span>
      );
    }

    if (role === 'user') {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
          <User className='h-3 w-3 mr-1' />
          사용자
        </span>
      );
    }
    return (
      <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
        <Bot className='h-3 w-3 mr-1' />
        AI
      </span>
    );
  };

  const truncateText = (text, maxLength = 50) => {
    // 객체나 배열인 경우 JSON 문자열로 변환
    let textStr;
    if (text === null || text === undefined) {
      return '';
    } else if (typeof text === 'object') {
      try {
        textStr = JSON.stringify(text, null, 2);
      } catch (e) {
        textStr = String(text);
      }
    } else {
      textStr = String(text);
    }

    if (textStr.length <= maxLength) return textStr;
    return textStr.slice(0, maxLength) + '...';
  };

  const normalizeMessageText = (text) => {
    if (text === null || text === undefined) {
      return '';
    }
    if (typeof text === 'object') {
      try {
        return JSON.stringify(text, null, 2);
      } catch (e) {
        return String(text);
      }
    }
    return String(text);
  };

  const openMessageModal = (message) => {
    setSelectedMessage(message);
    setMessageViewMode('markdown');
    setShowMessageModal(true);
  };

  // 채팅방 ID를 짧게 표시하는 함수
  const formatRoomId = (roomId) => {
    if (!roomId) return '';
    // UUID 형식인 경우 앞 8자만 표시
    if (roomId.length > 8) {
      return roomId.substring(0, 8) + '...';
    }
    return roomId;
  };

  const getFeedbackBadge = (feedback) => {
    // 피드백 값 정규화 (문자열로 변환 후 소문자로 변환)
    const normalizedFeedback = feedback
      ? String(feedback).toLowerCase().trim()
      : null;

    if (normalizedFeedback === 'like') {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
          <ThumbsUp className='h-3 w-3 mr-1' />
          좋아요
        </span>
      );
    }
    if (normalizedFeedback === 'dislike') {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive'>
          <ThumbsDown className='h-3 w-3 mr-1' />
          싫어요
        </span>
      );
    }
    return <span className='text-xs text-muted-foreground'>-</span>;
  };

  return (
    <div className='space-y-6'>
      {/* 페이지 헤더 */}
      <div className='bg-muted rounded-lg p-6 border border-border'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
          <div className='flex-1'>
            <h1 className='text-3xl font-bold text-foreground flex items-center gap-3'>
              <div className='bg-primary p-2 rounded-lg'>
                <MessageCircle className='h-7 w-7 text-white' />
              </div>
              메시지 관리
            </h1>
            <p className='text-muted-foreground mt-2 text-sm'>
              시스템의 모든 메시지를 실시간으로 조회하고 관리합니다
            </p>

            {/* 통계 요약 */}
            <div className='flex flex-wrap items-center gap-4 mt-4'>
              <div className='flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-sm'>
                <BarChart3 className='h-4 w-4 text-primary' />
                <span className='text-sm text-muted-foreground'>
                  총 메시지:
                </span>
                <span className='text-lg font-bold text-foreground'>
                  {totalCount.toLocaleString()}
                </span>
              </div>

              <div className='flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-sm'>
                <div
                  className={`w-2 h-2 rounded-full ${
                    isPollingEnabled
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted-foreground'
                  }`}
                ></div>
                <span className='text-sm text-muted-foreground'>
                  {isPollingEnabled
                    ? '자동 새로고침 활성'
                    : '자동 새로고침 비활성'}
                </span>
              </div>

              <div className='flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-sm'>
                <Clock className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm text-muted-foreground'>
                  {lastRefresh.toLocaleTimeString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* 액션 버튼 그룹 */}
          <div className='flex flex-wrap items-center gap-2'>
            <div className='flex items-center gap-2 bg-card p-1 rounded-lg shadow-sm'>
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
                title='테이블 뷰'
              >
                <List className='h-4 w-4' />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'card'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
                title='카드 뷰'
              >
                <LayoutGrid className='h-4 w-4' />
              </button>
            </div>

            <button
              onClick={() => setIsPollingEnabled(!isPollingEnabled)}
              className={`inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all shadow-sm ${
                isPollingEnabled
                  ? 'bg-muted hover:bg-muted/80 text-foreground'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              }`}
              title={
                isPollingEnabled ? '자동 새로고침 중지' : '자동 새로고침 시작'
              }
            >
              {isPollingEnabled ? (
                <Pause className='h-4 w-4 mr-2' />
              ) : (
                <Play className='h-4 w-4 mr-2' />
              )}
              {isPollingEnabled ? '중지' : '시작'}
            </button>

            <button
              onClick={() => fetchMessages()}
              disabled={loading}
              className='inline-flex items-center px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-white text-sm font-medium rounded-lg transition-all shadow-sm'
              title='수동 새로고침'
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              새로고침
            </button>

            <button
              onClick={exportData}
              className='inline-flex items-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-all shadow-sm'
            >
              <Download className='h-4 w-4 mr-2' />
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className='bg-card rounded-lg border border-border shadow-sm overflow-hidden'>
        {/* 필터 헤더 */}
        <div className='bg-muted px-6 py-4 border-b border-border'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <Filter className='h-5 w-5 text-foreground' />
              <h3 className='text-lg font-semibold text-foreground'>
                필터 및 검색
              </h3>
              {getActiveFiltersCount() > 0 && (
                <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
                  {getActiveFiltersCount()}개 활성
                </span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              {getActiveFiltersCount() > 0 && (
                <button
                  onClick={clearAllFilters}
                  className='inline-flex items-center px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors'
                >
                  <XCircle className='h-4 w-4 mr-1' />
                  모두 초기화
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className='inline-flex items-center px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors'
              >
                {showFilters ? (
                  <>
                    <ChevronUp className='h-4 w-4 mr-1' />
                    숨기기
                  </>
                ) : (
                  <>
                    <ChevronDown className='h-4 w-4 mr-1' />
                    펼치기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 필터 콘텐츠 */}
        {showFilters && (
          <div className='p-6'>
            <div className='space-y-4'>
              {/* 검색 영역 */}
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className={dateRange === 'custom' ? 'lg:col-span-3' : ''}>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <Search className='inline h-4 w-4 mr-1' />
                    메시지 내용 검색
                  </label>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                    <input
                      type='text'
                      placeholder='메시지 내용을 입력하세요...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className='w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      >
                        <XCircle className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <User className='inline h-4 w-4 mr-1' />
                    사용자 검색
                  </label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                    <input
                      type='text'
                      placeholder='이름 또는 이메일로 검색...'
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className='w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                    />
                    {selectedUser && (
                      <button
                        onClick={() => setSelectedUser('')}
                        className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      >
                        <XCircle className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 필터 옵션 */}
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <Building className='inline h-4 w-4 mr-1' />
                    그룹
                  </label>
                  <select
                    value={deptFilter}
                    onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
                    className='w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                  >
                    <option value=''>모든 그룹</option>
                    {departments.map((dept) => (
                      <option key={dept.value} value={dept.value}>
                        {dept.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <User className='inline h-4 w-4 mr-1' />
                    역할
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className='w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                  >
                    <option value=''>모든 역할</option>
                    <option value='user'>사용자</option>
                    <option value='assistant'>AI</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <ThumbsUp className='inline h-4 w-4 mr-1' />
                    피드백
                  </label>
                  <select
                    value={selectedFeedback}
                    onChange={(e) => setSelectedFeedback(e.target.value)}
                    className='w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                  >
                    <option value=''>모든 피드백</option>
                    <option value='like'>좋아요</option>
                    <option value='dislike'>싫어요</option>
                    <option value='none'>피드백 없음</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <Bot className='inline h-4 w-4 mr-1' />
                    모델
                  </label>
                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='모델명 입력...'
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className='w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                    />
                    {selectedModel && (
                      <button
                        onClick={() => setSelectedModel('')}
                        className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      >
                        <XCircle className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <Hash className='inline h-4 w-4 mr-1' />
                    채팅방 ID 검색
                  </label>
                  <div className='relative'>
                    <input
                      type='text'
                      placeholder='채팅방 ID를 입력하세요...'
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className='w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground font-mono text-sm transition-all'
                    />
                    {selectedRoomId && (
                      <button
                        onClick={() => setSelectedRoomId('')}
                        className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                      >
                        <XCircle className='h-4 w-4' />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4'>
                <div
                  className={
                    dateRange === 'custom' ? 'sm:col-span-2 lg:col-span-2' : ''
                  }
                >
                  <label className='block text-sm font-medium text-foreground mb-2'>
                    <Calendar className='inline h-4 w-4 mr-1' />
                    기간
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className='w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                  >
                    {dateRangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {dateRange === 'custom' && (
                    <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                      <input
                        type='date'
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className='w-full min-w-[140px] px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                      />
                      <input
                        type='date'
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className='w-full min-w-[140px] px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all'
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 활성 필터 태그 표시 */}
              {getActiveFiltersCount() > 0 && (
                <div className='pt-4 border-t border-border'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-medium text-foreground'>
                      활성 필터:
                    </span>
                    {searchTerm && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
                        검색: {searchTerm.substring(0, 20)}
                        {searchTerm.length > 20 ? '...' : ''}
                        <button
                          onClick={() => setSearchTerm('')}
                          className='ml-1.5 hover:text-primary'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {selectedRoomId && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary font-mono'>
                        방ID: {formatRoomId(selectedRoomId)}
                        <button
                          onClick={() => setSelectedRoomId('')}
                          className='ml-1.5 hover:text-primary'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {selectedUser && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
                        사용자: {selectedUser.substring(0, 20)}
                        {selectedUser.length > 20 ? '...' : ''}
                        <button
                          onClick={() => setSelectedUser('')}
                          className='ml-1.5 hover:text-primary'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {(dateRange !== '7d' &&
                      (dateRange !== 'custom' ||
                        customStartDate ||
                        customEndDate)) && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
                        기간:{' '}
                        {dateRange === 'custom'
                          ? `${customStartDate || '시작 없음'} ~ ${
                              customEndDate || '끝 없음'
                            }`
                          : dateRangeOptions.find(
                              (opt) => opt.value === dateRange
                            )?.label}
                        <button
                          onClick={() => {
                            setDateRange('7d');
                            setCustomStartDate('');
                            setCustomEndDate('');
                          }}
                          className='ml-1.5 hover:text-primary'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {deptFilter && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
                        그룹: {departments.find((d) => d.value === deptFilter)?.label || deptFilter.split('|')[0].replaceAll('부서', '그룹')}
                        <button
                          onClick={() => setDeptFilter('')}
                          className='ml-1.5 hover:text-primary'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {selectedRole && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground'>
                        역할: {selectedRole === 'user' ? '사용자' : 'AI'}
                        <button
                          onClick={() => setSelectedRole('')}
                          className='ml-1.5 hover:text-foreground'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {selectedFeedback && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground'>
                        피드백:{' '}
                        {selectedFeedback === 'like'
                          ? '좋아요'
                          : selectedFeedback === 'dislike'
                          ? '싫어요'
                          : '없음'}
                        <button
                          onClick={() => setSelectedFeedback('')}
                          className='ml-1.5 hover:text-foreground'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                    {selectedModel && (
                      <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary'>
                        모델: {selectedModel}
                        <button
                          onClick={() => setSelectedModel('')}
                          className='ml-1.5 hover:text-primary'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 메시지 목록 */}
      <div className='bg-card rounded-lg border border-border shadow-sm overflow-hidden'>
        {loading ? (
          <div className='flex flex-col items-center justify-center h-64 space-y-4'>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
            <p className='text-sm text-muted-foreground'>
              데이터를 불러오는 중...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className='text-center py-16'>
            <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4'>
              <MessageCircle className='h-8 w-8 text-muted-foreground' />
            </div>
            <h3 className='text-lg font-medium text-foreground mb-2'>
              메시지가 없습니다
            </h3>
            <p className='text-sm text-muted-foreground'>
              {getActiveFiltersCount() > 0
                ? '검색 조건과 일치하는 메시지가 없습니다. 필터를 조정해보세요.'
                : '아직 메시지가 없습니다.'}
            </p>
            {getActiveFiltersCount() > 0 && (
              <button
                onClick={clearAllFilters}
                className='mt-4 inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors'
              >
                <XCircle className='h-4 w-4 mr-2' />
                필터 초기화
              </button>
            )}
          </div>
        ) : viewMode === 'card' ? (
          /* 카드 뷰 */
          <div className='p-6'>
            <div className='max-h-[70vh] overflow-y-auto pr-2'>
              <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4'>
              {messages.map((message) => (
                <div
                  key={message._id}
                  className='bg-card border border-border rounded-lg p-5 hover:shadow-lg transition-all duration-200 hover:border-primary'
                  onDoubleClick={() => openMessageModal(message)}
                >
                  {/* 카드 헤더 */}
                  <div className='flex items-start justify-between mb-3'>
                    <div className='flex items-center gap-2 flex-1 min-w-0'>
                      {getRoleIcon(message.role, message.text)}
                      <div className='flex-1 min-w-0'>
                        <button
                          onClick={() => {
                            setSelectedUser(message.name || message.email);
                            setCurrentPage(1);
                          }}
                          className='font-medium text-foreground text-sm truncate hover:text-primary transition-colors block text-left w-full'
                          title={`이 사용자의 메시지만 보기 (${message.name || message.email})`}
                        >
                          {message.name || '이름 없음'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(message.email);
                            setCurrentPage(1);
                          }}
                          className='text-xs text-muted-foreground truncate hover:text-primary transition-colors block text-left w-full'
                          title={`이 이메일의 메시지만 보기 (${message.email})`}
                        >
                          {message.email}
                        </button>
                      </div>
                    </div>
                    {getRoleBadge(message.role, message.text)}
                  </div>

                  {/* 메시지 내용 */}
                  <div className='mb-3'>
                    <div className='text-sm text-foreground line-clamp-3 mb-2'>
                      {truncateText(message.text, 150)}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRoomId(message.roomId);
                        setCurrentPage(1);
                      }}
                      className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors font-mono'
                      title={`이 채팅방의 메시지만 보기 (${message.roomId})`}
                    >
                      <Hash className='h-3 w-3' />
                      {formatRoomId(message.roomId)}
                    </button>
                  </div>

                  {/* 메타 정보 */}
                  <div className='space-y-2 mb-3'>
                    {message.department && (
                      <div className='flex items-center text-xs text-muted-foreground'>
                        <Building className='h-3 w-3 mr-1 flex-shrink-0' />
                            <span className='truncate'>
                              {message.department.replaceAll('부서', '그룹')}
                            </span>
                      </div>
                    )}
                    <div className='flex items-center justify-between text-xs'>
                      <span className='inline-flex items-center text-muted-foreground'>
                        <Clock className='h-3 w-3 mr-1' />
                        {formatDate(message.createdAt)}
                      </span>
                      {message.role === 'assistant' &&
                        getFeedbackBadge(message.feedback)}
                    </div>
                    {(() => {
                      const hasLabel =
                        message.modelLabel &&
                        message.modelLabel.trim() &&
                        message.modelLabel !== 'N/A';
                      const hasModel = message.model && message.model.trim();

                      if (!hasLabel && !hasModel) return null;

                      return (
                        <div className='text-xs bg-muted text-foreground px-2 py-1 rounded inline-block'>
                          {hasLabel ? message.modelLabel : message.model}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 액션 버튼 */}
                  <div className='flex items-center justify-end gap-2 pt-3 border-t border-border'>
                    <button
                      onClick={() => openMessageModal(message)}
                      className='inline-flex items-center px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors'
                      title='메시지 상세 보기'
                    >
                      <Eye className='h-3 w-3 mr-1' />
                      상세
                    </button>
                    <button
                      onClick={() => deleteMessage(message._id)}
                      className='inline-flex items-center px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors'
                      title='메시지 삭제'
                    >
                      <Trash2 className='h-3 w-3 mr-1' />
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </div>
        ) : (
          /* 테이블 뷰 */
          <>
            {/* 테이블 헤더 */}
            <div className='bg-muted px-6 py-4 border-b-2 border-border'>
              <div className='grid grid-cols-12 gap-4 text-xs font-bold text-foreground uppercase tracking-wider'>
                <div className='col-span-2 flex items-center gap-1'>
                  <User className='h-3.5 w-3.5' />
                  사용자
                </div>
                <div className='col-span-1 flex items-center gap-1'>
                  <Bot className='h-3.5 w-3.5' />
                  역할
                </div>
                <div className='col-span-3 flex items-center gap-1'>
                  <MessageCircle className='h-3.5 w-3.5' />
                  메시지
                </div>
                <div className='col-span-1 flex items-center gap-1'>
                  <Bot className='h-3.5 w-3.5' />
                  모델
                </div>
                <div className='col-span-1 flex items-center gap-1'>
                  <ThumbsUp className='h-3.5 w-3.5' />
                  피드백
                </div>
                <div className='col-span-2 flex items-center gap-1'>
                  <Clock className='h-3.5 w-3.5' />
                  시간
                </div>
                <div className='col-span-2 text-center'>작업</div>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className='max-h-[70vh] overflow-y-auto'>
              <div className='divide-y divide-border'>
              {messages.map((message, index) => (
                <div
                  key={message._id}
                  className={`px-6 py-4 transition-all duration-150 ${
                    index % 2 === 0
                      ? 'bg-card'
                      : 'bg-muted/50'
                  } hover:bg-accent hover:shadow-sm`}
                  onDoubleClick={() => openMessageModal(message)}
                >
                  <div className='grid grid-cols-12 gap-4 items-center'>
                    {/* 사용자 정보 */}
                    <div className='col-span-2'>
                      <div className='text-sm'>
                        <button
                          onClick={() => {
                            setSelectedUser(message.name || message.email);
                            setCurrentPage(1);
                          }}
                          className='font-semibold text-foreground truncate hover:text-primary transition-colors text-left'
                          title={`이 사용자의 메시지만 보기 (${message.name || message.email})`}
                        >
                          {message.name || '이름 없음'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(message.email);
                            setCurrentPage(1);
                          }}
                          className='block text-muted-foreground text-xs truncate hover:text-primary transition-colors text-left'
                          title={`이 이메일의 메시지만 보기 (${message.email})`}
                        >
                          {message.email}
                        </button>
                        {message.department && (
                          <div className='flex items-center mt-1.5 text-xs text-muted-foreground'>
                            <Building className='h-3 w-3 mr-1 flex-shrink-0' />
                            <span className='truncate'>
                            {message.department.replaceAll('부서', '그룹')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 역할 */}
                    <div className='col-span-1'>
                      {getRoleBadge(message.role, message.text)}
                    </div>

                    {/* 메시지 내용 */}
                    <div className='col-span-3'>
                      <div className='text-sm text-foreground leading-relaxed mb-2'>
                        {truncateText(message.text, 120)}
                      </div>
                      <div className='flex items-center flex-wrap gap-2'>
                        <button
                          onClick={() => {
                            setSelectedRoomId(message.roomId);
                            setCurrentPage(1);
                          }}
                          className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors font-mono'
                          title={`이 채팅방의 메시지만 보기 (${message.roomId})`}
                        >
                          <Hash className='h-3 w-3' />
                          {formatRoomId(message.roomId)}
                        </button>
                        {message.clientIP && (
                          <span className='text-xs text-muted-foreground font-mono'>
                            {message.clientIP}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 모델 */}
                    <div className='col-span-1 min-w-0'>
                      <div className='flex flex-col gap-1.5'>
                        <span className='text-xs bg-muted text-foreground px-2.5 py-1 rounded-md break-words overflow-wrap-anywhere font-medium'>
                          {(() => {
                            const hasLabel =
                              message.modelLabel &&
                              message.modelLabel.trim() &&
                              message.modelLabel !== 'N/A';
                            const hasModel =
                              message.model && message.model.trim();

                            if (hasLabel) return message.modelLabel;
                            if (hasModel) {
                              return message.model;
                            }
                            return 'N/A';
                          })()}
                        </span>
                        {message.retryCount && message.retryCount > 1 && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                              message.retryCount === 2
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            재시도 {message.retryCount}회
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 피드백 */}
                    <div className='col-span-1'>
                      {getFeedbackBadge(message.feedback)}
                    </div>

                    {/* 시간 */}
                    <div className='col-span-2'>
                      <div className='flex items-center text-xs text-muted-foreground'>
                        <Calendar className='h-3.5 w-3.5 mr-1.5 flex-shrink-0' />
                        <span className='leading-tight'>
                          {formatDate(message.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* 작업 버튼 */}
                    <div className='col-span-2'>
                      <div className='flex items-center justify-center gap-2'>
                        {/* 상세 보기 */}
                        <button
                          onClick={() => openMessageModal(message)}
                          className='p-2 text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-all duration-150 hover:scale-105'
                          title='메시지 상세 보기'
                        >
                          <Eye className='h-4 w-4' />
                        </button>

                        {/* 메시지 삭제 */}
                        <button
                          onClick={() => deleteMessage(message._id)}
                          className='p-2 text-destructive hover:text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-all duration-150 hover:scale-105'
                          title='메시지 삭제'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className='bg-card border border-border rounded-lg shadow-sm p-4'>
          <div className='flex flex-col sm:flex-row items-center justify-between gap-4'>
            {/* 페이지 정보 */}
            <div className='text-sm text-muted-foreground'>
              <span className='font-medium text-foreground'>
                {((currentPage - 1) * 20 + 1).toLocaleString()}
              </span>
              {' - '}
              <span className='font-medium text-foreground'>
                {Math.min(currentPage * 20, totalCount).toLocaleString()}
              </span>
              {' / '}
              <span className='font-medium text-foreground'>
                {totalCount.toLocaleString()}
              </span>
              {' 개 메시지'}
            </div>

            {/* 페이지 네비게이션 */}
            <div className='flex items-center gap-2'>
              {/* 첫 페이지 */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className='px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                title='첫 페이지'
              >
                ««
              </button>

              {/* 이전 페이지 */}
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className='px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                ‹ 이전
              </button>

              {/* 페이지 번호 */}
              <div className='flex items-center gap-1'>
                {(() => {
                  const pageButtons = [];
                  const maxVisible = 5;
                  let startPage = Math.max(
                    1,
                    currentPage - Math.floor(maxVisible / 2)
                  );
                  let endPage = Math.min(
                    totalPages,
                    startPage + maxVisible - 1
                  );

                  if (endPage - startPage + 1 < maxVisible) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pageButtons.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                          currentPage === i
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-foreground bg-card border border-border hover:bg-accent'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pageButtons;
                })()}
              </div>

              {/* 다음 페이지 */}
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className='px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                다음 ›
              </button>

              {/* 마지막 페이지 */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className='px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                title='마지막 페이지'
              >
                »»
              </button>
            </div>

            {/* 페이지 이동 */}
            <div className='flex items-center gap-2'>
              <input
                type='number'
                min='1'
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page);
                  }
                }}
                className='w-20 px-3 py-2 text-sm text-center border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground'
                placeholder='페이지'
              />
              <span className='text-sm text-muted-foreground'>
                / {totalPages}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 메시지 상세 보기 모달 */}
      {showMessageModal && selectedMessage && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* 배경 오버레이 */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
            onClick={() => setShowMessageModal(false)}
          ></div>

          {/* 모달 내용 */}
          <div className='relative bg-card rounded-lg shadow-xl w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[90vh] overflow-y-auto p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-medium text-foreground'>
                메시지 상세 정보
              </h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className='text-muted-foreground hover:text-foreground'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='space-y-6'>
              {/* 메시지 내용 (가장 중요하므로 맨 위로) */}
              <div>
                <div className='flex flex-wrap items-center gap-2 mb-3'>
                  {getRoleIcon(selectedMessage.role, selectedMessage.text)}
                  <h4 className='text-lg font-medium text-foreground'>
                    {isSystemMessage(selectedMessage.text)
                      ? '시스템 메시지'
                      : selectedMessage.role === 'user'
                      ? '사용자 메시지'
                      : 'AI 응답'}
                  </h4>
                  <div className='ml-auto flex items-center gap-2'>
                    <button
                      onClick={() => setMessageViewMode('markdown')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        messageViewMode === 'markdown'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground hover:bg-accent'
                      }`}
                    >
                      마크다운
                    </button>
                    <button
                      onClick={() => setMessageViewMode('raw')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        messageViewMode === 'raw'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground hover:bg-accent'
                      }`}
                    >
                      원본
                    </button>
                  </div>
                </div>
                <div className='text-xs text-muted-foreground mb-2'>
                  글자수: {normalizeMessageText(selectedMessage.text).length}
                  {hasMessageOverflow ? ' · 스크롤 있음' : ''}
                </div>
                <div
                  ref={messageContentRef}
                  className={`bg-muted p-4 rounded-lg border-l-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400/70 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 ${
                    isSystemMessage(selectedMessage.text)
                      ? 'border-primary'
                      : selectedMessage.role === 'user'
                      ? 'border-primary'
                      : 'border-primary'
                  }`}
                >
                  {messageViewMode === 'markdown' ? (
                    <div className='markdown-content w-full'>
                      <MarkdownPreview
                        source={normalizeMessageText(selectedMessage.text)}
                      />
                    </div>
                  ) : (
                    <div className='whitespace-pre-wrap text-sm text-foreground leading-relaxed font-mono'>
                      {normalizeMessageText(selectedMessage.text)}
                    </div>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {/* 사용자 정보 */}
                <div>
                  <h4 className='text-sm font-medium text-foreground mb-3 flex items-center gap-2'>
                    <User className='h-4 w-4' />
                    사용자 정보
                  </h4>
                  <div className='bg-muted p-4 rounded-lg space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        이름:
                      </span>
                      <span className='font-medium text-foreground'>
                        {selectedMessage.name || '이름 없음'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        이메일:
                      </span>
                      <span className='font-medium text-foreground'>
                        {selectedMessage.email}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        그룹:
                      </span>
                      <span className='font-medium text-foreground'>
                        {selectedMessage.department || '미설정'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Cell:
                      </span>
                      <span className='font-medium text-foreground'>
                        {selectedMessage.cell || '미설정'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 메시지 메타데이터 */}
                <div>
                  <h4 className='text-sm font-medium text-foreground mb-3 flex items-center gap-2'>
                    <MessageCircle className='h-4 w-4' />
                    메시지 정보
                  </h4>
                  <div className='bg-muted p-4 rounded-lg space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        모델:
                      </span>
                      <span className='font-medium text-foreground'>
                        {(() => {
                          const hasLabel =
                            selectedMessage.modelLabel &&
                            selectedMessage.modelLabel.trim() &&
                            selectedMessage.modelLabel !== 'N/A';
                          const hasModel =
                            selectedMessage.model &&
                            selectedMessage.model.trim();

                          if (!hasLabel && !hasModel) return 'N/A';

                          return (
                            <div className='flex flex-col gap-1 items-end max-w-full'>
                              <span className='px-2 py-1 bg-primary/10 text-primary rounded text-xs break-words overflow-wrap-anywhere'>
                                {hasLabel
                                  ? selectedMessage.modelLabel
                                  : selectedMessage.model}
                              </span>
                              {selectedMessage.retryCount &&
                                selectedMessage.retryCount > 1 && (
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      selectedMessage.retryCount === 2
                                        ? 'bg-muted text-muted-foreground'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    재시도 {selectedMessage.retryCount}회
                                  </span>
                                )}
                            </div>
                          );
                        })()}
                      </span>
                    </div>
                    {selectedMessage.role === 'assistant' && (
                      <div className='flex justify-between'>
                        <span className='text-muted-foreground'>
                          피드백:
                        </span>
                        <span className='font-medium text-foreground'>
                          {getFeedbackBadge(selectedMessage.feedback)}
                        </span>
                      </div>
                    )}
                    <div className='flex justify-between items-center'>
                      <span className='text-muted-foreground'>
                        방 ID:
                      </span>
                      <button
                        onClick={() => {
                          setSelectedRoomId(selectedMessage.roomId);
                          setCurrentPage(1);
                          setShowMessageModal(false);
                        }}
                        className='inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors font-mono'
                        title={`이 채팅방의 메시지만 보기 (${selectedMessage.roomId})`}
                      >
                        <Hash className='h-3 w-3' />
                        {formatRoomId(selectedMessage.roomId)}
                      </button>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        IP 주소:
                      </span>
                      <span className='font-medium text-foreground font-mono text-xs'>
                        {selectedMessage.clientIP || '미기록'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        시간:
                      </span>
                      <span className='font-medium text-foreground text-xs'>
                        {formatDate(selectedMessage.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className='mt-6 flex justify-end'>
              <button
                onClick={() => setShowMessageModal(false)}
                className='px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors'
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
