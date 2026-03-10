'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  BarChart3,
  Clock,
  Filter,
  RefreshCw,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Globe,
  Monitor,
  Code,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Eye,
  X,
  Copy,
  Hash,
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

export default function ExternalApiLogsPage() {
  const { alert } = useAlert();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filters, setFilters] = useState({
    apiType: '',
    model: '',
    clientTool: '',
    clientIP: '', // IP 필터 추가
    endpoint: '',
    provider: '',
    timeRange: '7d',
    source: '',
    statusCode: '',
    isStream: '',
    // 세션 필터
    sessionHash: '',
    userId: '',
    tokenHash: '',
    sessionFilter: '', // 'exact' | 'user' | 'session'
    conversationId: '', // 대화 세션 ID
    groupByConversation: false, // 대화 세션별 그룹화
    page: 1,
    limit: 50,
  });
  const [pagination, setPagination] = useState({});
  const [promptModal, setPromptModal] = useState({ isOpen: false, log: null }); // 프롬프트 모달 상태
  const [expandedLogs, setExpandedLogs] = useState(new Set()); // 펼쳐진 로그 ID 집합
  const [expandedConversations, setExpandedConversations] = useState(new Set()); // 펼쳐진 대화 세션 ID 집합
  const [expandedMessages, setExpandedMessages] = useState(new Set()); // 펼쳐진 메시지 목록 (로그 ID 집합)
  const [expandedMessageContents, setExpandedMessageContents] = useState(
    new Set()
  ); // 펼쳐진 개별 메시지 내용 (로그ID-메시지인덱스)

  // UI 섹션 표시 상태
  const [showFilters, setShowFilters] = useState(false); // 필터 섹션 접기
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false); // 고급 필터 섹션 접기
  const [showDetailedStats, setShowDetailedStats] = useState(false); // 상세 통계 접기

  // API 로그 조회
  const fetchLogs = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);

        const token = localStorage.getItem('token');
        if (!token) {
          console.error('토큰이 없습니다');
          return;
        }

        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== '' && value !== null && value !== undefined) {
            if (key === 'groupByConversation') {
              params.append(key, value.toString());
            } else {
              params.append(key, value);
            }
          }
        });

        // custom 기간 지정 시 날짜 파라미터 추가
        if (filters.timeRange === 'custom') {
          if (customStartDate) params.append('startDate', customStartDate);
          if (customEndDate) params.append('endDate', customEndDate);
        }

        const response = await fetch(`/api/admin/external-api-logs?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setLogs(data.data.logs);
          setStats(data.data.stats);
          setPagination(data.data.pagination);
        } else if (response.status === 401) {
          console.error('인증 실패');
          alert(
            '인증이 필요합니다. 다시 로그인해주세요.',
            'error',
            '인증 실패'
          );
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || `서버 오류 (${response.status})`;
          console.error('로그 조회 실패:', response.status, errorMessage);
          alert(
            `로그 조회에 실패했습니다: ${errorMessage}`,
            'error',
            '조회 실패'
          );
        }
      } catch (error) {
        console.error('로그 조회 오류:', error);
        alert(
          `로그 조회 중 오류가 발생했습니다: ${error.message}`,
          'error',
          '오류 발생'
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [filters, customStartDate, customEndDate, alert]
  );

  useEffect(() => {
    // custom 모드가 아닐 때만 자동 조회
    if (filters.timeRange !== 'custom') {
      fetchLogs();
    }
  }, [fetchLogs, filters.timeRange]);

  // 필터 변경 핸들러
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // 필터 변경 시 첫 페이지로
    }));
  };

  // 필터 초기화 핸들러
  const handleResetFilters = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setFilters({
      apiType: '',
      model: '',
      clientTool: '',
      clientIP: '',
      endpoint: '',
    provider: '',
    timeRange: '7d',
    source: '',
    statusCode: '',
    isStream: '',
      sessionHash: '',
      userId: '',
      tokenHash: '',
      sessionFilter: '',
      conversationId: '',
      groupByConversation: false,
      page: 1,
      limit: 50,
    });
  };

  // 페이지 변경 핸들러
  const handlePageChange = (newPage) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
  };

  const getClientToolLabel = (log) => {
    if (!log) return 'Unknown';
    if (log.clientTool && log.clientTool !== 'Unknown') {
      return log.clientTool;
    }
    if (log.xClientName) return log.xClientName;
    if (log.userAgent && log.userAgent !== 'unknown') return log.userAgent;
    return 'Unknown';
  };

  // 클라이언트 도구 아이콘
  const getClientToolIcon = (clientTool) => {
    const tool = clientTool?.toLowerCase() || '';
    if (tool.includes('vscode') || tool.includes('continue'))
      return <Code className='h-4 w-4' />;
    if (tool.includes('cursor')) return <Code className='h-4 w-4' />;
    if (
      tool.includes('chrome') ||
      tool.includes('firefox') ||
      tool.includes('safari')
    )
      return <Globe className='h-4 w-4' />;
    if (tool.includes('postman') || tool.includes('insomnia'))
      return <Database className='h-4 w-4' />;
    if (tool.includes('python') || tool.includes('node'))
      return <Code className='h-4 w-4' />;
    return <Monitor className='h-4 w-4' />;
  };

  // 상태 코드 아이콘
  const getStatusIcon = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300)
      return <CheckCircle className='h-4 w-4 text-green-500' />;
    if (statusCode >= 400 && statusCode < 500)
      return <AlertTriangle className='h-4 w-4 text-yellow-500' />;
    if (statusCode >= 500) return <XCircle className='h-4 w-4 text-red-500' />;
    return <Info className='h-4 w-4 text-gray-500' />;
  };

  const getSourceBadge = (source) => {
    if (source === 'external') {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    }
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  };

  const getSourceLabel = (source) => {
    if (source === 'external') return '외부';
    return '내부';
  };

  // 응답 시간 색상
  const getResponseTimeColor = (responseTime) => {
    if (responseTime < 1000) return 'text-green-600 dark:text-green-400';
    if (responseTime < 5000) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // 시간 포맷팅
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });
  };

  // 토큰 수 포맷팅
  const formatTokens = (count) => {
    if (count > 1000) return `${(count / 1000).toFixed(1)}K`;
    return count?.toString() || '0';
  };

  // 프롬프트 전체 보기
  const openPromptModal = (log) => {
    setPromptModal({ isOpen: true, log });
  };

  const closePromptModal = () => {
    setPromptModal({ isOpen: false, log: null });
  };

  // 프롬프트 복사
  const copyPrompt = async (prompt) => {
    try {
      await navigator.clipboard.writeText(
        typeof prompt === 'string' ? prompt : JSON.stringify(prompt, null, 2)
      );
      alert('프롬프트가 클립보드에 복사되었습니다.', 'success', '복사 완료');
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  // 로그 펼치기/접기 토글
  const toggleLogExpansion = (logId) => {
    setExpandedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // 대화 세션 펼치기/접기 토글
  const toggleConversationExpansion = (conversationId) => {
    setExpandedConversations((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  };

  // 메시지 목록 펼치기/접기 토글
  const toggleMessagesExpansion = (logId) => {
    setExpandedMessages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // 개별 메시지 내용 펼치기/접기 토글
  const toggleMessageContentExpansion = (logId, messageIndex) => {
    const key = `${logId}-${messageIndex}`;
    setExpandedMessageContents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // JSON 데이터 복사
  const copyJson = async (data) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      alert('JSON 데이터가 클립보드에 복사되었습니다.', 'success', '복사 완료');
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  // content 파싱 헬퍼 함수 (JSON 문자열이면 파싱)
  const parseContent = (content) => {
    if (typeof content !== 'string') {
      return content;
    }

    // JSON 문자열인지 확인하고 파싱 시도
    try {
      const trimmed = content.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))
      ) {
        const parsed = JSON.parse(trimmed);
        return parsed;
      }
    } catch (e) {
      return content;
    }

    return content;
  };

  // content를 보기 좋게 표시하는 헬퍼 함수
  const renderContent = (content) => {
    const parsed = parseContent(content);

    if (typeof parsed === 'string') {
      return parsed;
    }

    return JSON.stringify(parsed, null, 2);
  };

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            API 로깅
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mt-1'>
            내부/외부 API 호출 기록을 한 곳에서 모니터링합니다
          </p>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={loading}
          className='btn-primary flex items-center gap-2'
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      {stats.overall && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
          <div className='card p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  총 요청
                </p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {stats.overall.totalRequests?.toLocaleString() || 0}
                </p>
              </div>
              <Activity className='h-8 w-8 text-blue-500' />
            </div>
          </div>

          <div className='card p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  총 토큰
                </p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {formatTokens(stats.overall.totalTokens)}
                </p>
              </div>
              <Zap className='h-8 w-8 text-yellow-500' />
            </div>
          </div>

          <div className='card p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  평균 최초 응답시간
                </p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {Math.round(stats.overall.avgFirstResponseTime || 0)}ms
                </p>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  최초 응답 기준
                </p>
              </div>
              <Clock className='h-8 w-8 text-green-500' />
            </div>
          </div>

          <div className='card p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  평균 최종 응답시간
                </p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {Math.round(stats.overall.avgFinalResponseTime || 0)}ms
                </p>
              </div>
              <Clock className='h-8 w-8 text-green-500' />
            </div>
          </div>

          <div className='card p-4'>
            <div className='flex items-center justify-between'>
              <div>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  성공률
                </p>
                <p className='text-2xl font-bold text-gray-900 dark:text-white'>
                  {stats.overall.totalRequests > 0
                    ? Math.round(
                        (stats.overall.successRequests /
                          stats.overall.totalRequests) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <BarChart3 className='h-8 w-8 text-purple-500' />
            </div>
          </div>
        </div>
      )}

      {/* 상세 통계 토글 버튼 */}
      {stats.byEndpoint && stats.byEndpoint.length > 0 && (
        <button
          onClick={() => setShowDetailedStats(!showDetailedStats)}
          className='w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors'
        >
          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
            상세 통계 {showDetailedStats ? '숨기기' : '보기'}
          </span>
          {showDetailedStats ? (
            <ChevronUp className='h-4 w-4 text-gray-500' />
          ) : (
            <ChevronDown className='h-4 w-4 text-gray-500' />
          )}
        </button>
      )}

      {/* 엔드포인트 통계 (상위 8개) */}
      {showDetailedStats &&
        Array.isArray(stats.byEndpoint) &&
        stats.byEndpoint.length > 0 && (
          <div className='card p-4'>
            <div className='flex items-center justify-between mb-3'>
              <h3 className='font-medium text-gray-900 dark:text-white'>
                엔드포인트별 통계
              </h3>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                총 {stats.byEndpoint.length}개 중 상위 8개
              </span>
            </div>
            <div className='space-y-2'>
              {stats.byEndpoint.slice(0, 8).map((ep) => (
                <div
                  key={ep._id || 'unknown'}
                  className='flex items-center justify-between text-sm'
                >
                  <div className='truncate max-w-[70%]'>
                    <span className='font-mono text-gray-800 dark:text-gray-200'>
                      {ep._id || '(unknown)'}
                    </span>
                  </div>
                  <div className='flex items-center gap-4 text-gray-600 dark:text-gray-400'>
                    <span>
                      건수:{' '}
                      <strong className='text-gray-900 dark:text-white'>
                        {ep.count}
                      </strong>
                    </span>
                    <span>
                      평균(최초/최종):{' '}
                      <strong className='text-gray-900 dark:text-white'>
                        {Math.round(ep.avgFirstResponseTime || 0)}ms /{' '}
                        {Math.round(ep.avgFinalResponseTime || 0)}ms
                      </strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* 필터 */}
      <div className='card'>
        <div className='flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700'>
          <div className='flex items-center gap-3'>
            <Filter className='h-5 w-5 text-blue-600 dark:text-blue-400' />
            <h3 className='font-semibold text-gray-900 dark:text-white'>
              필터
            </h3>
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={handleResetFilters}
              className='px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
            >
              초기화
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors flex items-center gap-1'
            >
              {showFilters ? (
                <>
                  <ChevronUp className='h-4 w-4' />
                  숨기기
                </>
              ) : (
                <>
                  <ChevronDown className='h-4 w-4' />
                  펼치기
                </>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className='p-4'>
            {/* 기본 필터 */}
            <div className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    시간 범위
                  </label>
                  <select
                    value={filters.timeRange}
                    onChange={(e) =>
                      handleFilterChange('timeRange', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  >
                    <option value='1h'>최근 1시간</option>
                    <option value='6h'>최근 6시간</option>
                    <option value='24h'>최근 24시간</option>
                    <option value='7d'>최근 7일</option>
                    <option value='30d'>최근 30일</option>
                    <option value='custom'>기간 지정</option>
                  </select>
                </div>
                {filters.timeRange === 'custom' && (
                  <div className='md:col-span-2 lg:col-span-5'>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                      기간 지정
                    </label>
                    <div className='flex items-center gap-3 flex-wrap'>
                      <input
                        type='date'
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]'
                        placeholder='시작 날짜'
                      />
                      <span className='text-sm text-gray-500 dark:text-gray-400'>~</span>
                      <input
                        type='date'
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]'
                        placeholder='종료 날짜'
                      />
                      <button
                        onClick={() => fetchLogs(true)}
                        className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium'
                      >
                        조회
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    카테고리
                  </label>
                  <select
                    value={filters.source}
                    onChange={(e) =>
                      handleFilterChange('source', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  >
                    <option value=''>전체</option>
                    <option value='external'>외부 API</option>
                    <option value='internal'>내부 API</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    API 타입
                  </label>
                  <select
                    value={filters.apiType}
                    onChange={(e) =>
                      handleFilterChange('apiType', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  >
                    <option value=''>전체</option>
                    <option value='generate'>Generate</option>
                    <option value='chat'>Chat</option>
                    <option value='image-analysis'>Image Analysis</option>
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    Provider
                  </label>
                  <select
                    value={filters.provider}
                    onChange={(e) =>
                      handleFilterChange('provider', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  >
                    <option key='all-provider' value=''>
                      전체
                    </option>
                    {(stats.byProvider || [])
                      .filter((p) => p._id)
                      .map((p, index) => (
                        <option key={p._id || `provider-${index}`} value={p._id}>
                          {p._id} ({p.count})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    클라이언트 도구
                  </label>
                  <select
                    value={filters.clientTool}
                    onChange={(e) =>
                      handleFilterChange('clientTool', e.target.value)
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  >
                    <option key='all' value=''>
                      전체
                    </option>
                    {stats.byClientTool?.map((tool, index) => (
                      <option
                        key={tool._id || `client-tool-${index}`}
                        value={tool._id}
                      >
                        {tool._id} ({tool.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    모델 검색
                  </label>
                  <input
                    type='text'
                    placeholder='모델명으로 검색...'
                    value={filters.model}
                    onChange={(e) => handleFilterChange('model', e.target.value)}
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500'
                  />
                </div>

                <div className='flex items-end'>
                  <label className='flex items-center gap-2 cursor-pointer px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors'>
                    <input
                      type='checkbox'
                      checked={filters.groupByConversation}
                      onChange={(e) =>
                        handleFilterChange(
                          'groupByConversation',
                          e.target.checked
                        )
                      }
                      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
                    />
                    <span className='text-sm font-medium text-gray-900 dark:text-white'>
                      대화 세션별로 그룹화
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 고급 필터 (디버깅용) */}
            <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors'
              >
                {showAdvancedFilters ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
                고급 필터 (디버깅용)
              </button>

              {showAdvancedFilters && (
                <div className='mt-4 space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                        IP 주소
                      </label>
                      <input
                        type='text'
                        placeholder='IP 주소 검색...'
                        value={filters.clientIP}
                        onChange={(e) =>
                          handleFilterChange('clientIP', e.target.value)
                        }
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      />
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                        Session Hash
                      </label>
                      <input
                        type='text'
                        placeholder='세션 해시...'
                        value={filters.sessionHash}
                        onChange={(e) =>
                          handleFilterChange('sessionHash', e.target.value)
                        }
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      />
                    </div>

                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                        User ID
                      </label>
                      <input
                        type='text'
                        placeholder='사용자 ID...'
                        value={filters.userId}
                        onChange={(e) =>
                          handleFilterChange('userId', e.target.value)
                        }
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                      />
                    </div>
                  </div>
                  
                  <p className='text-xs text-gray-500 dark:text-gray-400 italic'>
                    💡 고급 필터는 기술적인 디버깅 목적으로만 사용됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 로그 테이블 */}
      <div className='card p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='font-medium text-gray-900 dark:text-white'>
            로그 기록 ({pagination.totalCount?.toLocaleString() || 0})
            {pagination.totalPages > 1 && (
              <span className='ml-2 text-sm text-gray-500 dark:text-gray-400 font-normal'>
                {pagination.page} / {pagination.totalPages} 페이지
              </span>
            )}
          </h3>
        </div>

        {loading ? (
          <div className='flex items-center justify-center py-8'>
            <RefreshCw className='h-6 w-6 animate-spin text-gray-400' />
          </div>
        ) : logs.length === 0 ? (
          <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
            로그가 없습니다
          </div>
        ) : filters.groupByConversation ? (
          // 그룹화된 뷰
          <div className='space-y-4'>
            {logs.map((conversation, index) => {
              const isExpanded = expandedConversations.has(
                conversation.conversationId
              );
              const conversationLogs = conversation.logs || [];
              // 고유 key 생성: conversationId가 없거나 중복될 수 있으므로 첫 번째 로그의 _id와 조합
              const uniqueKey = conversation.conversationId
                ? `${conversation.conversationId}-${
                    conversationLogs[0]?._id || index
                  }`
                : `no-conversation-${conversationLogs[0]?._id || index}`;
              return (
                <div
                  key={uniqueKey}
                  className='border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-blue-50/30 dark:bg-blue-900/20'
                >
                  {/* 대화 세션 헤더 */}
                  <div
                    className='p-4 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors'
                    onClick={() =>
                      toggleConversationExpansion(conversation.conversationId)
                    }
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3 flex-1'>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleConversationExpansion(
                              conversation.conversationId
                            );
                          }}
                          className='p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded transition-colors'
                        >
                          {isExpanded ? (
                            <ChevronUp className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                          ) : (
                            <ChevronDown className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                          )}
                        </button>
                        <div className='flex items-center gap-2'>
                          <Hash className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                          <span className='text-sm font-mono text-blue-700 dark:text-blue-300'>
                            {conversation.conversationId || 'no-conversation'}
                          </span>
                        </div>
                        <span className='text-xs text-gray-600 dark:text-gray-400'>
                          {conversation.totalRequests}개 요청
                        </span>
                        <span className='text-xs text-gray-600 dark:text-gray-400'>
                          {formatTokens(conversation.totalTokens)} 토큰
                        </span>
                      </div>
                      <div className='text-right text-xs text-gray-600 dark:text-gray-400'>
                        <div>{formatTime(conversation.startTime)}</div>
                        <div>~ {formatTime(conversation.endTime)}</div>
                      </div>
                    </div>
                    {conversation.firstMessage && (
                      <div className='mt-2 text-sm text-gray-700 dark:text-gray-300 truncate'>
                        {conversation.firstMessage}...
                      </div>
                    )}
                  </div>

                  {/* 대화 세션 내 로그 목록 */}
                  {isExpanded && (
                    <div className='border-t border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800'>
                      <div className='p-2 space-y-2'>
                        {conversationLogs.map((log) => {
                          const isLogExpanded = expandedLogs.has(log._id);
                          return (
                            <div
                              key={log._id}
                              className='border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                            >
                              <div
                                className='flex items-start justify-between mb-2 cursor-pointer'
                                onClick={() => toggleLogExpansion(log._id)}
                              >
                                <div className='flex items-center gap-2 flex-1 flex-wrap'>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleLogExpansion(log._id);
                                    }}
                                    className='p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors'
                                  >
                                    {isLogExpanded ? (
                                      <ChevronUp className='h-3 w-3 text-gray-500' />
                                    ) : (
                                      <ChevronDown className='h-3 w-3 text-gray-500' />
                                    )}
                                  </button>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      log.apiType === 'generate'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        : log.apiType === 'image-analysis'
                                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}
                                  >
                                    {log.apiType?.toUpperCase()}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs font-medium ${getSourceBadge(
                                      log.source
                                    )}`}
                                  >
                                    {getSourceLabel(log.source)}
                                  </span>
                                  <div className='flex items-center gap-1'>
                                    {getStatusIcon(log.statusCode)}
                                    <span className='text-xs'>
                                      {log.statusCode}
                                    </span>
                                  </div>
                                  {(log.userName || log.userEmail) && (
                                    <span className='text-xs text-gray-700 dark:text-gray-300 font-medium'>
                                      {log.userName || log.userEmail}
                                    </span>
                                  )}
                                  <span className='text-xs text-gray-500 dark:text-gray-500'>•</span>
                                  <span className='text-xs text-gray-600 dark:text-gray-400'>
                                    {log.modelLabel || log.model}
                                  </span>
                                  <span className='text-xs text-gray-500 dark:text-gray-500'>•</span>
                                  <span className='text-xs text-gray-600 dark:text-gray-400'>
                                    {formatTime(log.timestamp)}
                                  </span>
                                  <span className='text-xs text-gray-500 dark:text-gray-500'>•</span>
                                  <span
                                    className={`text-xs font-medium ${getResponseTimeColor(
                                      log.finalResponseTime ?? log.responseTime
                                    )}`}
                                  >
                                    {log.firstResponseTime ?? log.responseTime}ms /{' '}
                                    {log.finalResponseTime ?? log.responseTime}ms
                                  </span>
                                </div>
                              </div>
                              {isLogExpanded && (
                                <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-4'>
                                  {/* 기본 정보 그리드 */}
                                  <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>
                                    {/* 클라이언트 정보 */}
                                    <div>
                                      <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2'>
                                        클라이언트
                                      </div>
                                      <div className='flex items-center gap-2 mb-1'>
                                        {getClientToolIcon(
                                          getClientToolLabel(log)
                                        )}
                                        <span className='text-sm font-medium text-gray-900 dark:text-white'>
                                          {getClientToolLabel(log)}
                                        </span>
                                      </div>
                                      <div className='text-xs text-gray-600 dark:text-gray-400'>
                                        {log.clientIP}
                                      </div>
                                    </div>

                                    {/* 사용자 & 설정 정보 */}
                                    <div>
                                      <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2'>
                                        사용자 & 설정
                                      </div>
                                      <div className='text-sm space-y-1'>
                                        {log.userName || log.userEmail ? (
                                          <div className='text-gray-900 dark:text-white'>
                                            {log.userName || '이름 없음'} (
                                            {log.userEmail || '이메일 없음'})
                                            {log.userDepartment && (
                                              <span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
                                                [{log.userDepartment}]
                                              </span>
                                            )}
                                          </div>
                                        ) : null}
                                        <div className='text-xs text-gray-600 dark:text-gray-400 space-y-1'>
                                          {log.tokenName && (
                                            <div>
                                              <strong>토큰:</strong>{' '}
                                              {log.tokenName}
                                            </div>
                                          )}
                                          <div>
                                            <strong>모델:</strong>{' '}
                                            {log.modelLabel || log.model}
                                          </div>
                                          {log.sessionHash && (
                                            <div className='flex items-center gap-2'>
                                              <strong>세션:</strong>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleFilterChange(
                                                    'sessionFilter',
                                                    'exact'
                                                  );
                                                  handleFilterChange(
                                                    'sessionHash',
                                                    log.sessionHash
                                                  );
                                                  handleFilterChange(
                                                    'userId',
                                                    log.userId || ''
                                                  );
                                                  handleFilterChange(
                                                    'tokenHash',
                                                    log.tokenHash || ''
                                                  );
                                                }}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-medium transition-colors font-mono'
                                                title='이 세션의 모든 요청 보기'
                                              >
                                                <Hash className='h-3 w-3' />
                                                {log.sessionHash.substring(
                                                  0,
                                                  8
                                                )}
                                                ...
                                              </button>
                                            </div>
                                          )}
                                          {log.userId && (
                                            <div className='flex items-center gap-2'>
                                              <strong>사용자:</strong>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleFilterChange(
                                                    'sessionFilter',
                                                    'user'
                                                  );
                                                  handleFilterChange(
                                                    'userId',
                                                    log.userId
                                                  );
                                                  handleFilterChange(
                                                    'tokenHash',
                                                    log.tokenHash || ''
                                                  );
                                                }}
                                                className='inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-medium transition-colors font-mono'
                                                title='이 사용자의 같은 토큰으로 보낸 요청 보기'
                                              >
                                                {log.userId.substring(0, 8)}...
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* 토큰 사용량 */}
                                    <div>
                                      <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2'>
                                        토큰 사용량
                                      </div>
                                      <div className='text-sm text-gray-600 dark:text-gray-400 space-y-1'>
                                        <div className='flex justify-between'>
                                          <span>입력:</span>
                                          <span className='font-medium text-gray-900 dark:text-white'>
                                            {formatTokens(log.promptTokenCount)}
                                          </span>
                                        </div>
                                        <div className='flex justify-between'>
                                          <span>출력:</span>
                                          <span className='font-medium text-gray-900 dark:text-white'>
                                            {formatTokens(
                                              log.responseTokenCount
                                            )}
                                          </span>
                                        </div>
                                        <div className='flex justify-between border-t border-gray-200 dark:border-gray-700 pt-1'>
                                          <span>
                                            <strong>총계:</strong>
                                          </span>
                                          <span className='font-bold text-gray-900 dark:text-white'>
                                            {formatTokens(log.totalTokenCount)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 프롬프트 미리보기 */}
                                  {log.prompt && (
                                    <div className='pt-3 border-t border-gray-200 dark:border-gray-700'>
                                      <div className='flex items-start justify-between'>
                                        <p className='text-sm text-gray-600 dark:text-gray-400 flex-1'>
                                          <strong>프롬프트:</strong>{' '}
                                          {typeof log.prompt === 'string'
                                            ? log.prompt.length > 100
                                              ? log.prompt.substring(0, 100) +
                                                '...'
                                              : log.prompt
                                            : '메시지 배열'}
                                        </p>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openPromptModal(log);
                                          }}
                                          className='ml-2 p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200'
                                          title='프롬프트 전체 보기'
                                        >
                                          <Eye className='h-4 w-4' />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* 메시지 정보 */}
                                  {log.messages &&
                                    Array.isArray(log.messages) &&
                                    log.messages.length > 0 && (
                                      <div className='pt-3 border-t border-gray-200 dark:border-gray-700'>
                                        <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2'>
                                          메시지 ({log.messages.length}개)
                                        </div>
                                        <div className='space-y-2 max-h-64 overflow-y-auto'>
                                          {(() => {
                                            const isMessagesExpanded =
                                              expandedMessages.has(log._id);
                                            const displayMessages =
                                              isMessagesExpanded
                                                ? log.messages
                                                : log.messages.slice(-3);

                                            return (
                                              <>
                                                {!isMessagesExpanded &&
                                                  log.messages.length > 3 && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleMessagesExpansion(
                                                          log._id
                                                        );
                                                      }}
                                                      className='w-full text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-center py-2 px-3 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
                                                    >
                                                      ... 이전{' '}
                                                      {log.messages.length - 3}
                                                      개 메시지 보기
                                                    </button>
                                                  )}
                                                {isMessagesExpanded &&
                                                  log.messages.length > 3 && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleMessagesExpansion(
                                                          log._id
                                                        );
                                                      }}
                                                      className='w-full text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-center py-2 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                                                    >
                                                      최신 3개만 보기
                                                    </button>
                                                  )}
                                                {displayMessages.map(
                                                  (msg, idx) => {
                                                    const originalIdx =
                                                      isMessagesExpanded
                                                        ? idx
                                                        : log.messages.length -
                                                          3 +
                                                          idx;
                                                    const messageKey = `${log._id}-${originalIdx}`;
                                                    const isContentExpanded =
                                                      expandedMessageContents.has(
                                                        messageKey
                                                      );
                                                    // 메시지 내용 추출 (다양한 형식 지원)
                                                    let contentStr = '';
                                                    if (typeof msg === 'string') {
                                                      contentStr = msg;
                                                    } else if (msg.content) {
                                                      contentStr = typeof msg.content === 'string' 
                                                        ? msg.content 
                                                        : JSON.stringify(msg.content, null, 2);
                                                    } else if (msg.text) {
                                                      contentStr = typeof msg.text === 'string' 
                                                        ? msg.text 
                                                        : JSON.stringify(msg.text, null, 2);
                                                    } else if (msg.message) {
                                                      contentStr = typeof msg.message === 'string' 
                                                        ? msg.message 
                                                        : JSON.stringify(msg.message, null, 2);
                                                    } else {
                                                      // 객체 전체를 표시
                                                      contentStr = JSON.stringify(msg, null, 2);
                                                    }
                                                    const shouldTruncate =
                                                      contentStr.length > 150;

                                                    return (
                                                      <div
                                                        key={originalIdx}
                                                        className='bg-gray-50 dark:bg-gray-900 rounded p-2 text-xs'
                                                      >
                                                        <div className='font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                                                          {(() => {
                                                            const role = typeof msg === 'object' && msg !== null 
                                                              ? (msg.role || msg.type || 'unknown')
                                                              : 'unknown';
                                                            if (role === 'user') return '👤 User';
                                                            if (role === 'assistant') return '🤖 Assistant';
                                                            if (role === 'system') return '⚙️ System';
                                                            return `📝 ${role}`;
                                                          })()}
                                                        </div>
                                                        <div className='text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words'>
                                                          {shouldTruncate &&
                                                          !isContentExpanded
                                                            ? contentStr.substring(
                                                                0,
                                                                150
                                                              ) + '...'
                                                            : contentStr}
                                                        </div>
                                                        {shouldTruncate && (
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              toggleMessageContentExpansion(
                                                                log._id,
                                                                originalIdx
                                                              );
                                                            }}
                                                            className='mt-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-xs underline'
                                                          >
                                                            {isContentExpanded
                                                              ? '접기'
                                                              : '전체 보기'}
                                                          </button>
                                                        )}
                                                      </div>
                                                    );
                                                  }
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                    )}

                                  {/* 오류 메시지 */}
                                  {log.error && (
                                    <div className='pt-3 border-t border-red-200 dark:border-red-700'>
                                      <p className='text-sm text-red-600 dark:text-red-400'>
                                        <strong>오류:</strong> {log.error}
                                      </p>
                                    </div>
                                  )}

                                  {/* HTTP Request/Response 상세 정보 */}
                                  <div className='pt-3 border-t border-gray-200 dark:border-gray-700 space-y-4'>
                                    {/* HTTP Request 정보 */}
                                    <div>
                                      <div className='flex items-center justify-between mb-2'>
                                        <h4 className='font-medium text-gray-900 dark:text-white flex items-center gap-2 text-sm'>
                                          <span className='px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-mono'>
                                            POST
                                          </span>
                                          HTTP Request
                                        </h4>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const requestData = {
                                              method: 'POST',
                                              url:
                                                log.endpoint ||
                                                '/api/v1/chat/completions',
                                              headers: {
                                                'Content-Type':
                                                  'application/json',
                                                Authorization:
                                                  log.authorization ===
                                                  'present'
                                                    ? 'Bearer ***'
                                                    : undefined,
                                                'User-Agent': log.userAgent,
                                                'Accept-Language':
                                                  log.acceptLanguage,
                                                Origin: log.origin,
                                                Referer: log.referer,
                                              },
                                              body: {
                                                model: log.model,
                                                messages:
                                                  log.messages ||
                                                  (log.prompt
                                                    ? [
                                                        {
                                                          role: 'user',
                                                          content: log.prompt,
                                                        },
                                                      ]
                                                    : []),
                                                stream: log.isStream,
                                              },
                                            };
                                            copyJson(requestData);
                                          }}
                                          className='flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
                                          title='Request 복사'
                                        >
                                          <Copy className='h-3 w-3' />
                                          Request 복사
                                        </button>
                                      </div>

                                      <div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2'>
                                        {/* URL */}
                                        <div>
                                          <div className='text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                                            URL
                                          </div>
                                          <div className='text-xs font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700'>
                                            {log.endpoint ||
                                              '/api/v1/chat/completions'}
                                          </div>
                                        </div>

                                        {/* Request Body */}
                                        <div>
                                          <div className='text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                                            Request Body
                                          </div>
                                          <div className='bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto'>
                                            <pre className='text-xs font-mono text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words'>
                                              {log.requestBody
                                                ? JSON.stringify(
                                                    log.requestBody,
                                                    null,
                                                    2
                                                  )
                                                : JSON.stringify(
                                                    {
                                                      model: log.model,
                                                      ...(log.messages &&
                                                      Array.isArray(
                                                        log.messages
                                                      )
                                                        ? {
                                                            messages:
                                                              log.messages.map(
                                                                (msg) => ({
                                                                  role: msg.role,
                                                                  content:
                                                                    parseContent(
                                                                      msg.content
                                                                    ),
                                                                })
                                                              ),
                                                          }
                                                        : {}),
                                                      ...(log.prompt
                                                        ? { prompt: log.prompt }
                                                        : {}),
                                                      stream: log.isStream,
                                                    },
                                                    null,
                                                    2
                                                  )}
                                            </pre>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* HTTP Response 정보 */}
                                    <div>
                                      <div className='flex items-center justify-between mb-2'>
                                        <h4 className='font-medium text-gray-900 dark:text-white flex items-center gap-2 text-sm'>
                                          <span
                                            className={`px-2 py-0.5 rounded text-xs font-mono ${
                                              log.statusCode >= 200 &&
                                              log.statusCode < 300
                                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                                : log.statusCode >= 400 &&
                                                  log.statusCode < 500
                                                ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                            }`}
                                          >
                                            {log.statusCode}
                                          </span>
                                          HTTP Response
                                        </h4>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const responseData = {
                                              status: log.statusCode,
                                              statusText:
                                                log.statusCode >= 200 &&
                                                log.statusCode < 300
                                                  ? 'OK'
                                                  : 'Error',
                                              headers: log.responseHeaders || {
                                                'Content-Type': log.isStream
                                                  ? 'text/event-stream'
                                                  : 'application/json',
                                              },
                                              body:
                                                log.responseBody ||
                                                log.error ||
                                                (log.messages
                                                  ? 'Streaming response'
                                                  : 'Response content'),
                                              usage: {
                                                prompt_tokens:
                                                  log.promptTokenCount,
                                                completion_tokens:
                                                  log.responseTokenCount,
                                                total_tokens:
                                                  log.totalTokenCount,
                                              },
                                            };
                                            copyJson(responseData);
                                          }}
                                          className='flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
                                          title='Response 복사'
                                        >
                                          <Copy className='h-3 w-3' />
                                          Response 복사
                                        </button>
                                      </div>

                                      <div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-3 space-y-2'>
                                        {/* Response Body / Error */}
                                        <div>
                                          <div className='text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                                            {log.error
                                              ? 'Error Message'
                                              : 'Response Body'}
                                          </div>
                                          <div
                                            className={`bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto ${
                                              log.error
                                                ? 'border-red-200 dark:border-red-700'
                                                : ''
                                            }`}
                                          >
                                            <pre
                                              className={`text-xs font-mono whitespace-pre-wrap break-words ${
                                                log.error
                                                  ? 'text-red-600 dark:text-red-400'
                                                  : 'text-gray-900 dark:text-gray-100'
                                              }`}
                                            >
                                              {log.error
                                                ? log.error
                                                : log.responseBody
                                                ? JSON.stringify(
                                                    log.responseBody,
                                                    null,
                                                    2
                                                  )
                                                : log.messages &&
                                                  Array.isArray(log.messages)
                                                ? 'Streaming response (메시지 배열)'
                                                : 'Response content'}
                                            </pre>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // 기존 개별 로그 뷰
          <div className='space-y-2'>
            {logs.map((log, index) => {
              const isExpanded = expandedLogs.has(log._id);
              // 고유 key 생성: _id가 없거나 중복될 수 있으므로 index와 조합
              const uniqueKey = log._id
                ? `log-${log._id}-${index}`
                : `log-${index}`;
              return (
                <div
                  key={uniqueKey}
                  className='border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                >
                  {/* 간결한 요약 헤더 */}
                  <div
                    className='flex items-start justify-between p-4 cursor-pointer'
                    onClick={() => toggleLogExpansion(log._id)}
                  >
                    <div className='flex items-center gap-3 flex-1'>
                      {/* 펼치기 아이콘 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLogExpansion(log._id);
                        }}
                        className='p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors'
                      >
                        {isExpanded ? (
                          <ChevronUp className='h-4 w-4 text-gray-500' />
                        ) : (
                          <ChevronDown className='h-4 w-4 text-gray-500' />
                        )}
                      </button>

                      {/* API 타입 & 스트리밍 */}
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.apiType === 'generate'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : log.apiType === 'image-analysis'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        }`}
                      >
                        {log.apiType?.toUpperCase()} {log.isStream && 'STREAM'}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getSourceBadge(
                          log.source
                        )}`}
                      >
                        {getSourceLabel(log.source)}
                      </span>

                      {/* 재시도 횟수 */}
                      {log.retryCount && log.retryCount > 1 && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            log.retryCount === 2
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                          }`}
                        >
                          재시도 {log.retryCount}회
                        </span>
                      )}

                      {/* 상태 코드 */}
                      <div className='flex items-center gap-1'>
                        {getStatusIcon(log.statusCode)}
                        <span className='text-sm font-medium'>
                          {log.statusCode}
                        </span>
                      </div>

                       {/* 핵심 정보 한 줄에 */}
                       <div className='flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400'>
                         <span className='flex items-center gap-1'>
                           {getClientToolIcon(getClientToolLabel(log))}
                           {getClientToolLabel(log)}
                         </span>
                         {(log.userName || log.userEmail) && (
                           <>
                             <span>•</span>
                             <span className='text-gray-700 dark:text-gray-300 font-medium'>
                               {log.userName || log.userEmail}
                             </span>
                           </>
                         )}
                         <span>•</span>
                         <span>{log.modelLabel || log.model}</span>
                         <span>•</span>
                         <span className='font-medium'>
                           {formatTokens(log.totalTokenCount)} 토큰
                         </span>
                       </div>
                     </div>

                    <div className='text-right'>
                      <div className='text-xs text-gray-600 dark:text-gray-400'>
                        {formatTime(log.timestamp)}
                      </div>
                      <div
                        className={`text-sm font-medium ${getResponseTimeColor(
                          log.finalResponseTime ?? log.responseTime
                        )}`}
                      >
                        {log.firstResponseTime ?? log.responseTime}ms /{' '}
                        {log.finalResponseTime ?? log.responseTime}ms
                      </div>
                    </div>
                  </div>

                  {/* 오류 메시지 (항상 표시) */}
                  {log.error && !isExpanded && (
                    <div className='px-4 pb-4 border-t border-red-200 dark:border-red-700 pt-3'>
                      <p className='text-sm text-red-600 dark:text-red-400'>
                        <strong>오류:</strong> {log.error}
                      </p>
                    </div>
                  )}

                  {/* 펼쳐진 상세 정보 */}
                  {isExpanded && (
                    <div className='border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50'>
                      <div className='p-4 space-y-4'>
                        {/* 사용자 & 세션 정보 */}
                        <div className='bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm'>
                          <h4 className='text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3'>
                            요청 정보
                          </h4>
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                            <div className='space-y-2'>
                              <div>
                                <span className='text-gray-500 dark:text-gray-400'>
                                  클라이언트:
                                </span>
                                <span className='ml-2 text-gray-900 dark:text-white font-medium'>
                                  {getClientToolLabel(log)}
                                </span>
                              </div>
                              <div>
                                <span className='text-gray-500 dark:text-gray-400'>
                                  IP:
                                </span>
                                <span className='ml-2 text-gray-900 dark:text-white font-mono text-xs'>
                                  {log.clientIP}
                                </span>
                              </div>
                              {log.userName && (
                                <div>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    사용자:
                                  </span>
                                  <span className='ml-2 text-gray-900 dark:text-white'>
                                    {log.userName} ({log.userEmail})
                                    {log.userDepartment && (
                                      <span className='ml-1 text-xs text-gray-500 dark:text-gray-400'>
                                        [{log.userDepartment}]
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              {log.tokenName && (
                                <div>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    토큰:
                                  </span>
                                  <span className='ml-2 text-gray-900 dark:text-white'>
                                    {log.tokenName}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className='space-y-2'>
                              {log.sessionHash && (
                                <div className='flex items-center gap-2'>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    세션:
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFilterChange(
                                        'sessionFilter',
                                        'exact'
                                      );
                                      handleFilterChange(
                                        'sessionHash',
                                        log.sessionHash
                                      );
                                      handleFilterChange(
                                        'userId',
                                        log.userId || ''
                                      );
                                      handleFilterChange(
                                        'tokenHash',
                                        log.tokenHash || ''
                                      );
                                    }}
                                    className='inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-mono transition-colors'
                                    title='이 세션의 모든 요청 보기'
                                  >
                                    <Hash className='h-3 w-3' />
                                    {log.sessionHash.substring(0, 12)}...
                                  </button>
                                </div>
                              )}
                              {log.conversationId && (
                                <div className='flex items-center gap-2'>
                                  <span className='text-gray-500 dark:text-gray-400'>
                                    대화:
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFilterChange(
                                        'conversationId',
                                        log.conversationId
                                      );
                                      handleFilterChange(
                                        'groupByConversation',
                                        false
                                      );
                                    }}
                                    className='inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-mono transition-colors'
                                    title='이 대화 세션의 모든 요청 보기'
                                  >
                                    <Hash className='h-3 w-3' />
                                    {log.conversationId.substring(0, 12)}...
                                  </button>
                                </div>
                              )}
                              <div>
                                <span className='text-gray-500 dark:text-gray-400'>
                                  토큰 사용:
                                </span>
                                <span className='ml-2 text-gray-900 dark:text-white font-medium'>
                                  {formatTokens(log.promptTokenCount)} →{' '}
                                  {formatTokens(log.responseTokenCount)}
                                  <span className='ml-1 text-gray-500 dark:text-gray-400 text-xs'>
                                    (총 {formatTokens(log.totalTokenCount)})
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 메시지 정보 (있는 경우) */}
                        {log.messages &&
                          Array.isArray(log.messages) &&
                          log.messages.length > 0 && (
                            <div className='bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm'>
                              <div className='flex items-center justify-between mb-3'>
                                <h4 className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                                  메시지 ({log.messages.length}개)
                                </h4>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPromptModal(log);
                                  }}
                                  className='text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 flex items-center gap-1'
                                >
                                  <Eye className='h-3 w-3' />
                                  전체 보기
                                </button>
                              </div>
                              <div className='space-y-2 max-h-64 overflow-y-auto'>
                                {(() => {
                                  const isMessagesExpanded =
                                    expandedMessages.has(log._id);
                                  const displayMessages = isMessagesExpanded
                                    ? log.messages
                                    : log.messages.slice(-2); // 최신 2개만

                                  return (
                                    <>
                                      {!isMessagesExpanded &&
                                        log.messages.length > 2 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleMessagesExpansion(log._id);
                                            }}
                                            className='w-full text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-center py-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors'
                                          >
                                            + {log.messages.length - 2}개 더
                                            보기
                                          </button>
                                        )}
                                      {displayMessages.map((msg, idx) => {
                                        const originalIdx = isMessagesExpanded
                                          ? idx
                                          : log.messages.length - 2 + idx;
                                        const messageKey = `${log._id}-${originalIdx}`;
                                        const isContentExpanded =
                                          expandedMessageContents.has(
                                            messageKey
                                          );
                                        // 메시지 내용 추출 (다양한 형식 지원)
                                        let contentStr = '';
                                        if (typeof msg === 'string') {
                                          contentStr = msg;
                                        } else if (msg.content) {
                                          contentStr = typeof msg.content === 'string' 
                                            ? msg.content 
                                            : JSON.stringify(msg.content, null, 2);
                                        } else if (msg.text) {
                                          contentStr = typeof msg.text === 'string' 
                                            ? msg.text 
                                            : JSON.stringify(msg.text, null, 2);
                                        } else if (msg.message) {
                                          contentStr = typeof msg.message === 'string' 
                                            ? msg.message 
                                            : JSON.stringify(msg.message, null, 2);
                                        } else {
                                          // 객체 전체를 표시
                                          contentStr = JSON.stringify(msg, null, 2);
                                        }
                                        const shouldTruncate =
                                          contentStr.length > 100;

                                        return (
                                          <div
                                            key={originalIdx}
                                            className='bg-gray-50 dark:bg-gray-900 rounded p-3 text-xs'
                                          >
                                            <div className='font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                                              {(() => {
                                                const role = typeof msg === 'object' && msg !== null 
                                                  ? (msg.role || msg.type || 'unknown')
                                                  : 'unknown';
                                                if (role === 'user') return '👤 User';
                                                if (role === 'assistant') return '🤖 Assistant';
                                                if (role === 'system') return '⚙️ System';
                                                return `📝 ${role}`;
                                              })()}
                                            </div>
                                            <div className='text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words'>
                                              {shouldTruncate &&
                                              !isContentExpanded
                                                ? contentStr.substring(0, 100) +
                                                  '...'
                                                : contentStr}
                                            </div>
                                            {shouldTruncate && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleMessageContentExpansion(
                                                    log._id,
                                                    originalIdx
                                                  );
                                                }}
                                                className='mt-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 text-xs'
                                              >
                                                {isContentExpanded
                                                  ? '접기'
                                                  : '더 보기'}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                      {isMessagesExpanded &&
                                        log.messages.length > 2 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleMessagesExpansion(log._id);
                                            }}
                                            className='w-full text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-center py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                                          >
                                            최신 2개만 보기
                                          </button>
                                        )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                        {/* 오류 메시지 */}
                        {log.error && (
                          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                            <p className='text-sm text-red-700 dark:text-red-300'>
                              <strong>오류:</strong> {log.error}
                            </p>
                          </div>
                        )}

                        {/* HTTP Request 정보 */}
                        <details className='bg-white dark:bg-gray-800 rounded-lg shadow-sm'>
                          <summary className='cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors'>
                            <div className='flex items-center justify-between'>
                              <h4 className='text-sm font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center gap-2'>
                                <span className='px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs font-mono'>
                                  POST
                                </span>
                                HTTP Request
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const requestData = {
                                    method: 'POST',
                                    url:
                                      log.endpoint ||
                                      '/api/v1/chat/completions',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization:
                                        log.authorization === 'present'
                                          ? 'Bearer ***'
                                          : undefined,
                                      'User-Agent': log.userAgent,
                                    },
                                    body: {
                                      model: log.model,
                                      messages:
                                        log.messages ||
                                        (log.prompt
                                          ? [
                                              {
                                                role: 'user',
                                                content: log.prompt,
                                              },
                                            ]
                                          : []),
                                      stream: log.isStream,
                                    },
                                  };
                                  copyJson(requestData);
                                }}
                                className='flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
                                title='Request 복사'
                              >
                                <Copy className='h-3 w-3' />
                                복사
                              </button>
                            </div>
                          </summary>

                          <div className='p-4 pt-0 space-y-2'>
                            {/* URL */}
                            <div className='text-xs'>
                              <span className='text-gray-500 dark:text-gray-400'>
                                URL:
                              </span>
                              <code className='ml-2 font-mono text-gray-900 dark:text-gray-100'>
                                {log.endpoint || '/api/v1/chat/completions'}
                              </code>
                            </div>

                            {/* Request Body 요약 */}
                            <div className='text-xs'>
                              <span className='text-gray-500 dark:text-gray-400'>
                                Body:
                              </span>
                              <span className='ml-2 text-gray-900 dark:text-white'>
                                model:{' '}
                                <code className='font-mono'>
                                  {log.modelLabel || log.model}
                                </code>,
                                stream:{' '}
                                <code className='font-mono'>
                                  {log.isStream ? 'true' : 'false'}
                                </code>
                                {log.messages &&
                                  `, messages: ${log.messages.length}개`}
                              </span>
                            </div>
                          </div>
                        </details>

                        {/* HTTP Response 정보 */}
                        <details className='bg-white dark:bg-gray-800 rounded-lg shadow-sm'>
                          <summary className='cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors'>
                            <div className='flex items-center justify-between'>
                              <h4 className='text-sm font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center gap-2'>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-mono ${
                                    log.statusCode >= 200 &&
                                    log.statusCode < 300
                                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                      : log.statusCode >= 400 &&
                                        log.statusCode < 500
                                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                      : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                  }`}
                                >
                                  {log.statusCode}
                                </span>
                                HTTP Response
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const responseData = {
                                    status: log.statusCode,
                                    headers: log.responseHeaders || {
                                      'Content-Type': log.isStream
                                        ? 'text/event-stream'
                                        : 'application/json',
                                    },
                                    body: log.responseBody || log.error,
                                    usage: {
                                      prompt_tokens: log.promptTokenCount,
                                      completion_tokens: log.responseTokenCount,
                                      total_tokens: log.totalTokenCount,
                                    },
                                  };
                                  copyJson(responseData);
                                }}
                                className='flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
                                title='Response 복사'
                              >
                                <Copy className='h-3 w-3' />
                                복사
                              </button>
                            </div>
                          </summary>

                          <div className='p-4 pt-0 space-y-2'>
                            {/* Response Body 요약 */}
                            {log.error ? (
                              <div className='text-xs bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2'>
                                <span className='text-red-700 dark:text-red-300'>
                                  {log.error}
                                </span>
                              </div>
                            ) : log.responseBody ? (
                              <div className='text-xs'>
                                <pre className='font-mono text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-2 rounded'>
                                  {typeof log.responseBody === 'string'
                                    ? log.responseBody
                                    : JSON.stringify(log.responseBody, null, 2)}
                                </pre>
                              </div>
                            ) : (
                              <div className='text-xs text-gray-500 dark:text-gray-400'>
                                {log.isStream
                                  ? 'Streaming response (콘텐츠 미저장)'
                                  : 'Response body 없음'}
                              </div>
                            )}
                          </div>
                        </details>

                        {/* 전체 Raw JSON (접을 수 있게) */}
                        <details className='bg-white dark:bg-gray-800 rounded-lg shadow-sm'>
                          <summary className='cursor-pointer p-4 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors'>
                            <div className='flex items-center justify-between'>
                              <h4 className='text-sm font-semibold text-gray-700 dark:text-gray-300'>
                                전체 Raw JSON 데이터
                              </h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyJson(log);
                                }}
                                className='flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
                                title='전체 JSON 복사'
                              >
                                <Copy className='h-3 w-3' />
                                복사
                              </button>
                            </div>
                          </summary>
                          <div className='p-4 pt-0'>
                            <pre className='text-xs font-mono text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 rounded'>
                              {JSON.stringify(log, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className='flex items-center justify-between mt-6'>
            <button
              onClick={() => handlePageChange(filters.page - 1)}
              disabled={!pagination.hasPrev || loading}
              className='flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600'
            >
              <ChevronLeft className='h-4 w-4' />
              이전
            </button>

            <div className='flex items-center gap-2'>
              {Array.from(
                { length: Math.min(pagination.totalPages, 5) },
                (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm rounded-md ${
                        page === filters.page
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  );
                }
              )}
            </div>

            <button
              onClick={() => handlePageChange(filters.page + 1)}
              disabled={!pagination.hasNext || loading}
              className='flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600'
            >
              다음
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        )}
      </div>

      {/* 프롬프트 전체 보기 모달 */}
      {promptModal.isOpen && promptModal.log && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* 배경 오버레이 */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
            onClick={closePromptModal}
          />
          {/* 모달 내용 */}
          <div className='relative bg-white dark:bg-gray-800 rounded-lg w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl max-h-[80vh] overflow-hidden'>
            <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                프롬프트 전체 보기
              </h3>
              <div className='flex items-center gap-2'>
                <button
                  onClick={() => copyPrompt(promptModal.log.prompt)}
                  className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  title='복사'
                >
                  <Copy className='h-4 w-4' />
                </button>
                <button
                  onClick={closePromptModal}
                  className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                >
                  <X className='h-4 w-4' />
                </button>
              </div>
            </div>
            <div className='p-4 overflow-y-auto max-h-[calc(80vh-120px)]'>
              <div className='mb-4'>
                <div className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
                  <strong>API:</strong> {promptModal.log.apiType} |
                  <strong> 모델:</strong>{' '}
                  {promptModal.log.modelLabel || promptModal.log.model} |
                  <strong> IP:</strong> {promptModal.log.clientIP} |
                  <strong> 시간:</strong>{' '}
                  {formatTime(promptModal.log.timestamp)}
                </div>
              </div>
              <div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-4'>
                <pre className='whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 font-mono overflow-x-auto'>
                  {typeof promptModal.log.prompt === 'string'
                    ? promptModal.log.prompt
                    : JSON.stringify(promptModal.log.prompt, null, 2)}
                </pre>
              </div>
              {promptModal.log.messages &&
                Array.isArray(promptModal.log.messages) && (
                  <div className='mt-4'>
                    <h4 className='font-medium text-gray-900 dark:text-white mb-2'>
                      메시지 배열 ({promptModal.log.messages.length}개):
                    </h4>
                    <div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-3'>
                      {promptModal.log.messages.map((msg, index) => {
                        // 메시지 내용 추출 (다양한 형식 지원)
                        let messageContent = null;
                        if (typeof msg === 'string') {
                          messageContent = msg;
                        } else if (msg.content) {
                          messageContent = msg.content;
                        } else if (msg.text) {
                          messageContent = msg.text;
                        } else if (msg.message) {
                          messageContent = msg.message;
                        } else {
                          messageContent = msg;
                        }
                        
                        // role 추출
                        const role = typeof msg === 'object' && msg !== null 
                          ? (msg.role || msg.type || 'unknown')
                          : 'unknown';
                        
                        return (
                          <div
                            key={index}
                            className='bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700'
                          >
                            <div className='text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1'>
                              [{index + 1}] {role === 'user' ? '👤 User' : role === 'assistant' ? '🤖 Assistant' : role === 'system' ? '⚙️ System' : `📝 ${role}`}
                            </div>
                            <pre className='whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100 font-mono overflow-x-auto'>
                              {renderContent(messageContent)}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                    <div className='mt-2'>
                      <button
                        onClick={() => copyPrompt(promptModal.log.messages)}
                        className='flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors'
                        title='메시지 배열 복사'
                      >
                        <Copy className='h-3 w-3' />
                        메시지 배열 복사
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
