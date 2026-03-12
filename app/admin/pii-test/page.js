'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Shield } from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';

const PII_TYPES = {
  'resident-number': { label: 'admin_pii_test.type_resident_number' },
  'alien-registration': { label: 'admin_pii_test.type_alien_registration' },
  phone: { label: 'admin_pii_test.type_phone' },
  email: { label: 'admin_pii_test.type_email' },
  'credit-card': { label: 'admin_pii_test.type_credit_card' },
  passport: { label: 'admin_pii_test.type_passport' },
  'driver-license': { label: 'admin_pii_test.type_driver_license' },
  'bank-account': { label: 'admin_pii_test.type_bank_account' },
  'health-insurance': { label: 'admin_pii_test.type_health_insurance' },
  'ip-address': { label: 'admin_pii_test.type_ip_address' },
};

const ALL_TYPE_KEYS = Object.keys(PII_TYPES);

function prettyJson(value) {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminPiiTestPage() {
  const { t } = useTranslation();
  const [text, setText] = useState(
    '홍길동 주민번호 900101-1234567, 연락처 010-1234-5678, 이메일 hong@example.com\n카드번호 1234-5678-9012-3456, IP 192.168.0.1'
  );
  const [enabledTypes, setEnabledTypes] = useState(() => {
    const initial = {};
    ALL_TYPE_KEYS.forEach((key) => {
      initial[key] = true;
    });
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const enabledCount = Object.values(enabledTypes).filter(Boolean).length;
  const allEnabled = enabledCount === ALL_TYPE_KEYS.length;
  const noneEnabled = enabledCount === 0;

  const toggleAll = (value) => {
    const updated = {};
    ALL_TYPE_KEYS.forEach((key) => {
      updated[key] = value;
    });
    setEnabledTypes(updated);
  };

  const handleTest = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('token');
      const selectedTypes = ALL_TYPE_KEYS.filter((key) => enabledTypes[key]);

      const res = await fetch('/api/admin/pii-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          enabledTypes: selectedTypes.length === ALL_TYPE_KEYS.length ? null : selectedTypes,
        }),
      });

      const data = await res.json();
      setResult(data);
      if (!res.ok || !data.success) {
        setError(data.error || t('admin_pii_test.detection_failed', { status: res.status }));
      }
    } catch (e) {
      setError(e.message || t('admin_pii_test.request_failed'));
    } finally {
      setLoading(false);
    }
  };

  const detectedResult = result?.result;
  const diagnostics = result?.diagnostics;

  // 탐지 유형별 그룹핑
  const detectedByType = {};
  if (detectedResult?.detectedList?.length > 0) {
    for (const item of detectedResult.detectedList) {
      if (!detectedByType[item.type]) {
        detectedByType[item.type] = [];
      }
      detectedByType[item.type].push(item);
    }
  }

  return (
    <div className='space-y-6'>
      {/* 헤더 */}
      <div>
        <h1 className='text-2xl font-bold text-foreground flex items-center gap-2'>
          <Shield className='w-6 h-6' />
          {t('admin_pii_test.title')}
        </h1>
        <p className='text-sm text-muted-foreground mt-1'>
          {t('admin_pii_test.subtitle')}
        </p>
      </div>

      {/* 탐지 유형 선택 */}
      <div className='bg-card rounded-xl border border-border p-4 space-y-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-semibold text-foreground'>
            {t('admin_pii_test.select_types')}
            <span className='ml-2 text-xs font-normal text-muted-foreground'>
              ({t('admin_pii_test.selected_count', { count: enabledCount, total: ALL_TYPE_KEYS.length })})
            </span>
          </h2>
          <div className='flex gap-2'>
            <button
              onClick={() => toggleAll(true)}
              disabled={allEnabled}
              className='px-2 py-1 text-xs rounded border border-border bg-muted text-foreground hover:bg-accent disabled:opacity-40 transition-colors'
            >
              {t('admin_pii_test.select_all')}
            </button>
            <button
              onClick={() => toggleAll(false)}
              disabled={noneEnabled}
              className='px-2 py-1 text-xs rounded border border-border bg-muted text-foreground hover:bg-accent disabled:opacity-40 transition-colors'
            >
              {t('admin_pii_test.deselect_all')}
            </button>
          </div>
        </div>
        <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2'>
          {ALL_TYPE_KEYS.map((key) => (
            <label
              key={key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                enabledTypes[key]
                  ? 'border-primary/30 bg-primary/5 text-foreground'
                  : 'border-border bg-muted/50 text-muted-foreground'
              }`}
            >
              <input
                type='checkbox'
                checked={enabledTypes[key]}
                onChange={(e) =>
                  setEnabledTypes({ ...enabledTypes, [key]: e.target.checked })
                }
                className='w-3.5 h-3.5 rounded'
              />
              <span className='text-xs'>{t(PII_TYPES[key].label)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 테스트 텍스트 */}
      <div className='bg-card rounded-xl border border-border p-4 space-y-3'>
        <h2 className='text-sm font-semibold text-foreground'>{t('admin_pii_test.test_text')}</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className='w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm'
          placeholder={t('admin_pii_test.text_placeholder')}
        />
        <button
          onClick={handleTest}
          disabled={loading || noneEnabled}
          className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none'
        >
          {loading ? (
            <>
              <RefreshCw className='w-4 h-4 animate-spin' />
              {t('admin_pii_test.detecting')}
            </>
          ) : (
            <>
              <Shield className='w-4 h-4' />
              {t('admin_pii_test.run_test')}
            </>
          )}
        </button>
        {error && <div className='text-sm text-destructive'>{error}</div>}
      </div>

      {/* 결과 */}
      {result && detectedResult && (
        <div className='space-y-4'>
          {/* 요약 */}
          <div className='bg-card rounded-xl border border-border p-4 space-y-3'>
            <div className='flex items-center gap-2'>
              {detectedResult.detected ? (
                <AlertTriangle className='w-5 h-5 text-destructive' />
              ) : (
                <CheckCircle2 className='w-5 h-5 text-primary' />
              )}
              <span
                className={`font-semibold ${
                  detectedResult.detected ? 'text-destructive' : 'text-primary'
                }`}
              >
                {detectedResult.detected
                  ? t('admin_pii_test.pii_detected', { count: detectedResult.detectedCnt })
                  : t('admin_pii_test.pii_not_detected')}
              </span>
              {diagnostics && (
                <span className='text-xs text-muted-foreground ml-auto'>
                  {diagnostics.durationMs}ms · {diagnostics.source}
                </span>
              )}
            </div>

            {/* 마스킹 결과 */}
            {detectedResult.detected && (
              <div className='space-y-2'>
                <div className='text-xs font-medium text-muted-foreground'>
                  {t('admin_pii_test.masking_result')}
                </div>
                <div className='text-sm p-3 rounded-lg bg-muted text-foreground whitespace-pre-wrap'>
                  {detectedResult.maskedText}
                </div>
              </div>
            )}
          </div>

          {/* 탐지 상세 */}
          {detectedResult.detected && detectedResult.detectedList?.length > 0 && (
            <div className='bg-card rounded-xl border border-border p-4 space-y-3'>
              <h3 className='text-sm font-semibold text-foreground'>{t('admin_pii_test.detection_detail')}</h3>
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-border'>
                      <th className='text-left py-2 px-3 text-xs font-medium text-muted-foreground'>
                        {t('admin_pii_test.col_type')}
                      </th>
                      <th className='text-left py-2 px-3 text-xs font-medium text-muted-foreground'>
                        {t('admin_pii_test.col_original')}
                      </th>
                      <th className='text-left py-2 px-3 text-xs font-medium text-muted-foreground'>
                        {t('admin_pii_test.col_masked')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectedResult.detectedList.map((item, idx) => (
                      <tr key={idx} className='border-b border-border/50'>
                        <td className='py-2 px-3'>
                          <span className='inline-block px-2 py-0.5 text-xs rounded bg-muted text-foreground'>
                            {item.label}
                          </span>
                        </td>
                        <td className='py-2 px-3 font-mono text-xs text-destructive'>
                          {item.original}
                        </td>
                        <td className='py-2 px-3 font-mono text-xs text-primary'>
                          {item.masked}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 유형별 요약 */}
              <div className='flex flex-wrap gap-2 pt-2'>
                {Object.entries(detectedByType).map(([type, items]) => (
                  <span
                    key={type}
                    className='inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg bg-muted text-foreground'
                  >
                    {PII_TYPES[type]?.label ? t(PII_TYPES[type].label) : type}
                    <span className='font-semibold text-primary'>{items.length}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 원본 JSON */}
          <details className='bg-card rounded-xl border border-border p-4'>
            <summary className='cursor-pointer text-sm font-semibold text-foreground'>
              {t('admin_pii_test.raw_response')}
            </summary>
            <pre className='text-xs overflow-auto p-3 rounded bg-muted text-foreground mt-3'>
              {prettyJson(result)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
