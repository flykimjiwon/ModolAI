'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import { useAgentGenerate } from '@/hooks/useAgentGenerate';
import {
  Loader2,
  AlertTriangle,
  Trash2,
  Copy,
  CheckCircle2,
  Bug,
  Search,
  ChevronRight,
  RefreshCw,
  XCircle,
  Sparkles,
} from '@/components/icons';
import {
  LANGUAGE_DETECT_PATTERNS,
  COMMON_ERROR_CATEGORIES,
} from '@/lib/agent-data/error-helper';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function detectLanguageAndFramework(text) {
  if (!text || typeof text !== 'string') return { language: '', framework: '' };

  const scores = {};
  for (const entry of LANGUAGE_DETECT_PATTERNS) {
    if (entry.pattern.test(text)) {
      const key = entry.lang;
      const prev = scores[key] || 0;
      scores[key] = Math.max(prev, entry.confidence);
    }
  }

  let language = '';
  let framework = '';
  let maxLangScore = 0;
  let maxFrameworkScore = 0;

  for (const [key, score] of Object.entries(scores)) {
    const entry = LANGUAGE_DETECT_PATTERNS.find((p) => p.lang === key);
    if (entry?.framework) {
      if (score > maxFrameworkScore) {
        maxFrameworkScore = score;
        framework = key;
      }
    } else {
      if (score > maxLangScore) {
        maxLangScore = score;
        language = key;
      }
    }
  }

  return { language, framework };
}

