'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  RefreshCw,
  User,
  Calendar,
  Zap,
  AlertCircle,
  X,
  Filter,
  Power,
  PowerOff,
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

const TOKENS_PER_PAGE = 20;
const DEFAULT_EXPIRES_IN_DAYS = 90;
const MAX_EXPIRES_IN_DAYS = 365;
const MIN_EXPIRES_IN_DAYS = 1;

// 유틸 함수들
const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  
  let date;
  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string') {
    if (dateValue.trim() === '') return '-';
    date = new Date(dateValue);
  } else if (typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else {
    return '-';
  }
  
  if (isNaN(date.getTime())) {
    if (typeof dateValue === 'string') {
      console.warn('Invalid date value:', dateValue);
    }
    return '-';
  }
  
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
};

const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  
  const expiryDate = expiresAt instanceof Date 
    ? expiresAt 
    : new Date(expiresAt);
  
  return !isNaN(expiryDate.getTime()) && expiryDate < new Date();
};

const filterTokens = (tokens, searchTerm) => {
  if (!searchTerm) return tokens;
  
  const searchLower = searchTerm.toLowerCase();
  return tokens.filter((token) =>
    token.name?.toLowerCase().includes(searchLower) ||
    token.user?.email?.toLowerCase().includes(searchLower) ||
    token.user?.name?.toLowerCase().includes(searchLower) ||
    token.tokenHash?.toLowerCase().includes(searchLower)
  );
};

const formatTokenCount = (count) => {
  if (!count) return '0';
  return `${(count / 1000).toFixed(1)}K`;
};

// API 호출 헬퍼
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const handleApiError = async (response, defaultMessage, alert) => {
  const errorData = await response.json().catch(() => ({}));
  const message = errorData.error || defaultMessage;
  alert(message, 'error', '오류');
  return errorData;
};

