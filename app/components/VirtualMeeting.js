'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Plus,
  Trash2,
  Loader2,
  Copy,
  Check,
  History,
  Play,
  Pause,
  RotateCcw,
  MessageSquare,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  X,
  ChevronDown,
  ChevronUp,
  Settings,
  Crown,
  Pencil,
} from '@/components/icons';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import {
  PERSONA_TEMPLATES,
  MEETING_FORMATS,
  DISCUSSION_FRAMEWORKS,
  PERSONA_COLORS,
  MAX_PARTICIPANTS,
} from '@/lib/agent-data/virtual-meeting';

// ─────────────────────────────────────────────────────────────────────────────
// Persona emoji mapping
// ─────────────────────────────────────────────────────────────────────────────
const PERSONA_EMOJIS = {
  pm: '📋',
  'senior-dev': '👨‍💻',
  'junior-dev': '🧑‍💻',
  'ux-designer': '🎨',
  'qa-engineer': '🔍',
  'business-analyst': '📊',
  cto: '🏛️',
  'marketing-manager': '📢',
  'hr-manager': '🤝',
  'finance-manager': '💰',
  'legal-advisor': '⚖️',
  'data-scientist': '🔬',
};

const getPersonaEmoji = (persona) => {
  if (persona?.id && PERSONA_EMOJIS[persona.id]) return PERSONA_EMOJIS[persona.id];
  const role = (persona?.role || '').toLowerCase();
  if (role.includes('개발') || role.includes('dev')) return '💻';
  if (role.includes('디자인') || role.includes('design')) return '🎨';
  if (role.includes('마케팅') || role.includes('market')) return '📢';
  if (role.includes('기획') || role.includes('plan')) return '📝';
  if (role.includes('대표') || role.includes('ceo')) return '👔';
  return '👤';
};

