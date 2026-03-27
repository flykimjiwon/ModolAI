/*
 * ═══════════════════════════════════════════════════════════════════════
 * 디자인 2: 사이버펑크/네온 디자인 채팅 페이지
 * ─────────────────────────────────────────────────────────────────────
 * 글라스모피즘(glassmorphism) + 네온 그라디언트 기반 채팅 UI.
 * 다크/라이트 모드 전환, 사이드바, 모델 선택, 이미지 업로드,
 * 마크다운 렌더링, 피드백, 쪽지(DM) 등 전체 기능 포함.
 *
 * 다른 프로젝트에 재사용 시:
 *   1. hooks(useChat, useChatSender, useModelManager) 경로 수정
 *   2. getStyles() 함수의 색상/그라디언트 커스텀
 *   3. globalCSS 내 애니메이션·마크다운 오버라이드 조정
 * ═══════════════════════════════════════════════════════════════════════
 */

'use client';

/* ─── 임포트 ─── */
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  Command,
  Sparkles,
  MoreHorizontal,
  X,
  Menu,
  ArrowUp,
  Sun,
  Moon,
  LogOut,
  Trash2,
  Pencil,
  Square,
  Loader2,
  MessageCircle,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Bell,
  MessageSquare,
  Shield,
  User,
  Key,
  Mail,
  Rocket,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  LucideImage,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useModelManager, loadRoomModel } from '@/hooks/useModelManager';
import { useChatSender } from '@/hooks/useChatSender';
import { detectClientIP } from '@/lib/clientIP';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { TokenManager } from '@/lib/tokenManager';
import { logger } from '@/lib/logger';
import { useAlert } from '@/contexts/AlertContext';
import dynamic from 'next/dynamic';
const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-4 bg-muted rounded w-3/4" />,
});
import rehypeSanitize from 'rehype-sanitize';
import ModelSelector from '@/components/chat/ModelSelector';
const NoticePopup = dynamic(() => import('@/components/NoticePopup'), { ssr: false });
const AgentSelector = dynamic(() => import('@/components/AgentSelector'), { ssr: false });
const DirectMessageModal = dynamic(() => import('@/components/DirectMessageModal'), { ssr: false });
const PatchNotesModal = dynamic(() => import('@/components/PatchNotesModal'), { ssr: false });

/* ═══════════════════════════════════════════
   ─── 유틸리티 함수 ───
   시간 포맷, 파일 읽기, 이미지 ID 생성, 파일 크기 표시
   ═══════════════════════════════════════════ */

function formatRoomTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR');
}

let _imgIdCounter = 0;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function generateImageId() {
  if (typeof crypto !== 'undefined') {
    if (crypto.randomUUID) return crypto.randomUUID();
    if (crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  return `${Date.now()}-${++_imgIdCounter}`;
}

function formatSize(size) {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(2)}MB`;
}

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toLowerCase();
  return tag === 'textarea' || tag === 'input';
}

/* ═══════════════════════════════════════════
   ─── 테마 인라인 스타일 (다크/라이트) ───
   Tailwind만으로 표현 불가능한 글라스모피즘,
   그라디언트, backdrop-filter 등을 isDark 분기로 생성.
   커스텀 시 이 함수의 반환값을 수정하면 전체 UI에 반영됨.
   ═══════════════════════════════════════════ */

function getStyles(isDark) {
  return {
    pageBackground: isDark
      ? { background: 'linear-gradient(145deg, #06080d 0%, #0a0a0f 40%, #0d0f18 100%)' }
      : { background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 40%, #e8edf3 100%)' },
    noiseOverlay: {
      position: 'fixed',
      inset: 0,
      opacity: isDark ? 0.03 : 0.015,
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      pointerEvents: 'none',
      zIndex: 1,
    },
    gridOverlay: {
      position: 'fixed',
      inset: 0,
      opacity: isDark ? 0.02 : 0.03,
      backgroundImage: isDark
        ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)'
        : 'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
      backgroundSize: '64px 64px',
      pointerEvents: 'none',
      zIndex: 1,
    },
    sidebarGlass: isDark
      ? {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }
      : {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.72) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(0,0,0,0.08)',
        },
    logoGlow: isDark
      ? { textShadow: '0 0 30px rgba(6,182,212,0.3), 0 0 60px rgba(6,182,212,0.1)' }
      : { textShadow: '0 0 20px rgba(6,182,212,0.15)' },
    activeItemBar: {
      background: 'linear-gradient(180deg, #06b6d4 0%, #0891b2 100%)',
      boxShadow: '0 0 8px rgba(6,182,212,0.4)',
    },
    topBar: isDark
      ? {
          background: 'rgba(10,10,15,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }
      : {
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        },
    inputGlow: isDark
      ? {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }
      : {
          background: 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.75) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
        },
    inputFocusGradient: {
      background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.15) 50%, transparent 100%)',
    },
    userBubble: isDark
      ? {
          background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
        }
      : {
          background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.03) 100%)',
          border: '1px solid rgba(6,182,212,0.15)',
        },
    aiBubble: isDark
      ? {
          background: 'linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(6,182,212,0.01) 100%)',
          borderLeft: '2px solid rgba(6,182,212,0.2)',
        }
      : {
          background: 'linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(6,182,212,0.02) 100%)',
          borderLeft: '2px solid rgba(6,182,212,0.3)',
        },
    sendButton: {
      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      boxShadow: '0 0 20px rgba(6,182,212,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
    },
    modelPill: isDark
      ? { background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }
      : { background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)' },
    searchBar: isDark
      ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
      : { background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)' },
    scrollButton: isDark
      ? {
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }
      : {
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(0,0,0,0.1)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
    navLink: isDark
      ? { borderBottom: '1px solid rgba(255,255,255,0.03)' }
      : { borderBottom: '1px solid rgba(0,0,0,0.04)' },
    imageThumbnail: isDark
      ? { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }
      : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)' },
  };
}

/* ═══════════════════════════════════════════
   ─── CSS 키프레임 + 마크다운 오버라이드 ───
   chat2 전용 애니메이션(fade-up, slide-in, typing-dot)과
   MarkdownPreview 컴포넌트의 코드블록/인라인코드 스타일 덮어쓰기.
   ═══════════════════════════════════════════ */

const globalCSS = `
  @keyframes chat2-fade-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes chat2-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes chat2-slide-in-left {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes chat2-typing-dot {
    0%, 60%, 100% { opacity: 0.2; transform: translateY(0); }
    30%           { opacity: 1;   transform: translateY(-3px); }
  }

  /* MarkdownPreview overrides inside chat2 */
  .chat2-md .wmde-markdown {
    background: transparent !important;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    font-size: 14px;
    line-height: 1.7;
  }
  .chat2-md .wmde-markdown pre {
    position: relative;
    background: linear-gradient(135deg, #0d1117 0%, #0a0e14 100%) !important;
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 0.75rem 0;
  }
  .chat2-md .wmde-markdown code {
    font-size: 13px;
  }
  .chat2-md .wmde-markdown :not(pre) > code {
    background: rgba(6,182,212,0.1);
    border: 1px solid rgba(6,182,212,0.15);
    color: #67e8f9;
    padding: 0.15em 0.4em;
    border-radius: 0.25rem;
    font-size: 0.85em;
  }
  [data-color-mode="light"] .chat2-md .wmde-markdown :not(pre) > code {
    color: #0891b2;
  }
  .chat2-md .wmde-markdown p {
    margin-bottom: 0.5em;
  }
  .chat2-md .wmde-markdown p:last-child {
    margin-bottom: 0;
  }
  .chat2-md .wmde-markdown ul, .chat2-md .wmde-markdown ol {
    padding-left: 1.25em;
    margin: 0.5em 0;
  }
  .chat2-md .wmde-markdown blockquote {
    border-left: 2px solid rgba(6,182,212,0.3);
    padding-left: 1em;
    margin: 0.75em 0;
    opacity: 0.85;
  }

  /* Code block copy button (DOM-injected) */
  .chat2-md .wmde-markdown pre .chat2-copy-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 4px 10px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    z-index: 2;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.5);
    backdrop-filter: blur(8px);
  }
  .chat2-md .wmde-markdown pre .chat2-copy-btn:hover {
    background: rgba(6,182,212,0.15);
    color: rgba(6,182,212,0.9);
    border-color: rgba(6,182,212,0.2);
  }
  [data-color-mode="light"] .chat2-md .wmde-markdown pre .chat2-copy-btn {
    background: rgba(0,0,0,0.04);
    border: 1px solid rgba(0,0,0,0.08);
    color: rgba(0,0,0,0.4);
  }
  [data-color-mode="light"] .chat2-md .wmde-markdown pre .chat2-copy-btn:hover {
    background: rgba(6,182,212,0.1);
    color: rgba(6,182,212,0.8);
    border-color: rgba(6,182,212,0.15);
  }
`;

/* ═══════════════════════════════════════════
   ─── 서브 컴포넌트 ───
   타이핑 인디케이터, 복사 버튼, 피드백 버튼 등
   메시지 버블 내에서 사용되는 작은 컴포넌트들.
   ═══════════════════════════════════════════ */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-3">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-cyan-400"
            style={{ animation: `chat2-typing-dot 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
      <span className="text-[11px] text-gray-500 font-mono ml-2">생성 중...</span>
    </div>
  );
}