function generateEntryId() {
  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const LANG_COLORS = {
  python: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  java: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  javascript: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  typescript: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  go: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300',
  rust: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  cpp: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  csharp: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  react: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  nextjs: 'bg-gray-100 text-gray-800 dark:bg-gray-700/60 dark:text-gray-300',
  spring: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  django: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  fastapi: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  express: 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300',
  docker: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  kubernetes: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ErrorHelper({ sidebarMenu, onRequestSidebarMenuChange }) {
  // Settings & model
  const [settings, setSettings] = useState(null);
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Input
  const [errorMessage, setErrorMessage] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [detectedLang, setDetectedLang] = useState('');
  const [detectedFramework, setDetectedFramework] = useState('');

  // Result
  const [resultText, setResultText] = useState('');
  const [copied, setCopied] = useState(false);

  // History & streaming
  const { history, loading: historyLoading, saveEntry, deleteEntry } = useAgentHistory('5');
  const { generate, loading: generating, error: generateError, streamingText, abortGeneration } = useAgentGenerate('/api/webapp-error-helper');

  const errorTextareaRef = useRef(null);
  const resultRef = useRef(null);

  // ── Load settings ──
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        if (!token) return;
        const res = await fetch('/api/webapp-error-helper', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings);
          setModelOptions(data.modelOptions || []);
          if (data.settings?.selectedModelId) {
            setSelectedModel(data.settings.selectedModelId);
          }
        }
      } catch (err) {
        console.warn('[ErrorHelper] Failed to load settings:', err.message);
      } finally {
        setSettingsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // ── Auto-detect language/framework ──
  useEffect(() => {
    const combined = `${errorMessage}\n${codeSnippet}`;
    const { language, framework } = detectLanguageAndFramework(combined);
    setDetectedLang(language);
    setDetectedFramework(framework);
  }, [errorMessage, codeSnippet]);

  // ── Scroll result on stream ──
  useEffect(() => {
    if (streamingText && resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight;
    }
  }, [streamingText]);

  // ── Generate handler ──
  const handleGenerate = useCallback(async () => {
    if (!errorMessage.trim() || generating) return;

    const entryId = generateEntryId();

    const result = await generate(
      {
        errorMessage: errorMessage.trim(),
        codeSnippet: codeSnippet.trim(),
        language: detectedLang,
        framework: detectedFramework,
        model: selectedModel,
      },
      {
        onDone: async (text) => {
          setResultText(text || '');
          if (text) {
            await saveEntry(entryId, {
              title: errorMessage.trim().slice(0, 80),
              inputData: {
                errorMessage: errorMessage.trim(),
                codeSnippet: codeSnippet.trim(),
                language: detectedLang,
                framework: detectedFramework,
              },
              outputText: text,
              metadata: { language: detectedLang, framework: detectedFramework },
            });
          }
        },
        onError: (err) => {
          console.error('[ErrorHelper] Generation failed:', err);
        },
      }
    );

    if (result) {
      setResultText(result);
    }
  }, [errorMessage, codeSnippet, detectedLang, detectedFramework, selectedModel, generating, generate, saveEntry]);

  // ── Load history item ──
  const handleLoadHistoryItem = useCallback((item) => {
    if (item?.input_data) {
      setErrorMessage(item.input_data.errorMessage || '');
      setCodeSnippet(item.input_data.codeSnippet || '');
    }
    setResultText(item?.output_text || '');
    onRequestSidebarMenuChange('');
  }, [onRequestSidebarMenuChange]);

  // ── Delete history item ──
  const handleDeleteHistoryItem = useCallback(async (id) => {
    await deleteEntry(id);
  }, [deleteEntry]);

  // ── Copy ──
  const handleCopy = useCallback(async () => {
    const text = resultText || streamingText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [resultText, streamingText]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setErrorMessage('');
    setCodeSnippet('');
    setResultText('');
  }, []);

  // ── Quick error category select ──
  const handleQuickCategory = useCallback((category) => {
    const example = category.keywords[0] || '';
    setErrorMessage((prev) => (prev ? `${prev}\n${example}` : example));
    onRequestSidebarMenuChange('');
    setTimeout(() => errorTextareaRef.current?.focus(), 100);
  }, [onRequestSidebarMenuChange]);

  // ── Current display text ──
  const displayText = generating ? streamingText : resultText;

  // ── Sidebar tab rendering ──
  const currentView = useMemo(() => {
    if (sidebarMenu === 'error-history') return 'history';
    return 'compose';
  }, [sidebarMenu]);

  // ────────────────────────────────────────────────────────────────
  // Render: history view
  // ────────────────────────────────────────────────────────────────
  if (currentView === 'history') {
    return (
      <div className="flex flex-col h-full bg-muted/30 dark:bg-background">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Analysis History</h2>
          <p className="text-sm text-muted-foreground mt-1">View previous error analysis results</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bug className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>No analysis history yet</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="bg-background rounded-lg border border-border p-3 hover:border-red-300 dark:hover:border-red-600 transition-colors cursor-pointer"
                onClick={() => handleLoadHistoryItem(item)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title || 'Error Analysis'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.metadata?.language && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${LANG_COLORS[item.metadata.language] || 'bg-muted text-muted-foreground'}`}>
                          {item.metadata.language}
                        </span>
                      )}
                      {item.metadata?.framework && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${LANG_COLORS[item.metadata.framework] || 'bg-muted text-muted-foreground'}`}>
                          {item.metadata.framework}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('ko-KR') : ''}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteHistoryItem(item.id); }}
                    className="p-1 text-muted-foreground hover:text-red-500 transition-colors shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Render: common error categories
  // ────────────────────────────────────────────────────────────────
  if (currentView === 'common-errors') {
    return (
      <div className="flex flex-col h-full bg-muted/30 dark:bg-background">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Common Errors</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a category to add it to the error input</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {COMMON_ERROR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleQuickCategory(cat)}
              className="w-full flex items-center gap-3 p-3 bg-background rounded-lg border border-border hover:border-red-300 dark:hover:border-red-600 transition-colors text-left"
            >
              <span className="text-2xl shrink-0">{cat.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{cat.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {cat.keywords.join(', ')}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  // Render: main (compose)
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-muted/30 dark:bg-background">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">에러 해결 도우미</h1>
            <p className="text-sm text-muted-foreground">에러 메시지를 입력하면 원인과 해결책을 분석합니다</p>
          </div>
        </div>

        {/* Detected language/framework badges */}
        {(detectedLang || detectedFramework) && (
          <div className="flex items-center gap-2 mt-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Auto-detected:</span>
            {detectedLang && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LANG_COLORS[detectedLang] || 'bg-muted text-muted-foreground'}`}>
                {detectedLang}
              </span>
            )}
            {detectedFramework && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LANG_COLORS[detectedFramework] || 'bg-muted text-muted-foreground'}`}>
                {detectedFramework}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4 space-y-3 border-b border-border">
        {/* Error message */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            에러 메시지 / 스택 트레이스
          </label>
          <textarea
            ref={errorTextareaRef}
            value={errorMessage}
            onChange={(e) => setErrorMessage(e.target.value)}
            placeholder="에러 메시지나 스택 트레이스를 붙여넣으세요..."
            className="w-full h-32 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-y font-mono"
            disabled={generating}
          />
        </div>

        {/* Related code (optional) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            관련 코드 <span className="text-muted-foreground font-normal">(선택)</span>
          </label>
          <textarea
            value={codeSnippet}
            onChange={(e) => setCodeSnippet(e.target.value)}
            placeholder="에러가 발생한 코드를 붙여넣으세요..."
            className="w-full h-24 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-y font-mono"
            disabled={generating}
          />
        </div>

        {/* Model select + action buttons */}
        <div className="flex items-center gap-2">
          {settings?.allowUserModelOverride && modelOptions.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={generating}
            >
              <option value="">Default model</option>
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.categoryLabel})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleReset}
            disabled={generating}
            className="px-3 py-2 text-sm border border-border rounded-lg text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Reset"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {generating ? (
            <button
              onClick={abortGeneration}
              className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <XCircle className="h-4 w-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!errorMessage.trim() || settingsLoading}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              분석하기
            </button>
          )}
        </div>

        {/* Error message */}
        {generateError && (
          <div className="p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
            {generateError}
          </div>
        )}
      </div>

      {/* Result area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {displayText ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Analysis complete
                  </>
                )}
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Copy"
              >
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div
              ref={resultRef}
              className="flex-1 overflow-y-auto p-4 prose prose-sm dark:prose-invert max-w-none"
            >
              <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed font-mono">
                {displayText}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Bug className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">에러 메시지를 입력하세요</p>
              <p className="text-sm mt-1">스택 트레이스를 붙여넣으면 자동으로 언어를 감지합니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
