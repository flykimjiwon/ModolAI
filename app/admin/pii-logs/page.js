'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAlert } from '@/contexts/AlertContext';
import {
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  XCircle,
  Clock,
} from 'lucide-react';

function parseAssistantMeta(messages) {
  if (!Array.isArray(messages)) return null;
  const assistant = messages.find((item) => item?.role === 'assistant');
  if (!assistant?.content) return null;
  if (typeof assistant.content === 'object') return assistant.content;
  if (typeof assistant.content !== 'string') return null;
  try {
    return JSON.parse(assistant.content);
  } catch {
    return null;
  }
}

function getPiiMeta(log) {
  const responseBody =
    log?.responseBody && typeof log.responseBody === 'object'
      ? log.responseBody
      : null;
  const assistantMeta = parseAssistantMeta(log?.messages);
  const detected =
    responseBody?.detected === true || assistantMeta?.detected === true;
  const detectedCnt = Number(
    responseBody?.detected_cnt ??
      responseBody?.detectedCnt ??
      assistantMeta?.detectedCnt ??
      0
  );
  const maskedText =
    responseBody?.masked_text ||
    responseBody?.maskedText ||
    assistantMeta?.maskedTextPreview ||
    '';
  const reason = assistantMeta?.reason || log?.error || null;
  const skipped = assistantMeta?.reason ? true : false;
  const detectedList = Array.isArray(responseBody?.detected_list)
    ? responseBody.detected_list
    : [];
  return { detected, detectedCnt, maskedText, reason, skipped, detectedList };
}

function getOriginalText(log) {
  if (log?.requestBody?.original_text) return log.requestBody.original_text;
  if (Array.isArray(log?.messages)) {
    const user = log.messages.find((m) => m?.role === 'user');
    if (user?.content && typeof user.content === 'string') return user.content;
  }
  return '';
}

function StatusBadge({ meta }) {
  if (meta.skipped || meta.reason) {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'>
        <XCircle className='w-3 h-3' /> 실패
      </span>
    );
  }
  if (meta.detected) {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'>
        <ShieldAlert className='w-3 h-3' /> PII 검출
      </span>
    );
  }
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'>
      <ShieldCheck className='w-3 h-3' /> 정상
    </span>
  );
}

