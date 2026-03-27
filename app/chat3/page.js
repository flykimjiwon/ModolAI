/**
 * ═══════════════════════════════════════════════════════════════════
 * 디자인 3: 미니멀 엘레강스 / 애플스타일 디자인 (Warm & Friendly)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 따뜻한 stone 색상 팔레트와 그라데이션 악센트(amber → rose → violet)를
 * 기반으로 한 미니멀 채팅 UI. 다크모드/라이트모드 모두 지원.
 *
 * 주요 기능:
 *  - 다크/라이트 테마 전환 (localStorage 기반 유지)
 *  - 대화방 CRUD (생성/이름변경/삭제/전환)
 *  - AI 모델 선택기 (ModelSelector 컴포넌트)
 *  - 에이전트 선택기 (AgentSelector 컴포넌트)
 *  - 이미지 업로드 (드래그앤드롭, 클립보드 붙여넣기, 파일선택)
 *  - 마크다운 렌더링 (SVG/코드블록 지원, XSS 방어)
 *  - 메시지 피드백 (좋아요/싫어요)
 *  - 스트리밍 응답 (실시간 타이핑 효과)
 *  - 쪽지(DM), 공지사항, 업데이트노트, 게시판 연동
 *
 * 재사용 시 참고:
 *  - useChat, useChatSender, useModelManager 훅이 백엔드 API와 연동
 *  - 너비: max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl
 *  - 말풍선: max-w-[95%] md:max-w-[90%] lg:max-w-[85%] xl:max-w-[80%]
 */
'use client';

/* ─── 임포트: React 핵심 훅 ─── */
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';

/* ─── 임포트: 커스텀 훅 (채팅, 모델, 전송) ─── */
import { useChat } from '@/hooks/useChat';
import { useModelManager, loadRoomModel } from '@/hooks/useModelManager';
import { useChatSender } from '@/hooks/useChatSender';

/* ─── 임포트: 유틸리티 (IP감지, JWT, 토큰, 로거) ─── */
import { detectClientIP } from '@/lib/clientIP';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import { TokenManager } from '@/lib/tokenManager';
import { logger } from '@/lib/logger';

/* ─── 임포트: 컨텍스트 ─── */
import { useAlert } from '@/contexts/AlertContext';

/* ─── 임포트: 마크다운 렌더링 & 보안 ─── */
import dynamic from 'next/dynamic';
const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), {
  ssr: false,
  loading: () => <div className="animate-pulse h-4 bg-muted rounded w-3/4" />,
});
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

/* ─── 임포트: 공통 UI 컴포넌트 ─── */
import ModelSelector from '@/components/chat/ModelSelector';
import NoticePopup from '@/components/NoticePopup';
import AgentSelector from '@/components/AgentSelector';
const DirectMessageModal = dynamic(() => import('@/components/DirectMessageModal'), { ssr: false });
const PatchNotesModal = dynamic(() => import('@/components/PatchNotesModal'), { ssr: false });

/* ─── 임포트: Lucide 아이콘 ─── */
import {
  Send,
  Plus,
  User,
  MessageCircle,
  Sun,
  Moon,
  Sparkles,
  Code,
  FileText,
  BarChart3,
  Brain,
  Menu,
  X,
  ArrowUp,
  LogOut,
  Loader2,
  Square,
  Trash2,
  Check,
  Pencil,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Mail,
  Bell,
  Rocket,
  MessageSquare,
  Key,
  Shield,
  ChevronUp,
  ChevronDown,
  LucideImage,
} from 'lucide-react';

/* ─── 이미지 헬퍼: 고유 ID 생성, DataURL 변환, 파일 크기 포맷 ─── */
let _imgIdCounter = 0;

