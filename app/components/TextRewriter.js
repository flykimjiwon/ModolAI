'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import { useAgentGenerate } from '@/hooks/useAgentGenerate';
import {
  Loader2,
  Sparkles,
  Copy,
  CheckCircle2,
  ChevronLeft,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
} from '@/components/icons';

const AGENT_ID = '4';

const TONE_PRESETS = [
  { id: 'formal', name: '공식적', icon: '📋' },
  { id: 'polite', name: '정중한', icon: '🤝' },
  { id: 'casual', name: '캐주얼', icon: '💬' },
  { id: 'academic', name: '학술적', icon: '🎓' },
  { id: 'persuasive', name: '설득적', icon: '🎯' },
  { id: 'concise', name: '간결한', icon: '✂️' },
  { id: 'detailed', name: '상세한', icon: '📖' },
  { id: 'humorous', name: '유머러스', icon: '😄' },
];

const PURPOSE_OPTIONS = [
  { id: '', name: '용도 선택 (선택사항)' },
  { id: 'email', name: '이메일' },
  { id: 'report', name: '보고서' },
  { id: 'proposal', name: '제안서' },
  { id: 'minutes', name: '회의록' },
  { id: 'announcement', name: '공지' },
  { id: 'sns', name: 'SNS' },
  { id: 'presentation-script', name: '프레젠대본' },
  { id: 'memo', name: '메모' },
  { id: 'apology', name: '사과문' },
  { id: 'thank-you', name: '감사편지' },
];

const MAX_TEXT_LENGTH = 5000;

