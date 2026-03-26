'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import { useAgentGenerate } from '@/hooks/useAgentGenerate';
import {
  Loader2,
  Sparkles,
  Copy,
  Check,
  Trash2,
  ChevronRight,
  Database,
  Table2,
  Code2,
  Lightbulb,
  RefreshCw,
  FileText,
  AlertCircle,
} from '@/components/icons';

// ─────────────────────────────────────────────────────────────────────────────
// DDL parser — simple CREATE TABLE parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseDDL(ddl) {
  if (!ddl || typeof ddl !== 'string') return [];

  const tables = [];
  const tableRegex = /CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\)\s*(?:;|PARTITION|ENGINE|WITH|TABLESPACE)/gi;

  let match;
  while ((match = tableRegex.exec(ddl)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];

    const lines = body.split(',').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^\s*(PRIMARY\s+KEY|UNIQUE|CHECK|CONSTRAINT|FOREIGN\s+KEY|INDEX|KEY\s)/i.test(line)) continue;

      const colMatch = line.match(/^\s*["`]?(\w+)["`]?\s+(\w[\w\s(),']*)/i);
      if (colMatch) {
        const colName = colMatch[1];
        let colType = colMatch[2].trim();
        colType = colType.split(/\s+(NOT|NULL|DEFAULT|PRIMARY|UNIQUE|CHECK|REFERENCES|GENERATED|CONSTRAINT)/i)[0].trim();
        const isPK = /PRIMARY\s+KEY/i.test(line);
        const isNotNull = /NOT\s+NULL/i.test(line);
        const hasDefault = /DEFAULT\s/i.test(line);
        const isFK = /REFERENCES/i.test(line);
        columns.push({ name: colName, type: colType, isPK, isNotNull, hasDefault, isFK });
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns });
    }
  }

  return tables;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema visualizer component
// ─────────────────────────────────────────────────────────────────────────────

function SchemaVisualizer({ tables }) {
  if (!tables || tables.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
      {tables.map((table) => (
        <div
          key={table.name}
          style={{
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            background: 'rgba(59, 130, 246, 0.05)',
            minWidth: '220px',
            maxWidth: '320px',
            flex: '1 1 auto',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(59, 130, 246, 0.12)',
              borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Table2 size={14} />
            {table.name}
            <span style={{ fontSize: '0.72rem', opacity: 0.6, fontWeight: 400 }}>
              ({table.columns.length}컬럼)
            </span>
          </div>
          <div style={{ padding: '6px 0' }}>
            {table.columns.map((col) => (
              <div
                key={col.name}
                style={{
                  padding: '3px 12px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderBottom: '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <span style={{ fontWeight: col.isPK ? 700 : 400, minWidth: '90px' }}>
                  {col.isPK && '\uD83D\uDD11 '}{col.isFK && '\uD83D\uDD17 '}{col.name}
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>{col.type}</span>
                {col.isNotNull && (
                  <span style={{ color: '#ef4444', fontSize: '0.65rem', fontWeight: 600 }}>NN</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result display component
// ─────────────────────────────────────────────────────────────────────────────

function SqlResultView({ text, isStreaming }) {
  const [copiedSection, setCopiedSection] = useState('');

  const handleCopy = useCallback((content, section) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(''), 2000);
    });
  }, []);

  const sections = useMemo(() => {
    if (!text) return { sql: '', explanation: '', tips: '' };

    const sqlMatch = text.match(/```sql\s*([\s\S]*?)```/i);
    const sql = sqlMatch ? sqlMatch[1].trim() : '';

    const explainMatch = text.match(/###?\s*쿼리\s*설명\s*([\s\S]*?)(?=###?\s*최적화|$)/i);
    const explanation = explainMatch ? explainMatch[1].trim() : '';

    const tipsMatch = text.match(/###?\s*최적화\s*팁\s*([\s\S]*?)$/i);
    const tips = tipsMatch ? tipsMatch[1].trim() : '';

    return { sql, explanation, tips };
  }, [text]);

  if (!text) return null;

  if (isStreaming && !sections.sql) {
    return (
      <div
        style={{
          padding: '16px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: '8px',
          fontSize: '0.88rem',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
        <span style={{ animation: 'blink 1s infinite' }}>{'\u2587'}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sections.sql && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.88rem' }}>
              <Code2 size={16} style={{ color: '#3b82f6' }} />
              생성된 SQL
            </div>
            <button
              onClick={() => handleCopy(sections.sql, 'sql')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: '6px',
                background: copiedSection === 'sql' ? '#10b981' : 'white',
                color: copiedSection === 'sql' ? 'white' : '#374151',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {copiedSection === 'sql' ? <Check size={12} /> : <Copy size={12} />}
              {copiedSection === 'sql' ? '복사됨' : '복사'}
            </button>
          </div>
          <pre
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              padding: '16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              lineHeight: 1.6,
              overflowX: 'auto',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <code>{sections.sql}</code>
          </pre>
        </div>
      )}

      {sections.explanation && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' }}>
            <FileText size={16} style={{ color: '#8b5cf6' }} />
            쿼리 설명
          </div>
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(139, 92, 246, 0.06)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '8px',
              fontSize: '0.84rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {sections.explanation}
          </div>
        </div>
      )}

      {sections.tips && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.88rem', marginBottom: '8px' }}>
            <Lightbulb size={16} style={{ color: '#f59e0b' }} />
            최적화 팁
          </div>
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid rgba(245, 158, 11, 0.15)',
              borderRadius: '8px',
              fontSize: '0.84rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {sections.tips}
          </div>
        </div>
      )}

      {!sections.sql && !isStreaming && (
        <div
          style={{
            padding: '16px',
            background: 'rgba(0,0,0,0.03)',
            borderRadius: '8px',
            fontSize: '0.84rem',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </div>
      )}

      {isStreaming && (
        <div style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontSize: '0.78rem' }}>
          <Loader2 size={14} className="animate-spin" style={{ display: 'inline' }} /> 생성 중...
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const DIALECT_OPTIONS = [
  { id: 'postgresql', label: 'PostgreSQL' },
  { id: 'mysql', label: 'MySQL' },
  { id: 'oracle', label: 'Oracle' },
  { id: 'sqlite', label: 'SQLite' },
  { id: 'mssql', label: 'MSSQL' },
  { id: 'mariadb', label: 'MariaDB' },
  { id: 'vertica', label: 'Vertica' },
  { id: 'redshift', label: 'Amazon Redshift' },
  { id: 'bigquery', label: 'Google BigQuery' },
  { id: 'snowflake', label: 'Snowflake' },
  { id: 'hive', label: 'Apache Hive' },
  { id: 'presto', label: 'Presto/Trino' },
  { id: 'clickhouse', label: 'ClickHouse' },
  { id: 'db2', label: 'IBM DB2' },
  { id: 'teradata', label: 'Teradata' },
];

export default function TextToSql({ sidebarMenu, onRequestSidebarMenuChange }) {
  const [settings, setSettings] = useState(null);
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');

  const [schema, setSchema] = useState('');
  const [parsedTables, setParsedTables] = useState([]);
  const [step, setStep] = useState(1);

  const [dialect, setDialect] = useState('postgresql');
  const [question, setQuestion] = useState('');
  const [resultText, setResultText] = useState('');

  const { history, loading: historyLoading, saveEntry, deleteEntry, refreshHistory } = useAgentHistory('3');
  const { generate, loading: generating, error: generateError, streamingText, abortGeneration } = useAgentGenerate('/api/webapp-text-to-sql');

  const textareaRef = useRef(null);
  const questionRef = useRef(null);

  const activeView = sidebarMenu || 'sql-compose';

  // ── Load settings ──
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setSettingsLoading(false);
      setSettingsError('Login required.');
      return;
    }

    fetch('/api/webapp-text-to-sql', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setSettings(data.settings || {});
        setModelOptions(data.modelOptions || []);
        if (data.settings?.allowUserModelOverride && data.modelOptions?.length > 0) {
          setSelectedModel(data.settings.selectedModelId || data.modelOptions[0]?.id || '');
        }
      })
      .catch((err) => {
        console.warn('[TextToSql] Failed to load settings:', err.message);
        setSettingsError('Failed to load settings.');
      })
      .finally(() => setSettingsLoading(false));
  }, []);

  // ── Parse DDL ──
  useEffect(() => {
    if (schema.trim()) {
      const tables = parseDDL(schema);
      setParsedTables(tables);
    } else {
      setParsedTables([]);
    }
  }, [schema]);

  // ── Generate SQL ──
  const handleGenerate = useCallback(async () => {
    if (!question.trim() || generating) return;

    const entryId = `sql-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setResultText('');

    const body = {
      question: question.trim(),
      schema: schema.trim(),
      dialect,
      ...(settings?.allowUserModelOverride && selectedModel ? { model: selectedModel } : {}),
    };

    const finalText = await generate(body, {
      onDelta: (_delta, acc) => {
        setResultText(acc);
      },
      onDone: (text) => {
        setResultText(text);
      },
      onError: (err) => {
        console.warn('[TextToSql] Generation error:', err);
      },
    });

    if (finalText) {
      const dialectLabel = DIALECT_OPTIONS.find((d) => d.id === dialect)?.label || dialect;
      await saveEntry(entryId, {
        title: question.trim().slice(0, 80),
        inputData: { question: question.trim(), schema: schema.trim(), dialect },
        outputText: finalText,
        metadata: { dialect: dialectLabel },
      });
    }
  }, [question, schema, dialect, selectedModel, settings, generating, generate, saveEntry]);

  // ── Load history item ──
  const handleLoadHistoryItem = useCallback((item) => {
    if (item.input_data) {
      const input = typeof item.input_data === 'string' ? JSON.parse(item.input_data) : item.input_data;
      setSchema(input.schema || '');
      setDialect(input.dialect || 'postgresql');
      setQuestion(input.question || '');
    }
    setResultText(item.output_text || '');
    if (item.input_data?.schema) setStep(2);
    onRequestSidebarMenuChange?.('sql-compose');
  }, [onRequestSidebarMenuChange]);

  // ── New compose ──
  const handleNewCompose = useCallback(() => {
    setSchema('');
    setParsedTables([]);
    setDialect('postgresql');
    setQuestion('');
    setResultText('');
    setStep(1);
    onRequestSidebarMenuChange?.('sql-compose');
  }, [onRequestSidebarMenuChange]);

  // ── Delete history ──
  const handleDeleteHistory = useCallback(async (id) => {
    await deleteEntry(id);
  }, [deleteEntry]);

  // ── Keyboard shortcut ──
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (step === 1 && schema.trim()) {
        setStep(2);
      } else if (step === 2) {
        handleGenerate();
      }
    }
  }, [step, schema, handleGenerate]);

  // ── Loading / error states ──
  if (settingsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6b7280' }}>
        <Loader2 size={24} className="animate-spin" style={{ marginRight: '8px' }} />
        설정 로드 중...
      </div>
    );
  }

  if (settingsError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#ef4444' }}>
        <AlertCircle size={20} style={{ marginRight: '8px' }} />
        {settingsError}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // History view
  // ─────────────────────────────────────────────────────────────────────────

  if (activeView === 'sql-history') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>SQL 생성 히스토리</h2>
          <button
            onClick={refreshHistory}
            disabled={historyLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '0.78rem',
            }}
          >
            <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {historyLoading && history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '0.85rem' }}>
              <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              히스토리 로딩 중...
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: '0.85rem' }}>
              <Database size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p>아직 생성 기록이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {history.map((item) => {
                const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata || '{}') : (item.metadata || {});
                return (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: 'white',
                    }}
                    onClick={() => handleLoadHistoryItem(item)}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; e.currentTarget.style.background = 'rgba(59,130,246,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; e.currentTarget.style.background = 'white'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title || '(제목 없음)'}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.72rem', color: '#9ca3af' }}>
                          {meta.dialect && (
                            <span style={{
                              padding: '1px 6px',
                              background: 'rgba(59,130,246,0.1)',
                              borderRadius: '4px',
                              color: '#3b82f6',
                              fontWeight: 500,
                            }}>
                              {meta.dialect}
                            </span>
                          )}
                          <span>{new Date(item.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteHistory(item.id); }}
                        style={{
                          padding: '4px',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: '#d1d5db',
                          borderRadius: '4px',
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; }}
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <style jsx global>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Compose view
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={20} style={{ color: '#3b82f6' }} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Text to SQL</h2>
            <p style={{ margin: 0, fontSize: '0.72rem', color: '#6b7280' }}>자연어로 질문하면 SQL을 생성해 드립니다</p>
          </div>
        </div>
        <button
          onClick={handleNewCompose}
          style={{
            padding: '6px 12px',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 500,
          }}
        >
          새 질문
        </button>
      </div>

      {/* Step indicator */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => setStep(1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            border: step === 1 ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '20px',
            background: step === 1 ? 'rgba(59,130,246,0.08)' : 'white',
            color: step === 1 ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: step === 1 ? 700 : 500,
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            width: '20px', height: '20px', borderRadius: '50%',
            background: step === 1 ? '#3b82f6' : '#e5e7eb',
            color: step === 1 ? 'white' : '#6b7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700,
          }}>1</span>
          스키마 (선택)
        </button>

        <ChevronRight size={14} style={{ color: '#d1d5db' }} />

        <button
          onClick={() => setStep(2)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            border: step === 2 ? '2px solid #3b82f6' : '1px solid rgba(0,0,0,0.1)',
            borderRadius: '20px',
            background: step === 2 ? 'rgba(59,130,246,0.08)' : 'white',
            color: step === 2 ? '#3b82f6' : '#6b7280',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: step === 2 ? 700 : 500,
            transition: 'all 0.15s',
          }}
        >
          <span style={{
            width: '20px', height: '20px', borderRadius: '50%',
            background: step === 2 ? '#3b82f6' : '#e5e7eb',
            color: step === 2 ? 'white' : '#6b7280',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: 700,
          }}>2</span>
          질문 → SQL 생성
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* ── Step 1: Schema input ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                테이블 스키마 (선택사항)
              </label>
              <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: '#6b7280' }}>
                CREATE TABLE 문을 붙여넣으면 더 정확한 SQL을 생성합니다.
                스키마 없이도 바로 질문할 수 있습니다.
              </p>
              <textarea
                ref={textareaRef}
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  email VARCHAR(255) UNIQUE,\n  created_at TIMESTAMP DEFAULT NOW()\n);\n\nCREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  user_id INT REFERENCES users(id),\n  amount DECIMAL(10,2),\n  status VARCHAR(20) DEFAULT 'pending'\n);`}
                style={{
                  width: '100%',
                  minHeight: '220px',
                  padding: '12px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.15)'; }}
              />
            </div>

            {parsedTables.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Table2 size={15} style={{ color: '#10b981' }} />
                  파싱된 테이블 ({parsedTables.length}개)
                </div>
                <SchemaVisualizer tables={parsedTables} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#3b82f6',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#2563eb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#3b82f6'; }}
              >
                {schema.trim() ? '다음: 질문 입력' : '바로 질문하기'}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Question + result ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {parsedTables.length > 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <Table2 size={14} style={{ color: '#10b981' }} />
                <span style={{ fontWeight: 600 }}>로드된 테이블:</span>
                {parsedTables.map((t) => (
                  <span key={t.name} style={{
                    padding: '1px 8px',
                    background: 'rgba(16,185,129,0.12)',
                    borderRadius: '4px',
                    fontWeight: 500,
                    fontFamily: 'monospace',
                  }}>
                    {t.name}
                  </span>
                ))}
                <button
                  onClick={() => setStep(1)}
                  style={{
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    background: 'white',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                  }}
                >
                  수정
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 180px' }}>
                <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>
                  SQL 방언
                </label>
                <select
                  value={dialect}
                  onChange={(e) => setDialect(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none cursor-pointer"
                >
                  {DIALECT_OPTIONS.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
              </div>

              {settings?.allowUserModelOverride && modelOptions.length > 0 && (
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>
                    모델
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm outline-none cursor-pointer"
                  >
                    {modelOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.categoryLabel})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>
                자연어 질문
              </label>
              <textarea
                ref={questionRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 최근 30일간 부서별 매출 합계를 구하고, 전월 대비 증감률을 계산해줘"
                style={{
                  width: '100%',
                  minHeight: '90px',
                  padding: '12px',
                  border: '1px solid rgba(0,0,0,0.15)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,0,0,0.15)'; }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleGenerate}
                disabled={!question.trim() || generating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  background: generating ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  cursor: !question.trim() || generating ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  opacity: !question.trim() ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (question.trim() && !generating) e.currentTarget.style.background = '#2563eb'; }}
                onMouseLeave={(e) => { if (!generating) e.currentTarget.style.background = '#3b82f6'; }}
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    SQL 생성
                  </>
                )}
              </button>

              {generating && (
                <button
                  onClick={abortGeneration}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  중단
                </button>
              )}
            </div>

            {generateError && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertCircle size={15} />
                {generateError}
              </div>
            )}

            {(resultText || streamingText) && (
              <div style={{ marginTop: '8px' }}>
                <SqlResultView
                  text={resultText || streamingText}
                  isStreaming={generating}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