export default function ApiKeysPage() {
  const { alert, confirm } = useAlert();
  const [tokens, setTokens] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(DEFAULT_EXPIRES_IN_DAYS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showTokenInfoModal, setShowTokenInfoModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users?limit=1000', {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: TOKENS_PER_PAGE.toString(),
        ...(selectedUserFilter && { userId: selectedUserFilter }),
      });

      const response = await fetch(`/api/admin/api-keys?${params}`, {
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data.tokens || []);
        setTotalPages(data.data.pagination.totalPages);
        setTotalCount(data.data.pagination.totalCount);
      } else {
        await handleApiError(
          response,
          `키 목록 조회 실패 (${response.status})`,
          alert
        );
      }
    } catch (error) {
      console.error('키 목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedUserFilter, alert]);

  const createToken = useCallback(async () => {
    if (!selectedUserId) {
      alert('사용자를 선택해주세요.', 'warning', '선택 오류');
      return;
    }

    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          userId: selectedUserId,
          name: tokenName || undefined,
          expiresInDays: parseInt(expiresInDays),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewToken(data.data.token);
        setShowCreateModal(false);
        setShowTokenModal(true);
        setTokenName('');
        setSelectedUserId('');
        fetchTokens();
      } else {
        await handleApiError(response, '키 발급 실패', alert);
      }
    } catch (error) {
      console.error('키 발급 오류:', error);
      alert('키 발급 중 오류가 발생했습니다.', 'error', '오류');
    }
  }, [selectedUserId, tokenName, expiresInDays, alert, fetchTokens]);

  const deleteToken = useCallback(async (tokenId) => {
    const confirmed = await confirm('정말 이 키를 삭제하시겠습니까?', '키 삭제 확인');
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/admin/api-keys?id=${tokenId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        alert('키가 삭제되었습니다.', 'success', '삭제 완료');
        fetchTokens();
      } else {
        await handleApiError(response, '키 삭제 실패', alert);
      }
    } catch (error) {
      console.error('키 삭제 오류:', error);
      alert('키 삭제 중 오류가 발생했습니다.', 'error', '오류');
    }
  }, [confirm, alert, fetchTokens]);

  const toggleTokenStatus = useCallback(async (tokenId, currentStatus) => {
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: tokenId,
          isActive: !currentStatus,
        }),
      });

      if (response.ok) {
        fetchTokens();
      } else {
        await handleApiError(response, '키 상태 변경 실패', alert);
      }
    } catch (error) {
      console.error('키 상태 변경 오류:', error);
      alert('키 상태 변경 중 오류가 발생했습니다.', 'error', '오류');
    }
  }, [alert, fetchTokens]);

  const copyToken = useCallback(async (token) => {
    try {
      await navigator.clipboard.writeText(token);
      alert('키가 클립보드에 복사되었습니다.', 'success');
    } catch (error) {
      console.error('복사 실패:', error);
      alert('키 복사에 실패했습니다.', 'error');
    }
  }, [alert]);

  const resetCreateForm = useCallback(() => {
    setShowCreateModal(false);
    setTokenName('');
    setSelectedUserId('');
    setExpiresInDays(DEFAULT_EXPIRES_IN_DAYS);
  }, []);

  const handleUserFilterChange = useCallback((value) => {
    setSelectedUserFilter(value);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const filteredTokens = useMemo(
    () => filterTokens(tokens, searchTerm),
    [tokens, searchTerm]
  );

  // 서브 컴포넌트들
  const ModalOverlay = ({ onClose, children, maxWidth = 'md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl' }) => (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
        onClick={onClose}
      />
      <div className={`relative bg-card rounded-lg w-full max-w-full ${maxWidth} p-6`}>
        {children}
      </div>
    </div>
  );

  const ModalHeader = ({ title, icon: Icon, iconClassName, onClose }) => (
    <div className='flex items-center justify-between mb-4'>
      {Icon ? (
        <div className='flex items-center gap-2'>
          <Icon className={iconClassName || 'h-5 w-5 text-muted-foreground'} />
          <h3 className='text-lg font-medium text-foreground'>{title}</h3>
        </div>
      ) : (
        <h3 className='text-lg font-medium text-foreground'>{title}</h3>
      )}
      <button
        onClick={onClose}
        className='text-muted-foreground hover:text-foreground'
      >
        <X className='h-5 w-5' />
      </button>
    </div>
  );

  const TokenItem = ({ token, onView, onToggleStatus, onDelete }) => (
    <div className='border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors'>
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-center gap-3 mb-2'>
            <Key className='h-5 w-5 text-muted-foreground' />
            <div>
              <div className='flex items-center gap-2'>
                <span className='font-medium text-foreground'>
                  {token.name || '이름 없음'}
                </span>
                {token.isActive ? (
                  <span className='px-2 py-0.5 bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary rounded text-xs font-medium'>
                    활성
                  </span>
                ) : (
                  <span className='px-2 py-0.5 bg-muted text-foreground dark:bg-muted dark:text-muted-foreground rounded text-xs font-medium'>
                    비활성
                  </span>
                )}
                {isExpired(token.expiresAt) && (
                  <span className='px-2 py-0.5 bg-destructive/10 text-destructive dark:bg-destructive/10 dark:text-destructive rounded text-xs font-medium'>
                    만료됨
                  </span>
                )}
              </div>
              <div className='text-sm text-muted-foreground mt-2 space-y-1'>
                {token.user && (
                  <div className='flex items-center gap-1'>
                    <User className='h-4 w-4' />
                    <span>
                      {token.user.name} ({token.user.email})
                    </span>
                  </div>
                )}
                <div className='flex items-center gap-4'>
                  <div className='flex items-center gap-1'>
                    <Calendar className='h-4 w-4' />
                    <span>발급: {formatDate(token.createdAt)}</span>
                  </div>
                  {token.expiresAt && (
                    <div className='flex items-center gap-1'>
                      <Calendar className='h-4 w-4' />
                      <span>만료: {formatDate(token.expiresAt)}</span>
                    </div>
                  )}
                </div>
                <div className='flex items-center gap-4'>
                  <div className='flex items-center gap-1'>
                    <Zap className='h-4 w-4' />
                    <span>
                      사용량: {token.usage?.requestCount || 0}회 / {formatTokenCount(token.usage?.totalTokens)} 키
                    </span>
                  </div>
                  {token.usage?.lastUsed && (
                    <div className='text-xs text-muted-foreground'>
                      마지막 사용: {formatDate(token.usage.lastUsed)}
                    </div>
                  )}
                </div>
                <div className='text-xs text-muted-foreground font-mono'>
                  해시: {token.tokenHash}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={() => onView(token)}
            className='p-2 text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground hover:bg-accent rounded transition-colors'
            title='키 정보 보기'
          >
            <Eye className='h-4 w-4' />
          </button>
          <button
            onClick={() => onToggleStatus(token._id, token.isActive)}
            className={`p-2 rounded transition-colors ${
              token.isActive
                ? 'text-primary hover:text-primary dark:text-primary dark:hover:text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground hover:bg-accent'
            }`}
            title={token.isActive ? '비활성화' : '활성화'}
          >
            {token.isActive ? (
              <Power className='h-4 w-4' />
            ) : (
              <PowerOff className='h-4 w-4' />
            )}
          </button>
          <button
            onClick={() => onDelete(token._id)}
            className='p-2 text-destructive hover:text-destructive dark:hover:text-destructive hover:bg-destructive/10 rounded transition-colors'
            title='삭제'
          >
            <Trash2 className='h-4 w-4' />
          </button>
        </div>
      </div>
    </div>
  );

  const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    return (
      <div className='flex items-center justify-between mt-6'>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className='px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent'
        >
          이전
        </button>
        <span className='text-sm text-muted-foreground'>
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className='px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent'
        >
          다음
        </button>
      </div>
    );
  };

  // 페이지 로드 시 초기화
  useEffect(() => {
    fetchUsers();
    fetchTokens();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 페이지 변경 시 키 목록 갱신
  useEffect(() => {
    fetchTokens();
  }, [currentPage, selectedUserFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>
            API 키 관리
          </h1>
          <p className='text-muted-foreground mt-1'>
            사용자별 API 키를 발급하고 관리합니다
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <button
            onClick={fetchTokens}
            disabled={loading}
            className='btn-secondary flex items-center gap-2'
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className='btn-primary flex items-center gap-2'
          >
            <Plus className='h-4 w-4' />
            키 발급
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className='card p-4'>
        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <Filter className='h-5 w-5 text-muted-foreground' />
            <span className='text-sm font-medium text-foreground'>
              필터
            </span>
          </div>
          <div className='flex-1'>
            <input
              type='text'
              placeholder='키명, 사용자명, 이메일로 검색...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='w-full px-3 py-2 border border-border rounded-md bg-background text-foreground'
            />
          </div>
          <div className='w-64'>
            <select
              value={selectedUserFilter}
              onChange={(e) => handleUserFilterChange(e.target.value)}
              className='w-full px-3 py-2 border border-border rounded-md bg-background text-foreground'
            >
              <option value=''>전체 사용자</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 키 목록 */}
      <div className='card p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='font-medium text-foreground'>
            키 목록 ({totalCount.toLocaleString()})
          </h3>
        </div>

        {loading ? (
          <div className='flex items-center justify-center py-8'>
            <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            키가 없습니다
          </div>
        ) : (
          <div className='space-y-3'>
            {filteredTokens.map((token) => (
              <TokenItem
                key={token._id}
                token={token}
                onView={(token) => {
                  setSelectedToken(token);
                  setShowTokenInfoModal(true);
                }}
                onToggleStatus={toggleTokenStatus}
                onDelete={deleteToken}
              />
            ))}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 키 발급 모달 */}
      {showCreateModal && (
        <ModalOverlay onClose={resetCreateForm}>
          <ModalHeader title='새 API 키 발급' onClose={resetCreateForm} />
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                사용자 선택 *
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className='w-full px-3 py-2 border border-border rounded-md bg-background text-foreground'
              >
                <option value=''>사용자를 선택하세요</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                키 이름 (선택사항)
              </label>
              <input
                type='text'
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder='예: 프로덕션 API 키'
                className='w-full px-3 py-2 border border-border rounded-md bg-background text-foreground'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                만료 기간 (일)
              </label>
              <input
                type='number'
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                min={MIN_EXPIRES_IN_DAYS}
                max={MAX_EXPIRES_IN_DAYS}
                className='w-full px-3 py-2 border border-border rounded-md bg-background text-foreground'
              />
            </div>
          </div>
          <div className='flex items-center gap-2 mt-6'>
            <button
              onClick={resetCreateForm}
              className='flex-1 px-4 py-2 border border-border rounded-md bg-background text-foreground hover:bg-accent'
            >
              취소
            </button>
            <button
              onClick={createToken}
              className='flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90'
            >
              발급
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* 발급된 키 표시 모달 */}
      {showTokenModal && newToken && (
        <ModalOverlay
          onClose={() => {
            setShowTokenModal(false);
            setNewToken(null);
          }}
          maxWidth='md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'
        >
          <ModalHeader
            title='키가 발급되었습니다'
            icon={AlertCircle}
            iconClassName='h-5 w-5 text-muted-foreground'
            onClose={() => {
              setShowTokenModal(false);
              setNewToken(null);
            }}
          />
          <div className='bg-muted border border-border rounded-lg p-4 mb-4'>
            <p className='text-sm text-muted-foreground'>
              ⚠️ 이 키는 이번에만 표시됩니다. 안전한 곳에 저장해주세요.
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              API 키
            </label>
            <div className='flex items-center gap-2'>
              <input
                type='text'
                value={newToken}
                readOnly
                className='flex-1 px-3 py-2 border border-border rounded-md bg-muted text-foreground font-mono text-sm'
              />
              <button
                onClick={() => copyToken(newToken)}
                className='px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center gap-2'
              >
                <Copy className='h-4 w-4' />
                복사
              </button>
            </div>
          </div>
          <div className='mt-4'>
            <p className='text-sm text-muted-foreground'>
              사용 예시는 관리자 화면에서 제공하지 않습니다.
            </p>
          </div>
          <div className='mt-6'>
            <button
              onClick={() => {
                setShowTokenModal(false);
                setNewToken(null);
              }}
              className='w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90'
            >
              확인
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* 키 정보 보기 모달 */}
      {showTokenInfoModal && selectedToken && (
        <ModalOverlay
          onClose={() => {
            setShowTokenInfoModal(false);
            setSelectedToken(null);
          }}
          maxWidth='md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'
        >
          <ModalHeader
            title='API 키 정보'
            icon={Key}
            onClose={() => {
              setShowTokenInfoModal(false);
              setSelectedToken(null);
            }}
          />
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                키 이름
              </label>
              <div className='px-3 py-2 border border-border rounded-md bg-muted text-foreground'>
                {selectedToken.name || '이름 없음'}
              </div>
            </div>
            {selectedToken.user && (
              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  사용자
                </label>
                <div className='px-3 py-2 border border-border rounded-md bg-muted text-foreground'>
                  {selectedToken.user.name} ({selectedToken.user.email})
                </div>
              </div>
            )}
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                원본 키
              </label>
              {selectedToken.originalToken ? (
                <div className='flex items-center gap-2'>
                  <input
                    type='text'
                    value={selectedToken.originalToken}
                    readOnly
                    className='flex-1 px-3 py-2 border border-border rounded-md bg-muted text-foreground font-mono text-sm'
                  />
                  <button
                    onClick={() => copyToken(selectedToken.originalToken)}
                    className='px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center gap-2'
                  >
                    <Copy className='h-4 w-4' />
                    복사
                  </button>
                </div>
              ) : (
                <div className='px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground text-sm'>
                  원본 키를 사용할 수 없습니다. 새로 발급된 키만 표시됩니다.
                </div>
              )}
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                키 해시
              </label>
              <div className='flex items-center gap-2'>
                <input
                  type='text'
                  value={selectedToken.tokenHash}
                  readOnly
                  className='flex-1 px-3 py-2 border border-border rounded-md bg-muted text-foreground font-mono text-sm'
                />
                <button
                  onClick={() => copyToken(selectedToken.tokenHash)}
                  className='px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center gap-2'
                >
                  <Copy className='h-4 w-4' />
                  복사
                </button>
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                상태
              </label>
              <div className='flex items-center gap-2'>
                {selectedToken.isActive ? (
                  <span className='px-2 py-1 bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary rounded text-sm font-medium'>
                    활성
                  </span>
                ) : (
                  <span className='px-2 py-1 bg-muted text-foreground dark:bg-muted dark:text-muted-foreground rounded text-sm font-medium'>
                    비활성
                  </span>
                )}
                {isExpired(selectedToken.expiresAt) && (
                  <span className='px-2 py-1 bg-destructive/10 text-destructive dark:bg-destructive/10 dark:text-destructive rounded text-sm font-medium'>
                    만료됨
                  </span>
                )}
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  발급일
                </label>
                <div className='px-3 py-2 border border-border rounded-md bg-muted text-foreground text-sm'>
                  {formatDate(selectedToken.createdAt)}
                </div>
              </div>
              {selectedToken.expiresAt && (
                <div>
                  <label className='block text-sm font-medium text-foreground mb-1'>
                    만료일
                  </label>
                  <div className='px-3 py-2 border border-border rounded-md bg-muted text-foreground text-sm'>
                    {formatDate(selectedToken.expiresAt)}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                사용량
              </label>
              <div className='px-3 py-2 border border-border rounded-md bg-muted text-foreground text-sm'>
                <div className='flex items-center gap-4'>
                  <span>요청: {selectedToken.usage?.requestCount || 0}회</span>
                  <span>키: {formatTokenCount(selectedToken.usage?.totalTokens)}</span>
                </div>
                {selectedToken.usage?.lastUsed && (
                  <div className='mt-2 text-xs text-muted-foreground'>
                    마지막 사용: {formatDate(selectedToken.usage.lastUsed)}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                사용 예시
              </label>
              <div className='px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground text-sm'>
                사용 예시는 관리자 화면에서 제공하지 않습니다.
              </div>
            </div>
          </div>
          <div className='mt-6 flex justify-end'>
            <button
              onClick={() => {
                setShowTokenInfoModal(false);
                setSelectedToken(null);
              }}
              className='px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90'
            >
              확인
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
