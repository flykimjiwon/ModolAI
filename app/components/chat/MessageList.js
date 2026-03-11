'use client';

import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { MessageCircle, Check, Copy, ThumbsUp, ThumbsDown } from '@/components/icons';
import MarkdownPreview from '@uiw/react-markdown-preview';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import TypingAnimation from '../TypingAnimation';
import { logger } from '@/lib/logger';

const CopyButton = memo(function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // HTTPS가 아닌 환경에서는 fallback 방식 사용
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: 임시 텍스트 영역 생성하여 복사
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
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
      className='absolute top-2 right-2 p-1.5 text-muted-foreground hover:text-foreground bg-background/80 rounded-md shadow-sm hover:shadow-md transition-all opacity-70 group-hover:opacity-100 z-[1]'
      title={copied ? '복사됨!' : '답변 전체 복사'}
    >
      {copied ? (
        <Check className='h-4 w-4 text-green-500' />
      ) : (
        <Copy className='h-4 w-4' />
      )}
    </button>
  );
});

const FeedbackButton = memo(function FeedbackButton({
  messageId,
  initialFeedback,
  onFeedbackChange,
}) {
  const [feedback, setFeedback] = useState(initialFeedback || null);
  const [loading, setLoading] = useState(false);

  // initialFeedback prop이 변경될 때 state 업데이트
  useEffect(() => {
    setFeedback(initialFeedback || null);
  }, [initialFeedback]);

  const handleFeedback = async (type) => {
    if (loading || !messageId) {
      if (!messageId) {
        console.warn('메시지 ID가 없어 피드백을 저장할 수 없습니다.');
      }
      return;
    }

    // 임시 ID인 경우 (메시지 저장 실패)
    if (messageId.startsWith('temp-')) {
      console.warn('⚠️ 메시지가 서버에 저장되지 않아 피드백을 제공할 수 없습니다.');
      alert('이 메시지는 서버에 저장되지 않아 피드백을 제공할 수 없습니다.\n페이지를 새로고침하거나 다시 시도해주세요.');
      return;
    }

    const newFeedback = feedback === type ? null : type; // 토글 기능
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webapp-chat/feedback/${messageId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedback: newFeedback }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status} 오류`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setFeedback(result.feedback);
      if (onFeedbackChange) {
        onFeedbackChange(result.feedback);
      }
    } catch (err) {
      logger.error('피드백 저장 실패:', err);
      // 사용자에게 오류 알림 (선택적 - 너무 많은 알림을 피하기 위해)
      // console.error만으로 처리하거나, 필요시 토스트 알림 추가 가능
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex items-center gap-1 mt-2 opacity-70 group-hover:opacity-100 transition-opacity'>
      <button
        onClick={() => handleFeedback('like')}
        disabled={loading || !messageId}
        className={`p-1.5 rounded-md transition-colors ${
          !messageId
            ? 'text-muted-foreground/30 cursor-not-allowed'
            : feedback === 'like'
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-primary hover:bg-accent'
        }`}
        title={!messageId ? '메시지 저장 중...' : '좋아요'}
      >
        <ThumbsUp className='h-4 w-4' />
      </button>
      <button
        onClick={() => handleFeedback('dislike')}
        disabled={loading || !messageId}
        className={`p-1.5 rounded-md transition-colors ${
          !messageId
            ? 'text-muted-foreground/30 cursor-not-allowed'
            : feedback === 'dislike'
            ? 'text-destructive bg-destructive/10'
            : 'text-muted-foreground hover:text-destructive hover:bg-accent'
        }`}
        title={!messageId ? '메시지 저장 중...' : '싫어요'}
      >
        <ThumbsDown className='h-4 w-4' />
      </button>
    </div>
  );
});

// SVG 인라인 렌더링 허용 스키마 (XSS 안전)
// - script/foreignObject/on이벤트/외부URL 차단
// - use href는 내부 참조(#)만 허용
const svgSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    // SVG 구조 요소
    'svg', 'g', 'defs', 'symbol',
    // 도형
    'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect',
    // 텍스트
    'text', 'tspan',
    // 그라디언트
    'linearGradient', 'radialGradient', 'stop',
    // 마스크/클립/마커
    'clipPath', 'mask', 'marker',
    // 필터
    'filter', 'feGaussianBlur', 'feOffset', 'feBlend',
    'feFlood', 'feComposite', 'feMerge', 'feMergeNode', 'feColorMatrix',
    // 설명
    'title', 'desc',
    // 내부 참조 (href는 #으로 시작하는 것만 허용)
    'use',
  ],
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] || []),
      // 좌표 (여러 SVG 요소에서 공통 사용)
      'x', 'y',
      // 채우기/선
      'fill', 'fillOpacity', 'fillRule',
      'stroke', 'strokeWidth', 'strokeDasharray', 'strokeDashoffset',
      'strokeLinecap', 'strokeLinejoin', 'strokeOpacity',
      // 공통 프레젠테이션
      'opacity', 'transform', 'style',
      'display', 'visibility', 'overflow',
      // 텍스트
      'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
      'textAnchor', 'dominantBaseline',
      // 참조
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

const SafeMarkdown = memo(function SafeMarkdown({ source }) {
  const plugins = useMemo(() => [[rehypeSanitize, svgSchema]], []);
  const markdownRef = useRef(null);
  const [colorMode, setColorMode] = useState('light');

  // 다크모드 상태 감지
  useEffect(() => {
    const updateColorMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setColorMode(isDark ? 'dark' : 'light');
    };

    // 초기 설정
    updateColorMode();

    // MutationObserver로 html 클래스 변경 감지
    const observer = new MutationObserver(updateColorMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // 마크다운이 렌더링될 때마다 복사 버튼 추가 (최적화됨)
  useEffect(() => {
    const addCopyButtons = () => {
      if (!markdownRef.current) return;

      const codeBlocks = markdownRef.current.querySelectorAll('pre code');

      codeBlocks.forEach((codeBlock) => {
        const pre = codeBlock.parentElement;
        if (pre && !pre.querySelector('.copy-button')) {
          const button = document.createElement('button');
          button.className = 'copy-button';
          button.textContent = '복사';
          button.onclick = async () => {
            try {
              // HTTPS가 아닌 환경에서는 fallback 방식 사용
              if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(codeBlock.textContent);
              } else {
                // Fallback: 임시 텍스트 영역 생성하여 복사
                const textArea = document.createElement('textarea');
                textArea.value = codeBlock.textContent;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
              }
              button.textContent = '복사됨!';
              setTimeout(() => {
                button.textContent = '복사';
              }, 2000);
            } catch (err) {
              logger.error('복사 실패:', err);
              button.textContent = '실패';
              setTimeout(() => {
                button.textContent = '복사';
              }, 2000);
            }
          };
          pre.style.position = 'relative';
          pre.appendChild(button);
        }
      });
    };

    // 응답이 완전히 끝난 후에만 복사 버튼 추가 (타이핑 중이 아닐 때만)
    if (source && !source.includes('isTyping')) {
      const timer = setTimeout(addCopyButtons, 200);
      return () => clearTimeout(timer);
    }
  }, [source]);

  return (
    <div className='markdown-content w-full' ref={markdownRef}>
      <MarkdownPreview
        source={source}
        style={{
          padding: 0,
          backgroundColor: 'transparent',
          width: '100%',
          minHeight: 'auto',
        }}
        rehypePlugins={plugins}
        data-color-mode={colorMode}
        wrapperElement={{
          'data-color-mode': colorMode,
          style: { width: '100%', contain: 'layout' },
        }}
      />
    </div>
  );
});

function MessageList({
  messages,
  bottomRef,
  modelOptions = [],
  currentRoom = null,
  imageHistoryByRoom = {},
  listRef,
}) {
  // 방제목 생성 관련 디버그 메시지 필터링
  const filteredMessages = messages.filter((msg) => {
    const text = msg.text || '';
    return !text.includes('[방제목 생성');
  });
  const displayMessages = currentRoom
    ? filteredMessages.filter((msg) => msg.roomId === currentRoom)
    : filteredMessages;
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
  const [previewImage, setPreviewImage] = useState(null);
  const localListRef = useRef(null);
  const resolvedListRef = listRef || localListRef;

  const formatSize = (size) => {
    if (!Number.isFinite(size)) return '';
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(2)}MB`;
  };


  // 모델 ID/uniqueKey를 표시명으로 변환하는 함수
  const getModelLabel = (modelKey) => {
    if (!modelKey) return null;

    // 0. uniqueKey 형식인지 확인 (id__label 형식)
    // uniqueKey 형식이면 라벨 부분만 추출하여 반환
    if (modelKey.includes('__')) {
      const parts = modelKey.split('__');
      if (parts.length >= 2) {
        return parts[1]; // label 부분 반환
      }
    }

    // 1. uniqueKey 또는 id로 직접 찾기
    const exactMatch = modelOptions.find(
      (m) => m.uniqueKey === modelKey || m.id === modelKey
    );
    if (exactMatch && exactMatch.label) {
      return exactMatch.label;
    }

    // 2. 정확한 ID로만 찾기 (역호환성)
    const idMatch = modelOptions.find((m) => m.id === modelKey);
    if (idMatch && idMatch.label) {
      return idMatch.label;
    }

    // 3. 모델 ID에서 서버 이름 제거 후 찾기 (예: "spark-ollama-gemma3:27b" -> "gemma3:27b")
    if (modelKey.includes('-')) {
      const parts = modelKey.split('-');
      // 마지막 부분이 모델 이름일 가능성이 높음
      const possibleModelId = parts[parts.length - 1];
      const serverRemovedMatch = modelOptions.find(
        (m) => m.id === possibleModelId
      );
      if (serverRemovedMatch && serverRemovedMatch.label) {
        return serverRemovedMatch.label;
      }
    }

    // 4. 콜론(:) 기준으로 기본 이름 찾기 (예: "gpt-oss:20b" -> "gpt-oss"로 시작하는 모델)
    if (modelKey.includes(':')) {
      const baseName = modelKey.split(':')[0];
      const baseMatch = modelOptions.find((m) => {
        if (!m.id) return false;
        return m.id.startsWith(baseName + ':') || m.id === baseName;
      });
      if (baseMatch && baseMatch.label) {
        return baseMatch.label;
      }
    }

    // 5. 부분 일치로 찾기 (모델 ID가 다른 모델 ID에 포함되는 경우)
    const partialMatch = modelOptions.find((m) => {
      if (!m.id) return false;
      // 모델 ID가 다른 모델 ID의 끝부분과 일치하는 경우 (예: "gemma3:27b"에서 "27b" 찾기)
      return m.id.endsWith(modelKey) || modelKey.endsWith(m.id);
    });
    if (partialMatch && partialMatch.label) {
      return partialMatch.label;
    }

    // 6. 찾지 못하면 원본 키 반환
    return modelKey;
  };

  // 모델 서버명을 추출하는 함수 (endpoint 기반)
  const getModelServerName = (modelKey) => {
    if (!modelKey) return null;

    // modelOptions에서 찾아서 endpoint 확인
    const exactMatch = modelOptions.find(
      (m) => m.uniqueKey === modelKey || m.id === modelKey
    );

    if (exactMatch && exactMatch.endpoint) {
      // endpoint에서 호스트명 추출
      // 예: "http://gpt-server:11434" -> "gpt-server"
      // 예: "http://spark-ollama:11434" -> "spark-ollama"
      try {
        const url = new URL(exactMatch.endpoint);
        const hostname = url.hostname;
        // 호스트명이 localhost나 IP가 아니면 서버명으로 사용
        if (hostname && hostname !== 'localhost' && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          return hostname;
        }
      } catch (e) {
        logger.warn('모델 서버 URL 파싱 실패:', e.message);
      }
      return null;
    }

    return null;
  };

  return (
    <main
      id='message-list'
      data-testid='message-list'
      ref={resolvedListRef}
      className="flex-1 min-h-0 w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 pt-6 pb-40 space-y-4 overflow-y-scroll chat-scrollbar"
    >
      {displayMessages.length === 0 ? (
        <div
          id='message-list-empty'
          data-testid='message-list-empty'
          className='flex flex-col items-center justify-center h-64 text-center'
        >
          <MessageCircle className='h-16 w-16 text-muted-foreground/40 mb-4' />
          <h3 className='text-lg font-medium text-muted-foreground mb-2'>
            새로운 대화를 시작하세요
          </h3>
          <p className='text-sm text-muted-foreground'>
            아래 입력창에 질문을 입력하면 AI가 답변해드립니다.
            <br />
            전체 화면에 이미지 드래그 또는 클립보드 붙여넣기도 가능합니다.
          </p>
        </div>
      ) : (
        (() => {
          let userTurnCounter = 0;
          return displayMessages.map((msg, idx) => {
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
            key={idx}
            id={`message-${idx}`}
            data-testid={`message-${idx}`}
            data-message-role={msg.role}
            className={`flex w-full ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            } mb-4`}
          >
            <div
              className={`relative group max-w-[95%] md:max-w-[90%] lg:max-w-[85%] xl:max-w-[80%] ${
                msg.role === 'user'
                  ? 'chat-message-user'
                  : `chat-message-assistant ${
                      msg.isTyping ? '' : 'pr-12'
                    }`
              }`}
            >
              {/* 메시지 순서 번호 */}
              <div
                className={`absolute -top-5 text-xs font-medium ${
                  msg.role === 'user'
                    ? 'right-0 text-foreground'
                    : 'left-0 text-muted-foreground'
                }`}
              >
                #{idx + 1}
              </div>
              {/* AI 답변에 모델 정보 표시 */}
              {msg.role === 'assistant' && msg.model && (
                <div className='absolute -top-5 left-8 text-xs text-muted-foreground font-normal'>
                  {getModelLabel(msg.model)}
                  {getModelServerName(msg.model) && (
                    <span className='ml-2 text-muted-foreground/60'>
                      [{getModelServerName(msg.model)}]
                    </span>
                  )}
                </div>
              )}
              {/* AI 답변에만 복사 버튼 추가 */}
              {msg.role === 'assistant' && !msg.isTyping && (
                <CopyButton text={msg.text} />
              )}
              {msg.role === 'assistant' && msg.isTyping && msg.text === '' ? (
                <TypingAnimation />
              ) : (
                <SafeMarkdown source={msg.text} />
              )}
              {msg.role === 'user' && userImages.length > 0 && (
                <div className='mt-3'>
                  <div className='text-[11px] text-muted-foreground mb-2'>
                    첨부 이미지 {userImages.length}개
                  </div>
                  <div className='grid grid-cols-5 gap-1.5'>
                    {userImages.map((image, imageIdx) => {
                      const src = image?.dataUrl || image?.url || image;
                      if (!src) return null;
                      const label = image?.name || `이미지 ${imageIdx + 1}`;
                      const sizeLabel = formatSize(image?.size);
                      return (
                        <button
                          type='button'
                          key={`${label}-${imageIdx}`}
                          onClick={() =>
                            setPreviewImage({
                              src,
                              name: label,
                              size: sizeLabel,
                            })
                          }
                          className='group text-left'
                          title={label}
                        >
                          <div className='relative w-12 h-12 sm:w-14 sm:h-14 rounded-md overflow-hidden border border-border bg-muted'>
                            <img
                              src={src}
                              alt={label}
                              className='w-full h-full object-cover'
                            />
                          </div>
                          <div className='mt-1 text-[10px] text-muted-foreground truncate'>
                            {label}
                          </div>
                          {sizeLabel && (
                            <div className='text-[10px] text-muted-foreground/70'>
                              {sizeLabel}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* AI 답변에만 피드백 버튼 추가 */}
              {msg.role === 'assistant' && !msg.isTyping && (
                <FeedbackButton
                  messageId={msg._id || null}
                  initialFeedback={msg.feedback}
                />
              )}
            </div>
          </div>
          );
        });
        })()
      )}
      <div ref={bottomRef} />
      {previewImage && (
        <div
          className='fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6'
          onClick={() => setPreviewImage(null)}
          role='dialog'
          aria-modal='true'
        >
          <div
            className='relative max-w-5xl w-full'
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type='button'
              className='absolute -top-4 -right-4 bg-background text-foreground rounded-full shadow px-3 py-1 text-sm'
              onClick={() => setPreviewImage(null)}
            >
              닫기
            </button>
            <div className='bg-black rounded-lg overflow-hidden'>
              <img
                src={previewImage.src}
                alt={previewImage.name || '첨부 이미지'}
                className='w-full max-h-[80vh] object-contain'
              />
            </div>
            <div className='mt-3 text-sm text-white/80 flex items-center gap-2'>
              <span>{previewImage.name}</span>
              {previewImage.size && (
                <span className='text-white/50'>({previewImage.size})</span>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default MessageList;