export default function TextRewriter({ sidebarMenu, onRequestSidebarMenuChange }) {
  // ── Settings state ──
  const [modelOptions, setModelOptions] = useState([]);
  const [allowUserModelOverride, setAllowUserModelOverride] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(true);

  // ── Input state ──
  const [inputText, setInputText] = useState('');
  const [selectedTone, setSelectedTone] = useState('formal');
  const [selectedPurpose, setSelectedPurpose] = useState('');

  // ── Result state ──
  const [resultText, setResultText] = useState('');
  const [copied, setCopied] = useState(false);

  // ── History ──
  const { history, loading: historyLoading, saveEntry, deleteEntry, refreshHistory } =
    useAgentHistory(AGENT_ID);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // ── Streaming ──
  const { generate, loading: generating, error, streamingText, abortGeneration } =
    useAgentGenerate('/api/webapp-text-rewriter');

  const inputRef = useRef(null);
  const resultRef = useRef(null);

  // ── Load settings ──
  useEffect(() => {
    async function loadSettings() {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/webapp-text-rewriter', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAllowUserModelOverride(data.settings?.allowUserModelOverride === true);
          setSelectedModel(data.settings?.selectedModelId || '');
          setModelOptions(Array.isArray(data?.modelOptions) ? data.modelOptions : []);
        }
      } catch (err) {
        console.warn('[TextRewriter] Failed to load settings:', err.message);
      } finally {
        setSettingsLoading(false);
      }
    }
    loadSettings();
  }, []);

  // ── Generate rewrite ──
  const handleGenerate = useCallback(async () => {
    if (!inputText.trim() || generating) return;

    setResultText('');
    setCopied(false);

    const body = {
      text: inputText.trim(),
      tone: selectedTone,
      purpose: selectedPurpose || undefined,
      model: selectedModel || undefined,
    };

    const entryId = `rewrite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toneName = TONE_PRESETS.find((t) => t.id === selectedTone)?.name || selectedTone;
    const purposeName = PURPOSE_OPTIONS.find((p) => p.id === selectedPurpose)?.name || '';

    const result = await generate(body, {
      onDone: async (finalText) => {
        setResultText(finalText);
        const title = `${toneName}${purposeName ? ` · ${purposeName}` : ''} — ${inputText.slice(0, 30)}${inputText.length > 30 ? '...' : ''}`;
        await saveEntry(entryId, {
          title,
          inputData: { text: inputText, tone: selectedTone, purpose: selectedPurpose },
          outputText: finalText,
          metadata: { tone: selectedTone, purpose: selectedPurpose },
        });
      },
    });

    if (!result) {
      setResultText('');
    }
  }, [inputText, selectedTone, selectedPurpose, selectedModel, generating, generate, saveEntry]);

  // ── Copy ──
  const handleCopy = useCallback(async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn('[TextRewriter] Copy failed');
    }
  }, []);

  // ── History item select ──
  const handleHistorySelect = useCallback((item) => {
    setSelectedHistoryItem(item);
    if (item.input_data) {
      try {
        const data = typeof item.input_data === 'string' ? JSON.parse(item.input_data) : item.input_data;
        setInputText(data.text || '');
        setSelectedTone(data.tone || 'formal');
        setSelectedPurpose(data.purpose || '');
      } catch {
        console.warn('[TextRewriter] Failed to parse input_data');
      }
    }
    setResultText(item.output_text || '');
    onRequestSidebarMenuChange?.('tone-templates');
  }, [onRequestSidebarMenuChange]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    setInputText('');
    setSelectedTone('formal');
    setSelectedPurpose('');
    setResultText('');
    setSelectedHistoryItem(null);
    setCopied(false);
    inputRef.current?.focus();
  }, []);

  // ── Char diff calculation ──
  const displayText = generating ? streamingText : resultText;
  const charDiff = displayText ? displayText.length - inputText.length : 0;
  const charDiffLabel = charDiff > 0 ? `+${charDiff}` : `${charDiff}`;

  // ── Loading ──
  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2 text-sm">Loading settings...</span>
      </div>
    );
  }

  // ── History tab ──
  if (sidebarMenu === 'rewrite-history') {
    return (
      <div className="h-full flex flex-col bg-background text-foreground">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold">Rewrite History</h2>
          <button
            onClick={refreshHistory}
            disabled={historyLoading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw size={16} className={historyLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-center mt-10 text-sm">
              No history yet.
            </p>
          ) : (
            history.map((item) => {
              let meta = {};
              try {
                meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : (item.metadata || {});
              } catch { /* corrupted metadata */ }
              const toneName = TONE_PRESETS.find((t) => t.id === meta.tone)?.name || '';
              return (
                <div
                  key={item.id}
                  onClick={() => handleHistorySelect(item)}
                  className="p-3 rounded-lg bg-muted border border-border cursor-pointer hover:bg-muted/80 transition-colors"
                >
                  <div className="text-sm font-semibold text-foreground mb-1 leading-snug">
                    {item.title || '(No title)'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {toneName && (
                      <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[11px]">
                        {toneName}
                      </span>
                    )}
                    <span>{new Date(item.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteEntry(item.id); }}
                      className="text-muted-foreground hover:text-red-500 dark:hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Compose tab ──
  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
        {selectedHistoryItem && (
          <button onClick={handleReset} className="text-muted-foreground hover:text-foreground">
            <ChevronLeft size={20} />
          </button>
        )}
        <ArrowRightLeft size={20} className="text-blue-500 dark:text-blue-400" />
        <h2 className="text-lg font-bold">텍스트 재작성</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Tone selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">톤 선택</label>
          <div className="grid grid-cols-4 gap-1.5">
            {TONE_PRESETS.map((tone) => (
              <button
                key={tone.id}
                onClick={() => setSelectedTone(tone.id)}
                className={`py-2 px-1 rounded-lg border text-xs font-medium text-center transition-all ${
                  selectedTone === tone.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className="block text-base mb-0.5">{tone.icon}</span>
                {tone.name}
              </button>
            ))}
          </div>
        </div>

        {/* Purpose selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">용도 (선택사항)</label>
          <select
            value={selectedPurpose}
            onChange={(e) => setSelectedPurpose(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          >
            {PURPOSE_OPTIONS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Model selection (when admin allows) */}
        {allowUserModelOverride && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">모델 선택 (관리자 허용 시)</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
            >
              <option value="">기본 모델 사용</option>
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>[{m.categoryLabel}] {m.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Original text input */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-foreground">원본 텍스트</label>
            <span className={`text-xs ${inputText.length > MAX_TEXT_LENGTH ? 'text-red-500' : 'text-muted-foreground'}`}>
              {inputText.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}자
            </span>
          </div>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="재작성할 텍스트를 입력하세요..."
            maxLength={MAX_TEXT_LENGTH}
            rows={6}
            className="w-full px-3.5 py-3 border border-border rounded-lg bg-background text-foreground text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-muted-foreground"
          />
        </div>

        {/* Generate / Abort button */}
        <button
          onClick={generating ? abortGeneration : handleGenerate}
          disabled={!inputText.trim() && !generating}
          className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            generating
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : !inputText.trim()
                ? 'bg-blue-300 dark:bg-blue-900/40 text-white cursor-not-allowed opacity-50'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {generating ? (
            <><Loader2 size={18} className="animate-spin" /> 중단</>
          ) : (
            <><Sparkles size={18} /> 재작성하기</>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Result area: side-by-side comparison */}
        {(displayText || generating) && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-foreground">결과 비교</label>
              {displayText && (
                <span className={`text-xs font-semibold ${charDiff === 0 ? 'text-muted-foreground' : charDiff > 0 ? 'text-green-500' : 'text-amber-500'}`}>
                  {displayText.length.toLocaleString()}자 ({charDiffLabel})
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5" style={{ minHeight: 160 }}>
              {/* Original */}
              <div className="p-3 rounded-lg bg-muted border border-border text-sm leading-relaxed text-muted-foreground overflow-y-auto max-h-72 whitespace-pre-wrap break-words">
                <div className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase">원본</div>
                {inputText || '(입력 텍스트 없음)'}
              </div>

              {/* Rewritten result */}
              <div
                ref={resultRef}
                className="p-3 rounded-lg bg-muted border border-blue-200 dark:border-blue-800 text-sm leading-relaxed text-foreground overflow-y-auto max-h-72 whitespace-pre-wrap break-words relative"
              >
                <div className="text-[11px] font-semibold text-blue-500 dark:text-blue-400 mb-2 uppercase">재작성</div>
                {displayText || (generating ? '생성 중...' : '')}
                {generating && (
                  <span className="inline-block w-1.5 h-4 bg-blue-500 ml-0.5 align-text-bottom animate-pulse" />
                )}
              </div>
            </div>

            {/* Copy / New write buttons */}
            {displayText && !generating && (
              <div className="flex justify-end mt-2 gap-2">
                <button
                  onClick={() => handleCopy(displayText)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                    copied
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? '복사 완료' : '결과 복사'}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted text-xs font-semibold"
                >
                  <RefreshCw size={14} />
                  새로 작성
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