function LogDetail({ log, meta }) {
  const originalText = getOriginalText(log);
  const isFailed = meta.skipped || !!meta.reason;

  return (
    <div className='px-4 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 space-y-4'>
      <div>
        <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2'>
          입력 (Request)
        </div>
        <div className='flex gap-4 mb-2 text-xs'>
          <div className='flex gap-1.5'>
            <span className='text-gray-500'>mxt_vrf:</span>
            <span className='font-mono font-medium text-gray-800 dark:text-gray-200'>
              {String(log?.requestBody?.mxt_vrf ?? true)}
            </span>
          </div>
          <div className='flex gap-1.5'>
            <span className='text-gray-500'>mask_opt:</span>
            <span className='font-mono font-medium text-gray-800 dark:text-gray-200'>
              {String(log?.requestBody?.mask_opt ?? true)}
            </span>
          </div>
        </div>
        <div className='text-xs text-gray-500 mb-1'>original_text</div>
        <pre className='text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200 max-h-40 overflow-y-auto'>
          {originalText || '(없음)'}
        </pre>
      </div>

      {!isFailed && (
        <div>
          <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2'>
            응답 (Response)
          </div>
          <div className='flex gap-4 mb-2 text-xs'>
            <div className='flex gap-1.5'>
              <span className='text-gray-500'>detected:</span>
              <span
                className={`font-medium ${meta.detected ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}
              >
                {String(meta.detected)}
              </span>
            </div>
            <div className='flex gap-1.5'>
              <span className='text-gray-500'>detected_cnt:</span>
              <span className='font-mono font-medium text-gray-800 dark:text-gray-200'>
                {meta.detectedCnt}
              </span>
            </div>
          </div>

          {meta.maskedText && (
            <div className='mb-3'>
              <div className='text-xs text-gray-500 mb-1'>masked_text</div>
              <pre className='text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200 max-h-40 overflow-y-auto'>
                {meta.maskedText}
              </pre>
            </div>
          )}

          {meta.detectedList.length > 0 && (
            <div>
              <div className='text-xs text-gray-500 mb-1'>
                detected_list ({meta.detectedList.length}건)
              </div>
              <div className='space-y-1'>
                {meta.detectedList.map((item, i) => (
                  <div
                    key={i}
                    className='text-xs bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded px-3 py-2 flex gap-3'
                  >
                    <span className='font-medium text-orange-700 dark:text-orange-400 shrink-0'>
                      {item.pattern || item.type || `#${i + 1}`}
                    </span>
                    <span className='font-mono text-gray-700 dark:text-gray-300 break-all'>
                      {item.masked_text || item.maskedText || JSON.stringify(item)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!meta.detected && meta.detectedCnt === 0 && !meta.maskedText && (
            <div className='text-xs text-gray-400 italic'>
              PII가 탐지되지 않았습니다.
            </div>
          )}
        </div>
      )}

      {isFailed && (
        <div>
          <div className='text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide mb-2'>
            오류 (Error)
          </div>
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 space-y-1.5 text-xs'>
            {meta.reason && (
              <div className='flex gap-2'>
                <span className='text-red-500 shrink-0 min-w-[70px]'>reason:</span>
                <span className='font-mono font-medium text-red-700 dark:text-red-400'>
                  {meta.reason}
                </span>
              </div>
            )}
            {log.statusCode != null && (
              <div className='flex gap-2'>
                <span className='text-red-500 shrink-0 min-w-[70px]'>statusCode:</span>
                <span className='font-mono font-medium text-red-700 dark:text-red-400'>
                  {log.statusCode}
                </span>
              </div>
            )}
            {log.error && (
              <div className='flex gap-2'>
                <span className='text-red-500 shrink-0 min-w-[70px]'>error:</span>
                <span className='text-red-700 dark:text-red-400 break-all'>
                  {log.error}
                </span>
              </div>
            )}
          </div>
          {log.responseBody && (
            <div className='mt-2'>
              <div className='text-xs text-gray-500 mb-1'>응답 body</div>
              <pre className='text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200 max-h-32 overflow-y-auto'>
                {typeof log.responseBody === 'string'
                  ? log.responseBody
                  : JSON.stringify(log.responseBody, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPiiLogsPage() {
  const { alert } = useAlert();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [expandedLogs, setExpandedLogs] = useState(new Set());
  const [filters, setFilters] = useState({
    timeRange: '7d',
    endpoint: '',
    model: '',
    detected: '',
    page: 1,
    limit: 50,
  });

  const fetchLogs = useCallback(
    async (showLoading = true) => {
      try {
        if (showLoading) setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          alert('관리자 인증 토큰이 없습니다.', 'error', '인증 오류');
          return;
        }
        const params = new URLSearchParams({
          apiType: 'pii-detect',
          timeRange: filters.timeRange,
          page: String(filters.page),
          limit: String(filters.limit),
        });
        if (filters.endpoint.trim()) params.set('endpoint', filters.endpoint);
        if (filters.model.trim()) params.set('model', filters.model);

        const response = await fetch(`/api/admin/external-api-logs?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || `조회 실패 (${response.status})`);
        }
        setLogs(Array.isArray(data?.data?.logs) ? data.data.logs : []);
        setPagination(
          data?.data?.pagination || { page: filters.page, totalPages: 1 }
        );
      } catch (error) {
        alert(`PII 로그 조회 실패: ${error.message}`, 'error', '조회 실패');
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [alert, filters]
  );

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = useMemo(() => {
    if (!filters.detected) return logs;
    return logs.filter((log) => {
      const meta = getPiiMeta(log);
      if (filters.detected === 'detected') return meta.detected;
      if (filters.detected === 'clean') return !meta.detected && !meta.skipped;
      if (filters.detected === 'failed') return meta.skipped || !!meta.reason;
      return true;
    });
  }, [filters.detected, logs]);

  const summary = useMemo(() => {
    return filteredLogs.reduce(
      (acc, log) => {
        const meta = getPiiMeta(log);
        acc.total += 1;
        if (meta.detected) acc.detected += 1;
        if (meta.skipped || meta.reason) acc.failed += 1;
        return acc;
      },
      { total: 0, detected: 0, failed: 0 }
    );
  }, [filteredLogs]);

  const toggleExpand = (id) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-white'>
            PII 로그
          </h1>
          <p className='text-sm text-gray-600 dark:text-gray-300 mt-1'>
            PII API 호출 이력 — 입력/출력값 및 성공/실패 상세 확인
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className='px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 inline-flex items-center gap-2'
        >
          <RefreshCw className='w-4 h-4' />
          새로고침
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
        <div className='p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'>
          <div className='text-xs text-gray-500'>총 로그</div>
          <div className='text-2xl font-semibold text-gray-900 dark:text-white'>
            {summary.total}
          </div>
        </div>
        <div className='p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-gray-800'>
          <div className='text-xs text-gray-500 inline-flex items-center gap-1'>
            <ShieldAlert className='w-4 h-4 text-orange-600' /> PII 검출
          </div>
          <div className='text-2xl font-semibold text-orange-700 dark:text-orange-400'>
            {summary.detected}
          </div>
        </div>
        <div className='p-4 rounded-xl border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800'>
          <div className='text-xs text-gray-500 inline-flex items-center gap-1'>
            <XCircle className='w-4 h-4 text-red-600' /> 실패/스킵
          </div>
          <div className='text-2xl font-semibold text-red-700 dark:text-red-400'>
            {summary.failed}
          </div>
        </div>
      </div>

      <div className='p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 grid grid-cols-1 md:grid-cols-5 gap-3'>
        <select
          value={filters.timeRange}
          onChange={(e) =>
            setFilters((p) => ({ ...p, timeRange: e.target.value, page: 1 }))
          }
          className='px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
        >
          <option value='1h'>최근 1시간</option>
          <option value='24h'>최근 24시간</option>
          <option value='7d'>최근 7일</option>
          <option value='30d'>최근 30일</option>
        </select>
        <input
          value={filters.endpoint}
          onChange={(e) =>
            setFilters((p) => ({ ...p, endpoint: e.target.value, page: 1 }))
          }
          placeholder='endpoint 필터'
          className='px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
        />
        <input
          value={filters.model}
          onChange={(e) =>
            setFilters((p) => ({ ...p, model: e.target.value, page: 1 }))
          }
          placeholder='model 필터'
          className='px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
        />
        <select
          value={filters.detected}
          onChange={(e) =>
            setFilters((p) => ({ ...p, detected: e.target.value, page: 1 }))
          }
          className='px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
        >
          <option value=''>검출 상태 전체</option>
          <option value='detected'>PII 검출</option>
          <option value='clean'>정상 (미검출)</option>
          <option value='failed'>실패/스킵</option>
        </select>
        <button
          onClick={() => fetchLogs(true)}
          className='px-3 py-2 rounded-lg bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
        >
          조회
        </button>
      </div>

      {loading ? (
        <div className='py-16 text-center text-gray-500'>로딩 중...</div>
      ) : filteredLogs.length === 0 ? (
        <div className='py-16 text-center text-gray-500'>
          조회 결과가 없습니다.
        </div>
      ) : (
        <div className='rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-800'>
          {filteredLogs.map((log) => {
            const meta = getPiiMeta(log);
            const id = log._id || log.timestamp;
            const isExpanded = expandedLogs.has(id);
            const original = getOriginalText(log);
            const preview = original.slice(0, 80);

            return (
              <div key={id}>
                <button
                  className='w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors'
                  onClick={() => toggleExpand(id)}
                >
                  <div className='flex items-center gap-3 flex-wrap'>
                    <span className='text-xs text-gray-500 whitespace-nowrap min-w-[130px]'>
                      {new Date(log.timestamp).toLocaleString('ko-KR')}
                    </span>

                    <StatusBadge meta={meta} />

                    {meta.detected && (
                      <span className='text-xs font-medium text-orange-600 dark:text-orange-400'>
                        {meta.detectedCnt}건
                      </span>
                    )}

                    {log.statusCode != null && (
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    )}

                    {log.responseTime != null && (
                      <span className='text-xs text-gray-400 inline-flex items-center gap-1'>
                        <Clock className='w-3 h-3' />
                        {log.responseTime}ms
                      </span>
                    )}

                    <span className='text-xs text-gray-400 truncate flex-1 min-w-0 text-left'>
                      {preview
                        ? `"${preview}${original.length > 80 ? '…' : ''}"`
                        : log.endpoint}
                    </span>

                    <span className='ml-auto text-gray-400 shrink-0'>
                      {isExpanded ? (
                        <ChevronUp className='w-4 h-4' />
                      ) : (
                        <ChevronDown className='w-4 h-4' />
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && <LogDetail log={log} meta={meta} />}
              </div>
            );
          })}
        </div>
      )}

      <div className='flex items-center justify-between text-sm'>
        <span className='text-gray-600 dark:text-gray-300'>
          페이지 {pagination.page || 1} / {pagination.totalPages || 1}
        </span>
        <div className='flex gap-2'>
          <button
            disabled={(pagination.page || 1) <= 1}
            onClick={() =>
              setFilters((p) => ({
                ...p,
                page: Math.max((p.page || 1) - 1, 1),
              }))
            }
            className='px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50'
          >
            이전
          </button>
          <button
            disabled={(pagination.page || 1) >= (pagination.totalPages || 1)}
            onClick={() =>
              setFilters((p) => ({
                ...p,
                page: Math.min((p.page || 1) + 1, pagination.totalPages || 1),
              }))
            }
            className='px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50'
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
