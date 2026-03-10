'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

function formatMatchedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '-';
  }
  return files.join(', ');
}

function EnvValueCard({ label, value }) {
  return (
    <div className='rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-4'>
      <div className='text-xs text-gray-500 dark:text-gray-400'>{label}</div>
      <div className='mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 break-all'>
        {value || '-'}
      </div>
    </div>
  );
}

export default function AdminEnvPage() {
  const { alert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const badge = useMemo(() => {
    if (!result?.success) {
      return {
        tone: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20',
        icon: <TriangleAlert className='w-4 h-4' />,
        text: '환경 점검 실패',
      };
    }

    return {
      tone: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20',
      icon: <ShieldCheck className='w-4 h-4' />,
      text: '환경 점검 성공',
    };
  }, [result]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/env', {
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
        throw new Error(data.error || `환경 변수 점검 실패 (${response.status})`);
      }

      setResult(data);
    } catch (fetchError) {
      const message = fetchError.message || '환경 변수 점검 실패';
      setError(message);
      alert(message, 'error', '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className='space-y-6'>
      <div className='card p-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-xl font-semibold text-gray-900 dark:text-white'>
              ENV 변수 확인
            </h1>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              현재 런타임에서 사용 중인 <code>POSTGRES_URI</code>와{' '}
              <code>NODE_ENV</code>, 그리고 값이 일치하는 <code>.env*</code>
              파일 후보를 확인합니다.
            </p>
          </div>

          <button
            type='button'
            onClick={loadData}
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
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${badge.tone}`}
        >
          {badge.icon}
          <span>{badge.text}</span>
        </div>

        {error && (
          <div className='rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-sm text-red-700 dark:text-red-300'>
            {error}
          </div>
        )}

        {result?.success && (
          <>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              <EnvValueCard
                label='NODE_ENV (runtime)'
                value={result.runtime?.nodeEnv}
              />
              <EnvValueCard
                label='POSTGRES_URI (runtime)'
                value={result.runtime?.postgresUri}
              />
            </div>

            <div className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
              <div className='px-4 py-2 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-800 dark:text-gray-200'>
                일치 파일 후보
              </div>
              <div className='p-4 space-y-2 text-sm'>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>NODE_ENV 후보</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {formatMatchedFiles(result.envFiles?.nodeEnvMatchedFiles)}
                  </div>
                </div>
                <div>
                  <span className='text-gray-500 dark:text-gray-400'>POSTGRES_URI 후보</span>
                  <div className='text-gray-900 dark:text-gray-100 break-all'>
                    {formatMatchedFiles(result.envFiles?.postgresUriMatchedFiles)}
                  </div>
                </div>
                <div className='text-xs text-gray-500 dark:text-gray-400 pt-1'>
                  {result.envFiles?.caveat}
                </div>
              </div>
            </div>

            <div className='rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
              <div className='px-4 py-2 bg-gray-50 dark:bg-gray-800/60 text-sm font-semibold text-gray-800 dark:text-gray-200'>
                점검한 .env 파일
              </div>

              <div className='p-4 space-y-3 text-sm'>
                <div className='rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900/40'>
                  <div className='text-xs text-gray-500 dark:text-gray-400'>프로젝트 루트</div>
                  <div className='mt-1 font-medium text-gray-900 dark:text-gray-100 break-all'>
                    {result.envFiles?.projectRoot || '-'}
                  </div>
                </div>

                <div className='overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md'>
                  <table className='min-w-full text-xs'>
                    <thead className='bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300'>
                      <tr>
                        <th className='px-3 py-2 text-left'>파일명</th>
                        <th className='px-3 py-2 text-left'>존재</th>
                        <th className='px-3 py-2 text-left'>NODE_ENV</th>
                        <th className='px-3 py-2 text-left'>POSTGRES_URI</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100 dark:divide-gray-800'>
                      {(result.envFiles?.snapshots || []).map((item) => (
                        <tr key={item.fileName}>
                          <td className='px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap'>
                            {item.fileName}
                          </td>
                          <td className='px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap'>
                            {item.exists ? 'YES' : 'NO'}
                          </td>
                          <td className='px-3 py-2 text-gray-700 dark:text-gray-300 break-all'>
                            {item.hasNodeEnv ? item.nodeEnvValue : '-'}
                          </td>
                          <td className='px-3 py-2 text-gray-700 dark:text-gray-300 break-all'>
                            {item.hasPostgresUri ? item.postgresUriValue : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
