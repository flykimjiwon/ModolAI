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
} from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';

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

function StatusBadge({ meta, t }) {
  if (meta.skipped || meta.reason) {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive'>
        <XCircle className='w-3 h-3' /> {t('admin_pii_logs.status_failed')}
      </span>
    );
  }
  if (meta.detected) {
    return (
      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground'>
        <ShieldAlert className='w-3 h-3' /> {t('admin_pii_logs.status_detected')}
      </span>
    );
  }
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary'>
      <ShieldCheck className='w-3 h-3' /> {t('admin_pii_logs.status_clean')}
    </span>
  );
}

function LogDetail({ log, meta, t }) {
  const originalText = getOriginalText(log);
  const isFailed = meta.skipped || !!meta.reason;

  return (
    <div className='px-4 py-4 bg-muted border-t border-border space-y-4'>
      <div>
        <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2'>
          {t('admin_pii_logs.input_request')}
        </div>
        <div className='flex gap-4 mb-2 text-xs'>
          <div className='flex gap-1.5'>
            <span className='text-muted-foreground'>mxt_vrf:</span>
            <span className='font-mono font-medium text-foreground'>
              {String(log?.requestBody?.mxt_vrf ?? true)}
            </span>
          </div>
          <div className='flex gap-1.5'>
            <span className='text-muted-foreground'>mask_opt:</span>
            <span className='font-mono font-medium text-foreground'>
              {String(log?.requestBody?.mask_opt ?? true)}
            </span>
          </div>
        </div>
        <div className='text-xs text-muted-foreground mb-1'>original_text</div>
        <pre className='text-xs bg-card border border-border rounded-lg p-3 whitespace-pre-wrap break-all text-foreground max-h-40 overflow-y-auto'>
          {originalText || t('admin_pii_logs.none')}
        </pre>
      </div>

      {!isFailed && (
        <div>
          <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2'>
            {t('admin_pii_logs.output_response')}
          </div>
          <div className='flex gap-4 mb-2 text-xs'>
            <div className='flex gap-1.5'>
              <span className='text-muted-foreground'>detected:</span>
              <span
                className={`font-medium ${meta.detected ? 'text-muted-foreground' : 'text-primary'}`}
              >
                {String(meta.detected)}
              </span>
            </div>
            <div className='flex gap-1.5'>
              <span className='text-muted-foreground'>detected_cnt:</span>
              <span className='font-mono font-medium text-foreground'>
                {meta.detectedCnt}
              </span>
            </div>
          </div>

          {meta.maskedText && (
            <div className='mb-3'>
              <div className='text-xs text-muted-foreground mb-1'>masked_text</div>
              <pre className='text-xs bg-card border border-border rounded-lg p-3 whitespace-pre-wrap break-all text-foreground max-h-40 overflow-y-auto'>
                {meta.maskedText}
              </pre>
            </div>
          )}

          {meta.detectedList.length > 0 && (
            <div>
              <div className='text-xs text-muted-foreground mb-1'>
                {t('admin_pii_logs.detected_list_count', { count: meta.detectedList.length })}
              </div>
              <div className='space-y-1'>
                {meta.detectedList.map((item, i) => (
                  <div
                    key={i}
                    className='text-xs bg-muted border border-border rounded px-3 py-2 flex gap-3'
                  >
                    <span className='font-medium text-muted-foreground shrink-0'>
                      {item.pattern || item.type || `#${i + 1}`}
                    </span>
                    <span className='font-mono text-foreground break-all'>
                      {item.masked_text || item.maskedText || JSON.stringify(item)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!meta.detected && meta.detectedCnt === 0 && !meta.maskedText && (
            <div className='text-xs text-muted-foreground italic'>
              {t('admin_pii_logs.no_pii_detected')}
            </div>
          )}
        </div>
      )}

      {isFailed && (
        <div>
          <div className='text-xs font-semibold text-destructive uppercase tracking-wide mb-2'>
            {t('admin_pii_logs.error_label')}
          </div>
          <div className='bg-destructive/10 border border-destructive/30 rounded-lg p-3 space-y-1.5 text-xs'>
            {meta.reason && (
              <div className='flex gap-2'>
                <span className='text-destructive shrink-0 min-w-[70px]'>reason:</span>
                <span className='font-mono font-medium text-destructive'>
                  {meta.reason}
                </span>
              </div>
            )}
            {log.statusCode != null && (
              <div className='flex gap-2'>
                <span className='text-destructive shrink-0 min-w-[70px]'>statusCode:</span>
                <span className='font-mono font-medium text-destructive'>
                  {log.statusCode}
                </span>
              </div>
            )}
            {log.error && (
              <div className='flex gap-2'>
                <span className='text-destructive shrink-0 min-w-[70px]'>error:</span>
                <span className='text-destructive break-all'>
                  {log.error}
                </span>
              </div>
            )}
          </div>
          {log.responseBody && (
            <div className='mt-2'>
              <div className='text-xs text-muted-foreground mb-1'>{t('admin_pii_logs.response_body')}</div>
              <pre className='text-xs bg-card border border-border rounded-lg p-3 whitespace-pre-wrap break-all text-foreground max-h-32 overflow-y-auto'>
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
  const { t } = useTranslation();
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
          alert(t('admin_pii_logs.no_auth_token'), 'error', t('admin_pii_logs.auth_error'));
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
          throw new Error(data.error || t('admin_pii_logs.fetch_failed_status', { status: response.status }));
        }
        setLogs(Array.isArray(data?.data?.logs) ? data.data.logs : []);
        setPagination(
          data?.data?.pagination || { page: filters.page, totalPages: 1 }
        );
      } catch (error) {
        alert(t('admin_pii_logs.fetch_error', { message: error.message }), 'error', t('admin_pii_logs.fetch_failed_title'));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [alert, filters, t]
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
          <h1 className='text-2xl font-bold text-foreground'>
            {t('admin_pii_logs.title')}
          </h1>
          <p className='text-sm text-muted-foreground mt-1'>
            {t('admin_pii_logs.subtitle')}
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none px-4 py-2 rounded-lg inline-flex items-center gap-2'
        >
          <RefreshCw className='w-4 h-4' />
          {t('admin_pii_logs.refresh')}
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
        <div className='p-4 rounded-xl border border-border bg-card'>
          <div className='text-xs text-muted-foreground'>{t('admin_pii_logs.total_logs')}</div>
          <div className='text-2xl font-semibold text-foreground'>
            {summary.total}
          </div>
        </div>
        <div className='p-4 rounded-xl border border-border bg-card'>
          <div className='text-xs text-muted-foreground inline-flex items-center gap-1'>
            <ShieldAlert className='w-4 h-4 text-muted-foreground' /> {t('admin_pii_logs.pii_detected')}
          </div>
          <div className='text-2xl font-semibold text-muted-foreground'>
            {summary.detected}
          </div>
        </div>
        <div className='p-4 rounded-xl border border-destructive/30 bg-card'>
          <div className='text-xs text-muted-foreground inline-flex items-center gap-1'>
            <XCircle className='w-4 h-4 text-destructive' /> {t('admin_pii_logs.failed_skipped')}
          </div>
          <div className='text-2xl font-semibold text-destructive'>
            {summary.failed}
          </div>
        </div>
      </div>

      <div className='p-4 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-5 gap-3'>
        <select
          value={filters.timeRange}
          onChange={(e) =>
            setFilters((p) => ({ ...p, timeRange: e.target.value, page: 1 }))
          }
          className='px-3 py-2 rounded-lg border border-border bg-background'
        >
          <option value='1h'>{t('admin_pii_logs.time_1h')}</option>
          <option value='24h'>{t('admin_pii_logs.time_24h')}</option>
          <option value='7d'>{t('admin_pii_logs.time_7d')}</option>
          <option value='30d'>{t('admin_pii_logs.time_30d')}</option>
        </select>
        <input
          value={filters.endpoint}
          onChange={(e) =>
            setFilters((p) => ({ ...p, endpoint: e.target.value, page: 1 }))
          }
          placeholder={t('admin_pii_logs.endpoint_filter')}
          className='px-3 py-2 rounded-lg border border-border bg-background'
        />
        <input
          value={filters.model}
          onChange={(e) =>
            setFilters((p) => ({ ...p, model: e.target.value, page: 1 }))
          }
          placeholder={t('admin_pii_logs.model_filter')}
          className='px-3 py-2 rounded-lg border border-border bg-background'
        />
        <select
          value={filters.detected}
          onChange={(e) =>
            setFilters((p) => ({ ...p, detected: e.target.value, page: 1 }))
          }
          className='px-3 py-2 rounded-lg border border-border bg-background'
        >
          <option value=''>{t('admin_pii_logs.all_status')}</option>
          <option value='detected'>{t('admin_pii_logs.status_detected')}</option>
          <option value='clean'>{t('admin_pii_logs.status_clean_option')}</option>
          <option value='failed'>{t('admin_pii_logs.status_failed_option')}</option>
        </select>
        <button
          onClick={() => fetchLogs(true)}
          className='px-3 py-2 rounded-lg bg-foreground text-background'
        >
          {t('admin_pii_logs.search')}
        </button>
      </div>

      {loading ? (
        <div className='py-16 text-center text-muted-foreground'>{t('common.loading')}</div>
      ) : filteredLogs.length === 0 ? (
        <div className='py-16 text-center text-muted-foreground'>
          {t('admin_pii_logs.no_results')}
        </div>
      ) : (
        <div className='rounded-xl border border-border overflow-hidden divide-y divide-border bg-card'>
          {filteredLogs.map((log) => {
            const meta = getPiiMeta(log);
            const id = log._id || log.timestamp;
            const isExpanded = expandedLogs.has(id);
            const original = getOriginalText(log);
            const preview = original.slice(0, 80);

            return (
              <div key={id}>
                <button
                  className='w-full text-left px-4 py-3 hover:bg-accent transition-colors'
                  onClick={() => toggleExpand(id)}
                >
                  <div className='flex items-center gap-3 flex-wrap'>
                    <span className='text-xs text-muted-foreground whitespace-nowrap min-w-[130px]'>
                      {new Date(log.timestamp).toLocaleString('ko-KR')}
                    </span>

                    <StatusBadge meta={meta} t={t} />

                    {meta.detected && (
                      <span className='text-xs font-medium text-muted-foreground'>
                        {t('admin_pii_logs.count_items', { count: meta.detectedCnt })}
                      </span>
                    )}

                    {log.statusCode != null && (
                      <span
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-primary/10 text-primary'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    )}

                    {log.responseTime != null && (
                      <span className='text-xs text-muted-foreground inline-flex items-center gap-1'>
                        <Clock className='w-3 h-3' />
                        {log.responseTime}ms
                      </span>
                    )}

                    <span className='text-xs text-muted-foreground truncate flex-1 min-w-0 text-left'>
                      {preview
                        ? `"${preview}${original.length > 80 ? '…' : ''}"`
                        : log.endpoint}
                    </span>

                    <span className='ml-auto text-muted-foreground shrink-0'>
                      {isExpanded ? (
                        <ChevronUp className='w-4 h-4' />
                      ) : (
                        <ChevronDown className='w-4 h-4' />
                      )}
                    </span>
                  </div>
                </button>

                {isExpanded && <LogDetail log={log} meta={meta} t={t} />}
              </div>
            );
          })}
        </div>
      )}

      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>
          {t('admin_pii_logs.page_info', { page: pagination.page || 1, totalPages: pagination.totalPages || 1 })}
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
            className='px-3 py-1.5 rounded border border-border disabled:opacity-50'
          >
            {t('common.previous')}
          </button>
          <button
            disabled={(pagination.page || 1) >= (pagination.totalPages || 1)}
            onClick={() =>
              setFilters((p) => ({
                ...p,
                page: Math.min((p.page || 1) + 1, pagination.totalPages || 1),
              }))
            }
            className='px-3 py-1.5 rounded border border-border disabled:opacity-50'
          >
            {t('common.next')}
          </button>
        </div>
      </div>
    </div>
  );
}
