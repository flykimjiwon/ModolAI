'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react';

function prettyJson(value) {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export default function AdminPiiTestPage() {
  const [text, setText] = useState('홍길동 주민번호 900101-1234567, 연락처 010-1234-5678');
  const [endpoint, setEndpoint] = useState('');
  const [txtVrf, setTxtVrf] = useState(true);
  const [maskOpt, setMaskOpt] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const verdict = useMemo(() => {
    if (!result) return null;
    if (result.success) {
      return {
        icon: <CheckCircle2 className='w-5 h-5 text-green-600' />,
        title: '호출 성공',
        tone: 'text-green-700 dark:text-green-300',
      };
    }
    return {
      icon: <AlertTriangle className='w-5 h-5 text-red-600' />,
      title: '호출 실패',
      tone: 'text-red-700 dark:text-red-300',
    };
  }, [result]);

  const handleTest = async () => {
    setLoading(true);
    setError('');

    const clientRequest = {
      text,
      endpoint,
      txtVrf,
      mxtVrf: txtVrf,
      maskOpt,
    };

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/pii-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(clientRequest),
      });

      const raw = await res.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        const parsedError = {
          success: false,
          error: `응답 파싱 실패 (${res.status})`,
          diagnostics: {
            reasonMessage: '서버가 JSON이 아닌 응답을 반환했습니다.',
          },
          rawResponse: raw,
        };
        setResult({
          ...parsedError,
          httpStatus: res.status,
          httpOk: res.ok,
          receivedAt: new Date().toISOString(),
          clientRequest,
        });
        setError(parsedError.error);
        return;
      }

      const merged = {
        ...data,
        httpStatus: res.status,
        httpOk: res.ok,
        receivedAt: new Date().toISOString(),
        clientRequest,
      };

      setResult(merged);
      if (!res.ok || !data.success) {
        setError(data.error || `PII 테스트 실패 (${res.status})`);
      }
    } catch (e) {
      setError(e.message || '요청 실패');
      setResult({
        success: false,
        error: e.message || '요청 실패',
        diagnostics: {
          reasonMessage: '브라우저에서 API 호출 자체가 실패했습니다.',
        },
        clientRequest,
        receivedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>PII 호출 테스트</h1>
        <p className='text-sm text-gray-600 dark:text-gray-300 mt-1'>
          detectPII 호출의 요청/응답/로그를 한 번에 확인해 실패 원인과 성공 근거를 진단합니다.
        </p>
      </div>

      <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4'>
        <div>
          <label className='block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300'>
            Endpoint (비우면 서버 환경변수 사용)
          </label>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder='http://techai-api-prod.shinhan.com/api/v1/validate/detectPII'
            className='w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
          />
        </div>

        <div>
          <label className='block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300'>
            원문 텍스트
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className='w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
          />
        </div>

        <div className='flex flex-wrap gap-4'>
          <label className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
            <input
              type='checkbox'
              checked={txtVrf}
              onChange={(e) => setTxtVrf(e.target.checked)}
            />
            txt_vrf (호환용 mxt_vrf 동시 전달)
          </label>
          <label className='flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300'>
            <input
              type='checkbox'
              checked={maskOpt}
              onChange={(e) => setMaskOpt(e.target.checked)}
            />
            mask_opt
          </label>
        </div>

        <button
          onClick={handleTest}
          disabled={loading}
          className='px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center gap-2'
        >
          {loading ? (
            <>
              <RefreshCw className='w-4 h-4 animate-spin' />
              호출 중...
            </>
          ) : (
            'PII 호출 테스트'
          )}
        </button>

        {error && <div className='text-sm text-red-600 dark:text-red-400'>{error}</div>}
      </div>

      {result && (
        <div className='space-y-4'>
          <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3'>
            <div className='flex items-center gap-2'>
              {verdict?.icon || <Info className='w-5 h-5 text-blue-600' />}
              <span className={`font-semibold ${verdict?.tone || 'text-gray-800 dark:text-gray-200'}`}>
                {verdict?.title || '호출 결과'}
              </span>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm'>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                <div className='text-gray-500'>HTTP 상태</div>
                <div className='font-semibold text-gray-900 dark:text-gray-100'>
                  {result.httpStatus ?? result.diagnostics?.statusCode ?? '-'}
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                <div className='text-gray-500'>호출 시간</div>
                <div className='font-semibold text-gray-900 dark:text-gray-100'>
                  {result.diagnostics?.durationMs ?? '-'} ms
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                <div className='text-gray-500'>Reason Code</div>
                <div className='font-semibold text-gray-900 dark:text-gray-100 break-all'>
                  {result.diagnostics?.reasonCode || '-'}
                </div>
              </div>
              <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                <div className='text-gray-500'>Endpoint Source</div>
                <div className='font-semibold text-gray-900 dark:text-gray-100'>
                  {result.diagnostics?.endpointSource || '-'}
                </div>
              </div>
            </div>

            <div className='text-sm text-gray-700 dark:text-gray-300'>
              <strong>판정 메시지:</strong>{' '}
              {result.diagnostics?.reasonMessage || result.error || '결과 메시지 없음'}
            </div>
            <div className='text-xs text-gray-500 dark:text-gray-400'>
              시작: {formatDateTime(result.diagnostics?.startedAt)} / 종료:{' '}
              {formatDateTime(result.diagnostics?.finishedAt)} / 수신:{' '}
              {formatDateTime(result.receivedAt)}
            </div>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-2 gap-4'>
            <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2'>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100'>요청 Payload</h3>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                Swagger 표기(txt_vrf)와 호환 필드(mxt_vrf)를 함께 보여줍니다.
              </p>

              <div>
                <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>request</div>
                <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.request)}
                </pre>
              </div>

              <div>
                <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>compatibilityRequest</div>
                <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.compatibilityRequest)}
                </pre>
              </div>

              <div>
                <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>clientRequest</div>
                <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.clientRequest)}
                </pre>
              </div>
            </div>

            <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2'>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100'>응답 Result</h3>
              <div className='grid grid-cols-2 gap-2 text-sm'>
                <div className='rounded bg-gray-50 dark:bg-gray-900 p-2'>
                  <span className='text-gray-500'>detected</span>
                  <div className='font-semibold text-gray-900 dark:text-gray-100'>
                    {String(result.result?.detected ?? '-')}
                  </div>
                </div>
                <div className='rounded bg-gray-50 dark:bg-gray-900 p-2'>
                  <span className='text-gray-500'>detectedCnt</span>
                  <div className='font-semibold text-gray-900 dark:text-gray-100'>
                    {result.result?.detectedCnt ?? '-'}
                  </div>
                </div>
                <div className='rounded bg-gray-50 dark:bg-gray-900 p-2'>
                  <span className='text-gray-500'>skipped</span>
                  <div className='font-semibold text-gray-900 dark:text-gray-100'>
                    {String(result.result?.skipped ?? '-')}
                  </div>
                </div>
                <div className='rounded bg-gray-50 dark:bg-gray-900 p-2'>
                  <span className='text-gray-500'>statusCode</span>
                  <div className='font-semibold text-gray-900 dark:text-gray-100'>
                    {result.result?.statusCode ?? '-'}
                  </div>
                </div>
              </div>

              <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.result)}
              </pre>
            </div>
          </div>

          <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3'>
            <h3 className='font-semibold text-gray-900 dark:text-gray-100'>로그 상세 (external_api_logs)</h3>

            {result.log?.lookupError ? (
              <div className='text-sm text-yellow-700 dark:text-yellow-300'>
                로그 조회 실패: {result.log.lookupError}
              </div>
            ) : result.log ? (
              <>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm'>
                  <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                    <div className='text-gray-500'>Log ID</div>
                    <div className='font-semibold text-gray-900 dark:text-gray-100 break-all'>
                      {result.log.id}
                    </div>
                  </div>
                  <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                    <div className='text-gray-500'>Status Code</div>
                    <div className='font-semibold text-gray-900 dark:text-gray-100'>
                      {result.log.statusCode ?? '-'}
                    </div>
                  </div>
                  <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                    <div className='text-gray-500'>Response Time</div>
                    <div className='font-semibold text-gray-900 dark:text-gray-100'>
                      {result.log.responseTimeMs ?? '-'} ms
                    </div>
                  </div>
                  <div className='rounded-lg bg-gray-50 dark:bg-gray-900 p-3'>
                    <div className='text-gray-500'>Logged At</div>
                    <div className='font-semibold text-gray-900 dark:text-gray-100'>
                      {formatDateTime(result.log.timestamp)}
                    </div>
                  </div>
                </div>

                {result.log.error && (
                  <div className='text-sm text-red-600 dark:text-red-400'>
                    로그 에러 메시지: {result.log.error}
                  </div>
                )}

                <details className='rounded-lg border border-gray-200 dark:border-gray-700 p-3'>
                  <summary className='cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-200'>
                    requestBody / responseBody / headers 보기
                  </summary>
                  <div className='grid grid-cols-1 xl:grid-cols-2 gap-3 mt-3'>
                    <div>
                      <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>
                        requestBody
                      </div>
                      <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.log.requestBody)}
                      </pre>
                    </div>
                    <div>
                      <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>
                        responseBody
                      </div>
                      <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.log.responseBody)}
                      </pre>
                    </div>
                    <div>
                      <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>
                        requestHeaders
                      </div>
                      <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.log.requestHeaders)}
                      </pre>
                    </div>
                    <div>
                      <div className='text-xs font-medium text-gray-600 dark:text-gray-300 mb-1'>
                        responseHeaders
                      </div>
                      <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result.log.responseHeaders)}
                      </pre>
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <div className='text-sm text-gray-600 dark:text-gray-300'>
                이번 호출에 해당하는 로그를 아직 찾지 못했습니다.
              </div>
            )}
          </div>

          <div className='bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4'>
            <h3 className='font-semibold text-gray-900 dark:text-gray-100 mb-2'>원본 API 응답(JSON)</h3>
            <pre className='text-xs overflow-auto p-3 rounded bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200'>
{prettyJson(result)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
