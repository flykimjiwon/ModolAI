'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Calendar,
  Zap,
  AlertCircle,
  X,
  ArrowLeft,
  CheckCircle,
  Power,
  PowerOff,
  RotateCw,
  ExternalLink,
  Settings,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AlertModal, ConfirmModal } from '@/components/ui/modal';

export default function MyApiKeysPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [tokenName, setTokenName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showTokenInfoModal, setShowTokenInfoModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [copiedStates, setCopiedStates] = useState({});
  const [selectedApiToken, setSelectedApiToken] = useState('');
  const [presetBaseUrl, setPresetBaseUrl] = useState('');
  const [presetApiBase, setPresetApiBase] = useState('');
  const [apiConfigExample, setApiConfigExample] = useState('');
  const [apiCurlExample, setApiCurlExample] = useState('');
  const [isTokenSectionExpanded, setIsTokenSectionExpanded] = useState(true);
  const [isApiSectionExpanded, setIsApiSectionExpanded] = useState(false);
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '', type: 'error' });
  const [successModal, setSuccessModal] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    title: '', 
    message: '', 
    type: 'warning', 
    onConfirm: null,
    confirmText: '확인',
    cancelText: '취소'
  });

  // 키 목록 조회
  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });

      const response = await fetch(`/api/user/api-keys?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setTokens(data.data.tokens || []);
        setTotalPages(data.data.pagination.totalPages);
        setTotalCount(data.data.pagination.totalCount);
      } else if (response.status === 401) {
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      } else {
        let errorData = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (parseError) {
          console.error('응답 파싱 실패:', parseError);
        }
        
        const errorMessage = errorData.error || '키 목록 조회 실패';
        const errorDetails = errorData.details || errorData.hint || '';
        const errorCode = errorData.code || '';
        
        const modalMessage = `${errorMessage}${errorDetails ? `\n\n상세: ${errorDetails}` : ''}${errorCode ? `\n\n코드: ${errorCode}` : ''}`;
        
        setErrorModal({
          isOpen: true,
          title: '키 목록 조회 실패',
          message: modalMessage,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('키 목록 조회 오류:', error);
      setErrorModal({
        isOpen: true,
        title: '키 목록 조회 오류',
        message: error.message || '키 목록을 불러오는 중 오류가 발생했습니다.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, router]);

  // 키 발급
  const createToken = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
        fetchTokens();
      } else {
        const error = await response.json();
        setErrorModal({
          isOpen: true,
          title: '키 발급 실패',
          message: error.error || '키 발급에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('키 발급 오류:', error);
      setErrorModal({
        isOpen: true,
        title: '키 발급 오류',
        message: '키 발급 중 오류가 발생했습니다.',
        type: 'error'
      });
    }
  };

  // 키 삭제
  const deleteToken = async (tokenId) => {
    setConfirmModal({
      isOpen: true,
      title: '키 삭제',
      message: '정말 이 키를 삭제하시겠습니까?',
      type: 'warning',
      confirmText: '삭제',
      cancelText: '취소',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/user/api-keys?id=${tokenId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            setSuccessModal({
              isOpen: true,
              title: '삭제 완료',
              message: '키가 삭제되었습니다.',
              type: 'success'
            });
            fetchTokens();
          } else {
            const error = await response.json();
            setErrorModal({
              isOpen: true,
              title: '키 삭제 실패',
              message: error.error || '키 삭제에 실패했습니다.',
              type: 'error'
            });
          }
        } catch (error) {
          console.error('키 삭제 오류:', error);
          setErrorModal({
            isOpen: true,
            title: '키 삭제 오류',
            message: '키 삭제 중 오류가 발생했습니다.',
            type: 'error'
          });
        }
      }
    });
  };

  // 키 활성화/비활성화
  const toggleTokenStatus = async (tokenId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/api-keys', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: tokenId,
          isActive: !currentStatus,
        }),
      });

      if (response.ok) {
        fetchTokens();
      } else {
        const error = await response.json();
        setErrorModal({
          isOpen: true,
          title: '키 상태 변경 실패',
          message: error.error || '키 상태 변경에 실패했습니다.',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('키 상태 변경 오류:', error);
      setErrorModal({
        isOpen: true,
        title: '키 상태 변경 오류',
        message: '키 상태 변경 중 오류가 발생했습니다.',
        type: 'error'
      });
    }
  };

  // 키 복사
  const copyToken = async (token, key = 'token') => {
    await copyToClipboard(token, key);
  };

  // 키 재발급
  const regenerateToken = async (tokenId, tokenName, expiresInDays) => {
    setConfirmModal({
      isOpen: true,
      title: '키 재발급',
      message: '기존 키가 비활성화되고 새 키가 발급됩니다. 계속하시겠습니까?',
      type: 'warning',
      confirmText: '재발급',
      cancelText: '취소',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');

          // 기존 키 비활성화
          await fetch('/api/user/api-keys', {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: tokenId,
              isActive: false,
            }),
          });

          // 새 키 발급
          const response = await fetch('/api/user/api-keys', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: tokenName,
              expiresInDays: expiresInDays || 90,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setNewToken(data.data.token);
            setShowTokenInfoModal(false);
            setShowTokenModal(true);
            setSelectedToken(null);
            fetchTokens();
          } else {
            const error = await response.json();
            setErrorModal({
              isOpen: true,
              title: '키 재발급 실패',
              message: error.error || '키 재발급에 실패했습니다.',
              type: 'error'
            });
          }
        } catch (error) {
          console.error('키 재발급 오류:', error);
          setErrorModal({
            isOpen: true,
            title: '키 재발급 오류',
            message: '키 재발급 중 오류가 발생했습니다.',
            type: 'error'
          });
        }
      }
    });
  };

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  };

  // 만료 여부 확인
  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  // 현재 서버의 기본 URL(프로토콜 + 호스트)을 가져옵니다.
  const getServerUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:3000';
  };

  // API Base URL을 반환합니다.
  const apiBaseUrl = getServerUrl();
  const normalizeBaseWithV1 = (value, fallback) => {
    const trimmed =
      typeof value === 'string' && value.trim() ? value.trim() : '';
    if (!trimmed) return `${fallback}/v1`;
    const cleaned = trimmed.replace(/\/+$/, '');
    return cleaned.endsWith('/v1') ? cleaned : `${cleaned}/v1`;
  };
  const resolvedApiBaseUrl = normalizeBaseWithV1(presetApiBase, apiBaseUrl);

  const fetchPresetSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (!res.ok) return;
      const data = await res.json();
      setPresetBaseUrl(data.manualPresetBaseUrl || '');
      setPresetApiBase(data.manualPresetApiBase || '');
      setApiConfigExample(data.apiConfigExample || '');
      setApiCurlExample(data.apiCurlExample || '');
    } catch (error) {
      console.warn('프리셋 URL 설정 로드 실패:', error.message);
    }
  }, []);

  useEffect(() => {
    fetchPresetSettings();
  }, [fetchPresetSettings]);

  // 클립보드 복사 함수 (HTTP 환경 지원)
  const copyToClipboard = async (text, key) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('Fallback 복사 실패');
      }
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(
        () => setCopiedStates((prev) => ({ ...prev, [key]: false })),
        2000
      );
      setSuccessModal({
        isOpen: true,
        title: '복사 완료',
        message: '클립보드에 복사되었습니다.',
        type: 'success'
      });
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      setErrorModal({
        isOpen: true,
        title: '복사 실패',
        message: `복사에 실패했습니다. 다음 내용을 수동으로 복사해주세요:\n\n${text}`,
        type: 'error'
      });
    }
  };

  // 플레이스홀더 치환 함수 (빈 문자열이면 플레이스홀더 유지)
  const replacePlaceholders = (text, apiKey) => {
    const selectedKey = apiKey && apiKey.trim() ? apiKey : '{{KEY}}';
    return text
      .replace(/\{\{KEY\}\}/g, selectedKey)
      .replace(/\{\{TOKEN\}\}/g, selectedKey);
  };

  // 기본 config 예시 (관리자 설정이 없을 경우)
  const getDefaultConfigExample = (token) => {
    const baseUrl = normalizeBaseWithV1(presetBaseUrl, apiBaseUrl);
    const tokenValue = token && token.trim() ? token : '{{KEY}}';
    return `name: Local Agent
version: 1.0.0
schema: v1
models:
  - title: "My Chat Model"
    provider: "openai"
    model: "gemma3:4b"
    apiKey: "${tokenValue}"
    baseUrl: "${baseUrl}"`;
  };

  // 기본 curl 예시 (관리자 설정이 없을 경우)
  const getDefaultCurlExample = (token) => {
    const tokenValue = token && token.trim() ? token : '{{KEY}}';
    return `curl -X POST ${resolvedApiBaseUrl}/chat/completions ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer ${tokenValue}" ^
  -d "{\\"model\\": \\"gemma3:4b\\", \\"messages\\": [{\\"role\\": \\"user\\", \\"content\\": \\"Hello!\\"}], \\"stream\\": true}"`;
  };

  const buildConfigPresetText = () => {
    const token = selectedApiToken.trim();

    if (apiConfigExample.trim()) {
      // 관리자가 설정한 예시가 있으면 플레이스홀더 치환
      return replacePlaceholders(apiConfigExample, token);
    }
    // 기본 예시 사용
    return getDefaultConfigExample(token);
  };

  const buildCurlExampleText = () => {
    const token = selectedApiToken.trim();

    if (apiCurlExample.trim()) {
      // 관리자가 설정한 예시가 있으면 플레이스홀더 치환
      return replacePlaceholders(apiCurlExample, token);
    }
    // 기본 예시 사용
    return getDefaultCurlExample(token);
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200'>
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6'>
        {/* 뒤로가기 버튼 */}
        <div className='mb-4'>
          <button
            onClick={() => router.push('/')}
            className='inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-3 transition-colors'
          >
            <ArrowLeft className='h-4 w-4 mr-1' />
            뒤로가기
          </button>
        </div>

        {/* 통합 카드 */}
        <div className='card'>
          <div className='p-4 sm:p-5'>
            {/* 헤더 */}
            <div className='mb-4'>
              <div className='flex items-center justify-between mb-2'>
                <h1 className='text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
                  <Key className='h-6 w-6 sm:h-8 sm:w-8' />내 API 키 관리
                </h1>
                <button
                  onClick={() =>
                    setIsTokenSectionExpanded(!isTokenSectionExpanded)
                  }
                  className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
                  aria-label={isTokenSectionExpanded ? '접기' : '펼치기'}
                >
                  {isTokenSectionExpanded ? (
                    <ChevronUp className='h-5 w-5' />
                  ) : (
                    <ChevronDown className='h-5 w-5' />
                  )}
                </button>
              </div>
              <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
                OpenAI 호환 API를 사용하기 위한 개인 API 키를 관리합니다
              </p>
            </div>

            {/* 접기/펼치기 가능한 내용 */}
            {isTokenSectionExpanded && (
              <>
                {/* 안내 메시지 */}
                <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 sm:p-4 mb-4'>
                  <div className='flex items-start gap-3'>
                    <AlertCircle className='h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5' />
                    <div className='flex-1 text-sm text-blue-800 dark:text-blue-200'>
                      <p className='font-semibold mb-1.5'>API 키 사용 안내</p>
                      <ul className='space-y-1 text-blue-700 dark:text-blue-300'>
                        <li className='flex items-start gap-2'>
                          <span className='text-blue-500 mt-1'>•</span>
                          <span>
                            발급된 키는 OpenAI 호환 API 엔드포인트에서 사용할
                            수 있습니다
                          </span>
                        </li>
                        <li className='flex items-start gap-2'>
                          <span className='text-blue-500 mt-1'>•</span>
                          <span>
                            키가 유출된 경우 즉시 삭제하고 새 키를
                            발급하세요
                          </span>
                        </li>
                        <li className='flex items-start gap-2'>
                          <span className='text-blue-500 mt-1'>•</span>
                          <span>
                            사용량은 자동으로 추적되며, 외부 API 로깅 페이지에서
                            확인할 수 있습니다
                          </span>
                        </li>
                        <li className='flex items-start gap-2'>
                          <span className='text-blue-500 mt-1'>•</span>
                          <span>
                            <strong>1인당 1개의 키만</strong> 발급할 수 있습니다.
                            새 키가 필요하면 기존 키를 삭제하세요
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 키 목록 */}
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
                    내 키 목록
                    <span className='text-sm font-normal text-gray-500 dark:text-gray-400'>
                      ({totalCount.toLocaleString()})
                    </span>
                  </h2>
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={fetchTokens}
                      disabled={loading}
                      className='btn-secondary flex items-center gap-2 text-sm'
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                      />
                      새로고침
                    </button>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      disabled={tokens.some((t) => t.isActive)}
                      className='btn-primary flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                      title={tokens.some((t) => t.isActive) ? '이미 활성 키가 있습니다. 기존 키를 삭제한 후 새 키를 발급하세요.' : '새 키 발급'}
                    >
                      <Plus className='h-4 w-4' />
                      키 발급
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className='flex items-center justify-center py-8'>
                    <RefreshCw className='h-6 w-6 animate-spin text-gray-400' />
                  </div>
                ) : tokens.length === 0 ? (
                  <div className='text-center py-8'>
                    <div className='inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-3'>
                      <Key className='h-8 w-8 text-gray-400' />
                    </div>
                    <p className='text-gray-600 dark:text-gray-400 mb-1.5 font-medium'>
                      발급된 키가 없습니다
                    </p>
                    <p className='text-sm text-gray-500 dark:text-gray-500 mb-4'>
                      첫 번째 API 키를 발급하여 시작하세요
                    </p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className='btn-primary inline-flex items-center gap-2'
                    >
                      <Plus className='h-4 w-4' />첫 키 발급하기
                    </button>
                  </div>
                ) : (
                  <div className='space-y-2'>
                    {tokens.map((token) => (
                      <div
                        key={token._id}
                        className='border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all'
                      >
                        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-start gap-3 mb-2'>
                              <div className='flex-shrink-0 mt-0.5'>
                                <Key className='h-5 w-5 text-gray-400' />
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='flex flex-wrap items-center gap-2 mb-1.5'>
                                  <span className='font-semibold text-gray-900 dark:text-white'>
                                    {token.name || '이름 없음'}
                                  </span>
                                  {token.isActive ? (
                                    <span className='px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-md text-xs font-medium'>
                                      활성
                                    </span>
                                  ) : (
                                    <span className='px-2 py-0.5 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-md text-xs font-medium'>
                                      비활성
                                    </span>
                                  )}
                                  {isExpired(token.expiresAt) && (
                                    <span className='px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-xs font-medium'>
                                      만료됨
                                    </span>
                                  )}
                                </div>
                                <div className='space-y-1.5 text-sm text-gray-600 dark:text-gray-400'>
                                  <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                                    <div className='flex items-center gap-1.5'>
                                      <Calendar className='h-3.5 w-3.5' />
                                      <span className='text-xs'>
                                        발급: {formatDate(token.createdAt)}
                                      </span>
                                    </div>
                                    {token.expiresAt && (
                                      <div className='flex items-center gap-1.5'>
                                        <Calendar className='h-3.5 w-3.5' />
                                        <span className='text-xs'>
                                          만료: {formatDate(token.expiresAt)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
                                    <div className='flex items-center gap-1.5'>
                                      <Zap className='h-3.5 w-3.5' />
                                      <span className='text-xs'>
                                        사용량:{' '}
                                        <strong>
                                          {token.usage?.requestCount || 0}회
                                        </strong>
                                        {token.usage?.totalTokens && (
                                          <>
                                            {' '}
                                            /{' '}
                                            <strong>
                                              {(
                                                token.usage.totalTokens / 1000
                                              ).toFixed(1)}
                                              K
                                            </strong>{' '}
                                            키
                                          </>
                                        )}
                                      </span>
                                    </div>
                                    {token.usage?.lastUsed && (
                                      <span className='text-xs text-gray-500 dark:text-gray-500'>
                                        마지막 사용:{' '}
                                        {formatDate(token.usage.lastUsed)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className='flex items-center gap-2 sm:flex-shrink-0'>
                            <button
                              onClick={() => {
                                setSelectedToken(token);
                                setShowTokenInfoModal(true);
                              }}
                              className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
                              title='키 정보 보기'
                            >
                              <Eye className='h-4 w-4' />
                            </button>
                            <button
                              onClick={() =>
                                toggleTokenStatus(token._id, token.isActive)
                              }
                              className={`p-2 rounded-md transition-colors ${
                                token.isActive
                                  ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                              onClick={() => deleteToken(token._id)}
                              className='p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors'
                              title='삭제'
                            >
                              <Trash2 className='h-4 w-4' />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className='flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700'>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className='btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      이전
                    </button>
                    <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className='btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

                {/* 키 발급 모달 */}
        {showCreateModal && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
            {/* 배경 오버레이 */}
            <div
              className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
              onClick={() => setShowCreateModal(false)}
            />
            {/* 모달 내용 */}
            <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='text-xl font-semibold text-gray-900 dark:text-white'>
                  새 API 키 발급
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setTokenName('');
                  }}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='space-y-5'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    키 이름{' '}
                    <span className='text-gray-500 text-xs'>(선택사항)</span>
                  </label>
                  <input
                    type='text'
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder='예: 프로덕션 API 키'
                    className='input-primary w-full'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    만료 기간 (일)
                  </label>
                  <input
                    type='number'
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                    min='1'
                    max='365'
                    className='input-primary w-full'
                  />
                  <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
                    1일부터 365일까지 설정 가능합니다
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-3 mt-6'>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setTokenName('');
                  }}
                  className='btn-secondary flex-1'
                >
                  취소
                </button>
                <button onClick={createToken} className='btn-primary flex-1'>
                  발급
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 발급된 키 표시 모달 */}
        {showTokenModal && newToken && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
            {/* 배경 오버레이 */}
            <div
              className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
              onClick={() => {
                setShowTokenModal(false);
                setNewToken(null);
              }}
            />
            {/* 모달 내용 */}
            <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6'>
              <div className='flex items-center justify-between mb-6'>
                <div className='flex items-center gap-2'>
                  <CheckCircle className='h-6 w-6 text-green-500' />
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-white'>
                    키가 발급되었습니다
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowTokenModal(false);
                    setNewToken(null);
                  }}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='mb-5'>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  API 키
                </label>
                <div className='flex items-center gap-2'>
                  <input
                    type='text'
                    value={newToken}
                    readOnly
                    className='flex-1 input-primary font-mono text-sm'
                  />
                  <button
                    onClick={() => copyToken(newToken, 'newToken')}
                    className='btn-primary flex items-center gap-2 whitespace-nowrap'
                  >
                    <Copy className='h-4 w-4' />
                    복사
                  </button>
                </div>
              </div>

              <div className='mb-6'>
                <div className='flex items-center justify-between mb-2'>
                  <p className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    사용 예시:
                  </p>
                  <button
                    onClick={() => {
                      const curlExample = apiCurlExample.trim()
                        ? replacePlaceholders(apiCurlExample, newToken)
                        : getDefaultCurlExample(newToken);
                      copyToClipboard(curlExample, 'newTokenCurl');
                    }}
                    className='btn-secondary flex items-center gap-2 text-xs'
                  >
                    {copiedStates.newTokenCurl ? (
                      <Check className='h-3 w-3 text-green-600' />
                    ) : (
                      <Copy className='h-3 w-3' />
                    )}
                    예시 복사
                  </button>
                </div>
                <div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
                  <pre className='text-xs font-mono text-gray-900 dark:text-gray-100 overflow-x-auto whitespace-pre-wrap'>
                    {apiCurlExample.trim()
                      ? replacePlaceholders(apiCurlExample, newToken)
                      : getDefaultCurlExample(newToken)}
                  </pre>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowTokenModal(false);
                  setNewToken(null);
                }}
                className='btn-primary w-full'
              >
                확인
              </button>
            </div>
          </div>
        )}

        {/* 키 정보 보기 모달 */}
        {showTokenInfoModal && selectedToken && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4'>
            {/* 배경 오버레이 */}
            <div
              className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
              onClick={() => {
                setShowTokenInfoModal(false);
                setSelectedToken(null);
              }}
            />
            {/* 모달 내용 */}
            <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto'>
              <div className='flex items-center justify-between mb-6'>
                <div className='flex items-center gap-2'>
                  <Key className='h-5 w-5 text-gray-600 dark:text-gray-400' />
                  <h3 className='text-xl font-semibold text-gray-900 dark:text-white'>
                    API 키 정보
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowTokenInfoModal(false);
                    setSelectedToken(null);
                  }}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors'
                >
                  <X className='h-5 w-5' />
                </button>
              </div>

              <div className='space-y-5'>
                {/* 키 이름 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    키 이름
                  </label>
                  <div className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'>
                    {selectedToken.name || '이름 없음'}
                  </div>
                </div>

                {/* 키 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    API 키
                  </label>
                  {selectedToken.originalToken ? (
                    <>
                      <div className='flex items-center gap-2'>
                        <input
                          type='text'
                          value={selectedToken.originalToken}
                          readOnly
                          className='flex-1 input-primary font-mono text-sm'
                        />
                        <button
                          onClick={() =>
                            copyToken(
                              selectedToken.originalToken,
                              'selectedToken'
                            )
                          }
                          className='btn-primary flex items-center gap-2 whitespace-nowrap'
                        >
                          <Copy className='h-4 w-4' />
                          복사
                        </button>
                      </div>
                      <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mt-2'>
                        <div className='flex items-start gap-2'>
                          <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5' />
                          <p className='text-xs text-green-800 dark:text-green-200'>
                            키가 표시됩니다. 유출되지 않게 조심해주세요.
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm'>
                      키를 사용할 수 없습니다. 키를 재발급해주세요.
                    </div>
                  )}
                </div>

                {/* 상태 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    상태
                  </label>
                  <div className='flex flex-wrap items-center gap-2'>
                    {selectedToken.isActive ? (
                      <span className='px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-md text-sm font-medium'>
                        활성
                      </span>
                    ) : (
                      <span className='px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-md text-sm font-medium'>
                        비활성
                      </span>
                    )}
                    {isExpired(selectedToken.expiresAt) && (
                      <span className='px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-md text-sm font-medium'>
                        만료됨
                      </span>
                    )}
                  </div>
                </div>

                {/* 발급/만료 날짜 */}
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      발급일
                    </label>
                    <div className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm'>
                      {formatDate(selectedToken.createdAt)}
                    </div>
                  </div>
                  {selectedToken.expiresAt && (
                    <div>
                      <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                        만료일
                      </label>
                      <div className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm'>
                        {formatDate(selectedToken.expiresAt)}
                      </div>
                    </div>
                  )}
                </div>

                {/* 사용량 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    사용량
                  </label>
                  <div className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm'>
                    <div className='flex flex-wrap items-center gap-4'>
                      <span>
                        요청:{' '}
                        <strong>
                          {selectedToken.usage?.requestCount || 0}회
                        </strong>
                      </span>
                      <span>
                        키:{' '}
                        <strong>
                          {selectedToken.usage?.totalTokens
                            ? `${(
                                selectedToken.usage.totalTokens / 1000
                              ).toFixed(1)}K`
                            : '0'}
                        </strong>
                      </span>
                    </div>
                    {selectedToken.usage?.lastUsed && (
                      <div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                        마지막 사용: {formatDate(selectedToken.usage.lastUsed)}
                      </div>
                    )}
                  </div>
                </div>

                {/* 사용 예시 */}
                <div>
                  <div className='flex items-center justify-between mb-2'>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                      사용 예시
                    </label>
                    <button
                      onClick={() => {
                        const tokenValue = selectedToken.originalToken || '{{KEY}}';
                        const curlExample = apiCurlExample.trim()
                          ? replacePlaceholders(apiCurlExample, tokenValue)
                          : getDefaultCurlExample(tokenValue);
                        copyToClipboard(curlExample, 'tokenInfoCurl');
                      }}
                      className='btn-secondary flex items-center gap-2 text-xs'
                      disabled={!selectedToken.originalToken}
                      title={
                        selectedToken.originalToken
                          ? '예시 복사'
                          : '키가 없어서 복사할 수 없습니다.'
                      }
                    >
                      {copiedStates.tokenInfoCurl ? (
                        <Check className='h-3 w-3 text-green-600' />
                      ) : (
                        <Copy className='h-3 w-3' />
                      )}
                      예시 복사
                    </button>
                  </div>
                  <div className='bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700'>
                    <pre className='text-xs font-mono text-gray-900 dark:text-gray-100 overflow-x-auto whitespace-pre-wrap'>
                      {apiCurlExample.trim()
                        ? replacePlaceholders(apiCurlExample, selectedToken.originalToken || '{{KEY}}')
                        : getDefaultCurlExample(selectedToken.originalToken || '{{KEY}}')}
                    </pre>
                  </div>
                </div>
              </div>

              <div className='mt-6 flex justify-end'>
                <button
                  onClick={() => {
                    setShowTokenInfoModal(false);
                    setSelectedToken(null);
                  }}
                  className='btn-primary'
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OpenAI 호환 프록시 API 안내 섹션 */}
        <div className='mt-6 sm:mt-8'>
          <div className='card'>
            <div className='p-4 sm:p-5'>
              {/* 헤더 */}
              <div className='mb-4'>
                <div className='flex items-center justify-between mb-2'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
                    <Zap className='h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400' />
                    OpenAI 호환 프록시 API
                  </h2>
                  <button
                    onClick={() =>
                      setIsApiSectionExpanded(!isApiSectionExpanded)
                    }
                    className='p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
                    aria-label={isApiSectionExpanded ? '접기' : '펼치기'}
                  >
                    {isApiSectionExpanded ? (
                      <ChevronUp className='h-5 w-5' />
                    ) : (
                      <ChevronDown className='h-5 w-5' />
                    )}
                  </button>
                </div>
                <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
                  VSCode Continue와 호환되는 OpenAI 호환 API 프록시
                </p>
              </div>

              {/* 접기/펼치기 가능한 내용 */}
              {isApiSectionExpanded && (
                <div className='space-y-4'>
                  {/* 단일 통합 API */}
                  <div className='border-2 border-green-200 dark:border-green-800 rounded-lg p-4 sm:p-5'>
                    <div className='flex items-start gap-3 mb-4'>
                      <div className='flex-shrink-0'>
                        <Zap className='h-6 w-6 text-green-600 dark:text-green-400' />
                      </div>
                      <div className='flex-1'>
                        <h3 className='text-lg font-semibold text-green-800 dark:text-green-200 mb-1'>
                          단일 통합 API
                        </h3>
                        <p className='text-sm text-gray-600 dark:text-gray-400'>
                          OpenAI API 호환 형식
                        </p>
                      </div>
                    </div>

                    <div className='bg-green-50 dark:bg-green-900/20 p-3 rounded-lg mb-4'>
                      <h4 className='font-semibold text-green-900 dark:text-green-100 mb-2 text-sm'>
                        주요 특징
                      </h4>
                      <ul className='text-sm text-green-800 dark:text-green-200 space-y-1.5'>
                        <li className='flex items-start gap-2'>
                          <span className='text-green-600 mt-0.5'>🎯</span>
                          <span>
                            <strong>표준 호환:</strong> OpenAI API 표준 형식
                            지원
                          </span>
                        </li>
                        <li className='flex items-start gap-2'>
                          <span className='text-green-600 mt-0.5'>🔗</span>
                          <span>
                            <strong>호환성:</strong> VSCode Continue 및 OpenAI
                            호환 클라이언트(IDE) 지원
                          </span>
                        </li>
                      </ul>
                    </div>

                    <div className='space-y-3'>
                      <div>
                        <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    API 키 선택 <span className='text-red-500'>*</span>
                        </label>
                        <select
                          value={
                            tokens.find(
                              (t) => t.originalToken === selectedApiToken
                            )?._id || ''
                          }
                          onChange={(e) => {
                            const selectedToken = tokens.find(
                              (t) => t._id === e.target.value
                            );
                            setSelectedApiToken(
                              selectedToken?.originalToken || ''
                            );
                          }}
                          className='input-primary w-full text-sm mb-2'
                        >
                      <option value=''>키 선택</option>
                          {tokens
                            .filter(
                              (token) =>
                                token.isActive && !isExpired(token.expiresAt)
                            )
                            .map((token) => (
                              <option key={token._id} value={token._id}>
                                {token.name || '이름 없음'}{' '}
                                {token.originalToken
                            ? '(키 사용 가능)'
                                  : '(재발급 필요)'}
                              </option>
                            ))}
                        </select>
                        <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        발급된 키를 선택해서 사용하세요. 없으면 키를
                          재발급하세요.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* VSCode Continue 설정 */}
                  <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5'>
                    <div className='flex items-start gap-3 mb-4'>
                      <div className='flex-shrink-0'>
                        <ExternalLink className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                      </div>
                      <div className='flex-1'>
                        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                          VSCode Continue 설정
                        </h3>
                      </div>
                    </div>

                    <div className='bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border-l-4 border-yellow-500 mb-4'>
                      <div className='flex items-start gap-2'>
                        <AlertCircle className='h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5' />
                        <p className='text-sm text-yellow-800 dark:text-yellow-200'>
                          <strong>주의:</strong> VSCode Continue에서도 API
                        키가 필수입니다. 위의 단일 통합 API 섹션에서 키를
                          선택하세요.
                        </p>
                      </div>
                    </div>

                    <div className='space-y-3'>
                      <div className='flex items-center justify-between'>
                        <h4 className='font-semibold text-gray-900 dark:text-white text-sm'>
                          config 설정 예시
                        </h4>
                        <button
                          onClick={() => {
                            const configText = buildConfigPresetText();
                            copyToClipboard(configText, 'config');
                          }}
                          className='btn-secondary flex items-center gap-2 text-sm'
                        >
                          {copiedStates.config ? (
                            <Check className='h-4 w-4 text-green-600' />
                          ) : (
                            <Copy className='h-4 w-4' />
                          )}
                          예시 복사
                        </button>
                      </div>

                      <div className='bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto'>
                        <pre className='text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap'>
                          {buildConfigPresetText()}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* API 테스트 (curl) */}
                  <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-4 sm:p-5'>
                    <div className='flex items-center gap-2 mb-2'>
                      <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                        API 테스트 (curl)
                      </h3>
                      <span className='px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium'>
                        Windows
                      </span>
                    </div>
                    <p className='text-sm text-gray-600 dark:text-gray-400 mb-3'>
                        API 키가 필수입니다. 위에서 키를 선택하세요.
                    </p>

                    <div className='bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border-l-4 border-yellow-500 mb-4'>
                      <div className='flex items-start gap-2'>
                        <AlertCircle className='h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5' />
                        <p className='text-sm text-yellow-800 dark:text-yellow-200'>
                          <strong>주의:</strong> 모든 API 호출에는 Authorization
                        헤더에 유효한 API 키가 필요합니다.
                        </p>
                      </div>
                    </div>

                    <div>
                      <div>
                        <div className='flex items-center justify-between mb-2'>
                          <h5 className='font-medium text-gray-900 dark:text-white text-sm'>
                            /v1/chat/completions 테스트
                          </h5>
                          <button
                            onClick={() => {
                              const curlText = buildCurlExampleText();
                              copyToClipboard(curlText, 'curlTest');
                            }}
                            className='btn-secondary flex items-center gap-2 text-xs'
                          >
                            {copiedStates.curlTest ? (
                              <Check className='h-3 w-3 text-green-600' />
                            ) : (
                              <Copy className='h-3 w-3' />
                            )}
                            복사
                          </button>
                        </div>
                        <div className='bg-gray-900 dark:bg-black text-green-400 p-3 rounded-lg border border-gray-700 text-xs font-mono overflow-x-auto'>
                          <pre className='whitespace-pre-wrap'>{buildCurlExampleText()}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 에러 모달 */}
      <AlertModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '', type: 'error' })}
        title={errorModal.title}
        message={errorModal.message}
        type={errorModal.type}
      />

      {/* 성공 모달 */}
      <AlertModal
        isOpen={successModal.isOpen}
        onClose={() => setSuccessModal({ isOpen: false, title: '', message: '', type: 'success' })}
        title={successModal.title}
        message={successModal.message}
        type={successModal.type}
      />

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ 
          isOpen: false, 
          title: '', 
          message: '', 
          type: 'warning', 
          onConfirm: null,
          confirmText: '확인',
          cancelText: '취소'
        })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText || '확인'}
        cancelText={confirmModal.cancelText || '취소'}
      />
    </div>
  );
}