// ─────────────────────────────────────────────────────────────────────────────
// Typing indicator component
// ─────────────────────────────────────────────────────────────────────────────
function TypingIndicator({ speaker, role, emoji, color, isFirst }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 px-4 py-3 animate-fade-in">
      <div className={`w-10 h-10 rounded-full ${color.bg} flex items-center justify-center flex-shrink-0 text-lg`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-semibold ${color.text}`}>{speaker}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <span className="text-xs">
            {isFirst
              ? t('virtual_meeting.preparing_speech', 'Preparing to speak')
              : t('virtual_meeting.reading_thinking', 'Reading previous messages and thinking')}
          </span>
          <span className="flex gap-0.5 ml-1">
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat message component
// ─────────────────────────────────────────────────────────────────────────────
function ChatBubble({ speaker, role, message, emoji, color }) {
  return (
    <div className="flex gap-3 px-4 py-3 animate-fade-in">
      <div className={`w-10 h-10 rounded-full ${color.bg} flex items-center justify-center flex-shrink-0 text-lg`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-sm font-semibold ${color.text}`}>{speaker}</span>
          <span className="text-xs text-muted-foreground">{role}</span>
        </div>
        <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {message}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Round divider
// ─────────────────────────────────────────────────────────────────────────────
function RoundDivider({ roundNumber, totalRounds }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1 border-t border-border" />
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {t('virtual_meeting.round', 'Round')} {roundNumber}{totalRounds ? ` / ${totalRounds}` : ''}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summarizing indicator
// ─────────────────────────────────────────────────────────────────────────────
function SummarizingIndicator() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-4 animate-fade-in">
      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-lg">
        📝
      </div>
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">
          {t('virtual_meeting.summarizing', 'Analyzing and summarizing the meeting...')}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function VirtualMeeting({ sidebarMenu = '', onRequestSidebarMenuChange = null }) {
  const { t } = useTranslation();
  const { history, loading: historyLoading, saveEntry, deleteEntry } = useAgentHistory('1');

  // ── State ('setup' | 'generating' | 'result') ──
  const [step, setStep] = useState('setup');

  // ── Settings ──
  const [meetingFormat, setMeetingFormat] = useState('brainstorming');
  const [roundCount, setRoundCount] = useState(3);
  const [framework, setFramework] = useState('');

  // ── Participants ──
  const [selectedPersonas, setSelectedPersonas] = useState([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customEmoji, setCustomEmoji] = useState('👤');
  const [customModelId, setCustomModelId] = useState('');
  const [savedCustomPersonas, setSavedCustomPersonas] = useState([]);

  // ── Extended settings ──
  const [customFormatText, setCustomFormatText] = useState('');
  const [minSpeechPerRound, setMinSpeechPerRound] = useState(1);
  const [leaderId, setLeaderId] = useState('');
  const [summaryModel, setSummaryModel] = useState('');

  // ── Topic ──
  const [topic, setTopic] = useState('');
  const [context, setContext] = useState('');

  // ── Live meeting state ──
  const [messages, setMessages] = useState([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [typingPersona, setTypingPersona] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [fullResult, setFullResult] = useState(null);

  // ── Result ──
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // ── Settings (API) ──
  const [settings, setSettings] = useState(null);
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [personaModels, setPersonaModels] = useState({});

  // ── UI ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelConfig, setShowModelConfig] = useState(false);
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // ── Load settings ──
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/webapp-virtual-meeting', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data.settings || {});
          setModelOptions(data.modelOptions || []);
        }
      } catch {}
    };
    loadSettings();
  }, []);

  // ── Filter allowed models ──
  const allowedModels = useMemo(() => {
    const allowed = settings?.extraConfig?.allowedModels || [];
    if (allowed.length === 0) return modelOptions;
    return modelOptions.filter((m) => allowed.includes(m.id));
  }, [settings, modelOptions]);

  // ── Load custom personas ──
  useEffect(() => {
    const loadCustomPersonas = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/webapp-virtual-meeting/personas', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setSavedCustomPersonas(
            (data.personas || []).map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              instructions: p.instructions,
              personality: p.instructions || t('virtual_meeting.custom_persona', 'Custom persona'),
              speakingStyle: t('virtual_meeting.clear_concise', 'Clear and concise speech'),
              concerns: [t('virtual_meeting.role_related', 'Role-related matters')],
              expertise: [p.role],
              sampleDialogue: [],
              isCustom: true,
              emoji: p.emoji || '👤',
              model: p.model_id || '',
            }))
          );
        }
      } catch {}
    };
    loadCustomPersonas();
  }, []);

  // ── Chat auto-scroll ──
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingPersona, isSummarizing, summaryData]);

  // ── View distinction ──
  const isHistoryView = sidebarMenu === 'meeting-history';

  // ── Persona emoji/color maps ──
  const personaEmojiMap = useMemo(() => {
    const map = {};
    selectedPersonas.forEach((p) => { map[p.name] = getPersonaEmoji(p); });
    return map;
  }, [selectedPersonas]);

  const personaColorMap = useMemo(() => {
    const map = {};
    selectedPersonas.forEach((p, i) => { map[p.name] = PERSONA_COLORS[i % PERSONA_COLORS.length]; });
    return map;
  }, [selectedPersonas]);

  // ── Add/remove persona ──
  const addPersona = (persona) => {
    if (selectedPersonas.length >= MAX_PARTICIPANTS) return;
    if (selectedPersonas.find((p) => p.id === persona.id)) return;
    setSelectedPersonas((prev) => [...prev, { ...persona }]);
  };

  const removePersona = (id) => {
    setSelectedPersonas((prev) => prev.filter((p) => p.id !== id));
    setPersonaModels((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addCustomPersona = async () => {
    if (!customName.trim() || !customRole.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/webapp-virtual-meeting/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: customName.trim(),
          role: customRole.trim(),
          instructions: customInstructions.trim(),
          modelId: customModelId,
          emoji: customEmoji || '👤',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newPersona = {
          id: data.persona.id,
          name: data.persona.name,
          role: data.persona.role,
          instructions: data.persona.instructions,
          personality: data.persona.instructions || t('virtual_meeting.custom_persona', 'Custom persona'),
          speakingStyle: t('virtual_meeting.clear_concise', 'Clear and concise speech'),
          concerns: [t('virtual_meeting.role_related', 'Role-related matters')],
          expertise: [data.persona.role],
          sampleDialogue: [],
          isCustom: true,
          emoji: data.persona.emoji,
          model: data.persona.model_id,
        };
        setSavedCustomPersonas((prev) => [newPersona, ...prev]);
        setSelectedPersonas((prev) => [...prev, newPersona]);
        setCustomName(''); setCustomRole(''); setCustomInstructions(''); setCustomEmoji('👤'); setCustomModelId('');
        setShowCustomForm(false);
      }
    } catch {}
  };

  const [editingPersona, setEditingPersona] = useState(null);

  const startEditPersona = (persona) => {
    setEditingPersona({
      id: persona.id,
      name: persona.name,
      role: persona.role,
      instructions: persona.instructions || '',
      emoji: persona.emoji || '👤',
      modelId: persona.model_id || persona.model || '',
    });
  };

  const updateCustomPersona = async () => {
    if (!editingPersona || !editingPersona.name?.trim() || !editingPersona.role?.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/webapp-virtual-meeting/personas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: editingPersona.id,
          name: editingPersona.name.trim(),
          role: editingPersona.role.trim(),
          instructions: editingPersona.instructions.trim(),
          modelId: editingPersona.modelId,
          emoji: editingPersona.emoji || '👤',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.persona;
        setSavedCustomPersonas((prev) => prev.map((p) =>
          p.id === updated.id ? { ...p, name: updated.name, role: updated.role, instructions: updated.instructions, emoji: updated.emoji, model_id: updated.model_id, model: updated.model_id } : p
        ));
        setSelectedPersonas((prev) => prev.map((p) =>
          p.id === updated.id ? { ...p, name: updated.name, role: updated.role, instructions: updated.instructions, emoji: updated.emoji, personality: updated.instructions || t('virtual_meeting.custom_persona', 'Custom persona'), model: updated.model_id } : p
        ));
        setEditingPersona(null);
      }
    } catch {}
  };

  const deleteCustomPersona = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/webapp-virtual-meeting/personas?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSavedCustomPersonas((prev) => prev.filter((p) => p.id !== id));
        setSelectedPersonas((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {}
  };

  // ── SSE event handler ──
  const handleMeetingEvent = useCallback((event) => {
    switch (event.type) {
      case 'round_start':
        setCurrentRound(event.roundNumber);
        setTotalRounds(event.totalRounds || 0);
        break;
      case 'typing':
        setTypingPersona({ speaker: event.speaker, role: event.role });
        break;
      case 'message':
        setTypingPersona(null);
        setMessages((prev) => [...prev, {
          speaker: event.speaker,
          role: event.role,
          message: event.message,
          roundNumber: event.roundNumber,
        }]);
        break;
      case 'summarizing':
        setTypingPersona(null);
        setIsSummarizing(true);
        break;
      case 'summary':
        setIsSummarizing(false);
        setSummaryData(event.data);
        break;
      case 'complete':
        setFullResult(event.data);
        break;
      case 'error':
        setTypingPersona(null);
        setIsSummarizing(false);
        setError(event.message || t('virtual_meeting.meeting_error', 'An error occurred during the meeting.'));
        break;
    }
  }, []);

  // ── Start meeting (custom SSE streaming) ──
  const startMeeting = useCallback(async () => {
    if (!topic.trim() || selectedPersonas.length < 2) return;

    setStep('generating');
    setMessages([]);
    setCurrentRound(0);
    setTotalRounds(0);
    setTypingPersona(null);
    setIsSummarizing(false);
    setSummaryData(null);
    setFullResult(null);
    setError('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const token = localStorage.getItem('token');

    try {
      const response = await fetch('/api/webapp-virtual-meeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          meetingFormat,
          personas: selectedPersonas.map((p) => ({
            name: p.name,
            role: p.role,
            personality: p.personality,
            speakingStyle: p.speakingStyle,
            concerns: p.concerns,
            expertise: p.expertise,
            model: personaModels[p.id] || p.model || '',
            instructions: p.instructions || '',
          })),
          topic: topic.trim(),
          context: context.trim(),
          roundCount,
          framework: framework || undefined,
          defaultModel: selectedModel || undefined,
          minSpeechPerRound,
          leaderId: leaderId || undefined,
          customFormatText: meetingFormat === 'custom' ? customFormatText : undefined,
          summaryModel: summaryModel || undefined,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: t('virtual_meeting.meeting_create_failed', 'Failed to create meeting.') }));
        setError(err.error || t('virtual_meeting.meeting_create_failed', 'Failed to create meeting.'));
        setStep('setup');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            handleMeetingEvent(event);
          } catch {}
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const data = trimmed.slice(5).trim();
          if (data && data !== '[DONE]') {
            try { handleMeetingEvent(JSON.parse(data)); } catch {}
          }
        }
      }

      setStep('result');
    } catch (err) {
      if (err.name === 'AbortError') {
        setTypingPersona(null);
        setIsSummarizing(false);
        setStep((prev) => prev);
        return;
      }
      setError(err.message || t('virtual_meeting.meeting_error', 'An error occurred during the meeting.'));
      setStep('setup');
    }
  }, [topic, context, selectedPersonas, meetingFormat, roundCount, framework, selectedModel, personaModels, handleMeetingEvent, minSpeechPerRound, leaderId, customFormatText, summaryModel]);

  // ── Save history on result ──
  useEffect(() => {
    if (step === 'result' && fullResult && topic.trim()) {
      const entryId = `meeting-${Date.now()}`;
      saveEntry(entryId, {
        title: topic.trim().slice(0, 100),
        inputData: {
          meetingFormat,
          personas: selectedPersonas.map((p) => ({ id: p.id, name: p.name, role: p.role })),
          topic: topic.trim(),
          roundCount,
          framework,
        },
        outputData: fullResult,
        outputText: JSON.stringify(fullResult, null, 2),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, fullResult]);

  // ── Abort ──
  const abortMeeting = () => {
    abortControllerRef.current?.abort();
    setTypingPersona(null);
    setIsSummarizing(false);
    if (messages.length > 0) {
      setStep('result');
    } else {
      setStep('setup');
    }
  };

  // ── Restore history ──
  const restoreHistory = (entry) => {
    const input = entry.input_data || {};
    const output = entry.output_data || {};
    setTopic(input.topic || entry.title || '');
    setMeetingFormat(input.meetingFormat || 'brainstorming');
    setRoundCount(input.roundCount || 3);
    setFramework(input.framework || '');
    if (Array.isArray(input.personas)) {
      const restored = input.personas.map((p) => {
        const template = PERSONA_TEMPLATES.find((t) => t.id === p.id);
        return template ? { ...template } : { ...p, personality: '', speakingStyle: '', concerns: [], expertise: [], sampleDialogue: [] };
      });
      setSelectedPersonas(restored);
    }
    if (output?.rounds) {
      const restoredMessages = [];
      output.rounds.forEach((round) => {
        if (Array.isArray(round.discussions)) {
          round.discussions.forEach((d) => {
            restoredMessages.push({
              speaker: d.speaker,
              role: d.role,
              message: d.message,
              roundNumber: round.roundNumber,
            });
          });
        }
      });
      setMessages(restoredMessages);
      setSummaryData({
        summary: output.summary,
        conclusions: output.conclusions,
        actionItems: output.actionItems,
        keyInsights: output.keyInsights,
      });
      setFullResult(output);
      setStep('result');
    } else {
      setStep('setup');
    }
    if (typeof onRequestSidebarMenuChange === 'function') {
      onRequestSidebarMenuChange('start-meeting');
    }
  };

  // ── Reset all ──
  const resetAll = () => {
    setStep('setup');
    setMeetingFormat('brainstorming');
    setRoundCount(3);
    setFramework('');
    setSelectedPersonas([]);
    setTopic('');
    setContext('');
    setMessages([]);
    setCurrentRound(0);
    setTotalRounds(0);
    setTypingPersona(null);
    setIsSummarizing(false);
    setSummaryData(null);
    setFullResult(null);
    setError('');
    setPersonaModels({});
    setMinSpeechPerRound(1);
    setLeaderId('');
    setCustomFormatText('');
    setSummaryModel('');
  };

  // ── Copy result ──
  const copyResult = () => {
    const text = fullResult ? JSON.stringify(fullResult, null, 2) : messages.map((m) => `[${m.speaker}] ${m.message}`).join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // ── Group messages by round ──
  const messagesByRound = useMemo(() => {
    const grouped = {};
    messages.forEach((m) => {
      const r = m.roundNumber || 1;
      if (!grouped[r]) grouped[r] = [];
      grouped[r].push(m);
    });
    return grouped;
  }, [messages]);

  // ─────────────────────────────────────────────────────────────────────────
  // Chat view rendering (shared for generating + result)
  // ─────────────────────────────────────────────────────────────────────────
  const renderChatView = () => (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {selectedPersonas.slice(0, 4).map((p, i) => (
              <div
                key={p.id}
                className={`w-8 h-8 rounded-full ${PERSONA_COLORS[i % PERSONA_COLORS.length].bg} flex items-center justify-center text-sm border-2 border-background`}
              >
                {getPersonaEmoji(p)}
              </div>
            ))}
            {selectedPersonas.length > 4 && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground border-2 border-background">
                +{selectedPersonas.length - 4}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{topic}</h3>
            <p className="text-xs text-muted-foreground">
              {t('virtual_meeting.participants_count', '{count} participants', { count: selectedPersonas.length }).replace('{count}', selectedPersonas.length)} · {MEETING_FORMATS.find((f) => f.id === meetingFormat)?.name}
              {step === 'generating' && currentRound > 0 && ` · ${t('virtual_meeting.round_in_progress', 'Round {current}/{total} in progress', { current: currentRound, total: totalRounds || '' }).replace('{current}', currentRound).replace('/{total}', totalRounds ? `/${totalRounds}` : '')}`}
              {step === 'result' && ` · ${Object.keys(messagesByRound).length}${t('virtual_meeting.rounds_completed', ' rounds completed')}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {step === 'generating' && (
            <button
              onClick={abortMeeting}
              className="px-3 py-1.5 text-xs border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1"
            >
              <Pause className="h-3 w-3" /> {t('virtual_meeting.stop', 'Stop')}
            </button>
          )}
          {step === 'result' && (
            <>
              <button onClick={copyResult} className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:bg-accent flex items-center gap-1">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? t('virtual_meeting.copied', 'Copied') : t('virtual_meeting.copy', 'Copy')}
              </button>
              <button
                onClick={() => {
                  resetAll();
                  if (typeof onRequestSidebarMenuChange === 'function') onRequestSidebarMenuChange('start-meeting');
                }}
                className="px-3 py-1.5 text-xs border border-border text-muted-foreground rounded-lg hover:bg-accent flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> {t('virtual_meeting.new_meeting', 'New Meeting')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chat body */}
      <div className="flex-1 overflow-y-auto bg-muted">
        {messages.length === 0 && step === 'generating' && !typingPersona && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="flex gap-3">
              {selectedPersonas.map((p, i) => (
                <div key={p.id} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-full ${PERSONA_COLORS[i % PERSONA_COLORS.length].bg} flex items-center justify-center text-xl animate-pulse`}>
                    {getPersonaEmoji(p)}
                  </div>
                  <span className="text-xs text-muted-foreground">{p.name}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">{t('virtual_meeting.preparing_meeting', 'Preparing the meeting...')}</span>
            </div>
          </div>
        )}

        {/* Messages by round */}
        {Object.entries(messagesByRound).map(([roundNum, roundMessages]) => (
          <div key={roundNum}>
            <RoundDivider roundNumber={Number(roundNum)} totalRounds={totalRounds || Object.keys(messagesByRound).length} />
            <div className="divide-y divide-border">
              {roundMessages.map((msg, i) => {
                const emoji = personaEmojiMap[msg.speaker] || '👤';
                const color = personaColorMap[msg.speaker] || PERSONA_COLORS[i % PERSONA_COLORS.length];
                return (
                  <ChatBubble
                    key={`${roundNum}-${i}`}
                    speaker={msg.speaker}
                    role={msg.role}
                    message={msg.message}
                    emoji={emoji}
                    color={color}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typingPersona && (
          <>
            {currentRound > 0 && !messagesByRound[currentRound] && (
              <RoundDivider roundNumber={currentRound} totalRounds={totalRounds} />
            )}
            <TypingIndicator
              speaker={typingPersona.speaker}
              role={typingPersona.role}
              emoji={personaEmojiMap[typingPersona.speaker] || '👤'}
              color={personaColorMap[typingPersona.speaker] || PERSONA_COLORS[0]}
              isFirst={messages.length === 0}
            />
          </>
        )}

        {/* Summarizing */}
        {isSummarizing && <SummarizingIndicator />}

        {/* Summary result */}
        {summaryData && (
          <div className="p-4 space-y-4 border-t border-border">
            {summaryData.summary && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-2 mb-2 text-sm">
                  <MessageSquare className="h-4 w-4" /> {t('virtual_meeting.meeting_summary', 'Meeting Summary')}
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{summaryData.summary}</p>
              </div>
            )}

            {summaryData.conclusions && Array.isArray(summaryData.conclusions) && summaryData.conclusions.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-200 flex items-center gap-2 mb-2 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> {t('virtual_meeting.conclusions', 'Conclusions')}
                </h3>
                <ul className="space-y-1">
                  {summaryData.conclusions.map((c, i) => (
                    <li key={i} className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">•</span> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summaryData.actionItems && Array.isArray(summaryData.actionItems) && summaryData.actionItems.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-3 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> {t('virtual_meeting.action_items', 'Action Items')}
                </h3>
                <div className="space-y-2">
                  {summaryData.actionItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        item.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {item.priority === 'high' ? t('virtual_meeting.priority_high', 'High') : item.priority === 'medium' ? t('virtual_meeting.priority_medium', 'Medium') : t('virtual_meeting.priority_low', 'Low')}
                      </span>
                      <div>
                        <p className="text-amber-800 dark:text-amber-300">{item.task}</p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          {t('virtual_meeting.assignee', 'Assignee')}: {item.assignee}{item.deadline ? ` · ${t('virtual_meeting.deadline', 'Due')}: ${item.deadline}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summaryData.keyInsights && Array.isArray(summaryData.keyInsights) && summaryData.keyInsights.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
                <h3 className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-2 mb-2 text-sm">
                  <Lightbulb className="h-4 w-4" /> {t('virtual_meeting.key_insights', 'Key Insights')}
                </h3>
                <ul className="space-y-1">
                  {summaryData.keyInsights.map((insight, i) => (
                    <li key={i} className="text-sm text-purple-800 dark:text-purple-300 flex items-start gap-2">
                      <span className="text-purple-500 mt-0.5">💡</span> {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summaryData.rawText && !summaryData.summary && (
              <div className="bg-muted rounded-lg border border-border p-4">
                <h3 className="font-semibold text-foreground mb-2 text-sm">{t('virtual_meeting.summary_raw', 'Meeting Summary (Raw)')}</h3>
                <pre className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{summaryData.rawText}</pre>
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {error && step !== 'setup' && (
          <div className="p-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // History view
  // ─────────────────────────────────────────────────────────────────────────
  if (isHistoryView) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground">{t('virtual_meeting.meeting_history', 'Meeting History')}</h2>
            <button
              onClick={() => {
                resetAll();
                if (typeof onRequestSidebarMenuChange === 'function') onRequestSidebarMenuChange('start-meeting');
              }}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> {t('virtual_meeting.new_meeting', 'New Meeting')}
            </button>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{t('virtual_meeting.no_history', 'No meeting records yet')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="bg-background rounded-lg border border-border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <button onClick={() => restoreHistory(entry)} className="flex-1 text-left">
                      <h3 className="font-medium text-foreground">{entry.title || t('virtual_meeting.no_title', 'Untitled')}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {entry.input_data?.meetingFormat && `${MEETING_FORMATS.find((f) => f.id === entry.input_data.meetingFormat)?.name || entry.input_data.meetingFormat}`}
                        {entry.input_data?.personas && ` · ${entry.input_data.personas.length}${t('virtual_meeting.people', ' people')}`}
                        {entry.input_data?.roundCount && ` · ${entry.input_data.roundCount}${t('virtual_meeting.rounds', ' rounds')}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(entry.created_at).toLocaleString('ko-KR')}</p>
                    </button>
                    <button onClick={() => deleteEntry(entry.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors ml-2" title={t('virtual_meeting.delete', 'Delete')}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Meeting in progress or result → chat view
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'generating' || step === 'result') {
    return renderChatView();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Setup view
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Meeting topic */}
        <div>
          <label className="block text-base font-semibold text-foreground mb-2">
            {t('virtual_meeting.meeting_topic_label', 'Meeting Topic')} *
          </label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('virtual_meeting.topic_placeholder', 'e.g. Next-gen mobile app renewal strategy')}
            maxLength={500}
            className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">{topic.length}/500</p>
        </div>

        {/* Participant selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground">
              {t('virtual_meeting.select_participants', 'Select Participants')} ({selectedPersonas.length}/{MAX_PARTICIPANTS})
            </h3>
            <button
              onClick={() => setShowCustomForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
            >
              <UserPlus className="h-4 w-4" /> {t('virtual_meeting.add_custom', 'Add Custom')}
            </button>
          </div>

          {/* Selected participants */}
          {selectedPersonas.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedPersonas.map((p, i) => {
                const color = PERSONA_COLORS[i % PERSONA_COLORS.length];
                const isLeader = leaderId === p.name;
                return (
                  <span key={p.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color.bg} ${color.text}`}>
                    <span className="text-base">{p.emoji || getPersonaEmoji(p)}</span>
                    {p.name} ({p.role})
                    <button
                      onClick={() => setLeaderId(isLeader ? '' : p.name)}
                      className={`ml-0.5 ${isLeader ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-400'}`}
                      title={isLeader ? t('virtual_meeting.remove_leader', 'Remove leader') : t('virtual_meeting.set_leader', 'Set as meeting leader')}
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removePersona(p.id)} className="hover:opacity-70">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Custom form */}
          {showCustomForm && (
            <div className="mb-4 p-4 bg-muted rounded-lg border border-border space-y-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.name_label', 'Name')} *</label>
                  <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={t('virtual_meeting.name_placeholder', 'e.g. Alex')} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.role_label', 'Role')} *</label>
                  <input value={customRole} onChange={(e) => setCustomRole(e.target.value)} placeholder={t('virtual_meeting.role_placeholder', 'e.g. CEO')} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground" />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.emoji_label', 'Emoji')}</label>
                  <input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} placeholder="👤" maxLength={4} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground text-center" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.instructions_label', 'Instructions')}</label>
                <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder={t('virtual_meeting.instructions_placeholder', 'Enter speaking style, interests, areas of expertise for this role')} rows={2} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground resize-none" />
              </div>
              <div className="flex gap-2 items-end">
                {allowedModels.length > 0 && (
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.model_label', 'Model')}</label>
                    <select value={customModelId} onChange={(e) => setCustomModelId(e.target.value)} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground">
                      <option value="">{t('virtual_meeting.default_model', 'Default model')}</option>
                      {allowedModels.map((m) => (
                        <option key={m.id} value={m.id}>[{m.categoryLabel}] {m.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button onClick={addCustomPersona} disabled={!customName.trim() || !customRole.trim()} className="btn-primary text-sm py-1.5 disabled:opacity-50">{t('virtual_meeting.add', 'Add')}</button>
                <button onClick={() => setShowCustomForm(false)} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {/* Preset personas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {PERSONA_TEMPLATES.map((persona) => {
              const isSelected = selectedPersonas.some((p) => p.id === persona.id);
              return (
                <button
                  key={persona.id}
                  onClick={() => isSelected ? removePersona(persona.id) : addPersona(persona)}
                  disabled={!isSelected && selectedPersonas.length >= MAX_PARTICIPANTS}
                  className={`p-3 rounded-lg border-2 text-left transition-all text-sm ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-border hover:border-border/80 disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getPersonaEmoji(persona)}</span>
                    <div>
                      <p className="font-medium text-foreground">{persona.name}</p>
                      <p className="text-xs text-muted-foreground">{persona.role}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom personas */}
          {savedCustomPersonas.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('virtual_meeting.my_custom_personas', 'My Custom Personas')}</h4>

              {/* Edit form */}
              {editingPersona && (
                <div className="mb-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{t('virtual_meeting.edit_persona', 'Edit Persona')}</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.name_label', 'Name')} *</label>
                      <input value={editingPersona.name} onChange={(e) => setEditingPersona((prev) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.role_label', 'Role')} *</label>
                      <input value={editingPersona.role} onChange={(e) => setEditingPersona((prev) => ({ ...prev, role: e.target.value }))} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground" />
                    </div>
                    <div className="w-16">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.emoji_label', 'Emoji')}</label>
                      <input value={editingPersona.emoji} onChange={(e) => setEditingPersona((prev) => ({ ...prev, emoji: e.target.value }))} maxLength={4} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground text-center" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.instructions_label', 'Instructions')}</label>
                    <textarea value={editingPersona.instructions} onChange={(e) => setEditingPersona((prev) => ({ ...prev, instructions: e.target.value }))} rows={2} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground resize-none" />
                  </div>
                  <div className="flex gap-2 items-end">
                    {allowedModels.length > 0 && (
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">{t('virtual_meeting.model_label', 'Model')}</label>
                        <select value={editingPersona.modelId} onChange={(e) => setEditingPersona((prev) => ({ ...prev, modelId: e.target.value }))} className="w-full px-3 py-1.5 border border-border rounded-lg bg-background text-sm text-foreground">
                          <option value="">{t('virtual_meeting.default_model', 'Default model')}</option>
                          {allowedModels.map((m) => (
                            <option key={m.id} value={m.id}>[{m.categoryLabel}] {m.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button onClick={updateCustomPersona} disabled={!editingPersona.name?.trim() || !editingPersona.role?.trim()} className="btn-primary text-sm py-1.5 disabled:opacity-50">{t('virtual_meeting.save', 'Save')}</button>
                    <button onClick={() => setEditingPersona(null)} className="p-1.5 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {savedCustomPersonas.map((persona) => {
                  const isSelected = selectedPersonas.some((p) => p.id === persona.id);
                  return (
                    <div key={persona.id} className="relative group">
                      <button
                        onClick={() => isSelected ? removePersona(persona.id) : addPersona(persona)}
                        disabled={!isSelected && selectedPersonas.length >= MAX_PARTICIPANTS}
                        className={`w-full p-3 rounded-lg border-2 text-left transition-all text-sm ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-border hover:border-border/80 disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{persona.emoji || '👤'}</span>
                          <div>
                            <p className="font-medium text-foreground">{persona.name}</p>
                            <p className="text-xs text-muted-foreground">{persona.role}</p>
                          </div>
                        </div>
                      </button>
                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditPersona(persona); }}
                          className="p-1 rounded-full bg-background shadow text-muted-foreground hover:text-blue-500"
                          title={t('virtual_meeting.edit', 'Edit')}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCustomPersona(persona.id); }}
                          className="p-1 rounded-full bg-background shadow text-muted-foreground hover:text-red-500"
                          title={t('virtual_meeting.delete', 'Delete')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Per-participant model settings */}
        {selectedPersonas.length > 0 && allowedModels.length > 0 && (
          <div>
            <button
              onClick={() => setShowModelConfig(!showModelConfig)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium"
            >
              <Settings className="h-4 w-4" />
              {t('virtual_meeting.per_participant_model', 'Per-participant model settings')}
              {showModelConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showModelConfig && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  {t('virtual_meeting.model_select_hint', 'You can select a suitable model for each role. (e.g. Developer → code-specialized model)')}
                </p>
                {selectedPersonas.map((p, i) => {
                  const color = PERSONA_COLORS[i % PERSONA_COLORS.length];
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center text-base flex-shrink-0`}>
                        {getPersonaEmoji(p)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.name} ({p.role})</p>
                      </div>
                      <select
                        value={personaModels[p.id] || ''}
                        onChange={(e) => setPersonaModels((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="px-2 py-1.5 border border-border rounded-lg bg-background text-foreground text-xs max-w-[200px]"
                      >
                        <option value="">{t('virtual_meeting.default_model', 'Default model')}</option>
                        {allowedModels.map((m) => (
                          <option key={m.id} value={m.id}>[{m.categoryLabel}] {m.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Meeting format */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-3">{t('virtual_meeting.meeting_format', 'Meeting Format')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MEETING_FORMATS.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setMeetingFormat(fmt.id)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  meetingFormat === fmt.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-border hover:border-border/80'
                }`}
              >
                <p className="font-medium text-foreground text-sm">{fmt.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{fmt.description}</p>
              </button>
            ))}
          </div>
          {meetingFormat === 'custom' && (
            <div className="mt-3">
              <textarea
                value={customFormatText}
                onChange={(e) => setCustomFormatText(e.target.value)}
                placeholder={t('virtual_meeting.custom_format_placeholder', 'Enter meeting format, rules, and procedure directly. e.g. Each participant speaks for 3 minutes, then the leader summarizes before moving to the next topic.')}
                rows={4}
                maxLength={3000}
                className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground resize-none text-sm"
              />
            </div>
          )}
        </div>

        {/* Advanced settings */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {t('virtual_meeting.advanced_settings', 'Advanced Settings')}
          </button>

          {showAdvanced && (
            <div className="space-y-5 pl-1">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('virtual_meeting.background_context', 'Background Context')}</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={t('virtual_meeting.context_placeholder', 'Enter background information, previous decisions, reference materials, etc...')}
                  rows={3}
                  maxLength={3000}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-background text-foreground resize-none text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('virtual_meeting.discussion_framework', 'Discussion Framework')}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFramework('')}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      !framework ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground'
                    }`}
                  >
                    {t('virtual_meeting.free_discussion', 'Free Discussion')}
                  </button>
                  {DISCUSSION_FRAMEWORKS.map((fw) => (
                    <button
                      key={fw.id}
                      onClick={() => setFramework(fw.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        framework === fw.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground'
                      }`}
                    >
                      {fw.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('virtual_meeting.round_count_label', 'Number of Rounds')}: {roundCount}
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={roundCount}
                  onChange={(e) => setRoundCount(Number(e.target.value))}
                  className="w-full max-w-xs accent-blue-600"
                />
                <div className="flex justify-between text-xs text-muted-foreground max-w-xs">
                  <span>1</span><span>5</span><span>10</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t('virtual_meeting.speech_per_round_label', 'Speeches per role per round')}: {minSpeechPerRound}
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  value={minSpeechPerRound}
                  onChange={(e) => setMinSpeechPerRound(Number(e.target.value))}
                  className="w-full max-w-xs accent-blue-600"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('virtual_meeting.speech_per_round_hint', '1: default, 2-3: deeper discussion (takes longer)')}
                </p>
              </div>

              {settings?.allowUserModelOverride && allowedModels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">{t('virtual_meeting.default_model_label', 'Default Model')}</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full max-w-sm px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                  >
                    <option value="">{t('virtual_meeting.default_model', 'Default model')}</option>
                    {allowedModels.map((m) => (
                      <option key={m.id} value={m.id}>[{m.categoryLabel}] {m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">{t('virtual_meeting.summary_model_label', 'Summary Model')}</label>
                <select
                  value={summaryModel}
                  onChange={(e) => setSummaryModel(e.target.value)}
                  className="w-full max-w-sm px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
                >
                  <option value="">{t('virtual_meeting.default_model', 'Default model')}</option>
                  {allowedModels.map((m) => (
                    <option key={m.id} value={m.id}>[{m.categoryLabel}] {m.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Start meeting button */}
        <button
          onClick={startMeeting}
          disabled={!topic.trim() || selectedPersonas.length < 2}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-base disabled:cursor-not-allowed"
        >
          <Play className="h-5 w-5" />
          {t('virtual_meeting.start_meeting_btn', 'Start Meeting')} ({selectedPersonas.length}{t('virtual_meeting.people', ' people')} · {roundCount}{t('virtual_meeting.rounds', ' rounds')})
        </button>

      </div>
    </div>
  );
}