/* Glass-themed copy button for assistant messages */
const CopyButtonGlass = memo(function CopyButtonGlass({ text, isDark }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-999999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('복사 실패:', err);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-3 right-3 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 z-[1]"
      style={{
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        backdropFilter: 'blur(8px)',
        color: copied ? '#22d3ee' : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
      }}
      title={copied ? '복사됨!' : '답변 전체 복사'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
});

/* Glass-themed feedback button */
const FeedbackButtonGlass = memo(function FeedbackButtonGlass({ messageId, initialFeedback, isDark }) {
  const [feedback, setFeedback] = useState(initialFeedback || null);
  const [fbLoading, setFbLoading] = useState(false);

  useEffect(() => {
    setFeedback(initialFeedback || null);
  }, [initialFeedback]);

  const handleFeedback = async (type) => {
    if (fbLoading || !messageId) return;
    if (typeof messageId === 'string' && messageId.startsWith('temp-')) return;
    const newFeedback = feedback === type ? null : type;
    setFbLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/webapp-chat/feedback/${messageId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: newFeedback }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setFeedback(result.feedback);
    } catch (err) {
      logger.error('피드백 저장 실패:', err);
    } finally {
      setFbLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleFeedback('like')}
        disabled={fbLoading || !messageId}
        className="p-1 rounded transition-all"
        style={{
          color: feedback === 'like' ? '#06b6d4' : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          background: feedback === 'like' ? 'rgba(6,182,212,0.12)' : 'transparent',
        }}
        title="좋아요"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        onClick={() => handleFeedback('dislike')}
        disabled={fbLoading || !messageId}
        className="p-1 rounded transition-all"
        style={{
          color: feedback === 'dislike' ? '#f87171' : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          background: feedback === 'dislike' ? 'rgba(248,113,113,0.12)' : 'transparent',
        }}
        title="싫어요"
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════
   ─── 메인 컴포넌트 ───
   Chat2Page: 전체 페이지 렌더링.
   상태(state), 이펙트(effects), 핸들러(handlers),
   렌더(render) 순서로 구성됨.
   ═══════════════════════════════════════════ */

export default function Chat2Page() {
  const router = useRouter();
  const { alert } = useAlert();

  /* ── 인증 상태 ── */
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [authChecked, setAuthChecked] = useState(false);

  /* ── 앱 상태 (이미지, 설정 등) ── */
  const [clientIP, setClientIP] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [maxImagesPerMessage, setMaxImagesPerMessage] = useState(5);
  const [imageAnalysisModel, setImageAnalysisModel] = useState('');
  const [imageAnalysisPrompt, setImageAnalysisPrompt] = useState('이 이미지를 설명해줘.');
  const [imageHistoryByRoom, setImageHistoryByRoom] = useState({});
  const [maxUserQuestionLength, setMaxUserQuestionLength] = useState(300000);
  const [profileEditEnabled, setProfileEditEnabled] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);

  /* ── UI 상태 (다크모드, 사이드바, 모달 등) ── */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [roomMenuOpen, setRoomMenuOpen] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);

  /* ── 쪽지(DM) 상태 ── */
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [showDmModal, setShowDmModal] = useState(false);
  const [showDmNotification, setShowDmNotification] = useState(false);
  const [newDmCount, setNewDmCount] = useState(0);
  const prevUnreadCountRef = useRef(0);

  /* ── 코어 훅 (채팅, 모델, 전송) ── */
  const {
    rooms,
    currentRoom,
    messages,
    setMessages,
    loading: chatLoading,
    createRoom,
    renameRoom: originalRenameRoom,
    deleteRoom: originalDeleteRoom,
    switchRoom,
    clearSession,
    loadRooms,
  } = useChat();

  const renameRoom = async (roomId, newName) => {
    try {
      await originalRenameRoom(roomId, newName);
    } catch (error) {
      alert(error.message, 'error', '채팅방 이름 변경 실패');
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      return await originalDeleteRoom(roomId);
    } catch (error) {
      const is404 = error?.status === 404 ||
        (typeof error?.message === 'string' && (error.message.includes('404') || error.message.includes('채팅방을 찾을 수 없습니다')));
      if (is404) return true;
      alert(error.message, error.type || 'error', error.type === 'warning' ? '경고' : '오류');
      return false;
    }
  };

  const {
    modelOptions,
    modelConfig,
    selectedModel,
    setSelectedModel,
    setSelectedModelWithRoom,
    restoreRoomModel,
    modelsLoading,
    userDefaultModelId,
    saveUserDefaultModel,
  } = useModelManager(userRole);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const lastRestoredRoomRef = useRef(null);
  const imageInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const {
    input,
    setInput,
    loading,
    sendMessage,
    handleKeyDown,
    stopStreaming,
  } = useChatSender({
    currentRoom,
    messages,
    setMessages,
    modelOptions,
    selectedModel,
    modelsLoading,
    clientIP,
    inputRef,
    renameRoom,
    rooms,
    loadRooms,
    selectedImages,
    setSelectedImages,
    imageHistoryByRoom,
    setImageHistoryByRoom,
    imageAnalysisModel,
    imageAnalysisPrompt,
    maxUserQuestionLength,
  });

  /* ── 계산된 값 (필터, 모델 라벨 등) ── */
  const styles = getStyles(isDark);
  const currentRoomData = rooms.find((r) => r._id === currentRoom);
  const filteredRooms = searchQuery
    ? rooms.filter((r) => r.name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : rooms;
  const selectedModelInfo = modelOptions.find((m) => m.id === selectedModel);
  const modelLabel = selectedModelInfo?.label || selectedModelInfo?.modelName || '';

  // Filter debug messages from display
  const displayMessages = useMemo(() => {
    const filtered = messages.filter((msg) => {
      const text = msg.text || '';
      return !text.includes('[방제목 생성');
    });
    return currentRoom ? filtered.filter((msg) => !msg.roomId || msg.roomId === currentRoom) : filtered;
  }, [messages, currentRoom]);

  // Image history for current room
  const imageHistory = currentRoom ? imageHistoryByRoom[currentRoom] || [] : [];
  const imagesByTurn = useMemo(() => {
    const map = new Map();
    imageHistory.forEach((entry) => {
      if (entry && Number.isFinite(entry.turnIndex)) {
        map.set(entry.turnIndex, entry.images || []);
      }
    });
    return map;
  }, [imageHistory]);

  const maxImages = Number.isFinite(maxImagesPerMessage) ? maxImagesPerMessage : 5;
  const currentImageCount = selectedImages?.length || 0;

  /* ── 모델 이름/서버명 조회 헬퍼 ── */
  const getModelLabel = useCallback((modelKey) => {
    if (!modelKey) return null;
    if (modelKey.includes('__')) {
      const parts = modelKey.split('__');
      if (parts.length >= 2) return parts[1];
    }
    const exactMatch = modelOptions.find((m) => m.uniqueKey === modelKey || m.id === modelKey);
    if (exactMatch?.label) return exactMatch.label;
    const idMatch = modelOptions.find((m) => m.id === modelKey);
    if (idMatch?.label) return idMatch.label;
    if (modelKey.includes('-')) {
      const parts = modelKey.split('-');
      const possibleModelId = parts[parts.length - 1];
      const serverRemovedMatch = modelOptions.find((m) => m.id === possibleModelId);
      if (serverRemovedMatch?.label) return serverRemovedMatch.label;
    }
    if (modelKey.includes(':')) {
      const baseName = modelKey.split(':')[0];
      const baseMatch = modelOptions.find((m) => m.id && (m.id.startsWith(baseName + ':') || m.id === baseName));
      if (baseMatch?.label) return baseMatch.label;
    }
    return modelKey;
  }, [modelOptions]);

  const getModelServerName = useCallback((modelKey) => {
    if (!modelKey) return null;
    const exactMatch = modelOptions.find((m) => m.uniqueKey === modelKey || m.id === modelKey);
    if (exactMatch?.endpoint) {
      try {
        const url = new URL(exactMatch.endpoint);
        const hostname = url.hostname;
        if (hostname && hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          return hostname;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }, [modelOptions]);

  /* ═══════════════════════════════════════════
     ─── 이펙트(Effects) ───
     인증, IP감지, 설정로드, 모델복원, 스크롤, DM 등
     ═══════════════════════════════════════════ */

  // 1. 인증 확인 — 토큰 없으면 로그인 페이지로 리다이렉트
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        const loginUrl = await TokenManager.getLoginUrl();
        router.replace(loginUrl);
        return;
      }
      try {
        const payload = decodeJWTPayload(token);
        setUserEmail(payload.email || '');
        setUserRole(payload.role || 'user');
        setAuthChecked(true);
      } catch (error) {
        logger.error('토큰 파싱 실패:', error);
        const loginUrl = await TokenManager.getLoginUrl();
        router.replace(loginUrl);
      }
    };
    checkAuth();
  }, [router]);

  // 2. 클라이언트 IP 감지
  useEffect(() => {
    detectClientIP()
      .then(setClientIP)
      .catch((err) => logger.error('클라이언트 IP 감지 실패:', err));
  }, []);

  // 3. 관리자 설정 로드 (이미지 제한, 프로필 편집, 게시판 등)
  useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !isMounted) return;
        setMaxImagesPerMessage(data.maxImagesPerMessage || 5);
        setImageAnalysisModel(data.imageAnalysisModel || '');
        setImageAnalysisPrompt(data.imageAnalysisPrompt || '이 이미지를 설명해줘.');
        setMaxUserQuestionLength(data.maxUserQuestionLength || 300000);
        setProfileEditEnabled(data.profileEditEnabled !== undefined ? data.profileEditEnabled : false);
        setBoardEnabled(data.boardEnabled !== undefined ? data.boardEnabled : true);
      })
      .catch((error) => logger.error('설정 로드 실패:', error.message));
    return () => {
      isMounted = false;
    };
  }, []);

  // 4. 방 변경 시 저장된 모델 복원
  useEffect(() => {
    if (currentRoom && modelOptions.length > 0 && !modelsLoading) {
      if (lastRestoredRoomRef.current === currentRoom) return;
      const savedModel = loadRoomModel(currentRoom);
      if (savedModel && savedModel === selectedModel) {
        lastRestoredRoomRef.current = currentRoom;
        return;
      }
      const availableModelIds = modelOptions.map((m) => m.id);
      restoreRoomModel(currentRoom, availableModelIds);
      lastRestoredRoomRef.current = currentRoom;
    }
  }, [currentRoom, modelOptions, modelsLoading, restoreRoomModel, selectedModel]);

  // 5. 방 변경 시 선택된 이미지 초기화
  useEffect(() => {
    setSelectedImages([]);
    setImageHistoryByRoom({});
  }, [currentRoom]);

  // 6. 다크모드 초기화 — localStorage 또는 HTML class에서 읽기
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      const dark = saved === 'dark';
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    } else {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
  }, []);

  // 7. 새 메시지 도착 시 자동 스크롤 (사용자가 하단에 있을 때만)
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  // 8. 로딩 완료 시 입력 필드에 포커스
  useEffect(() => {
    if (!currentRoom) return;
    if (loading || chatLoading || modelsLoading) return;
    inputRef.current?.focus();
  }, [loading, chatLoading, modelsLoading, currentRoom]);

  // 9. 스크롤 버튼 표시 여부 (콘텐츠가 넘칠 때만)
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const checkScrollbar = () => {
      setShowScrollButtons(container.scrollHeight > container.clientHeight);
    };
    checkScrollbar();
    container.addEventListener('scroll', checkScrollbar, { passive: true });
    window.addEventListener('resize', checkScrollbar);
    return () => {
      container.removeEventListener('scroll', checkScrollbar);
      window.removeEventListener('resize', checkScrollbar);
    };
  }, [messages]);

  // 10. IntersectionObserver로 하단 도달 여부 추적
  useEffect(() => {
    const container = listRef.current || null;
    const target = bottomRef.current;
    if (!target || typeof window === 'undefined') return;

    if (!('IntersectionObserver' in window)) {
      const handleScroll = () => {
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
      };
      container?.addEventListener('scroll', handleScroll, { passive: true });
      return () => container?.removeEventListener('scroll', handleScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setIsAtBottom(entry.isIntersecting);
      },
      { root: container, rootMargin: '0px 0px 50px 0px', threshold: 0.01 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [messages]);

  // 11. 읽지 않은 쪽지 수 조회 + 60초 간격 폴링
  const fetchUnreadDmCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/direct-messages/unread-count', {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        const newCount = data.count || 0;
        if (newCount > prevUnreadCountRef.current && prevUnreadCountRef.current >= 0) {
          const diff = newCount - prevUnreadCountRef.current;
          setNewDmCount(diff);
          setShowDmNotification(true);
          setTimeout(() => setShowDmNotification(false), 5000);
        }
        prevUnreadCountRef.current = newCount;
        setUnreadDmCount(newCount);
      }
    } catch (error) {
      logger.error('읽지 않은 쪽지 개수 조회 실패:', error);
    }
  }, []);

  useEffect(() => {
    fetchUnreadDmCount();
    const interval = setInterval(fetchUnreadDmCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadDmCount]);

  // 12. 코드블록 복사 버튼 DOM 주입
  useEffect(() => {
    if (!listRef.current) return;
    const timer = setTimeout(() => {
      const codeBlocks = listRef.current?.querySelectorAll('.chat2-md pre code');
      if (!codeBlocks) return;
      codeBlocks.forEach((codeBlock) => {
        const pre = codeBlock.parentElement;
        if (pre && !pre.querySelector('.chat2-copy-btn')) {
          const btn = document.createElement('button');
          btn.className = 'chat2-copy-btn';
          btn.textContent = '복사';
          btn.onclick = async () => {
            try {
              if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(codeBlock.textContent);
              } else {
                const ta = document.createElement('textarea');
                ta.value = codeBlock.textContent;
                ta.style.position = 'fixed';
                ta.style.left = '-999999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
              }
              btn.textContent = '복사됨!';
              setTimeout(() => { btn.textContent = '복사'; }, 2000);
            } catch {
              btn.textContent = '실패';
              setTimeout(() => { btn.textContent = '복사'; }, 2000);
            }
          };
          pre.appendChild(btn);
        }
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [messages]);

  // 13. 글로벌 드래그/드롭 + 붙여넣기 이미지 업로드
  const addImagesFromFiles = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    const currentCount = selectedImages?.length || 0;
    const availableSlots = Math.max(0, maxImages - currentCount);
    if (availableSlots <= 0) {
      alert(`이미지는 최대 ${maxImages}장까지 첨부할 수 있습니다.`, 'warning', '업로드 제한');
      return;
    }
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    const maxSizeBytes = 10 * 1024 * 1024;
    const errors = [];
    const validFiles = files.filter((file) => {
      if (!allowedTypes.has(file.type)) { errors.push(`${file.name}: 지원하지 않는 파일 형식입니다.`); return false; }
      if (file.size > maxSizeBytes) { errors.push(`${file.name}: 10MB를 초과했습니다.`); return false; }
      return true;
    });
    if (validFiles.length > availableSlots) errors.push(`최대 ${maxImages}장까지 첨부할 수 있습니다.`);
    const filesToRead = validFiles.slice(0, availableSlots);
    try {
      const dataUrls = await Promise.all(filesToRead.map((file) => readFileAsDataUrl(file)));
      const nextImages = filesToRead.map((file, index) => ({
        id: generateImageId(), name: file.name, size: file.size, type: file.type, dataUrl: dataUrls[index],
      }));
      setSelectedImages((prev) => [...(prev || []), ...nextImages]);
    } catch {
      alert('이미지 파일을 읽는 중 문제가 발생했습니다.', 'error', '업로드 실패');
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
    if (errors.length > 0) alert(errors.join('\n'), 'warning', '업로드 제한');
  }, [selectedImages, maxImages, alert]);

  useEffect(() => {
    const handleWindowDragOver = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
    };
    const handleWindowDragEnter = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dragCounterRef.current += 1;
      setIsGlobalDragging(true);
    };
    const handleWindowDragLeave = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsGlobalDragging(false);
    };
    const handleWindowDrop = async (event) => {
      if (!event.dataTransfer?.files?.length) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
      const files = Array.from(event.dataTransfer.files);
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length > 0) await addImagesFromFiles(imageFiles);
    };
    const handleWindowPaste = async (event) => {
      if (isEditableTarget(event.target)) return;
      const items = Array.from(event.clipboardData?.items || []);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      event.preventDefault();
      const files = imageItems.map((item) => item.getAsFile()).filter(Boolean);
      await addImagesFromFiles(files);
    };
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [addImagesFromFiles]);

  /* ═══════════════════════════════════════════
     ─── 이벤트 핸들러 ───
     다크모드 토글, 로그아웃, 방 CRUD, 스크롤, 이미지 처리
     ═══════════════════════════════════════════ */

  const toggleDark = () => {
    const newDark = !isDark;
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme', newDark ? 'dark' : 'light');
    setIsDark(newDark);
  };

  const handleLogout = async () => {
    const ok = window.confirm('로그아웃 하시겠습니까?');
    if (!ok) return;
    clearSession();
    await TokenManager.logout();
  };

  const handleCreateRoom = async () => {
    if (loading || chatLoading) return;

    // Empty room reuse: current room has no messages
    if (messages.length === 0 && currentRoom) {
      alert('현재 채팅방에 대화 내용이 없습니다. 현재 채팅방을 계속 사용해주세요.', 'info', '현재 채팅방 사용');
      return;
    }

    // 20 room limit
    if (rooms.length >= 20) {
      const ok = window.confirm('최대 값(20개)의 대화방이 생성되어 있습니다. 가장 오래된 대화방을 삭제하시겠습니까?');
      if (!ok) return;
      const sortedRooms = [...rooms].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || 0);
        const dateB = new Date(b.createdAt || b.updatedAt || 0);
        return dateA - dateB;
      });
      const oldestRoom = sortedRooms[0];
      if (oldestRoom) {
        const success = await deleteRoom(oldestRoom._id);
        if (success) await createRoom();
      }
      return;
    }

    // Reuse most recent empty room
    if (rooms.length > 0) {
      const mostRecentRoom = rooms[0];
      if (!mostRecentRoom.messageCount || mostRecentRoom.messageCount === 0) {
        if (currentRoom !== mostRecentRoom._id) switchRoom(mostRecentRoom._id);
        return;
      }
    }

    try {
      const newRoom = await createRoom('New Chat');
      if (newRoom) switchRoom(newRoom._id);
    } catch (e) {
      logger.error('방 생성 실패:', e);
    }
  };

  const handleDeleteRoom = async (roomId) => {
    setRoomMenuOpen(null);
    const ok = window.confirm('이 대화를 삭제하시겠습니까?');
    if (!ok) return;
    await deleteRoom(roomId);
  };

  const startRenaming = (room) => {
    setEditingRoom(room._id);
    setEditingRoomName(room.name);
    setRoomMenuOpen(null);
  };

  const submitRename = async () => {
    if (editingRoom && editingRoomName.trim()) {
      await renameRoom(editingRoom, editingRoomName.trim());
    }
    setEditingRoom(null);
    setEditingRoomName('');
  };

  // 텍스트 영역 자동 높이 조절 (scrollHeight 기반)
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const cs = window.getComputedStyle(el);
    const lineH = parseInt(cs.lineHeight, 10) || 20;
    const padTop = parseInt(cs.paddingTop, 10) || 0;
    const padBot = parseInt(cs.paddingBottom, 10) || 0;
    const maxH = lineH * 8 + padTop + padBot;
    const nextH = Math.min(el.scrollHeight, maxH);
    el.style.height = `${nextH}px`;
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // Scroll handlers
  const scrollToTop = () => {
    const container = listRef.current;
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    const container = listRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      setIsAtBottom(true);
    }
  };

  // Image handlers
  const handleImageChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) await addImagesFromFiles(files);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleRemoveImage = (imageId) => {
    setSelectedImages((prev) => (prev || []).filter((img) => img.id !== imageId));
  };

  const handleTextareaPaste = async (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    event.preventDefault();
    const files = imageItems.map((item) => item.getAsFile()).filter(Boolean);
    await addImagesFromFiles(files);
  };

  const handleTextareaDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer?.files || []);
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length > 0) await addImagesFromFiles(imageFiles);
  };

  /* ── 인증 가드 — 인증 확인 전에는 아무것도 렌더링하지 않음 ── */
  if (!authChecked) return null;

  /* ═══════════════════════════════════════════
     ─── 렌더링 ───
     사이드바 | 메인영역(헤더 + 메시지 + 입력) | 모달
     ═══════════════════════════════════════════ */

  // Compute user turn indices for image display
  let userTurnCounter = 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: globalCSS }} />

      <div className="h-screen w-screen flex overflow-hidden relative" style={styles.pageBackground}>
        {/* Texture overlays */}
        <div style={styles.noiseOverlay} />
        <div style={styles.gridOverlay} />

        {/* Global drag overlay */}
        {isGlobalDragging && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
            <div className="absolute inset-0" style={{ background: 'rgba(6,182,212,0.05)' }} />
            <div
              className="relative px-4 py-2 rounded-full text-sm font-mono font-medium text-cyan-300 shadow-lg"
              style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', backdropFilter: 'blur(12px)' }}
            >
              이미지를 놓으면 업로드됩니다
            </div>
          </div>
        )}

        {/* Mobile sidebar backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            style={{ backdropFilter: 'blur(4px)' }}
          />
        )}

        {/* ═══════════════════════════════════════
           ─── 사이드바 ───
           로고, 검색, 새 대화, 방 목록, 네비게이션, 사용자 프로필
           ═══════════════════════════════════════ */}
        <aside
          className={`
            fixed lg:relative z-40 h-full w-64 flex flex-col
            transition-transform duration-300 ease-out
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
          style={styles.sidebarGlass}
        >
          {/* ── 로고 ── */}
          <div className="px-4 pt-5 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  boxShadow: '0 0 20px rgba(6,182,212,0.3)',
                }}
              >
                <Sparkles size={14} className="text-white" />
              </div>
              <div>
                <span
                  className={`text-sm font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}
                  style={styles.logoGlow}
                >
                  ModolAI
                </span>
                <span className={`text-[9px] font-mono ml-1.5 tracking-widest uppercase ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  PRO
                </span>
              </div>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className={`lg:hidden transition-colors ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <X size={16} />
            </button>
          </div>

          {/* ── 검색 ── */}
          <div className="px-3 pb-3">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
              style={styles.searchBar}
            >
              <Search size={13} className="shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검색..."
                className={`flex-1 bg-transparent outline-none text-[13px] ${
                  isDark
                    ? 'text-gray-300 placeholder:text-gray-600'
                    : 'text-gray-700 placeholder:text-gray-400'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}
                >
                  <X size={12} />
                </button>
              )}
              <div className={`flex items-center gap-0.5 text-[10px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                <Command size={10} />
                <span>K</span>
              </div>
            </div>
          </div>

          {/* ── 새 대화 버튼 ── */}
          <div className="px-3 pb-2">
            <button
              onClick={handleCreateRoom}
              disabled={loading || chatLoading}
              className={`
                w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px]
                transition-all group disabled:opacity-50
                ${isDark
                  ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5'
                  : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
                }
              `}
              style={{ border: isDark ? '1px dashed rgba(255,255,255,0.08)' : '1px dashed rgba(0,0,0,0.12)' }}
            >
              <Plus
                size={14}
                className={`transition-colors ${isDark
                  ? 'text-gray-500 group-hover:text-cyan-400'
                  : 'text-gray-400 group-hover:text-cyan-500'
                }`}
              />
              <span>새 대화</span>
              <div className={`ml-auto flex items-center gap-0.5 text-[10px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                <Command size={10} />
                <span>N</span>
              </div>
            </button>
          </div>

          {/* ── 대화방 목록 라벨 ── */}
          <div className="px-4 pt-2 pb-1">
            <span className={`text-[10px] font-mono uppercase tracking-[0.15em] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              대화 목록 ({filteredRooms.length})
            </span>
          </div>

          {/* ── 대화방 목록 (검색 필터 적용) ── */}
          <div className="flex-1 overflow-y-auto px-2 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
            {filteredRooms.length === 0 && (
              <div className={`px-3 py-8 text-center text-[12px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                {searchQuery ? '검색 결과 없음' : '대화가 없습니다'}
              </div>
            )}

            {filteredRooms.map((room, idx) => {
              const isActive = room._id === currentRoom;
              const isEditing = editingRoom === room._id;
              const menuOpen = roomMenuOpen === room._id;

              return (
                <div
                  key={room._id}
                  className="relative"
                  style={{ animation: `chat2-slide-in-left 0.3s ease-out ${idx * 0.03}s both` }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!isEditing) {
                        switchRoom(room._id);
                        setMobileMenuOpen(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (!isEditing) {
                          switchRoom(room._id);
                          setMobileMenuOpen(false);
                        }
                      }
                    }}
                    className={`
                      w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all relative group cursor-pointer
                      ${isActive
                        ? isDark
                          ? 'bg-white/[0.06] text-white'
                          : 'bg-cyan-50/80 text-gray-900'
                        : isDark
                          ? 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
                      }
                    `}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div
                        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
                        style={styles.activeItemBar}
                      />
                    )}

                    <MessageCircle
                      size={14}
                      className={`shrink-0 transition-colors ${
                        isActive
                          ? 'text-cyan-400'
                          : isDark
                            ? 'text-gray-600 group-hover:text-gray-400'
                            : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingRoomName}
                          onChange={(e) => setEditingRoomName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename();
                            if (e.key === 'Escape') {
                              setEditingRoom(null);
                              setEditingRoomName('');
                            }
                          }}
                          onBlur={submitRename}
                          className={`w-full bg-transparent text-[13px] outline-none border-b border-cyan-400 ${isDark ? 'text-white' : 'text-gray-900'}`}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <div className="text-[13px] truncate leading-tight">{room.name}</div>
                          <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            {formatRoomTime(room.updatedAt || room.createdAt)}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Room menu trigger */}
                    {!isEditing && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRoomMenuOpen(menuOpen ? null : room._id);
                          }}
                          className={`
                            p-0.5 rounded transition-opacity shrink-0
                            ${isDark
                              ? 'text-gray-600 hover:bg-white/10'
                              : 'text-gray-400 hover:bg-black/5'
                            }
                            ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                          `}
                        >
                          <MoreHorizontal size={14} />
                        </button>

                        {/* Room context menu */}
                        {menuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setRoomMenuOpen(null)} />
                            <div
                              className={`absolute right-0 top-6 z-50 w-32 rounded-lg shadow-xl overflow-hidden text-[12px]
                                ${isDark
                                  ? 'bg-gray-800 border border-white/10'
                                  : 'bg-white border border-gray-200 shadow-lg'
                                }
                              `}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startRenaming(room);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 transition-colors ${
                                  isDark
                                    ? 'hover:bg-white/5 text-gray-300'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <Pencil size={12} /> 이름 변경
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room._id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={12} /> 삭제
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 사이드바 구분선 ── */}
          <div
            className="mx-4 my-1"
            style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}
          />

          {/* ── 네비게이션 링크 (쪽지, 공지, 게시판 등) ── */}
          <div className="px-3 py-1 space-y-0.5 overflow-y-auto" style={{ maxHeight: '200px', scrollbarWidth: 'thin' }}>
            {/* 쪽지 (DM) */}
            <button
              onClick={() => setShowDmModal(true)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all relative ${
                isDark ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5' : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <Mail size={13} className="shrink-0" />
              <span>쪽지</span>
              {unreadDmCount > 0 && (
                <span
                  className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 0 8px rgba(239,68,68,0.4)' }}
                >
                  {unreadDmCount > 99 ? '99+' : unreadDmCount}
                </span>
              )}
            </button>

            {/* DM notification bubble */}
            {showDmNotification && (
              <div className="px-3 py-1.5 mx-1 rounded-lg text-[11px] font-mono text-cyan-300" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                새 쪽지 {newDmCount}개가 도착했습니다
                <button onClick={() => setShowDmNotification(false)} className="ml-2 text-cyan-500 hover:text-cyan-300"><X size={10} className="inline" /></button>
              </div>
            )}

            {/* 공지사항 */}
            <button
              onClick={() => router.push('/notice')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                isDark ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5' : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <Bell size={13} className="shrink-0" />
              <span>공지사항</span>
            </button>

            {/* 업데이트 노트 */}
            <button
              onClick={() => setPatchNotesOpen(true)}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                isDark ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5' : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <Rocket size={13} className="shrink-0" />
              <span>업데이트 노트</span>
            </button>

            {/* 자유게시판 */}
            {boardEnabled && (
              <button
                onClick={() => router.push('/board')}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                  isDark ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5' : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
                }`}
              >
                <MessageSquare size={13} className="shrink-0" />
                <span>자유게시판</span>
              </button>
            )}

            {/* 내 API 키 */}
            <button
              onClick={() => router.push('/my-api-keys')}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                isDark ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5' : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
              }`}
            >
              <Key size={13} className="shrink-0" />
              <span>내 API 키</span>
            </button>

            {/* 프로필 수정 */}
            {profileEditEnabled && (
              <button
                onClick={() => router.push('/profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                  isDark ? 'text-gray-400 hover:text-cyan-400 hover:bg-cyan-400/5' : 'text-gray-500 hover:text-cyan-600 hover:bg-cyan-50'
                }`}
              >
                <User size={13} className="shrink-0" />
                <span>프로필 수정</span>
              </button>
            )}

            {/* 관리자 페이지 */}
            {(userRole === 'admin' || userRole === 'manager') && (
              <button
                onClick={() => router.push('/admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12px] font-mono transition-all ${
                  isDark ? 'text-cyan-400/80 hover:text-cyan-300 hover:bg-cyan-400/5' : 'text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50'
                }`}
              >
                <Shield size={13} className="shrink-0" />
                <span>관리자 페이지</span>
              </button>
            )}
          </div>

          {/* ── 사이드바 구분선 ── */}
          <div
            className="mx-4 my-1"
            style={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.06)' }}
          />

          {/* ── 사용자 프로필 + 로그아웃 ── */}
          <div className="px-3 pb-4">
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors cursor-pointer group">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-cyan-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))',
                  border: '1px solid rgba(6,182,212,0.2)',
                }}
              >
                {userEmail?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className={`text-[13px] truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {userEmail || '사용자'}
                  </div>
                  {/* Role badge */}
                  {userRole === 'admin' && (
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full text-red-300"
                      style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      관리자
                    </span>
                  )}
                  {userRole === 'manager' && (
                    <span
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full text-amber-300"
                      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.2)' }}
                    >
                      매니저
                    </span>
                  )}
                </div>
                <div className={`text-[10px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                  {userRole}
                </div>
              </div>
              <button
                onClick={handleLogout}
                title="로그아웃"
                className={`opacity-0 group-hover:opacity-100 transition-all ${
                  isDark
                    ? 'text-gray-600 hover:text-red-400'
                    : 'text-gray-400 hover:text-red-500'
                }`}
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* ═══════════════════════════════════════
           ─── 메인 영역 ───
           에이전트 선택, 상단 바, 메시지 목록, 입력 영역
           ═══════════════════════════════════════ */}
        <main className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* ── 에이전트 선택 ── */}
          <div className="relative z-10">
            <AgentSelector />
          </div>

          {/* ── 상단 바 (방 이름, 모델 표시, 다크모드 토글) ── */}
          <div className="flex items-center justify-between px-4 lg:px-6 py-3" style={styles.topBar}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className={`lg:hidden p-1 transition-colors ${
                  isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Menu size={18} />
              </button>

              <div className="flex items-center gap-1.5 text-[13px]">
                <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>대화</span>
                <ChevronRight size={12} className={isDark ? 'text-gray-600' : 'text-gray-300'} />
                <span className={`font-medium truncate max-w-[200px] ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {currentRoomData?.name || 'New Chat'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Model pill in top bar */}
              {modelLabel && (
                <div
                  className={`hidden sm:block text-[11px] font-mono px-2 py-0.5 rounded-full ${
                    isDark ? 'text-cyan-400/80' : 'text-cyan-600'
                  }`}
                  style={styles.modelPill}
                >
                  {modelLabel}
                </div>
              )}

              {/* Message count */}
              <div
                className={`text-[10px] font-mono px-2 py-1 rounded ${
                  isDark ? 'text-gray-500 bg-white/[0.03]' : 'text-gray-400 bg-black/[0.03]'
                }`}
              >
                {displayMessages.filter((m) => !m.isTyping).length} 메시지
              </div>

              <button
                onClick={toggleDark}
                className="p-1 rounded-md transition-all"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                  width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title={isDark ? '라이트 모드' : '다크 모드'}
              >
                {isDark ? <Sun size={12} /> : <Moon size={12} />}
              </button>
            </div>
          </div>

          {/* ── 메시지 영역 (메인 UI와 동일한 max-w 반응형 폭) ── */}
          <div ref={listRef} className="flex-1 overflow-y-auto py-6">
          <div className="max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 space-y-1">
            {/* Empty state */}
            {displayMessages.length === 0 && !chatLoading && (
              <div
                className="flex flex-col items-center justify-center h-full gap-4"
                style={{ animation: 'chat2-fade-up 0.5s ease-out' }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))',
                    border: '1px solid rgba(6,182,212,0.15)',
                  }}
                >
                  <Sparkles size={24} className="text-cyan-400" />
                </div>
                <div className="text-center">
                  <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    새 대화를 시작하세요
                  </h3>
                  <p className={`text-[13px] font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                    무엇이든 물어보세요
                  </p>
                </div>
              </div>
            )}

            {/* Chat loading spinner */}
            {chatLoading && displayMessages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
              </div>
            )}

            {/* Message list */}
            {(() => {
              userTurnCounter = 0;
              return displayMessages.map((msg, idx) => {
                let userTurnIndex = null;
                if (msg.role === 'user') {
                  userTurnCounter += 1;
                  userTurnIndex = userTurnCounter;
                }
                const userImages = msg.role === 'user' && userTurnIndex ? imagesByTurn.get(userTurnIndex) || [] : [];

                return (
                  <div
                    key={msg._id || `msg-${idx}`}
                    className="group relative"
                    style={{ animation: `chat2-fade-up 0.4s ease-out ${Math.min(idx * 0.05, 0.5)}s both` }}
                  >
                    {msg.role === 'user' ? (
                      /* ────── User Bubble ────── */
                      <div className="flex justify-end mb-4">
                        <div className="max-w-[95%] md:max-w-[90%] lg:max-w-[85%] xl:max-w-[80%] rounded-xl px-5 py-3.5 relative" style={styles.userBubble}>
                          {/* Message number */}
                          <div className={`absolute -top-5 right-0 text-[10px] font-mono ${isDark ? 'text-cyan-500/50' : 'text-cyan-600/50'}`}>
                            #{idx + 1}
                          </div>
                          <div className="absolute top-3.5 right-0 translate-x-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/40" />
                          </div>
                          <div
                            className={`text-[14px] leading-relaxed whitespace-pre-wrap ${
                              isDark ? 'text-gray-200' : 'text-gray-800'
                            }`}
                          >
                            {msg.text}
                          </div>
                          {/* Attached images display */}
                          {userImages.length > 0 && (
                            <div className="mt-3">
                              <div className={`text-[10px] font-mono mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                첨부 이미지 {userImages.length}개
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {userImages.map((image, imageIdx) => {
                                  const src = image?.dataUrl || image?.url || image;
                                  if (!src) return null;
                                  const label = image?.name || `이미지 ${imageIdx + 1}`;
                                  const sizeLabel = formatSize(image?.size);
                                  return (
                                    <button
                                      type="button"
                                      key={`${label}-${imageIdx}`}
                                      onClick={() => setPreviewImage({ src, name: label, size: sizeLabel })}
                                      className="group/img text-left"
                                      title={label}
                                    >
                                      <div
                                        className="relative w-12 h-12 rounded-md overflow-hidden"
                                        style={styles.imageThumbnail}
                                      >
                                        <img src={src} alt={label} className="w-full h-full object-cover" />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ────── Assistant Bubble ────── */
                      <div className="mb-6">
                        <div className="max-w-[95%] md:max-w-[90%] lg:max-w-[85%] xl:max-w-[80%] rounded-xl px-5 py-4 relative" style={styles.aiBubble}>
                          {/* Message number */}
                          <div className={`absolute -top-5 left-0 text-[10px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                            #{idx + 1}
                          </div>

                          {/* Copy button */}
                          {!msg.isTyping && <CopyButtonGlass text={msg.text} isDark={isDark} />}

                          {/* AI header */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.05))' }}
                            >
                              <Sparkles size={10} className="text-cyan-400" />
                            </div>
                            <span className={`text-[11px] font-mono tracking-wide ${isDark ? 'text-cyan-400/70' : 'text-cyan-500'}`}>
                              ModolAI
                            </span>
                            {msg.model && (() => {
                              const lbl = getModelLabel(msg.model);
                              const serverName = getModelServerName(msg.model);
                              return lbl ? (
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isDark ? 'text-gray-500' : 'text-gray-500'}`}
                                    style={styles.modelPill}
                                  >
                                    {lbl}
                                  </div>
                                  {serverName && (
                                    <span className={`text-[9px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                      [{serverName}]
                                    </span>
                                  )}
                                </div>
                              ) : null;
                            })()}
                          </div>

                          {/* Content */}
                          {msg.isTyping && !msg.text ? (
                            <TypingIndicator />
                          ) : (
                            <div className={`chat2-md ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              <MarkdownPreview
                                source={msg.text || ''}
                                style={{
                                  backgroundColor: 'transparent',
                                  color: 'inherit',
                                  fontSize: '14px',
                                  lineHeight: '1.7',
                                }}
                                wrapperElement={{ 'data-color-mode': isDark ? 'dark' : 'light' }}
                                rehypePlugins={[rehypeSanitize]}
                              />
                            </div>
                          )}

                          {/* Feedback buttons */}
                          {!msg.isTyping && (
                            <FeedbackButtonGlass
                              messageId={msg._id || null}
                              initialFeedback={msg.feedback}
                              isDark={isDark}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            <div ref={bottomRef} />
          </div>
          </div>

          {/* ── 스크롤 버튼 (맨 위/맨 아래) ── */}
          {showScrollButtons && (
            <div className="fixed bottom-32 right-5 z-50 flex flex-col gap-2" style={{ animation: 'chat2-fade-in 0.3s ease-out' }}>
              <button
                onClick={scrollToTop}
                className={`p-2.5 rounded-xl transition-all hover:scale-105 ${isDark ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-cyan-600'}`}
                style={styles.scrollButton}
                title="맨 위로"
              >
                <ChevronUp size={18} />
              </button>
              <button
                onClick={scrollToBottom}
                className={`p-2.5 rounded-xl transition-all hover:scale-105 ${isDark ? 'text-gray-400 hover:text-cyan-400' : 'text-gray-500 hover:text-cyan-600'}`}
                style={styles.scrollButton}
                title="맨 아래로"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════
             ─── 입력 영역 ───
             새 메시지 버튼, 스트리밍 상태, 이미지 썸네일,
             텍스트 입력, 모델 선택, 전송 버튼
             ═══════════════════════════════════════ */}
          {/* ── 입력 영역 (메인 UI와 동일한 max-w 반응형 폭) ── */}
          <div className="pb-4 pt-2 relative" style={styles.inputGlow}>
          <div className="max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4">
            {/* Focus glow line */}
            {inputFocused && (
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{ ...styles.inputFocusGradient, animation: 'chat2-fade-in 0.3s ease-out' }}
              />
            )}

            {/* "새 메시지" 스크롤 버튼 — 스트리밍 중에도 표시 */}
            {!isAtBottom && (
              <div className="flex justify-center mb-2">
                <button
                  onClick={scrollToBottom}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono transition-all hover:scale-105 ${
                    isDark ? 'text-cyan-400' : 'text-cyan-600'
                  }`}
                  style={{
                    ...styles.scrollButton,
                    animation: 'chat2-fade-up 0.3s ease-out',
                  }}
                >
                  <ChevronDown size={14} />
                  <span>새 메시지</span>
                </button>
              </div>
            )}

            {/* Streaming controls */}
            {loading && (
              <div className="mb-3 flex items-center justify-center gap-3">
                <div
                  className="flex items-center gap-2 px-4 py-2 rounded-lg"
                  style={
                    isDark
                      ? { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                      : { background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
                  }
                >
                  <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />
                  <span className={`text-[12px] font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    응답 생성 중...
                  </span>
                  <button
                    onClick={stopStreaming}
                    className="ml-2 px-2 py-0.5 text-[11px] font-mono text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors flex items-center gap-1"
                  >
                    <Square size={10} fill="currentColor" /> 중단
                  </button>
                </div>
              </div>
            )}

            {/* Image thumbnails */}
            {currentImageCount > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 px-1">
                {selectedImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative w-14 h-14 rounded-lg overflow-hidden"
                    style={styles.imageThumbnail}
                  >
                    <img src={image.dataUrl} alt={image.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(image.id)}
                      className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full text-[10px] text-white"
                      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                      title="이미지 제거"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
                inputFocused ? 'ring-1 ring-cyan-500/20' : ''
              } ${isDragging ? 'ring-2 ring-cyan-400/40' : ''}`}
              style={{
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
                border: `1px solid ${
                  inputFocused
                    ? 'rgba(6,182,212,0.2)'
                    : isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.08)'
                }`,
              }}
            >
              {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div
                    className="px-3 py-1.5 rounded-full text-[11px] font-mono text-cyan-300"
                    style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}
                  >
                    이미지를 놓으면 업로드됩니다
                  </div>
                </div>
              )}

              <div className="relative p-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    resizeTextarea();
                  }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onKeyDown={handleKeyDown}
                  onPaste={handleTextareaPaste}
                  onDrop={handleTextareaDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                  placeholder={modelsLoading ? '모델 로딩 중...' : '메시지를 입력하세요… (Enter 전송, Shift+Enter 줄바꿈, 이미지 드래그/붙여넣기)'}
                  disabled={loading || !currentRoom || modelsLoading}
                  rows={1}
                  className={`
                    w-full bg-transparent text-[14px] resize-none outline-none
                    font-mono leading-relaxed min-h-[24px] max-h-[120px]
                    disabled:opacity-50 pr-44
                    ${isDark
                      ? 'text-gray-200 placeholder:text-gray-600'
                      : 'text-gray-800 placeholder:text-gray-400'
                    }
                  `}
                  style={{ scrollbarWidth: 'none' }}
                />

                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-all ${
                      isDark
                        ? 'text-gray-500 hover:text-cyan-400 hover:bg-cyan-400/10'
                        : 'text-gray-400 hover:text-cyan-600 hover:bg-cyan-50'
                    }`}
                    title={`이미지 업로드 (${currentImageCount}/${maxImages})`}
                  >
                    <LucideImage size={15} />
                    {currentImageCount > 0 && (
                      <span className="ml-0.5 text-[9px] font-mono text-cyan-400">{currentImageCount}</span>
                    )}
                  </button>
                  {modelConfig && modelOptions.length > 0 && (
                    <ModelSelector
                      selectedModel={selectedModel}
                      setSelectedModel={(id) => setSelectedModelWithRoom(id, currentRoom)}
                      modelConfig={modelConfig}
                      disabled={loading || !currentRoom || modelsLoading}
                      userDefaultModelId={userDefaultModelId}
                      onSetUserDefault={saveUserDefaultModel}
                    />
                  )}
                  <button
                    onClick={() => {
                      if ((input.trim() || selectedImages.length > 0) && !loading) {
                        sendMessage(input);
                      }
                    }}
                    disabled={loading || !currentRoom || modelsLoading || (!input.trim() && selectedImages.length === 0)}
                    className={`
                      shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200
                      ${(input.trim() || selectedImages.length > 0) && !loading
                        ? 'text-white hover:scale-105'
                        : isDark
                          ? 'text-gray-600 cursor-not-allowed'
                          : 'text-gray-400 cursor-not-allowed'
                      }
                    `}
                    style={
                      (input.trim() || selectedImages.length > 0) && !loading
                        ? styles.sendButton
                        : { background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)' }
                    }
                  >
                    <ArrowUp size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>

            {/* Keyboard hints */}
            <div className={`flex items-center justify-center gap-4 mt-2.5 text-[10px] font-mono ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              <span>
                <kbd className={isDark ? 'text-gray-500' : 'text-gray-500'}>Enter</kbd> 전송
              </span>
              <span className={isDark ? 'text-gray-700' : 'text-gray-300'}>·</span>
              <span>
                <kbd className={isDark ? 'text-gray-500' : 'text-gray-500'}>Shift+Enter</kbd> 줄바꿈
              </span>
              <span className={isDark ? 'text-gray-700' : 'text-gray-300'}>·</span>
              <span className={isDark ? 'text-gray-700' : 'text-gray-400'}>
                ModolAI는 실수를 할 수 있습니다
              </span>
            </div>
          </div>
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════
         ─── 이미지 미리보기 모달 ───
         첨부 이미지 클릭 시 전체 화면 프리뷰
         ═══════════════════════════════════════ */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="absolute -top-4 -right-4 px-3 py-1 text-sm font-mono rounded-lg text-cyan-300 transition-all hover:text-white"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              onClick={() => setPreviewImage(null)}
            >
              닫기
            </button>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <img
                src={previewImage.src}
                alt={previewImage.name || '첨부 이미지'}
                className="w-full max-h-[80vh] object-contain bg-black"
              />
            </div>
            <div className="mt-3 text-sm font-mono text-gray-300 flex items-center gap-2">
              <span>{previewImage.name}</span>
              {previewImage.size && <span className="text-gray-500">({previewImage.size})</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
         ─── 모달 & 팝업 ───
         쪽지(DM), 패치노트, 공지사항 팝업
         ═══════════════════════════════════════ */}
      <DirectMessageModal
        isOpen={showDmModal}
        onClose={() => setShowDmModal(false)}
        onUnreadCountChange={fetchUnreadDmCount}
      />

      <PatchNotesModal
        isOpen={patchNotesOpen}
        onClose={() => setPatchNotesOpen(false)}
      />

      <NoticePopup target="main" />
    </>
  );
}
