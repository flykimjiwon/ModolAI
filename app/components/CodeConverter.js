'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import { useAgentGenerate } from '@/hooks/useAgentGenerate';
import {
  Loader2,
  ArrowRightLeft,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  Code2,
  FileCode,
} from '@/components/icons';

const EXPLANATION_SEPARATOR = '<!-- EXPLANATION -->';

const DEFAULT_LANGUAGES = [
  { id: 'python', name: 'Python', extension: '.py' },
  { id: 'javascript', name: 'JavaScript', extension: '.js' },
  { id: 'typescript', name: 'TypeScript', extension: '.ts' },
  { id: 'java', name: 'Java', extension: '.java' },
  { id: 'go', name: 'Go', extension: '.go' },
  { id: 'rust', name: 'Rust', extension: '.rs' },
  { id: 'cpp', name: 'C++', extension: '.cpp' },
  { id: 'csharp', name: 'C#', extension: '.cs' },
  { id: 'kotlin', name: 'Kotlin', extension: '.kt' },
  { id: 'swift', name: 'Swift', extension: '.swift' },
];

export default function CodeConverter({ sidebarMenu, onRequestSidebarMenuChange }) {
  // ─── Settings & language list ─────────────────────────────────────────────
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);
  const [settings, setSettings] = useState(null);
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');

  // ─── Input state ──────────────────────────────────────────────────────────
  const [sourceLanguage, setSourceLanguage] = useState('python');
  const [targetLanguage, setTargetLanguage] = useState('javascript');
  const [sourceCode, setSourceCode] = useState('');
  const [explainDifferences, setExplainDifferences] = useState(true);

  // ─── Output state ─────────────────────────────────────────────────────────
  const [convertedCode, setConvertedCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── History & streaming ──────────────────────────────────────────────────
  const { history, loading: historyLoading, saveEntry, deleteEntry, refreshHistory } = useAgentHistory('2');
  const { generate, loading: generating, error, streamingText, abortGeneration } = useAgentGenerate('/api/webapp-code-convert');

  const sourceTextareaRef = useRef(null);
  const resultRef = useRef(null);
  const copyTimerRef = useRef(null);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortGeneration();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [abortGeneration]);

  // ─── Load settings ────────────────────────────────────────────────────────
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        const res = await fetch('/api/webapp-code-convert', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings || {});
          setModelOptions(data.modelOptions || []);
          if (data.languages?.length) setLanguages(data.languages);
        }
      } catch (err) {
        console.warn('[CodeConverter] Failed to load settings:', err.message);
      }
    };
    loadSettings();
  }, []);

  // ─── Parse streaming text ─────────────────────────────────────────────────
  useEffect(() => {
    if (!streamingText) return;
    const idx = streamingText.indexOf(EXPLANATION_SEPARATOR);
    if (idx !== -1) {
      setConvertedCode(streamingText.slice(0, idx).trim());
      setExplanation(streamingText.slice(idx + EXPLANATION_SEPARATOR.length).trim());
    } else {
      setConvertedCode(streamingText);
    }
  }, [streamingText]);

  // ─── Swap languages ───────────────────────────────────────────────────────
  const swapLanguages = useCallback(() => {
    const prevSource = sourceLanguage;
    const prevTarget = targetLanguage;
    setSourceLanguage(prevTarget);
    setTargetLanguage(prevSource);
    if (convertedCode) {
      setSourceCode(convertedCode);
      setConvertedCode('');
      setExplanation('');
    }
  }, [sourceLanguage, targetLanguage, convertedCode]);

  // ─── Run conversion ───────────────────────────────────────────────────────
  const handleConvert = useCallback(async () => {
    if (!sourceCode.trim() || generating) return;
    if (sourceLanguage === targetLanguage) return;
    if (sourceCode.trim().length > 50000) return;

    setConvertedCode('');
    setExplanation('');
    setShowExplanation(false);

    const body = {
      sourceCode: sourceCode.trim(),
      sourceLanguage,
      targetLanguage,
      explainDifferences,
    };
    if (selectedModel) body.model = selectedModel;

    await generate(body, {
      onDone: async (fullText) => {
        let code = fullText;
        let expl = '';
        const sepIdx = fullText.indexOf(EXPLANATION_SEPARATOR);
        if (sepIdx !== -1) {
          code = fullText.slice(0, sepIdx).trim();
          expl = fullText.slice(sepIdx + EXPLANATION_SEPARATOR.length).trim();
        }
        setConvertedCode(code);
        setExplanation(expl);

        // Save to history
        const entryId = `cc-${Date.now()}`;
        const srcLang = languages.find((l) => l.id === sourceLanguage);
        const tgtLang = languages.find((l) => l.id === targetLanguage);
        const title = `${srcLang?.name || sourceLanguage} → ${tgtLang?.name || targetLanguage}`;
        await saveEntry(entryId, {
          title,
          inputData: { sourceCode: sourceCode.trim(), sourceLanguage, targetLanguage },
          outputData: { convertedCode: code, explanation: expl },
          outputText: code,
          metadata: { explainDifferences },
        });
      },
    });
  }, [sourceCode, sourceLanguage, targetLanguage, explainDifferences, selectedModel, generating, generate, saveEntry, languages]);

  // ─── Load history item ────────────────────────────────────────────────────
  const loadHistoryItem = useCallback((item) => {
    if (item.input_data) {
      setSourceCode(item.input_data.sourceCode || '');
      setSourceLanguage(item.input_data.sourceLanguage || 'python');
      setTargetLanguage(item.input_data.targetLanguage || 'javascript');
    }
    if (item.output_data) {
      setConvertedCode(item.output_data.convertedCode || '');
      setExplanation(item.output_data.explanation || '');
    }
    onRequestSidebarMenuChange?.('code-compose');
  }, [onRequestSidebarMenuChange]);

  // ─── Copy ─────────────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!convertedCode) return;
    try {
      await navigator.clipboard.writeText(convertedCode);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not supported in this environment
    }
  }, [convertedCode]);

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSourceCode('');
    setConvertedCode('');
    setExplanation('');
    setShowExplanation(false);
    sourceTextareaRef.current?.focus();
  }, []);

  // ─── Filter target language options ───────────────────────────────────────
  const targetLanguageOptions = useMemo(
    () => languages.filter((l) => l.id !== sourceLanguage),
    [languages, sourceLanguage]
  );

  // Auto-change target language if source matches
  useEffect(() => {
    if (sourceLanguage === targetLanguage) {
      const alt = languages.find((l) => l.id !== sourceLanguage);
      if (alt) setTargetLanguage(alt.id);
    }
  }, [sourceLanguage, targetLanguage, languages]);

  // ─── Line count calculation ────────────────────────────────────────────────
  const sourceLineCount = useMemo(() => {
    const count = (sourceCode || '').split('\n').length;
    return Math.max(count, 10);
  }, [sourceCode]);

  const resultLineCount = useMemo(() => {
    const count = (convertedCode || streamingText || '').split('\n').length;
    return Math.max(count, 10);
  }, [convertedCode, streamingText]);

  const isHistory = sidebarMenu === 'convert-history' || sidebarMenu === 'code-history' || sidebarMenu === 'history';

  // =====================================================================
  // History view
  // =====================================================================
  if (isHistory) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>변환 히스토리</h2>
          <button
            onClick={refreshHistory}
            disabled={historyLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>

        {historyLoading && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            히스토리 로딩 중...
          </div>
        )}

        {!historyLoading && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: '#9ca3af' }}>
            변환 히스토리가 없습니다.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {history.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #e5e7eb', borderRadius: 10, padding: '1rem',
                background: '#fff', cursor: 'pointer', transition: 'border-color 0.15s',
              }}
              onClick={() => loadHistoryItem(item)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#93c5fd')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileCode size={16} style={{ color: '#3b82f6' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEntry(item.id);
                    }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#9ca3af', padding: 4, borderRadius: 4,
                    }}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {item.output_text && (
                <pre style={{
                  marginTop: 8, padding: '0.6rem', background: '#f9fafb',
                  borderRadius: 6, fontSize: '0.8rem', color: '#374151',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre',
                  maxHeight: 80,
                }}>
                  {item.output_text.slice(0, 200)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // =====================================================================
  // Main conversion view
  // =====================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top control bar */}
      <div className="bg-muted border-b border-border" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        flexShrink: 0, flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Source language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label className="text-foreground" style={{ fontSize: '0.82rem', fontWeight: 600 }}>소스</label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="bg-background text-foreground border-border"
              style={{ padding: '5px 10px', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {languages.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <button
            onClick={swapLanguages}
            className="bg-background border-border hover:bg-muted"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: '50%',
              borderWidth: 1, borderStyle: 'solid', cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            title="언어 교환"
          >
            <ArrowRightLeft size={14} style={{ color: '#3b82f6' }} />
          </button>

          {/* Target language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label className="text-foreground" style={{ fontSize: '0.82rem', fontWeight: 600 }}>대상</label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="bg-background text-foreground border-border"
              style={{ padding: '5px 10px', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {targetLanguageOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Explain differences toggle */}
          <label className="text-muted-foreground" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: '0.82rem', cursor: 'pointer', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={explainDifferences}
              onChange={(e) => setExplainDifferences(e.target.checked)}
              style={{ accentColor: '#3b82f6' }}
            />
            변환 설명 포함
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Model selector (if allowed by settings) */}
          {settings?.allowUserModelOverride && modelOptions.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-background text-foreground border-border"
              style={{ padding: '5px 10px', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', fontSize: '0.82rem', maxWidth: 180 }}
            >
              <option value="">기본 모델</option>
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          )}

          {/* Reset */}
          <button
            onClick={handleReset}
            className="bg-background text-muted-foreground border-border hover:bg-muted"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '6px 12px', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer', fontSize: '0.82rem',
            }}
          >
            <RefreshCw size={13} />
            초기화
          </button>

          {/* Convert / Abort button */}
          <button
            onClick={generating ? abortGeneration : handleConvert}
            disabled={!sourceCode.trim() && !generating}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', borderRadius: 8,
              border: 'none',
              background: generating ? '#ef4444' : '#3b82f6',
              color: '#fff', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
              opacity: (!sourceCode.trim() && !generating) ? 0.5 : 1,
              transition: 'background 0.15s',
            }}
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                중단
              </>
            ) : (
              <>
                <Code2 size={15} />
                변환
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 text-red-600 dark:text-red-400" style={{
          padding: '0.6rem 1.25rem', fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      {/* Split code area */}
      <div style={{
        display: 'flex', flex: 1, overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Left: source code */}
        <div className="border-r border-border" style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          <div className="bg-muted border-b border-border text-muted-foreground" style={{
            padding: '0.5rem 1rem', fontSize: '0.8rem',
            fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Code2 size={14} />
            {languages.find((l) => l.id === sourceLanguage)?.name || sourceLanguage}
            <span className="text-muted-foreground" style={{ fontWeight: 400, opacity: 0.7 }}>
              ({languages.find((l) => l.id === sourceLanguage)?.extension || ''})
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'auto', minHeight: 200 }}>
            <div style={{ display: 'flex', minHeight: '100%' }}>
              {/* Line numbers */}
              <div className="bg-muted text-muted-foreground border-r border-border" style={{
                padding: '0.75rem 0', textAlign: 'right', userSelect: 'none',
                fontSize: '0.82rem', fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                lineHeight: '1.408rem', minWidth: 40, paddingRight: 8, flexShrink: 0,
              }}>
                {Array.from({ length: sourceLineCount }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                ref={sourceTextareaRef}
                value={sourceCode}
                onChange={(e) => setSourceCode(e.target.value)}
                placeholder="변환할 코드를 붙여넣으세요..."
                spellCheck={false}
                className="text-foreground placeholder:text-muted-foreground"
                style={{
                  flex: 1, padding: '0.75rem 1rem', border: 'none', outline: 'none',
                  resize: 'none', fontSize: '0.88rem', lineHeight: '1.408rem',
                  fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                  background: 'transparent',
                  minHeight: '100%', width: '100%',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: result code */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        }}>
          <div className="bg-muted border-b border-border text-muted-foreground" style={{
            padding: '0.5rem 1rem', fontSize: '0.8rem',
            fontWeight: 600, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileCode size={14} />
              {languages.find((l) => l.id === targetLanguage)?.name || targetLanguage}
              <span className="text-muted-foreground" style={{ fontWeight: 400, opacity: 0.7 }}>
                ({languages.find((l) => l.id === targetLanguage)?.extension || ''})
              </span>
            </div>
            {convertedCode && (
              <button
                onClick={handleCopy}
                className="bg-background text-muted-foreground border-border hover:bg-muted"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 5, borderWidth: 1, borderStyle: 'solid', cursor: 'pointer', fontSize: '0.78rem',
                }}
              >
                {copied ? <Check size={12} style={{ color: '#22c55e' }} /> : <Copy size={12} />}
                {copied ? '복사됨' : '복사'}
              </button>
            )}
          </div>
          <div ref={resultRef} style={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
            {!convertedCode && !generating && !streamingText ? (
              <div className="text-muted-foreground" style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%',
                fontSize: '0.9rem', gap: 8,
              }}>
                <ArrowRightLeft size={32} style={{ opacity: 0.3 }} />
                <span>변환 결과가 여기에 표시됩니다</span>
              </div>
            ) : (
              <div style={{ display: 'flex', minHeight: '100%' }}>
                {/* Line numbers */}
                <div className="bg-muted text-muted-foreground border-r border-border" style={{
                  padding: '0.75rem 0', textAlign: 'right', userSelect: 'none',
                  fontSize: '0.82rem', fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                  lineHeight: '1.408rem', minWidth: 40, paddingRight: 8, flexShrink: 0,
                }}>
                  {Array.from({ length: resultLineCount }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre className="text-foreground" style={{
                  flex: 1, padding: '0.75rem 1rem', margin: 0,
                  fontSize: '0.88rem', lineHeight: '1.408rem',
                  fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: 'transparent',
                }}>
                  {convertedCode || streamingText}
                  {generating && <span className="animate-pulse" style={{ color: '#3b82f6' }}>|</span>}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: conversion explanation */}
      {(explanation || (generating && streamingText?.includes(EXPLANATION_SEPARATOR))) && (
        <div className="border-t border-border bg-muted" style={{ flexShrink: 0 }}>
          <button
            onClick={() => setShowExplanation((v) => !v)}
            className="text-foreground hover:bg-muted"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.6rem 1.25rem', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
            }}
          >
            <span>변환 설명</span>
            {showExplanation ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          {showExplanation && (
            <div className="text-foreground" style={{
              padding: '0 1.25rem 1rem', fontSize: '0.88rem',
              lineHeight: 1.7, maxHeight: 200, overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
