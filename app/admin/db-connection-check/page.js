'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Database, RefreshCw, TriangleAlert } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }
  return Number(value).toLocaleString('ko-KR');
}

function describeRootCause(code) {
  switch (code) {
    case 'missing-connection-env':
      return 'POSTGRES_URI / DATABASE_URL 미설정';
    case 'configured-db-and-active-db-mismatch':
      return '환경변수 DB명과 실제 연결 DB명이 다름';
    case 'connected-to-expected-db-name':
      return 'DB명 기준으로는 modol 또는 modol_dev 연결';
    case 'unknown-db-name':
      return '예상 외 DB명으로 연결';
    default:
      return code || '-';
  }
}

export default function AdminDbConnectionCheckPage() {
  const { alert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const statusBadge = useMemo(() => {
    if (!result?.success) {
      return {
        tone: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20',
        icon: <TriangleAlert className='w-4 h-4' />,
        text: '점검 실패',
      };
    }

    if (result.connection?.isModol) {
      return {
        tone: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20',
        icon: <CheckCircle2 className='w-4 h-4' />,
        text: 'modol DB 연결',
      };
    }

    if (result.connection?.isModolDev) {
      return {
        tone:
          'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20',
        icon: <TriangleAlert className='w-4 h-4' />,
        text: 'modol_dev DB 연결',
      };
    }

    return {
      tone: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20',
      icon: <TriangleAlert className='w-4 h-4' />,
      text: '알 수 없는 DB 연결',
    };
  }, [result]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/db-connection-check', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const raw = await response.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`응답 파싱 실패 (${response.status})`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `DB 연결 확인 실패 (${response.status})`);
      }

      setResult(data);
    } catch (fetchError) {
      const message = fetchError.message || 'DB 연결 확인 실패';
      setError(message);
      alert(message, 'error', '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <div className='space-y-6'>
      <div className='card p-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-xl font-semibold text-gray-900 dark:text-white'>
              DB 연결 확인
            </h1>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              현재 컨테이너가 실제로 어떤 PostgreSQL 데이터베이스에 연결되어 있는지
              확인하는 관리자 진단 페이지입니다.
            </p>
          </div>
          <button
            type='button'
            onClick={loadStatus}
            disabled={loading}
            className='btn-primary text-sm px-3 py-1.5 inline-flex items-center gap-2 disabled:opacity-60'
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      <div className='card p-6 space-y-4'>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${statusBadge.tone}`}
        >
          {statusBadge.icon}
          <span>{statusBadge.text}</span>
        </div>

        {error && (
          <div className='rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>
            {error}
          </div>
        )}

        {result?.success && (
          <>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3'>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                <div className='text-xs text-gray-500 dark:text-gray-400'>활성 DB</div>
                <div className='mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 break-all'>
                  {result.connection?.activeDatabase || '-'}
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                <div className='text-xs text-gray-500 dark:text-gray-400'>환경변수 DB</div>
                <div className='mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 break-all'>
                  {result.connection?.configuredDatabase || '-'}
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                <div className='text-xs text-gray-500 dark:text-gray-400'>일치 여부</div>
                <div className='mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  {result.connection?.matchesConfiguredDatabase === true
                    ? '일치'
                    : result.connection?.matchesConfiguredDatabase === false
                      ? '불일치'
                      : '-'}
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                <div className='text-xs text-gray-500 dark:text-gray-400'>점검 시각(KST)</div>
                <div className='mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100'>
                  {formatDateTime(result.server?.checkedAtKst)}
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                <div className='text-xs text-gray-500 dark:text-gray-400'>연결 지문</div>
                <div className='mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100 break-all'>
                  {result.diagnostics?.connectionFingerprint || '-'}
                </div>
              </div>
            </div>

            <div className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
              <div className='px-4 py-2 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2'>
                <Database className='w-4 h-4' />
                연결 상세
              </div>
              <div className='p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm'>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>연결 소스</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.connection?.source || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>원인 추정</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {describeRootCause(result.diagnostics?.probableRootCause)}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>마스킹된 URI</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.connection?.configuredUriMasked || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>환경변수 Host:Port</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.connection?.configuredHost || '-'}
                    {result.connection?.configuredPort
                      ? `:${result.connection.configuredPort}`
                      : ''}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>환경변수 DB User</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.connection?.configuredUser || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>DB 사용자</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.server?.currentUser || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>스키마</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.server?.currentSchema || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>DB 서버 IP</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.server?.serverIp || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>DB 서버 Port</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.server?.serverPort || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>DB OID</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {formatNumber(result.server?.databaseOid)}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>Replica 여부</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.server?.isReplica === true
                      ? 'Replica'
                      : result.server?.isReplica === false
                        ? 'Primary'
                        : '-'}
                  </div>
                </div>
                <div className='md:col-span-2'>
                  <span className='text-gray-500 dark:text-gray-400'>DB 서버 버전</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.server?.serverVersion || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>NODE_ENV</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.env?.nodeEnv || '-'}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>APP_ENV</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {result.env?.appEnv || '-'}
                  </div>
                </div>
              </div>
            </div>

            <div className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
              <div className='px-4 py-2 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-800 dark:text-gray-200'>
                데이터 지표 비교
              </div>
              <div className='p-4 space-y-3 text-sm'>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  <div className='rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>Public 테이블 수</div>
                    <div className='mt-1 font-semibold text-gray-900 dark:text-gray-100'>
                      {formatNumber(result.server?.publicTableCount)}
                    </div>
                  </div>
                  <div className='rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>추정 전체 행 수</div>
                    <div className='mt-1 font-semibold text-gray-900 dark:text-gray-100'>
                      {formatNumber(result.server?.approxLiveRows)}
                    </div>
                  </div>
                  <div className='rounded-md bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3'>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>연결 지문</div>
                    <div className='mt-1 font-semibold text-gray-900 dark:text-gray-100 break-all'>
                      {result.diagnostics?.connectionFingerprint || '-'}
                    </div>
                  </div>
                </div>

                <div>
                  <div className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                    주요 테이블 추정 행 수
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'>
                    {Object.entries(result.stats?.keyTableApproxRows || {}).map(
                      ([tableName, approxRows]) => (
                        <div
                          key={tableName}
                          className='rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900/40'
                        >
                          <div className='text-xs text-gray-500 dark:text-gray-400'>
                            {tableName}
                          </div>
                          <div className='text-sm font-semibold text-gray-900 dark:text-gray-100'>
                            {formatNumber(approxRows)}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
              <div className='px-4 py-2 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-800 dark:text-gray-200'>
                환경변수 사용 현황
              </div>
              <div className='p-4 space-y-3 text-sm'>
                <div className='rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900/40'>
                  <div className='text-xs text-gray-500 dark:text-gray-400'>
                    DB 연결 결정
                  </div>
                  <div className='mt-1 font-semibold text-gray-900 dark:text-gray-100'>
                    {result.envUsage?.dbConnectionVariable || '-'}
                  </div>
                  <div className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    {result.envUsage?.dbConnectionSummary || '-'}
                  </div>
                </div>

                <div className='overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md'>
                  <table className='min-w-full text-xs'>
                    <thead className='bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300'>
                      <tr>
                        <th className='px-3 py-2 text-left'>변수명</th>
                        <th className='px-3 py-2 text-left'>설정 여부</th>
                        <th className='px-3 py-2 text-left'>미리보기</th>
                        <th className='px-3 py-2 text-left'>용도</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100 dark:divide-gray-800'>
                      {(result.env?.variables || []).map((item) => (
                        <tr key={item.key}>
                          <td className='px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap'>
                            {item.key}
                          </td>
                          <td className='px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap'>
                            {item.isSet ? 'SET' : 'UNSET'}
                          </td>
                          <td className='px-3 py-2 text-gray-700 dark:text-gray-300 break-all'>
                            {item.valuePreview || '-'}
                          </td>
                          <td className='px-3 py-2 text-gray-500 dark:text-gray-400 break-all'>
                            {item.usedFor || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className='rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 text-sm text-blue-900 dark:text-blue-200'>
              <div className='font-semibold'>판단 가이드</div>
              <ul className='mt-2 list-disc ml-5 space-y-1'>
                <li>
                  다른 환경(predev/prod)에서 이 페이지를 열어 연결 지문이 같으면 같은 DB를
                  보고 있을 가능성이 높습니다.
                </li>
                <li>
                  환경변수 DB와 활성 DB가 불일치하면 CI/K8s env 주입 순서나 `.env` 덮어쓰기를
                  먼저 확인하세요.
                </li>
                <li>
                  주요 테이블 행 수가 두 환경에서 완전히 동일하면 DB 분기 실패 또는 DB 복제
                  상태일 수 있습니다.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