const generateImageId = () => {
  if (typeof crypto !== 'undefined') {
    if (crypto.randomUUID) return crypto.randomUUID();
    if (crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }
  return `${Date.now()}-${++_imgIdCounter}`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const formatSize = (size) => {
  if (!Number.isFinite(size)) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(2)}MB`;
};

/* ─── 제안 카드: 웰컴 화면에 표시되는 빠른 시작 프롬프트 ─── */
const SUGGESTION_CARDS = [
  {
    icon: Code,
    title: '코드 작성',
    desc: '함수, 컴포넌트, 스크립트 작성을 도와드려요',
    gradient: 'from-amber-400 to-orange-500',
    darkGradient: 'dark:from-amber-500 dark:to-orange-600',
    prompt: '간단한 React 컴포넌트를 작성해줘',
  },
  {
    icon: FileText,
    title: '문서 요약',
    desc: '긴 문서를 핵심만 간결하게 정리해요',
    gradient: 'from-rose-400 to-pink-500',
    darkGradient: 'dark:from-rose-500 dark:to-pink-600',
    prompt: '효과적인 문서 요약 방법을 알려줘',
  },
  {
    icon: BarChart3,
    title: '데이터 분석',
    desc: '데이터를 분석하고 인사이트를 도출해요',
    gradient: 'from-violet-400 to-purple-500',
    darkGradient: 'dark:from-violet-500 dark:to-purple-600',
    prompt: '데이터 분석 보고서 작성 방법을 알려줘',
  },
  {
    icon: Brain,
    title: '아이디어 브레인스토밍',
    desc: '창의적인 아이디어를 함께 발전시켜요',
    gradient: 'from-teal-400 to-emerald-500',
    darkGradient: 'dark:from-teal-500 dark:to-emerald-600',
    prompt: '새로운 프로젝트 아이디어를 브레인스토밍해줘',
  },
];

/* ─── SVG 보안 스키마: 마크다운 내 SVG 렌더링 시 XSS 공격 방어 ─── */
const svgSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'svg', 'g', 'defs', 'symbol',
    'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect',
    'text', 'tspan',
    'linearGradient', 'radialGradient', 'stop',
    'clipPath', 'mask', 'marker',
    'filter', 'feGaussianBlur', 'feOffset', 'feBlend',
    'feFlood', 'feComposite', 'feMerge', 'feMergeNode', 'feColorMatrix',
    'title', 'desc', 'use',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] || []),
      'x', 'y',
      'fill', 'fillOpacity', 'fillRule',
      'stroke', 'strokeWidth', 'strokeDasharray', 'strokeDashoffset',
      'strokeLinecap', 'strokeLinejoin', 'strokeOpacity',
      'opacity', 'transform', 'style',
      'display', 'visibility', 'overflow',
      'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
      'textAnchor', 'dominantBaseline',
      'clipPath', 'mask', 'filter',
      'markerStart', 'markerMid', 'markerEnd',
    ],
    svg: ['viewBox', 'xmlns', 'preserveAspectRatio'],
    circle: ['cx', 'cy', 'r'],
    ellipse: ['cx', 'cy', 'rx', 'ry'],
    line: ['x1', 'y1', 'x2', 'y2'],
    path: ['d'],
    polygon: ['points'],
    polyline: ['points'],
    rect: ['x', 'y', 'rx', 'ry'],
    text: ['x', 'y', 'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust'],
    tspan: ['x', 'y', 'dx', 'dy', 'rotate'],
    g: [],
    defs: [],
    symbol: ['viewBox', 'preserveAspectRatio'],
    use: [['href', /^#/]],
    linearGradient: ['gradientUnits', 'gradientTransform', 'spreadMethod', 'x1', 'y1', 'x2', 'y2'],
    radialGradient: ['gradientUnits', 'gradientTransform', 'spreadMethod', 'cx', 'cy', 'r', 'fx', 'fy'],
    stop: ['offset', 'stopColor', 'stopOpacity'],
    clipPath: ['clipPathUnits'],
    mask: ['x', 'y', 'maskUnits'],
    marker: ['viewBox', 'refX', 'refY', 'markerWidth', 'markerHeight', 'markerUnits', 'orient', 'preserveAspectRatio'],
    filter: ['x', 'y', 'filterUnits', 'primitiveUnits'],
    feGaussianBlur: ['in', 'stdDeviation', 'result'],
    feOffset: ['in', 'dx', 'dy', 'result'],
    feBlend: ['in', 'in2', 'mode', 'result'],
    feFlood: ['floodColor', 'floodOpacity', 'result'],
    feComposite: ['in', 'in2', 'operator', 'k1', 'k2', 'k3', 'k4', 'result'],
    feMerge: ['result'],
    feMergeNode: ['in'],
    feColorMatrix: ['in', 'type', 'values', 'result'],
    title: [],
    desc: [],
  },
};

/* ─── 타이핑 인디케이터: AI 응답 대기 중 표시되는 바운스 애니메이션 ─── */
function BouncingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-stone-400 dark:bg-stone-500"
          style={{
            animation: 'chat3bounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}

/* ─── 복사 버튼: AI 응답 텍스트를 클립보드에 복사 (HTTPS/Fallback 지원) ─── */
const WarmCopyButton = memo(function WarmCopyButton({ text }) {
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
        ta.style.top = '-999999px';
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
      className={`absolute top-2 right-2 p-1.5 rounded-lg shadow-sm transition-all opacity-0 group-hover:opacity-100 z-[1] ${
        copied
          ? 'bg-gradient-to-r from-amber-400 to-rose-500'
          : 'bg-white/85 dark:bg-stone-700/85 border border-stone-200/50 dark:border-stone-600/50'
      }`}
      title={copied ? '복사됨!' : '답변 전체 복사'}
    >
      {copied ? (
        <Check size={14} className="text-white" />
      ) : (
        <Copy size={14} className="text-stone-400 dark:text-stone-500" />
      )}
    </button>
  );
});

/* ─── 피드백 버튼: AI 응답에 좋아요/싫어요 평가 (서버 저장) ─── */
const WarmFeedbackButton = memo(function WarmFeedbackButton({
  messageId,
  initialFeedback,
}) {
  const [feedback, setFeedback] = useState(initialFeedback || null);
  const [fbLoading, setFbLoading] = useState(false);

  useEffect(() => {
    setFeedback(initialFeedback || null);
  }, [initialFeedback]);

  const handleFeedback = async (type) => {
    if (fbLoading || !messageId) return;
    if (messageId.startsWith('temp-')) return;

    const newFeedback = feedback === type ? null : type;
    setFbLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/webapp-chat/feedback/${messageId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
        className={`p-1.5 rounded-lg transition-colors ${
          !messageId
            ? 'text-stone-300 dark:text-stone-600 cursor-not-allowed'
            : feedback === 'like'
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30'
              : 'text-stone-400 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-700'
        }`}
        title={!messageId ? '메시지 저장 중...' : '좋아요'}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        onClick={() => handleFeedback('dislike')}
        disabled={fbLoading || !messageId}
        className={`p-1.5 rounded-lg transition-colors ${
          !messageId
            ? 'text-stone-300 dark:text-stone-600 cursor-not-allowed'
            : feedback === 'dislike'
              ? 'text-rose-500 bg-rose-50 dark:bg-rose-900/30'
              : 'text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-stone-700'
        }`}
        title={!messageId ? '메시지 저장 중...' : '싫어요'}
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
});

/* ─── 마크다운 렌더러: rehype-sanitize로 XSS 방어 + 코드블록 복사 버튼 자동 삽입 ─── */
const WarmSafeMarkdown = memo(function WarmSafeMarkdown({ source }) {
  const plugins = useMemo(() => [[rehypeSanitize, svgSchema]], []);
  const linkComponents = useMemo(
    () => ({
      a: ({ children, ...props }) => (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    }),
    []
  );
  const markdownRef = useRef(null);
  const [colorMode, setColorMode] = useState('light');

  useEffect(() => {
    const updateColorMode = () => {
      setColorMode(
        document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      );
    };
    updateColorMode();
    const observer = new MutationObserver(updateColorMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Add warm-styled copy buttons to code blocks after render
  useEffect(() => {
    if (!markdownRef.current || !source) return;
    const addCopyButtons = () => {
      const codeBlocks = markdownRef.current?.querySelectorAll('pre code');
      if (!codeBlocks) return;
      codeBlocks.forEach((codeBlock) => {
        const pre = codeBlock.parentElement;
        if (pre && !pre.querySelector('.warm-copy-btn')) {
          const btn = document.createElement('button');
          btn.className = 'warm-copy-btn';
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
                ta.style.top = '-999999px';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
              }
              btn.textContent = '복사됨!';
              btn.style.background =
                'linear-gradient(135deg, #f59e0b, #f43f5e)';
              btn.style.color = '#fff';
              btn.style.borderColor = 'transparent';
              setTimeout(() => {
                btn.textContent = '복사';
                btn.style.background = '';
                btn.style.color = '';
                btn.style.borderColor = '';
              }, 2000);
            } catch (err) {
              logger.error('복사 실패:', err);
            }
          };
          pre.style.position = 'relative';
          pre.appendChild(btn);
        }
      });
    };
    const timer = setTimeout(addCopyButtons, 200);
    return () => clearTimeout(timer);
  }, [source]);

  return (
    <div className="markdown-content w-full" ref={markdownRef}>
      <MarkdownPreview
        source={source}
        style={{
          padding: 0,
          backgroundColor: 'transparent',
          color: 'inherit',
          fontSize: '15px',
          width: '100%',
        }}
        rehypePlugins={plugins}
        components={linkComponents}
        data-color-mode={colorMode}
        wrapperElement={{
          'data-color-mode': colorMode,
          style: { width: '100%', contain: 'layout' },
        }}
      />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
   메인 컴포넌트: Chat3Page
   구조: 인증 → 상태초기화 → 사이드이펙트 → 핸들러 → 렌더링
   레이아웃: 사이드바(오버레이) | 헤더 | 메인(웰컴/메시지) | 입력영역
   ═══════════════════════════════════════════════════════════════════ */
export default function Chat3Page() {
  const router = useRouter();
  const { alert } = useAlert();

  /* ─── 다크모드 토글: localStorage에 테마 저장, documentElement에 'dark' 클래스 토글 ─── */
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      const dark = saved === 'dark';
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    } else {
      const dark = document.documentElement.classList.contains('dark');
      setIsDark(dark);
    }
  }, []);
  const toggleDark = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    setIsDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  /* ─── 인증 상태: 이메일, 역할(admin/manager/user), 인증 완료 여부 ─── */
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [authChecked, setAuthChecked] = useState(false);

  /* ─── 클라이언트 IP: 서버 전송용 ─── */
  const [clientIP, setClientIP] = useState(null);

  /* ─── 이미지 상태: 선택된 이미지, 업로드 설정, 방별 이미지 이력 ─── */
  const [selectedImages, setSelectedImages] = useState([]);
  const [maxImagesPerMessage, setMaxImagesPerMessage] = useState(5);
  const [imageAnalysisModel, setImageAnalysisModel] = useState('');
  const [imageAnalysisPrompt, setImageAnalysisPrompt] = useState(
    '이 이미지를 설명해줘.'
  );
  const [imageHistoryByRoom, setImageHistoryByRoom] = useState({});
  const [maxUserQuestionLength, setMaxUserQuestionLength] = useState(300000);
  const [isDragging, setIsDragging] = useState(false);

  /* ─── UI 상태: 사이드바, 방 편집, 모달, 스크롤 위치 등 ─── */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState('');
  const [patchNotesOpen, setPatchNotesOpen] = useState(false);
  const [showDmModal, setShowDmModal] = useState(false);
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [profileEditEnabled, setProfileEditEnabled] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);

  /* ─── 핵심 훅: useChat — 방 CRUD, 메시지 관리, 세션 ─── */
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
      alert(error.message, 'error', '이름 변경 실패');
    }
  };

  const deleteRoom = async (roomId) => {
    try {
      return await originalDeleteRoom(roomId);
    } catch (error) {
      if (error?.status === 404) return true;
      alert(error.message, error.type || 'error', '오류');
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

  /* ─── Refs: DOM 참조 (입력창, 스크롤 하단, 메시지 목록, 이미지 입력) ─── */
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const lastRestoredRoomRef = useRef(null);
  const textareaRef = useRef(null);
  const imageInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const addImagesRef = useRef(null);

  /* ─── 메시지 전송 훅: useChatSender — 입력, 전송, 스트리밍 중단 ─── */
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

  /* ─── 이미지 업로드 로직: 파일 검증(타입/크기) → DataURL 변환 → 상태 추가 ─── */
  const addImagesFromFiles = async (files) => {
    if (!files || files.length === 0) return;
    const maxImages = maxImagesPerMessage;
    const currentCount = selectedImages.length;
    const availableSlots = Math.max(0, maxImages - currentCount);
    if (availableSlots <= 0) {
      alert(
        `이미지는 최대 ${maxImages}장까지 첨부할 수 있습니다.`,
        'warning',
        '업로드 제한'
      );
      return;
    }

    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const maxSizeBytes = 10 * 1024 * 1024;
    const validFiles = Array.from(files).filter(
      (f) => allowedTypes.has(f.type) && f.size <= maxSizeBytes
    );
    const filesToRead = validFiles.slice(0, availableSlots);

    try {
      const dataUrls = await Promise.all(filesToRead.map(readFileAsDataUrl));
      const nextImages = filesToRead.map((file, i) => ({
        id: generateImageId(),
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: dataUrls[i],
      }));
      setSelectedImages((prev) => [...prev, ...nextImages]);
    } catch (err) {
      logger.error('이미지 읽기 실패:', err);
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
  };
  addImagesRef.current = addImagesFromFiles;

  /* ─── 이펙트: JWT 토큰 검증 → 인증 실패 시 로그인 페이지로 리다이렉트 ─── */
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

  /* ─── 이펙트: 클라이언트 IP 감지 ─── */
  useEffect(() => {
    detectClientIP()
      .then(setClientIP)
      .catch((err) => logger.error('클라이언트 IP 감지 실패:', err));
  }, []);

  /* ─── 이펙트: 관리자 설정 로드 (이미지 제한, 프로필편집, 게시판 활성화) ─── */
  useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !isMounted) return;
        setMaxImagesPerMessage(data.maxImagesPerMessage || 5);
        setImageAnalysisModel(data.imageAnalysisModel || '');
        setImageAnalysisPrompt(
          data.imageAnalysisPrompt || '이 이미지를 설명해줘.'
        );
        setMaxUserQuestionLength(data.maxUserQuestionLength || 300000);
        setProfileEditEnabled(
          data.profileEditEnabled !== undefined
            ? data.profileEditEnabled
            : false
        );
        setBoardEnabled(
          data.boardEnabled !== undefined ? data.boardEnabled : true
        );
      })
      .catch((error) => logger.error('설정 로드 실패:', error.message));
    return () => {
      isMounted = false;
    };
  }, []);

  /* ─── 이펙트: 방 전환 시 이전에 선택했던 모델 복원 ─── */
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
  }, [
    currentRoom,
    modelOptions,
    modelsLoading,
    restoreRoomModel,
    selectedModel,
  ]);

  /* ─── 이펙트: 방 변경 시 이미지 선택 초기화 ─── */
  useEffect(() => {
    setSelectedImages([]);
    setImageHistoryByRoom({});
  }, [currentRoom]);

  /* ─── Effects: Auto-scroll (stream or already at bottom) ─── */
  // 스크롤 자동이동: 사용자가 하단에 있을 때만 새 메시지 수신 시 자동 스크롤
  // loading 제거 — 스트리밍 중 불필요한 스크롤 점프 방지
  useEffect(() => {
    if (isAtBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  /* ─── 이펙트: IntersectionObserver로 스크롤 하단 감지 (isAtBottom) ─── */
  useEffect(() => {
    const container = listRef.current;
    const target = bottomRef.current;
    if (!target) return;

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

  /* ─── 이펙트: 로딩 완료 후 입력창 자동 포커스 ─── */
  useEffect(() => {
    if (!currentRoom) return;
    if (loading || chatLoading || modelsLoading) return;
    inputRef.current?.focus();
  }, [loading, chatLoading, modelsLoading, currentRoom]);

  /* ─── 이펙트: 쪽지(DM) 읽지 않은 개수 60초 간격 폴링 ─── */
  const fetchUnreadDmCount = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch('/api/direct-messages/unread-count', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadDmCount(data.count || 0);
      }
    } catch (err) {
      console.error('읽지 않은 쪽지 개수 조회 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchUnreadDmCount();
    const interval = setInterval(fetchUnreadDmCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadDmCount]);

  /* ─── 이펙트: 전역 드래그앤드롭 & 클립보드 붙여넣기 이미지 처리 ─── */
  useEffect(() => {
    const isEditableTarget = (target) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName?.toLowerCase();
      return tag === 'textarea' || tag === 'input';
    };

    const handleWindowDragOver = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
    };
    const handleWindowDragEnter = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      setIsDragging(true);
    };
    const handleWindowDragLeave = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) setIsDragging(false);
    };
    const handleWindowDrop = async (e) => {
      if (!e.dataTransfer?.files?.length) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (files.length > 0 && addImagesRef.current)
        await addImagesRef.current(files);
    };
    const handleWindowPaste = async (e) => {
      if (isEditableTarget(e.target)) return;
      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter((i) => i.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      e.preventDefault();
      const files = imageItems.map((i) => i.getAsFile()).filter(Boolean);
      if (files.length > 0 && addImagesRef.current)
        await addImagesRef.current(files);
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
  }, []);

  /* ─── 핸들러: 로그아웃, 입력, 전송, 방 관리, 이미지, 스크롤 ─── */
  const handleLogout = async () => {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;
    clearSession();
    await TokenManager.logout();
  };

  const handleTextareaInput = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  };

  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter((i) => i.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map((i) => i.getAsFile()).filter(Boolean);
    await addImagesFromFiles(files);
  };

  const handleSend = () => {
    if ((input.trim() || selectedImages.length > 0) && !loading) {
      sendMessage(input);
    }
  };

  const handleSuggestionClick = (prompt) => {
    if (!loading && currentRoom) {
      sendMessage(prompt);
    }
  };

  const handleRoomSwitch = (roomId) => {
    switchRoom(roomId);
    setSidebarOpen(false);
  };

  const handleCreateRoom = async () => {
    if (loading || chatLoading) return;

    // Empty room reuse
    if (messages.length === 0 && currentRoom) {
      alert(
        '현재 채팅방에 대화 내용이 없습니다. 현재 채팅방을 계속 사용해주세요.',
        'info',
        '알림'
      );
      return;
    }

    // 20 room limit
    if (rooms.length >= 20) {
      if (
        window.confirm(
          '최대 20개의 대화방이 생성되어 있습니다. 가장 오래된 대화방을 삭제하시겠습니까?'
        )
      ) {
        const sorted = [...rooms].sort(
          (a, b) =>
            new Date(a.createdAt || a.updatedAt || 0) -
            new Date(b.createdAt || b.updatedAt || 0)
        );
        if (sorted[0]) {
          const ok = await deleteRoom(sorted[0]._id);
          if (ok) await createRoom('New Chat');
        }
      }
      return;
    }

    // Reuse empty recent room
    if (rooms.length > 0) {
      const recent = rooms[0];
      if (!recent.messageCount || recent.messageCount === 0) {
        if (currentRoom !== recent._id) switchRoom(recent._id);
        setSidebarOpen(false);
        return;
      }
    }

    await createRoom('New Chat');
  };

  const handleStartRename = (e, room) => {
    e.stopPropagation();
    setEditingRoomId(room._id);
    setEditingRoomName(room.name);
  };

  const handleFinishRename = async (roomId) => {
    if (editingRoomName.trim()) {
      await renameRoom(roomId, editingRoomName.trim());
    }
    setEditingRoomId(null);
    setEditingRoomName('');
  };

  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation();
    if (window.confirm('이 대화방을 삭제하시겠습니까?')) {
      await deleteRoom(roomId);
    }
  };

  const handleRemoveImage = (imageId) => {
    setSelectedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const scrollToTop = () => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    listRef.current?.scrollTo({
      top: listRef.current?.scrollHeight,
      behavior: 'smooth',
    });
    setIsAtBottom(true);
  };

  /* ─── 모델 헬퍼: 모델 라벨 표시명 / 서버 호스트명 추출 ─── */
  const getModelLabel = (modelKey) => {
    if (!modelKey) return null;
    if (modelKey.includes('__')) {
      const parts = modelKey.split('__');
      if (parts.length >= 2) return parts[1];
    }
    const exact = modelOptions.find(
      (m) => m.uniqueKey === modelKey || m.id === modelKey
    );
    if (exact?.label) return exact.label;
    const idMatch = modelOptions.find((m) => m.id === modelKey);
    if (idMatch?.label) return idMatch.label;
    if (modelKey.includes('-')) {
      const parts = modelKey.split('-');
      const possible = parts[parts.length - 1];
      const match = modelOptions.find((m) => m.id === possible);
      if (match?.label) return match.label;
    }
    if (modelKey.includes(':')) {
      const baseName = modelKey.split(':')[0];
      const match = modelOptions.find(
        (m) => m.id && (m.id.startsWith(baseName + ':') || m.id === baseName)
      );
      if (match?.label) return match.label;
    }
    return modelKey;
  };

  const getModelServerName = (modelKey) => {
    if (!modelKey) return null;
    const match = modelOptions.find(
      (m) => m.uniqueKey === modelKey || m.id === modelKey
    );
    if (match?.endpoint) {
      try {
        const hostname = new URL(match.endpoint).hostname;
        if (
          hostname &&
          hostname !== 'localhost' &&
          !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)
        ) {
          return hostname;
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  };

  /* ─── 현재 방의 이미지 이력: turnIndex별 이미지 매핑 ─── */
  const imageHistory = currentRoom
    ? imageHistoryByRoom[currentRoom] || []
    : [];
  const imagesByTurn = useMemo(() => {
    const map = new Map();
    imageHistory.forEach((entry) => {
      if (entry && Number.isFinite(entry.turnIndex)) {
        map.set(entry.turnIndex, entry.images || []);
      }
    });
    return map;
  }, [imageHistory]);

  /* ─── 필터링된 메시지: 방제목 생성 메시지 제외, 현재 방 메시지만 ─── */
  const filteredMessages = useMemo(() => {
    let msgs = messages.filter(
      (m) => !(m.text || '').includes('[방제목 생성')
    );
    if (currentRoom) msgs = msgs.filter((m) => m.roomId === currentRoom);
    return msgs;
  }, [messages, currentRoom]);

  /* ─── 선택된 모델 표시명 ─── */
  const selectedModelLabel =
    modelOptions.find((m) => m.id === selectedModel)?.label || '모델 선택';

  /* ─── 웰컴 화면 표시 조건: 메시지 없고 방이 선택된 경우 ─── */
  const showWelcome = filteredMessages.length === 0 && currentRoom;

  /* ─── 역할 뱃지: 관리자/매니저 표시 ─── */
  const getRoleBadge = () => {
    if (userRole === 'admin')
      return (
        <span className="ml-2 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
          관리자
        </span>
      );
    if (userRole === 'manager')
      return (
        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          매니저
        </span>
      );
    return null;
  };

  /* ─── 인증 가드: 인증 확인 전 렌더링 방지 ─── */
  if (!authChecked) return null;

  return (
    <div
      className={`relative flex h-screen flex-col overflow-hidden transition-colors duration-300 ${
        isDark
          ? 'bg-stone-900 text-stone-100'
          : 'bg-[#faf9f7] text-stone-800'
      }`}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      {/* ─── CSS 키프레임 애니메이션: 바운스, 페이드업, 인사, 카드진입, 펄스 ─── */}
      <style>{`
        @keyframes chat3bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes chat3fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chat3greeting {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes chat3cardIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chat3pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .chat3-msg-enter {
          animation: chat3fadeUp 0.35s ease-out both;
        }
        /* Warm MarkdownPreview overrides */
        .wmde-markdown {
          font-family: inherit !important;
          line-height: 1.7 !important;
        }
        .wmde-markdown code {
          border-radius: 6px !important;
        }
        /* Warm code block copy button */
        .warm-copy-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          background: rgba(255,255,255,0.9);
          color: #78716c;
          border: 1px solid rgba(214,211,209,0.5);
          cursor: pointer;
          transition: all 0.2s;
          opacity: 0;
          z-index: 2;
        }
        pre:hover .warm-copy-btn {
          opacity: 1;
        }
        .warm-copy-btn:hover {
          background: linear-gradient(135deg, #f59e0b, #f43f5e);
          color: #fff;
          border-color: transparent;
        }
        .dark .warm-copy-btn {
          background: rgba(41,37,36,0.9);
          color: #a8a29e;
          border-color: rgba(68,64,60,0.5);
        }
        .dark .warm-copy-btn:hover {
          background: linear-gradient(135deg, #f59e0b, #f43f5e);
          color: #fff;
          border-color: transparent;
        }
      `}</style>

      {/* ─── 전역 드래그 오버레이: 이미지 드래그 시 안내 UI 표시 ─── */}
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-amber-500/10" />
          <div className="relative rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
            이미지를 놓으면 업로드됩니다
          </div>
        </div>
      )}



      {/* ═══ 사이드바: 대화방 목록, 네비게이션 링크, 사용자 정보 ═══ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="relative z-50 flex w-72 flex-col border-r shadow-2xl"
            style={{
              background: isDark
                ? 'linear-gradient(180deg, #292524 0%, #1c1917 100%)'
                : 'linear-gradient(180deg, #fefdfb 0%, #faf8f5 100%)',
              borderColor: isDark ? '#44403c' : '#e7e5e4',
            }}
          >
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500">
                  <Sparkles size={16} className="text-white" />
                </div>
                <span className="text-base font-bold tracking-tight text-stone-800 dark:text-stone-100">
                  ModolAI
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200/60 hover:text-stone-600 dark:hover:bg-stone-700/60 dark:hover:text-stone-300"
              >
                <X size={18} />
              </button>
            </div>

            {/* New Chat Button */}
            <div className="px-4 pb-4">
              <button
                onClick={handleCreateRoom}
                disabled={loading || chatLoading}
                className="flex w-full items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-all duration-200 hover:shadow-md disabled:opacity-50"
                style={{
                  borderColor: isDark ? '#57534e' : '#d6d3d1',
                  background: isDark ? '#292524' : '#ffffff',
                  color: isDark ? '#d6d3d1' : '#44403c',
                }}
              >
                <Plus size={16} />새 대화
              </button>
            </div>

            {/* Room List */}
            <p className="mb-2 px-5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              대화 목록
            </p>
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
              {rooms.map((room) => (
                <li
                  key={room._id}
                  onClick={() => handleRoomSwitch(room._id)}
                  className={`group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                    currentRoom === room._id
                      ? isDark
                        ? 'bg-stone-700/50 text-stone-100'
                        : 'bg-stone-200/60 text-stone-800'
                      : isDark
                        ? 'text-stone-400 hover:bg-stone-700/40'
                        : 'text-stone-500 hover:bg-stone-200/50'
                  }`}
                >
                  <MessageCircle size={15} className="shrink-0 opacity-50" />
                  {editingRoomId === room._id ? (
                    <input
                      value={editingRoomName}
                      onChange={(e) => setEditingRoomName(e.target.value)}
                      onBlur={() => handleFinishRename(room._id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename(room._id);
                        if (e.key === 'Escape') {
                          setEditingRoomId(null);
                          setEditingRoomName('');
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      maxLength={15}
                      className="flex-1 truncate rounded bg-transparent px-1 text-sm outline-none ring-1 ring-amber-400/50"
                    />
                  ) : (
                    <span className="flex-1 truncate">{room.name}</span>
                  )}
                  {/* Actions (visible on hover) */}
                  {editingRoomId !== room._id && (
                    <div className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => handleStartRename(e, room)}
                        className="rounded p-1 text-stone-400 hover:text-amber-500"
                        title="이름 변경"
                      >
                        <Pencil size={12} />
                      </button>
                      {rooms.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room._id)}
                          className="rounded p-1 text-stone-400 hover:text-rose-500"
                          title="삭제"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* ─── 네비게이션 링크: 쪽지, 공지, 업데이트, 게시판, API키, 프로필, 관리자 ─── */}
            <div
              className="space-y-0.5 border-t px-3 py-3"
              style={{ borderColor: isDark ? '#44403c' : '#e7e5e4' }}
            >
              {/* 쪽지 (DM) */}
              <button
                onClick={() => setShowDmModal(true)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-700/40"
              >
                <Mail size={15} />
                받은 쪽지
                {unreadDmCount > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                    {unreadDmCount > 99 ? '99+' : unreadDmCount}
                  </span>
                )}
              </button>

              {/* 공지사항 */}
              <button
                onClick={() => router.push('/notice')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-700/40"
              >
                <Bell size={15} />
                공지사항
              </button>

              {/* 업데이트 노트 */}
              <button
                onClick={() => setPatchNotesOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-700/40"
              >
                <Rocket size={15} />
                업데이트 노트
              </button>

              {/* 자유게시판 */}
              {boardEnabled && (
                <button
                  onClick={() => router.push('/board')}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-700/40"
                >
                  <MessageSquare size={15} />
                  자유게시판
                </button>
              )}

              {/* 내 API 키 */}
              <button
                onClick={() => router.push('/my-api-keys')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-700/40"
              >
                <Key size={15} />내 API 키
              </button>

              {/* 프로필 수정 */}
              {profileEditEnabled && (
                <button
                  onClick={() => router.push('/profile')}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-400 dark:hover:bg-stone-700/40"
                >
                  <User size={15} />
                  프로필 수정
                </button>
              )}

              {/* 관리자 */}
              {(userRole === 'admin' || userRole === 'manager') && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-100/50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                >
                  <Shield size={15} />
                  관리자 페이지
                </button>
              )}
            </div>

            {/* Sidebar Footer */}
            <div
              className="border-t px-4 py-3"
              style={{ borderColor: isDark ? '#44403c' : '#e7e5e4' }}
            >
              <div className="mb-2 flex items-center px-1">
                <span className="truncate text-xs text-stone-400 dark:text-stone-500">
                  {userEmail}
                </span>
                {getRoleBadge()}
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-stone-500 transition-colors hover:bg-rose-100/60 hover:text-rose-600 dark:text-stone-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
              >
                <LogOut size={15} />
                로그아웃
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ═══ 헤더: 메뉴버튼, 로고, 방이름, 다크모드토글, 프로필 ═══ */}
      <header
        className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur-md"
        style={{
          borderColor: isDark
            ? 'rgba(120,113,108,0.2)'
            : 'rgba(214,211,209,0.6)',
          background: isDark
            ? 'rgba(28,25,23,0.85)'
            : 'rgba(250,249,247,0.85)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-xl p-2 text-stone-500 transition-colors hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-700/40 dark:hover:text-stone-200"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500 shadow-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-stone-700 dark:text-stone-200">
              ModolAI
            </span>
          </div>
        </div>

        {/* Current room name (center) */}
        {currentRoom && !showWelcome && (
          <span
            className="absolute left-1/2 hidden -translate-x-1/2 text-sm font-medium text-stone-500 dark:text-stone-400 md:block"
            style={{ animation: 'chat3fadeUp 0.3s ease-out both' }}
          >
            {rooms.find((r) => r._id === currentRoom)?.name || ''}
          </span>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition-all duration-300 hover:bg-stone-200/50 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-700/40 dark:hover:text-stone-200"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <div className="relative h-8 w-8 cursor-pointer rounded-full bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500 p-[2px] shadow-sm transition-transform duration-200 hover:scale-105">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
              <User
                size={15}
                className="text-stone-500 dark:text-stone-400"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ═══ 에이전트 선택기: AI 에이전트 모드 전환 ═══ */}
      <AgentSelector />

      {/* ═══ 메인 콘텐츠: 웰컴 화면 또는 메시지 목록 ═══ */}
      <main ref={listRef} className="relative flex-1 overflow-y-auto">
        {showWelcome ? (
          /* ─── 웰컴 화면: 인사말, 제안 카드, 최근 대화 목록 ─── */
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-12">
            <div
              className="mb-8 text-center"
              style={{ animation: 'chat3greeting 0.6s ease-out both' }}
            >
              <h1
                className="mb-2 text-4xl font-bold tracking-tight sm:text-5xl"
                style={{
                  background:
                    'linear-gradient(135deg, #f59e0b, #f43f5e, #8b5cf6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                안녕하세요! 👋
              </h1>
              <p className="text-lg text-stone-500 dark:text-stone-400">
                무엇을 도와드릴까요?
              </p>
              {userEmail && (
                <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
                  {userEmail.split('@')[0]}님, ModolAI가 함께할게요
                </p>
              )}
            </div>

            {/* Suggestion Cards */}
            <div
              className="mb-10 grid w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto grid-cols-1 gap-3 sm:grid-cols-2"
              style={{ animation: 'chat3cardIn 0.6s ease-out 0.15s both' }}
            >
              {SUGGESTION_CARDS.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(card.prompt)}
                    disabled={loading || !currentRoom}
                    className="group relative flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                    style={{
                      animationDelay: `${0.1 + idx * 0.08}s`,
                      background: isDark
                        ? 'rgba(41,37,36,0.7)'
                        : 'rgba(255,255,255,0.8)',
                      borderColor: isDark
                        ? 'rgba(68,64,60,0.5)'
                        : 'rgba(214,211,209,0.5)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${card.gradient} ${card.darkGradient} shadow-sm transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold leading-tight text-stone-700 dark:text-stone-200">
                        {card.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-stone-400 dark:text-stone-500">
                        {card.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Recent Rooms */}
            {rooms.length > 1 && (
              <div
                className="w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto"
                style={{ animation: 'chat3cardIn 0.6s ease-out 0.35s both' }}
              >
                <p className="mb-3 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  <MessageCircle size={12} />
                  최근 대화
                </p>
                <div className="flex flex-col gap-1">
                  {rooms
                    .filter((r) => r._id !== currentRoom)
                    .slice(0, 5)
                    .map((room) => (
                      <button
                        key={room._id}
                        onClick={() => handleRoomSwitch(room._id)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 hover:bg-stone-200/40 dark:hover:bg-stone-800/40"
                      >
                        <MessageCircle
                          size={15}
                          className="shrink-0 text-stone-400 dark:text-stone-500"
                        />
                        <span className="truncate text-sm text-stone-600 dark:text-stone-300">
                          {room.name}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ─── 메시지 목록: 사용자/AI 말풍선, 이미지 첨부, 피드백 ─── */
          <div className="mx-auto flex w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl flex-col gap-5 px-4 py-6">
            {(() => {
              let userTurnCounter = 0;
              return filteredMessages.map((msg, idx) => {
                let userTurnIndex = null;
                if (msg.role === 'user') {
                  userTurnCounter += 1;
                  userTurnIndex = userTurnCounter;
                }
                const userImages =
                  msg.role === 'user' && userTurnIndex
                    ? imagesByTurn.get(userTurnIndex) || []
                    : [];

                return (
                  <div
                    key={msg._id || `msg-${idx}`}
                    className={`chat3-msg-enter flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                    style={{
                      animationDelay: `${Math.min(idx, 5) * 0.05}s`,
                    }}
                  >
                    {/* AI Avatar */}
                    {msg.role === 'assistant' && (
                      <div className="mr-2.5 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500 shadow-sm">
                        <Sparkles size={14} className="text-white" />
                      </div>
                    )}

                    <div
                      className={`relative group max-w-[95%] md:max-w-[90%] lg:max-w-[85%] xl:max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-br from-stone-200/80 to-stone-200/50 text-stone-800 dark:from-stone-700/60 dark:to-stone-700/40 dark:text-stone-100'
                          : `border bg-white/80 text-stone-700 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] backdrop-blur-sm dark:border-stone-700/50 dark:bg-stone-800/60 dark:text-stone-200 dark:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.3)] ${
                              !msg.isTyping ? 'pr-10' : ''
                            }`
                      }`}
                    >
                      {/* Message number */}
                      <div
                        className={`absolute -top-5 text-[11px] font-medium ${
                          msg.role === 'user'
                            ? 'right-0 text-amber-500/70 dark:text-amber-400/70'
                            : 'left-0 text-stone-400 dark:text-stone-500'
                        }`}
                      >
                        #{idx + 1}
                      </div>

                      {/* Model + server name on AI messages */}
                      {msg.role === 'assistant' && msg.model && (
                        <div className="absolute -top-5 left-8 text-[11px] text-stone-400 dark:text-stone-500">
                          {getModelLabel(msg.model)}
                          {getModelServerName(msg.model) && (
                            <span className="ml-1.5 text-stone-300 dark:text-stone-600">
                              [{getModelServerName(msg.model)}]
                            </span>
                          )}
                        </div>
                      )}

                      {/* Copy button on AI messages */}
                      {msg.role === 'assistant' && !msg.isTyping && (
                        <WarmCopyButton text={msg.text} />
                      )}

                      {/* Message content */}
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      ) : msg.isTyping && !msg.text ? (
                        <BouncingDots />
                      ) : (
                        <WarmSafeMarkdown source={msg.text || ''} />
                      )}

                      {/* User image thumbnails */}
                      {msg.role === 'user' && userImages.length > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-[11px] text-stone-500 dark:text-stone-400">
                            첨부 이미지 {userImages.length}개
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {userImages.map((image, imgIdx) => {
                              const src =
                                image?.dataUrl || image?.url || image;
                              if (!src) return null;
                              const label =
                                image?.name || `이미지 ${imgIdx + 1}`;
                              const sizeLabel = formatSize(image?.size);
                              return (
                                <button
                                  type="button"
                                  key={`${label}-${imgIdx}`}
                                  onClick={() =>
                                    setPreviewImage({
                                      src,
                                      name: label,
                                      size: sizeLabel,
                                    })
                                  }
                                  className="text-left"
                                  title={label}
                                >
                                  <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800 sm:h-14 sm:w-14">
                                    <img
                                      src={src}
                                      alt={label}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="mt-0.5 truncate text-[10px] text-stone-400">
                                    {label}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Feedback on AI messages */}
                      {msg.role === 'assistant' && !msg.isTyping && (
                        <WarmFeedbackButton
                          messageId={msg._id || null}
                          initialFeedback={msg.feedback}
                        />
                      )}
                    </div>
                  </div>
                );
              });
            })()}

            {/* Typing indicator when loading and last msg is not already typing */}
            {loading &&
              filteredMessages.length > 0 &&
              !filteredMessages[filteredMessages.length - 1]?.isTyping && (
                <div
                  className="flex items-start gap-2.5"
                  style={{ animation: 'chat3fadeUp 0.3s ease-out both' }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500 shadow-sm">
                    <Sparkles
                      size={14}
                      className="text-white"
                      style={{
                        animation: 'chat3pulse 1.5s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <div className="rounded-2xl border bg-white/80 px-4 py-3 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] backdrop-blur-sm dark:border-stone-700/50 dark:bg-stone-800/60 dark:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.3)]">
                    <BouncingDots />
                  </div>
                </div>
              )}

            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* ═══ 스크롤 버튼: 맨위/맨아래 이동 ═══ */}
      {filteredMessages.length > 0 && (
        <div className="absolute right-4 bottom-44 z-20 flex flex-col gap-2">
          <button
            onClick={scrollToTop}
            className="flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-all duration-200 hover:scale-110"
            style={{
              background: isDark
                ? 'rgba(41,37,36,0.9)'
                : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? '#57534e' : '#d6d3d1',
            }}
            title="맨 위로"
          >
            <ChevronUp
              size={16}
              className="text-stone-500 dark:text-stone-400"
            />
          </button>
          <button
            onClick={scrollToBottom}
            className="flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-all duration-200 hover:scale-110"
            style={{
              background: isDark
                ? 'rgba(41,37,36,0.9)'
                : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? '#57534e' : '#d6d3d1',
            }}
            title="맨 아래로"
          >
            <ChevronDown
              size={16}
              className="text-stone-500 dark:text-stone-400"
            />
          </button>
        </div>
      )}

      {/* "새 메시지" 스크롤 인디케이터: 스크롤 올렸을 때 하단 이동 버튼 */}
      {!isAtBottom && filteredMessages.length > 0 && (
        <div className="absolute bottom-36 left-1/2 z-20 -translate-x-1/2">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium shadow-lg transition-all duration-200 hover:shadow-xl"
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(244,63,94,0.2))'
                : 'rgba(255,255,255,0.95)',
              borderColor: isDark
                ? 'rgba(245,158,11,0.4)'
                : 'rgba(214,211,209,0.6)',
              color: isDark ? '#fbbf24' : '#92400e',
            }}
          >
            <ChevronDown size={14} />새 메시지
          </button>
        </div>
      )}

      {/* ═══ 입력 영역: 중단버튼, 이미지 미리보기, 텍스트입력, 모델선택, 전송 ═══ */}
      <footer className="shrink-0 px-4 pb-4 pt-2">
        <div className="mx-auto w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl">
          {/* Stop Button */}
          {loading && (
            <div className="mb-2 flex justify-center">
              <button
                onClick={stopStreaming}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200 hover:shadow-sm"
                style={{
                  borderColor: isDark
                    ? 'rgba(239,68,68,0.4)'
                    : 'rgba(239,68,68,0.3)',
                  background: isDark
                    ? 'rgba(127,29,29,0.3)'
                    : 'rgba(254,226,226,0.8)',
                  color: isDark ? '#fca5a5' : '#dc2626',
                }}
              >
                <Square size={10} fill="currentColor" />
                중단
              </button>
            </div>
          )}

          {/* Image thumbnails */}
          {selectedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {selectedImages.map((image) => (
                <div
                  key={image.id}
                  className="relative h-16 w-16 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-800"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-black/80"
                    title="이미지 제거"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div
            className="flex items-end gap-2 rounded-2xl border p-2 transition-all duration-300 focus-within:shadow-lg"
            style={{
              borderColor: isDark
                ? 'rgba(68,64,60,0.5)'
                : 'rgba(214,211,209,0.6)',
              background: isDark
                ? 'rgba(41,37,36,0.6)'
                : 'rgba(255,255,255,0.9)',
              boxShadow: isDark
                ? '0 2px 20px -4px rgba(0,0,0,0.3)'
                : '0 2px 20px -4px rgba(0,0,0,0.06)',
              backdropFilter: 'blur(12px)',
            }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragging(false);
              dragCounterRef.current = 0;
              const files = Array.from(e.dataTransfer?.files || []).filter(
                (f) => f.type.startsWith('image/')
              );
              if (files.length > 0) await addImagesFromFiles(files);
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            {/* Image upload button */}
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-stone-400 transition-colors hover:bg-stone-200/50 hover:text-amber-500 dark:hover:bg-stone-700/50"
              title={`이미지 업로드 (${selectedImages.length}/${maxImagesPerMessage})`}
            >
              <LucideImage size={18} />
            </button>

            <input
              ref={imageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) await addImagesFromFiles(files);
              }}
            />

            <textarea
              ref={(el) => {
                textareaRef.current = el;
                inputRef.current = el;
              }}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              placeholder={
                modelsLoading
                  ? '모델 로딩 중...'
                  : !currentRoom
                    ? '대화를 시작하려면 방을 선택하세요...'
                    : '궁금한 것을 물어보세요... (Enter 전송, Shift+Enter 줄바꿈)'
              }
              disabled={loading || !currentRoom || modelsLoading}
              className="max-h-[160px] min-h-[36px] flex-1 resize-none bg-transparent py-2 pl-2 text-[15px] leading-snug text-stone-700 outline-none placeholder:text-stone-400 disabled:opacity-50 dark:text-stone-200 dark:placeholder:text-stone-500"
              style={{ scrollbarWidth: 'none' }}
            />

            {modelConfig && modelOptions.length > 0 && (
              <div className="mb-0.5 shrink-0">
                <ModelSelector
                  selectedModel={selectedModel}
                  setSelectedModel={(modelId) =>
                    setSelectedModelWithRoom(modelId, currentRoom)
                  }
                  modelConfig={modelConfig}
                  disabled={loading || !currentRoom || modelsLoading}
                  userDefaultModelId={userDefaultModelId}
                  onSetUserDefault={saveUserDefaultModel}
                />
              </div>
            )}

            <button
              onClick={handleSend}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-md active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              disabled={
                (!input.trim() && selectedImages.length === 0) ||
                loading ||
                !currentRoom ||
                modelsLoading
              }
              style={{
                background:
                  (input.trim() || selectedImages.length > 0) && !loading
                    ? 'linear-gradient(135deg, #f59e0b, #f43f5e)'
                    : isDark
                      ? '#44403c'
                      : '#d6d3d1',
              }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <ArrowUp
                  size={18}
                  className="text-white"
                  strokeWidth={2.5}
                />
              )}
            </button>
          </div>

          <p className="mt-2 text-center text-[11px] text-stone-400 dark:text-stone-500">
            ModolAI는 실수를 할 수 있습니다. 중요한 정보는 반드시 확인하세요.
          </p>
        </div>
      </footer>

      {/* ═══ 이미지 미리보기 모달: 첨부 이미지 전체화면 확대 ═══ */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -right-4 -top-4 rounded-full bg-white dark:bg-stone-700 px-3 py-1 text-sm font-medium text-stone-800 dark:text-stone-100 shadow-lg hover:bg-stone-100 dark:hover:bg-stone-600 transition-colors"
              onClick={() => setPreviewImage(null)}
            >
              닫기
            </button>
            <div className="overflow-hidden rounded-2xl bg-stone-900">
              <img
                src={previewImage.src}
                alt={previewImage.name || '첨부 이미지'}
                className="max-h-[80vh] w-full object-contain"
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-stone-200">
              <span>{previewImage.name}</span>
              {previewImage.size && (
                <span className="text-stone-400">({previewImage.size})</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 모달 & 팝업: 쪽지, 업데이트노트, 공지사항 ═══ */}
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
    </div>
  );
}
