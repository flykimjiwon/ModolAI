'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Download,
  Pencil,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  Plus,
  Trash2,
  Copy,
  GripVertical,
  CheckCircle2,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SLIDE_BREAK = '<!-- SLIDE_BREAK -->';
const SLIDE_BREAK_PATTERN = /<!--\s*SLIDE_BREAK\s*-->/gi;

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE PRESETS & STYLE TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_PRESETS = [
  {
    id: 'light-casual-breeze',
    theme: 'light',
    tone: 'casual',
    label: '라이트 + 캐주얼 Breeze',
    caption: '가볍고 유연한 카드형',
    description: '아이디어 제안, 워크숍, 내부 브리핑에 적합',
  },
  {
    id: 'light-casual-coral',
    theme: 'light',
    tone: 'casual',
    label: '라이트 + 캐주얼 Coral',
    caption: '명도 높은 포인트형',
    description: '교육, 온보딩, 캠페인 소개에 적합',
  },
  {
    id: 'light-business-classic',
    theme: 'light',
    tone: 'business',
    label: '라이트 + 비즈니스 Classic',
    caption: '정돈된 보고서형',
    description: '경영 보고, 전략 제안서, 대외 PT에 적합',
  },
  {
    id: 'light-business-mint',
    theme: 'light',
    tone: 'business',
    label: '라이트 + 비즈니스 Mint',
    caption: '청량한 데이터 브리프형',
    description: '성과 공유, 운영 회의, 주간 리포트에 적합',
  },
  {
    id: 'dark-casual-neon',
    theme: 'dark',
    tone: 'casual',
    label: '다크 + 캐주얼 Neon',
    caption: '강한 대비의 크리에이티브형',
    description: '기술 소개, 데모데이, 실험적 컨셉에 적합',
  },
  {
    id: 'dark-casual-aurora',
    theme: 'dark',
    tone: 'casual',
    label: '다크 + 캐주얼 Aurora',
    caption: '청록 하이라이트형',
    description: '제품 쇼케이스, 프로젝트 리뷰, 팀 공유에 적합',
  },
  {
    id: 'dark-business-steel',
    theme: 'dark',
    tone: 'business',
    label: '다크 + 비즈니스 Steel',
    caption: '중후한 데이터 리포트형',
    description: '금융/리스크/성과 중심 발표에 적합',
  },
  {
    id: 'dark-business-graphite',
    theme: 'dark',
    tone: 'business',
    label: '다크 + 비즈니스 Graphite',
    caption: '절제된 임원 보고형',
    description: '운영 계획, 분기 전략, KPI 리뷰에 적합',
  },
];

// 실제 생성되는 슬라이드의 CSS 색상 토큰 (미리보기와 일치)
const TEMPLATE_STYLE_TOKENS = {
  'light-casual-breeze': {
    canvasStart: '#f8fafc',
    canvasEnd: '#e0f2fe',
    shellBg: 'rgba(255, 255, 255, 0.94)',
    shellBorder: 'rgba(125, 211, 252, 0.55)',
    shellShadow: '0 22px 52px rgba(14, 165, 233, 0.14)',
    cardBg: 'rgba(240, 249, 255, 0.82)',
    cardAltBg: 'rgba(236, 253, 245, 0.78)',
    titleColor: '#0f172a',
    bodyColor: '#334155',
    subColor: '#0284c7',
    accent: '#f43f5e',
    accentBg: '#38bdf8',
    neutral: '#94a3b8',
    radius: '28px',
    titleWeight: '860',
    titleStyle: 'normal',
    fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  'light-casual-coral': {
    canvasStart: '#fff7ed',
    canvasEnd: '#ffedd5',
    shellBg: 'rgba(255, 251, 245, 0.95)',
    shellBorder: 'rgba(251, 146, 60, 0.44)',
    shellShadow: '0 22px 50px rgba(249, 115, 22, 0.12)',
    cardBg: 'rgba(255, 237, 213, 0.80)',
    cardAltBg: 'rgba(254, 249, 195, 0.78)',
    titleColor: '#7c2d12',
    bodyColor: '#9a3412',
    subColor: '#ea580c',
    accent: '#ea580c',
    accentBg: '#f97316',
    neutral: '#c2410c',
    radius: '28px',
    titleWeight: '860',
    titleStyle: 'normal',
    fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  'light-business-classic': {
    canvasStart: '#ffffff',
    canvasEnd: '#e2e8f0',
    shellBg: 'rgba(248, 250, 252, 0.98)',
    shellBorder: 'rgba(37, 99, 235, 0.34)',
    shellShadow: '0 12px 30px rgba(37, 99, 235, 0.12)',
    cardBg: 'rgba(255, 255, 255, 0.94)',
    cardAltBg: 'rgba(239, 246, 255, 0.86)',
    titleColor: '#0f172a',
    bodyColor: '#475569',
    subColor: '#1d4ed8',
    accent: '#1d4ed8',
    accentBg: '#1d4ed8',
    neutral: '#64748b',
    radius: '8px',
    titleWeight: '780',
    titleStyle: 'normal',
    fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  'light-business-mint': {
    canvasStart: '#f0fdfa',
    canvasEnd: '#dcfce7',
    shellBg: 'rgba(247, 255, 252, 0.98)',
    shellBorder: 'rgba(20, 184, 166, 0.35)',
    shellShadow: '0 12px 30px rgba(13, 148, 136, 0.12)',
    cardBg: 'rgba(236, 253, 245, 0.90)',
    cardAltBg: 'rgba(209, 250, 229, 0.90)',
    titleColor: '#134e4a',
    bodyColor: '#115e59',
    subColor: '#0f766e',
    accent: '#0f766e',
    accentBg: '#14b8a6',
    neutral: '#0f766e',
    radius: '12px',
    titleWeight: '780',
    titleStyle: 'normal',
    fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  'dark-casual-neon': {
    canvasStart: '#0b1226',
    canvasEnd: '#082f49',
    shellBg: 'rgba(12, 25, 48, 0.88)',
    shellBorder: 'rgba(56, 189, 248, 0.44)',
    shellShadow: '0 24px 58px rgba(8, 47, 73, 0.35)',
    cardBg: 'rgba(14, 116, 144, 0.34)',
    cardAltBg: 'rgba(8, 100, 130, 0.30)',
    titleColor: '#e0f2fe',
    bodyColor: '#94a3b8',
    subColor: '#7dd3fc',
    accent: '#38bdf8',
    accentBg: '#38bdf8',
    neutral: '#475569',
    radius: '26px',
    titleWeight: '870',
    titleStyle: 'normal',
    fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  'dark-casual-aurora': {
    canvasStart: '#071a1d',
    canvasEnd: '#12373b',
    shellBg: 'rgba(8, 32, 36, 0.90)',
    shellBorder: 'rgba(45, 212, 191, 0.40)',
    shellShadow: '0 24px 58px rgba(4, 47, 46, 0.38)',
    cardBg: 'rgba(17, 94, 89, 0.34)',
    cardAltBg: 'rgba(15, 118, 110, 0.30)',
    titleColor: '#ccfbf1',
    bodyColor: '#99f6e4',
    subColor: '#5eead4',
    accent: '#2dd4bf',
    accentBg: '#14b8a6',
    neutral: '#14b8a6',
    radius: '24px',
    titleWeight: '860',
    titleStyle: 'normal',
    fontFamily: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
  },
  'dark-business-steel': {
    canvasStart: '#0a1022',
    canvasEnd: '#1e293b',
    shellBg: 'rgba(15, 23, 42, 0.90)',
    shellBorder: 'rgba(96, 165, 250, 0.33)',
    shellShadow: '0 24px 58px rgba(15, 23, 42, 0.44)',
    cardBg: 'rgba(30, 64, 175, 0.26)',
    cardAltBg: 'rgba(51, 65, 85, 0.46)',
    titleColor: '#dbeafe',
    bodyColor: '#94a3b8',
    subColor: '#93c5fd',
    accent: '#60a5fa',
    accentBg: '#60a5fa',
    neutral: '#475569',
    radius: '10px',
    titleWeight: '760',
    titleStyle: 'normal',
    fontFamily: '"Noto Serif KR", "Times New Roman", "Noto Sans KR", serif',
  },
  'dark-business-graphite': {
    canvasStart: '#0f172a',
    canvasEnd: '#111827',
    shellBg: 'rgba(17, 24, 39, 0.92)',
    shellBorder: 'rgba(148, 163, 184, 0.30)',
    shellShadow: '0 24px 58px rgba(2, 6, 23, 0.48)',
    cardBg: 'rgba(51, 65, 85, 0.35)',
    cardAltBg: 'rgba(30, 41, 59, 0.48)',
    titleColor: '#e2e8f0',
    bodyColor: '#cbd5e1',
    subColor: '#93c5fd',
    accent: '#93c5fd',
    accentBg: '#3b82f6',
    neutral: '#64748b',
    radius: '10px',
    titleWeight: '760',
    titleStyle: 'normal',
    fontFamily: '"Noto Serif KR", "Times New Roman", "Noto Sans KR", serif',
  },
};

const PPT_HISTORY_STORAGE_KEY = 'ppt-maker-history-v1';
const MAX_PPT_HISTORY_ITEMS = 20;

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function getTemplatePreset(theme = 'light', tone = 'business', presetId = '') {
  const preferred = TEMPLATE_PRESETS.find((p) => p.id === presetId);
  if (preferred) return preferred;
  return TEMPLATE_PRESETS.find((p) => p.theme === theme && p.tone === tone) || TEMPLATE_PRESETS[2];
}

function pickPresetIdByThemeTone(theme = 'light', tone = 'business', preferredPresetId = '') {
  const preferred = TEMPLATE_PRESETS.find(
    (p) => p.id === preferredPresetId && p.theme === theme && p.tone === tone
  );
  if (preferred) return preferred.id;
  return getTemplatePreset(theme, tone).id;
}

const REWRITE_PRESET_OPTIONS = [
  { value: 'none', label: '사용자 입력만', instruction: '' },
  {
    value: 'shorten',
    label: '길이 압축',
    instruction: '현재 슬라이드의 핵심은 유지하고 분량을 약 35% 줄여 간결하게 작성하세요.',
  },
  {
    value: 'expand',
    label: '길이 확장',
    instruction: '현재 슬라이드의 근거와 예시를 보강해 분량을 약 35% 확장하세요.',
  },
  {
    value: 'formal',
    label: '정중한 보고서 톤',
    instruction: '문체를 정중하고 신뢰감 있는 보고서 톤으로 재작성하세요.',
  },
  {
    value: 'friendly',
    label: '친근한 설명 톤',
    instruction: '문체를 이해하기 쉬운 친근한 설명 톤으로 재작성하세요.',
  },
  {
    value: 'english',
    label: '비즈니스 영어',
    instruction: '슬라이드의 모든 텍스트를 자연스러운 비즈니스 영어로 바꿔주세요.',
  },
];

function getRewritePresetInstruction(presetValue = 'none') {
  const preset = REWRITE_PRESET_OPTIONS.find((item) => item.value === presetValue);
  return preset?.instruction || '';
}

function createSlideUid() {
  return `sl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeChartMode(mode = '') {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'bar' || normalized === 'line' || normalized === 'donut') return normalized;
  return '';
}

function simpleStringHash(text = '') {
  const source = String(text || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function remapIndexAfterMove(targetIndex, fromIndex, toIndex) {
  if (targetIndex === fromIndex) return toIndex;
  if (fromIndex < toIndex && targetIndex > fromIndex && targetIndex <= toIndex) return targetIndex - 1;
  if (fromIndex > toIndex && targetIndex >= toIndex && targetIndex < fromIndex) return targetIndex + 1;
  return targetIndex;
}

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeSimpleEntities(text = '') {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeWhitespace(text = '') {
  return decodeSimpleEntities(String(text || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function isHexColor(value = '') {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || '').trim());
}

function normalizeHexColor(value = '', fallback = '#2563eb') {
  const raw = String(value || '').trim();
  if (!isHexColor(raw)) return fallback;
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  return raw.toLowerCase();
}

function stripHtmlTags(html = '') {
  return normalizeWhitespace(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, toFiniteNumber(value, min)));
}

function shortenChartLabel(label = '', max = 14) {
  const text = normalizeWhitespace(label);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}\u2026`;
}

function isTimelineLikeLabel(label = '') {
  return /(?:19\d{2}|20\d{2}|Q[1-4]|[1-9]월|1[0-2]월|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b)/i.test(label);
}

function extractInlineChartSvg(contentHtml = '') {
  const source = String(contentHtml || '');
  const match = source.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (!match) return '';

  const rawSvg = String(match[0]);
  if (!/(?:<rect\b|<circle\b|<path\b|<polyline\b|<line\b)/i.test(rawSvg)) return '';

  return rawSvg
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*(['"])?javascript:[\s\S]*?\1/gi, '')
    .trim();
}

function sanitizeInlineChartSvg(svgString = '') {
  if (!svgString || typeof svgString !== 'string') return null;
  const trimmed = svgString.trim();
  if (!trimmed.toLowerCase().startsWith('<svg')) return null;
  // Reject overly complex SVGs
  const elementCount = (trimmed.match(/<[a-zA-Z]/g) || []).length;
  if (elementCount > 50) return null;
  let cleaned = trimmed
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<use\b[^>]*\/>/gi, '')
    .replace(/<use\b[^>]*>[\s\S]*?<\/use>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(?:xlink:)?href\s*=\s*"javascript:[^"]*"/gi, '')
    .replace(/\s+(?:xlink:)?href\s*=\s*'javascript:[^']*'/gi, '');
  return cleaned.trim() || null;
}

function extractChartPointsFromRenderedSvg(contentHtml = '') {
  const source = String(contentHtml || '');
  const labelMatches = [...source.matchAll(/<text[^>]*class="[^"]*ppt-point-label[^"]*"[^>]*>([\s\S]*?)<\/text>/gi)];
  const valueMatches = [...source.matchAll(/<text[^>]*class="[^"]*ppt-point-value[^"]*"[^>]*>([\s\S]*?)<\/text>/gi)];
  if (labelMatches.length < 2 || valueMatches.length < 2) return [];

  const pointCount = Math.min(8, labelMatches.length, valueMatches.length);
  const points = [];

  for (let index = 0; index < pointCount; index += 1) {
    const labelText = stripHtmlTags(labelMatches[index]?.[1] || '');
    const rawValueText = stripHtmlTags(valueMatches[index]?.[1] || '');
    const numberMatch = rawValueText.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?/);
    if (!numberMatch) continue;

    const parsed = toFiniteNumber(String(numberMatch[0]).replace(/,/g, ''), NaN);
    if (!Number.isFinite(parsed)) continue;

    points.push({
      label: shortenChartLabel(labelText || `항목 ${index + 1}`, 18),
      value: clampNumber(parsed, 0, 999999),
      unit: /%/.test(rawValueText) ? 'percent' : 'number',
    });
  }

  return points;
}

function extractChartPointsFromLines(lines = []) {
  const points = [];
  const usedLabels = new Set();

  for (const rawLine of lines) {
    const line = normalizeWhitespace(rawLine);
    if (!line) continue;

    const matches = [...line.matchAll(/(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(%?)/g)];
    if (matches.length === 0) continue;

    const fallbackLabel = shortenChartLabel(line.replace(/(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%?)/g, '').replace(/[():\-]/g, ' '), 16);

    for (let idx = 0; idx < matches.length; idx += 1) {
      const numberToken = matches[idx][1];
      const isPercent = matches[idx][2] === '%';
      const value = toFiniteNumber(String(numberToken).replace(/,/g, ''), NaN);
      if (!Number.isFinite(value)) continue;
      const bounded = isPercent ? clampNumber(value, 0, 100) : clampNumber(value, 0, 999999);

      const labelBase = fallbackLabel || `지표 ${points.length + 1}`;
      const uniqueLabel = idx === 0 ? labelBase : `${labelBase} ${idx + 1}`;
      const dedupeKey = uniqueLabel.toLowerCase();
      if (usedLabels.has(dedupeKey)) continue;
      usedLabels.add(dedupeKey);

      points.push({
        label: uniqueLabel,
        value: bounded,
        unit: isPercent ? 'percent' : 'number',
      });
    }
  }

  return points.slice(0, 8);
}

function inferChartMode(chartPoints = [], lowerText = '') {
  if (!Array.isArray(chartPoints) || chartPoints.length < 2) return '';

  const percentPoints = chartPoints.filter((item) => item.unit === 'percent');
  const sumPercent = percentPoints.reduce((acc, item) => acc + toFiniteNumber(item.value), 0);
  const hasCompositionKeyword = /(구성|분포|비중|점유|share|portion|mix|composition|breakdown|ratio)/i.test(lowerText);
  if (percentPoints.length >= 2 && (hasCompositionKeyword || (sumPercent >= 90 && sumPercent <= 110))) {
    return 'donut';
  }

  const hasTrendKeyword = /(추이|증가|감소|변화|성장|전년|분기|월별|연도|trend|growth|decline|timeline)/i.test(lowerText);
  const timelineLikeCount = chartPoints.filter((item) => isTimelineLikeLabel(item.label)).length;
  if (hasTrendKeyword || timelineLikeCount >= 2) return 'line';

  return 'bar';
}

function sanitizeSlideMarkupContent(html = '') {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(?:html|head|body)[^>]*>/gi, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .trim();
}

function parseSlideSemantics(contentHtml = '') {
  const sanitized = sanitizeSlideMarkupContent(contentHtml)
    .replace(/<!--\s*PPT_SOURCE_START\s*-->/gi, '')
    .replace(/<!--\s*PPT_SOURCE_END\s*-->/gi, '')
    .replace(/<p\s+class="ppt-meta"[^>]*>[\s\S]*?<\/p>/gi, '');

  const extractTagTexts = (pattern) => {
    const matches = [...sanitized.matchAll(pattern)];
    return matches.map((m) => stripHtmlTags(m[1] || '')).filter(Boolean);
  };

  const headings = extractTagTexts(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi);
  const paragraphs = extractTagTexts(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  const listItems = extractTagTexts(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  const plainText = stripHtmlTags(sanitized);

  const sentencePool = plainText
    .split(/[.!?]\s+|\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);

  let bullets = listItems.slice();
  if (bullets.length === 0) {
    bullets = [...paragraphs, ...sentencePool]
      .map((line) => normalizeWhitespace(line))
      .filter((line) => line.length >= 10)
      .slice(0, 8);
  }

  const percentValues = [...plainText.matchAll(/(-?\d{1,3}(?:\.\d+)?)\s*%/g)]
    .map((m) => Number(m[1]))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.max(8, Math.min(98, Math.round(v))));

  const numericValues = [...plainText.matchAll(/\b(\d{2,4})\b/g)]
    .map((m) => Number(m[1]))
    .filter((v) => Number.isFinite(v) && v >= 10)
    .map((v) => Math.max(10, Math.min(95, Math.round((v % 100) || 50))));

  const metrics = (percentValues.length > 0 ? percentValues : numericValues).slice(0, 6);
  const emailMatch = plainText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const urlMatch = plainText.match(/(https?:\/\/\S+|www\.\S+)/i);

  const title = headings[0] || sentencePool[0] || bullets[0] || 'Presentation Overview';
  const subtitle = headings[1] || paragraphs[0] || sentencePool[1] || '핵심 메시지를 요약합니다.';
  const summary = paragraphs[1] || sentencePool.slice(2, 4).join(' ') || subtitle;
  const renderedChartPoints = extractChartPointsFromRenderedSvg(contentHtml);
  const inferredChartPoints = extractChartPointsFromLines([
    ...headings,
    ...paragraphs,
    ...bullets,
    ...sentencePool,
  ]);
  const chartPoints = renderedChartPoints.length >= 2 ? renderedChartPoints : inferredChartPoints;
  const chartMode = inferChartMode(chartPoints, plainText.toLowerCase());
  const inlineChartSvg = extractInlineChartSvg(contentHtml);

  return {
    title, subtitle, summary,
    bullets: bullets.slice(0, 8),
    paragraphs, metrics,
    email: emailMatch ? emailMatch[0] : 'support@techai.local',
    url: urlMatch ? urlMatch[0] : 'www.techai.local',
    plainText,
    lowerText: plainText.toLowerCase(),
    chartPoints,
    chartMode,
    inlineChartSvg,
  };
}

function inferBodyLayout(slideData, index) {
  const content = slideData?.lowerText || '';
  if (
    slideData.chartPoints.length >= 2 ||
    slideData.metrics.length >= 4 ||
    /(지표|성과|통계|수치|매출|분기|증가|감소|달성|비율|percent|kpi)/.test(content)
  ) return 'metrics';
  if (/(비교|대비|vs|경쟁|기존|현재|개선|전환|before|after)/.test(content)) return 'compare';
  if (slideData.bullets.length >= 3) return 'list';
  return index % 2 === 0 ? 'summary' : 'list';
}

function renderMetricBars(metricValues, tokens) {
  const values = (metricValues.length > 0 ? metricValues : [34, 52, 64, 78, 71, 88]).slice(0, 6);
  return values.map((value, index) => [
    '<div class="ppt-bar-col">',
    `  <div class="ppt-bar-value">${value}%</div>`,
    '  <div class="ppt-bar-track">',
    `    <div class="ppt-bar-fill" style="height:${value}%; background:${tokens.accentBg};"></div>`,
    '  </div>',
    `  <div class="ppt-bar-label">Q${index + 1}</div>`,
    '</div>',
  ].join('\n')).join('\n');
}

function renderTemplateBarSvg(points = [], tokens) {
  const safePoints = points.slice(0, 6);
  if (safePoints.length < 2) return '';

  const animId = `pba${Math.random().toString(36).slice(2, 7)}`;
  const maxValue = Math.max(...safePoints.map((item) => toFiniteNumber(item.value, 0)), 1);
  const minX = 90;
  const maxX = 900;
  const chartBaseY = 380;
  const chartTopY = 80;
  const slotWidth = (maxX - minX) / safePoints.length;
  const barWidth = Math.max(40, slotWidth * 0.48);

  const bars = safePoints.map((point, index) => {
    const ratio = clampNumber(toFiniteNumber(point.value) / maxValue, 0, 1);
    const barHeight = Math.round((chartBaseY - chartTopY) * ratio);
    const x = Math.round(minX + index * slotWidth + (slotWidth - barWidth) / 2);
    const y = chartBaseY - barHeight;
    const label = escapeHtml(shortenChartLabel(point.label, 12) || `항목 ${index + 1}`);
    const displayValue = Number.isFinite(point.value) ? `${Math.round(point.value)}${point.unit === 'percent' ? '%' : ''}` : '-';
    const delay = `${(index * 0.08).toFixed(2)}s`;
    return [
      `<rect class="${animId}" style="animation-delay:${delay}" x="${x}" y="${y}" width="${Math.round(barWidth)}" height="${barHeight}" rx="10" fill="${tokens.accentBg}" opacity="0.9" />`,
      `<text x="${Math.round(x + barWidth / 2)}" y="${y - 12}" text-anchor="middle" class="ppt-data-label ppt-point-value">${escapeHtml(displayValue)}</text>`,
      `<text x="${Math.round(x + barWidth / 2)}" y="414" text-anchor="middle" class="ppt-data-axis ppt-point-label">${label}</text>`,
    ].join('');
  }).join('');

  const animStyle = [
    '<style>',
    `@keyframes ${animId}-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }`,
    `.${animId} { transform-box: fill-box; transform-origin: 50% 100%; animation: ${animId}-grow 0.5s ease-out both; }`,
    `@media print { .${animId} { animation: none !important; transform: none !important; } }`,
    '</style>',
  ].join('');

  return [
    '<svg class="ppt-data-svg" viewBox="0 0 960 440" role="img" aria-label="Bar chart">',
    animStyle,
    `<line x1="80" y1="380" x2="920" y2="380" stroke="${tokens.shellBorder}" stroke-width="2" />`,
    `<line x1="90" y1="70" x2="90" y2="380" stroke="${tokens.shellBorder}" stroke-width="2" />`,
    bars,
    '</svg>',
  ].join('');
}

function renderTemplateLineSvg(points = [], tokens) {
  const safePoints = points.slice(0, 7);
  if (safePoints.length < 2) return '';

  const animId = `pla${Math.random().toString(36).slice(2, 7)}`;
  const minX = 90;
  const maxX = 900;
  const minY = 90;
  const maxY = 360;
  const values = safePoints.map((item) => toFiniteNumber(item.value, 0));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const span = Math.max(1, maxValue - minValue);
  const slotWidth = (maxX - minX) / Math.max(1, safePoints.length - 1);

  const coordinates = safePoints.map((point, index) => {
    const x = Math.round(minX + slotWidth * index);
    const normalized = (toFiniteNumber(point.value, minValue) - minValue) / span;
    const y = Math.round(maxY - (maxY - minY) * clampNumber(normalized, 0, 1));
    return {
      x, y,
      label: escapeHtml(shortenChartLabel(point.label, 10) || `시점 ${index + 1}`),
      valueText: `${Math.round(toFiniteNumber(point.value, 0))}${point.unit === 'percent' ? '%' : ''}`,
      delay: `${(index * 0.06 + 0.7).toFixed(2)}s`,
    };
  });

  const linePoints = coordinates.map((item) => `${item.x},${item.y}`).join(' ');
  const areaPoints = `${linePoints} ${maxX},${maxY} ${minX},${maxY}`;
  const circles = coordinates.map((item, i) => [
    `<circle class="${animId}-dot ${animId}-d${i}" cx="${item.x}" cy="${item.y}" r="6" fill="${tokens.accentBg}" style="animation-delay:${item.delay}" />`,
    `<text x="${item.x}" y="${item.y - 14}" text-anchor="middle" class="ppt-data-label ppt-point-value">${escapeHtml(item.valueText)}</text>`,
    `<text x="${item.x}" y="394" text-anchor="middle" class="ppt-data-axis ppt-point-label">${item.label}</text>`,
  ].join('')).join('');

  const animStyle = [
    '<style>',
    `@keyframes ${animId}-draw { from { stroke-dashoffset: 2000; } to { stroke-dashoffset: 0; } }`,
    `@keyframes ${animId}-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }`,
    `.${animId}-line { stroke-dasharray: 2000; animation: ${animId}-draw 0.8s ease-out both; }`,
    `.${animId}-dot { transform-box: fill-box; transform-origin: center; animation: ${animId}-pop 0.3s ease-out both; }`,
    `@media print { .${animId}-line, .${animId}-dot { animation: none !important; stroke-dasharray: none !important; } }`,
    '</style>',
  ].join('');

  return [
    '<svg class="ppt-data-svg" viewBox="0 0 960 440" role="img" aria-label="Line chart">',
    animStyle,
    `<line x1="80" y1="360" x2="920" y2="360" stroke="${tokens.shellBorder}" stroke-width="2" />`,
    `<line x1="90" y1="70" x2="90" y2="360" stroke="${tokens.shellBorder}" stroke-width="2" />`,
    `<polygon points="${areaPoints}" fill="${tokens.accentBg}" opacity="0.16" />`,
    `<polyline class="${animId}-line" points="${linePoints}" fill="none" stroke="${tokens.accentBg}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />`,
    circles,
    '</svg>',
  ].join('');
}

function renderTemplateDonutSvg(points = [], tokens) {
  const safePoints = points.slice(0, 5);
  if (safePoints.length < 2) return '';

  const animId = `pda${Math.random().toString(36).slice(2, 7)}`;
  const normalized = safePoints.map((item) => ({
    label: shortenChartLabel(item.label, 18) || '항목',
    value: Math.max(0, toFiniteNumber(item.value, 0)),
  }));
  const total = normalized.reduce((acc, item) => acc + item.value, 0);
  if (total <= 0) return '';

  const palette = [tokens.accentBg, tokens.accent, '#38bdf8', '#22c55e', '#f59e0b'];
  const circumference = 2 * Math.PI * 110;
  let offset = 0;

  const slices = normalized.map((item, index) => {
    const ratio = item.value / total;
    const segment = ratio * circumference;
    const delay = `${(index * 0.1).toFixed(2)}s`;
    const element = `<circle class="${animId}-slice" style="animation-delay:${delay}" cx="320" cy="220" r="110" fill="none" stroke="${palette[index % palette.length]}" stroke-width="52" stroke-dasharray="${segment.toFixed(2)} ${(circumference - segment).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 320 220)" stroke-linecap="butt" />`;
    offset += segment;
    return element;
  }).join('');

  const legends = normalized.map((item, index) => {
    const pct = Math.round((item.value / total) * 100);
    const y = 140 + index * 46;
    return [
      `<rect x="580" y="${y - 14}" width="18" height="18" rx="4" fill="${palette[index % palette.length]}" />`,
      `<text x="606" y="${y}" class="ppt-data-axis ppt-point-label" text-anchor="start">${escapeHtml(item.label)}</text>`,
      `<text x="850" y="${y}" class="ppt-data-label ppt-point-value" text-anchor="end">${pct}%</text>`,
    ].join('');
  }).join('');

  const animStyle = [
    '<style>',
    `@keyframes ${animId}-fade { from { opacity: 0; } to { opacity: 1; } }`,
    `.${animId}-slice { animation: ${animId}-fade 0.45s ease-out both; }`,
    `@media print { .${animId}-slice { animation: none !important; } }`,
    '</style>',
  ].join('');

  return [
    '<svg class="ppt-data-svg" viewBox="0 0 960 440" role="img" aria-label="Donut chart">',
    animStyle,
    `<circle cx="320" cy="220" r="110" fill="none" stroke="${tokens.neutral}44" stroke-width="52" />`,
    slices,
    '<text x="320" y="214" text-anchor="middle" class="ppt-data-label">주합</text>',
    '<text x="320" y="246" text-anchor="middle" class="ppt-data-value">100%</text>',
    legends,
    '</svg>',
  ].join('');
}

function renderChartBlock(slideData, tokens, chartModeOverride = '') {
  const points = Array.isArray(slideData?.chartPoints) ? slideData.chartPoints : [];
  const chartMode = normalizeChartMode(chartModeOverride) || slideData?.chartMode || 'bar';

  if (points.length >= 2) {
    const templateSvg =
      chartMode === 'donut'
        ? renderTemplateDonutSvg(points, tokens)
        : chartMode === 'line'
          ? renderTemplateLineSvg(points, tokens)
          : renderTemplateBarSvg(points, tokens);

    if (templateSvg) {
      return [
        '<div class="ppt-chart-shell">',
        templateSvg,
        '</div>',
      ].join('\n');
    }
  }

  const safeSvg = sanitizeInlineChartSvg(slideData?.inlineChartSvg || '');
  if (safeSvg) {
    return [
      '<div class="ppt-chart-shell ppt-chart-shell--ai">',
      safeSvg,
      '</div>',
    ].join('\n');
  }

  return [
    '<div class="ppt-metric-grid">',
    renderMetricBars(slideData?.metrics || [], tokens),
    '</div>',
  ].join('\n');
}

function buildPresetSlideHtml(
  contentHtml,
  theme = 'light',
  tone = 'business',
  index = 0,
  totalSlides = 1,
  colorOverrides = null,
  presetId = '',
  chartModeOverride = '',
  slideUid = '',
  chartPointsOverride = null
) {
  const preset = getTemplatePreset(theme, tone, presetId);
  const baseTokens = TEMPLATE_STYLE_TOKENS[preset.id] || TEMPLATE_STYLE_TOKENS['light-business-classic'];
  const tokens = {
    ...baseTokens,
    canvasStart: normalizeHexColor(colorOverrides?.canvasStart, baseTokens.canvasStart),
    canvasEnd: normalizeHexColor(colorOverrides?.canvasEnd, baseTokens.canvasEnd),
    accentBg: normalizeHexColor(colorOverrides?.accentBg, baseTokens.accentBg),
  };
  const slideData = parseSlideSemantics(contentHtml);
  if (Array.isArray(chartPointsOverride) && chartPointsOverride.length >= 2) {
    slideData.chartPoints = chartPointsOverride;
    slideData.chartMode = inferChartMode(chartPointsOverride, slideData.lowerText);
  }
  const effectiveChartMode = normalizeChartMode(chartModeOverride) || slideData.chartMode || '';
  const resolvedSlideUid = String(slideUid || '').trim() || createSlideUid();

  const isFirst = index === 0;
  const isLast = index === totalSlides - 1;
  const bodyMode = inferBodyLayout(slideData, index);
  const modeLabel = isFirst
    ? 'Introduction'
    : isLast
      ? 'Closing'
      : bodyMode === 'metrics' && effectiveChartMode
        ? `metrics-${effectiveChartMode}`
        : bodyMode;

  const cardItems = (slideData.bullets.length > 0 ? slideData.bullets : [slideData.summary])
    .slice(0, 4)
    .map((item) => [
      '<article class="ppt-item-card">',
      '  <div class="ppt-item-check">&#10003;</div>',
      `  <p class="ppt-item-text">${escapeHtml(item)}</p>`,
      '</article>',
    ].join('\n')).join('\n');

  const splitSource = (slideData.bullets.length > 0 ? slideData.bullets : [slideData.summary, slideData.subtitle]).slice(0, 6);
  const midpoint = Math.max(1, Math.ceil(splitSource.length / 2));
  const leftItems = splitSource.slice(0, midpoint);
  const rightItems = splitSource.slice(midpoint);
  const compareList = (items) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  let bodySection = '';

  if (isFirst) {
    bodySection = [
      '<div class="ppt-hero">',
      '  <div class="ppt-kicker-row">',
      `    <div class="ppt-kicker-line" style="background:${tokens.accentBg};"></div>`,
      `    <p class="ppt-kicker">Slide ${String(index + 1).padStart(2, '0')} : Introduction</p>`,
      '  </div>',
      `  <h1 class="ppt-title">${escapeHtml(slideData.title)} <span class="ppt-accent">${escapeHtml(slideData.subtitle)}</span></h1>`,
      `  <p class="ppt-subtitle">${escapeHtml(slideData.summary)}</p>`,
      '  <div class="ppt-cta-row">',
      `    <span class="ppt-cta">${escapeHtml(slideData.bullets[0] || '프로젝트 시작')}</span>`,
      '  </div>',
      '</div>',
    ].join('\n');
  } else if (isLast) {
    bodySection = [
      '<div class="ppt-outro">',
      `  <div class="ppt-outro-icon" style="background:${tokens.accentBg};">&#10003;</div>`,
      `  <h1 class="ppt-title">${escapeHtml(slideData.title || 'Thank You')}</h1>`,
      `  <p class="ppt-subtitle">${escapeHtml(slideData.summary)}</p>`,
      '  <div class="ppt-contact-grid">',
      `    <div class="ppt-contact-chip">Email: ${escapeHtml(slideData.email)}</div>`,
      `    <div class="ppt-contact-chip">Web: ${escapeHtml(slideData.url)}</div>`,
      '  </div>',
      '</div>',
    ].join('\n');
  } else if (bodyMode === 'compare') {
    bodySection = [
      '<div class="ppt-body">',
      `  <h2 class="ppt-section-title">${escapeHtml(slideData.title)}</h2>`,
      `  <p class="ppt-section-sub">${escapeHtml(slideData.subtitle)}</p>`,
      '  <div class="ppt-compare-grid">',
      '    <section class="ppt-compare-card">',
      '      <h3>Current</h3>',
      `      <ul>${compareList(leftItems)}</ul>`,
      '    </section>',
      '    <section class="ppt-compare-card ppt-compare-card--target">',
      '      <h3>Target</h3>',
      `      <ul>${compareList(rightItems.length > 0 ? rightItems : [slideData.summary])}</ul>`,
      '    </section>',
      '  </div>',
      '</div>',
    ].join('\n');
  } else if (bodyMode === 'metrics') {
    bodySection = [
      '<div class="ppt-body">',
      `  <h2 class="ppt-section-title">${escapeHtml(slideData.title)}</h2>`,
      `  <p class="ppt-section-sub">${escapeHtml(slideData.subtitle)}</p>`,
      renderChartBlock(slideData, tokens, effectiveChartMode),
      '</div>',
    ].join('\n');
  } else if (bodyMode === 'list') {
    bodySection = [
      '<div class="ppt-body">',
      `  <h2 class="ppt-section-title">${escapeHtml(slideData.title)}</h2>`,
      `  <p class="ppt-section-sub">${escapeHtml(slideData.subtitle)}</p>`,
      '  <div class="ppt-items-grid">',
      cardItems,
      '  </div>',
      '</div>',
    ].join('\n');
  } else {
    bodySection = [
      '<div class="ppt-body">',
      `  <h2 class="ppt-section-title">${escapeHtml(slideData.title)}</h2>`,
      `  <p class="ppt-section-sub">${escapeHtml(slideData.subtitle)}</p>`,
      `  <div class="ppt-summary-card">${escapeHtml(slideData.summary)}</div>`,
      '</div>',
    ].join('\n');
  }

  return [
    '<section class="ppt-slide">',
    '<style>',
    `  .ppt-slide { min-height: 100vh; width: 100%; box-sizing: border-box; padding: 4vw; background: linear-gradient(152deg, ${tokens.canvasStart}, ${tokens.canvasEnd}); color: ${tokens.bodyColor}; font-family: ${tokens.fontFamily}; }`,
    `  .ppt-shell { min-height: calc(100vh - 8vw); border-radius: ${tokens.radius}; background: ${tokens.shellBg}; border: 1px solid ${tokens.shellBorder}; box-shadow: ${tokens.shellShadow}; padding: 2rem 2.1rem; display: flex; flex-direction: column; gap: 1rem; }`,
    `  .ppt-shell::before { content: ''; position: absolute; pointer-events: none; inset: 0; border-radius: ${tokens.radius}; opacity: 0.25; background: linear-gradient(140deg, ${tokens.accent}22, transparent 55%); }`,
    '  .ppt-shell { position: relative; overflow: hidden; }',
    `  .ppt-meta { margin: 0; font-size: 0.72rem; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; color: ${tokens.subColor}; }`,
    '  .ppt-kicker-row { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.7rem; }',
    '  .ppt-kicker-line { height: 0.24rem; width: 2.5rem; border-radius: 999px; }',
    `  .ppt-kicker { margin: 0; font-size: 0.74rem; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; color: ${tokens.accent}; }`,
    `  .ppt-title { margin: 0; font-size: clamp(2rem, 3.3vw, 3.25rem); line-height: 1.12; color: ${tokens.titleColor}; font-weight: ${tokens.titleWeight}; font-style: ${tokens.titleStyle}; }`,
    `  .ppt-subtitle { margin: 0.4rem 0 0; font-size: clamp(1.04rem, 1.58vw, 1.35rem); line-height: 1.5; color: ${tokens.bodyColor}; }`,
    `  .ppt-accent { color: ${tokens.accent}; display: inline; }`,
    `  .ppt-cta { display: inline-flex; align-items: center; border-radius: ${tokens.radius}; background: ${tokens.accentBg}; color: #ffffff; font-weight: 700; padding: 0.68rem 1rem; margin-top: 1rem; }`,
    '  .ppt-section-title { margin: 0; font-size: clamp(1.56rem, 2.4vw, 2.35rem); line-height: 1.2; }',
    `  .ppt-section-sub { margin: 0.25rem 0 0.9rem; color: ${tokens.subColor}; }`,
    '  .ppt-items-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }',
    `  .ppt-item-card { border-radius: calc(${tokens.radius} * 0.55); border: 1px solid ${tokens.shellBorder}; background: ${tokens.cardBg}; padding: 0.8rem 0.9rem; display: flex; gap: 0.55rem; align-items: flex-start; }`,
    `  .ppt-item-check { flex-shrink: 0; width: 1.2rem; height: 1.2rem; border-radius: 999px; background: ${tokens.accentBg}; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; margin-top: 0.12rem; }`,
    '  .ppt-item-text { margin: 0; font-size: 0.93rem; line-height: 1.45; }',
    '  .ppt-compare-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; }',
    `  .ppt-compare-card { border-radius: calc(${tokens.radius} * 0.55); border: 1px solid ${tokens.shellBorder}; background: ${tokens.cardBg}; padding: 0.9rem 1rem; }`,
    `  .ppt-compare-card--target { background: ${tokens.cardAltBg}; border-color: ${tokens.accent}66; }`,
    '  .ppt-compare-card h3 { margin: 0 0 0.45rem; font-size: 1.02rem; }',
    '  .ppt-compare-card ul { margin: 0; padding-left: 1rem; }',
    '  .ppt-compare-card li { margin: 0.25rem 0; }',
    `  .ppt-chart-shell { width: 100%; border-radius: calc(${tokens.radius} * 0.55); border: 1px solid ${tokens.shellBorder}; background: ${tokens.cardBg}; padding: 0.55rem 0.7rem; }`,
    '  .ppt-chart-shell svg { width: 100%; height: auto; display: block; max-height: 48vh; }',
    '  .ppt-chart-shell--ai svg { max-height: 44vh; }',
    `  .ppt-data-label { fill: ${tokens.bodyColor}; font-family: ${tokens.fontFamily}; font-size: 18px; font-weight: 700; }`,
    `  .ppt-data-value { fill: ${tokens.titleColor}; font-family: ${tokens.fontFamily}; font-size: 32px; font-weight: 800; }`,
    `  .ppt-data-axis { fill: ${tokens.subColor}; font-family: ${tokens.fontFamily}; font-size: 15px; font-weight: 600; }`,
    '  .ppt-metric-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.62rem; align-items: end; height: 48vh; border-radius: calc(var(--radius, 18px)); }',
    `  .ppt-bar-col { display: flex; flex-direction: column; align-items: center; gap: 0.42rem; color: ${tokens.bodyColor}; }`,
    '  .ppt-bar-value { font-size: 0.72rem; font-weight: 700; }',
    `  .ppt-bar-track { position: relative; width: 100%; min-height: 9rem; border-radius: 999px; background: ${tokens.neutral}33; overflow: hidden; }`,
    '  .ppt-bar-fill { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 999px; animation: ppt-bar-grow 0.65s ease-out both; }',
    '  @keyframes ppt-bar-grow { from { height: 0; } }',
    '  .ppt-bar-col:nth-child(1) .ppt-bar-fill { animation-delay: 0s; }',
    '  .ppt-bar-col:nth-child(2) .ppt-bar-fill { animation-delay: 0.07s; }',
    '  .ppt-bar-col:nth-child(3) .ppt-bar-fill { animation-delay: 0.14s; }',
    '  .ppt-bar-col:nth-child(4) .ppt-bar-fill { animation-delay: 0.21s; }',
    '  .ppt-bar-col:nth-child(5) .ppt-bar-fill { animation-delay: 0.28s; }',
    '  .ppt-bar-col:nth-child(6) .ppt-bar-fill { animation-delay: 0.35s; }',
    '  .ppt-bar-label { font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.9; }',
    `  .ppt-summary-card { border-radius: calc(${tokens.radius} * 0.55); border: 1px solid ${tokens.shellBorder}; background: ${tokens.cardBg}; padding: 1rem; line-height: 1.6; }`,
    '  .ppt-outro { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 64vh; }',
    '  .ppt-outro-icon { width: 4.8rem; height: 4.8rem; border-radius: 999px; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22); margin-bottom: 1.1rem; }',
    '  .ppt-contact-grid { margin-top: 1rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; width: 100%; max-width: 40rem; }',
    `  .ppt-contact-chip { border-radius: calc(${tokens.radius} * 0.45); border: 1px solid ${tokens.shellBorder}; background: ${tokens.cardBg}; padding: 0.62rem 0.78rem; font-size: 0.84rem; text-align: left; }`,
    '  .ppt-source { display: none !important; }',
    '  @media print { .ppt-bar-fill { animation: none !important; } }',
    '  @media (max-width: 960px) { .ppt-items-grid, .ppt-compare-grid, .ppt-contact-grid { grid-template-columns: 1fr; } .ppt-metric-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); height: auto; } }',
    '</style>',
    `<div class="ppt-shell" data-theme="${theme}" data-layout="${modeLabel}" data-template-preset-id="${preset.id}" data-chart-mode="${effectiveChartMode}" data-slide-uid="${resolvedSlideUid}" data-color-canvas-start="${tokens.canvasStart}" data-color-canvas-end="${tokens.canvasEnd}" data-color-accent-bg="${tokens.accentBg}">`,
    `  <p class="ppt-meta">${escapeHtml(preset.label)} | Slide ${index + 1} / ${totalSlides}</p>`,
    bodySection,
    '  <p class="ppt-meta">Shinhan TechAI PPT Template Engine</p>',
    `  <div class="ppt-source"><!-- PPT_SOURCE_START -->${contentHtml}<!-- PPT_SOURCE_END --></div>`,
    '</div>',
    '</section>',
  ].join('\n');
}

function applyTemplatePresetToSlides(rawHtml, theme = 'light', tone = 'business', presetId = '') {
  const chunks = splitSlides(rawHtml);
  if (chunks.length === 0) return '';
  const totalSlides = chunks.length;
  const templated = chunks.map((chunk, index) => {
    const cleaned = sanitizeSlideMarkupContent(chunk);
    const finalContent = cleaned || '<h2>슬라이드 내용을 생성하지 못했습니다.</h2><p>다시 생성해 주세요.</p>';
    return buildPresetSlideHtml(finalContent, theme, tone, index, totalSlides, null, presetId, '', createSlideUid());
  });
  return templated.join(`\n${SLIDE_BREAK}\n`);
}

function extractTemplateContent(slideHtml = '') {
  if (!slideHtml || typeof slideHtml !== 'string') return '';
  const sourceMatch = slideHtml.match(/<!--\s*PPT_SOURCE_START\s*-->([\s\S]*?)<!--\s*PPT_SOURCE_END\s*-->/i);
  if (sourceMatch && sourceMatch[1]) return sourceMatch[1].trim();
  const wrappedMatch = slideHtml.match(/<div class="ppt-content">([\s\S]*?)<\/div>\s*<p class="ppt-footer">/i);
  if (wrappedMatch && wrappedMatch[1]) return wrappedMatch[1].trim();
  return sanitizeSlideMarkupContent(slideHtml);
}

function reapplyTemplatePresetOnSlides(slides = [], theme = 'light', tone = 'business', presetId = '') {
  if (!Array.isArray(slides) || slides.length === 0) return [];
  const totalSlides = slides.length;
  const seenUids = new Set();
  return slides.map((slide, index) => {
    const extractedContent = extractTemplateContent(slide);
    const finalContent = extractedContent || '<h2>슬라이드 내용을 생성하지 못했습니다.</h2><p>다시 생성해 주세요.</p>';
    const colorOverrides = extractSlideColorOverrides(slide, theme, tone, presetId);
    const chartModeOverride = extractSlideChartMode(slide);
    let slideUid = extractSlideUid(slide);
    if (!slideUid || seenUids.has(slideUid)) slideUid = createSlideUid();
    seenUids.add(slideUid);
    return buildPresetSlideHtml(finalContent, theme, tone, index, totalSlides, colorOverrides, presetId, chartModeOverride, slideUid);
  });
}

function extractSlideTemplatePresetId(slideHtml = '', theme = 'light', tone = 'business', fallbackPresetId = '') {
  const source = String(slideHtml || '');
  const matched = source.match(/data-template-preset-id="([^"]+)"/i)?.[1] || '';
  if (matched && TEMPLATE_STYLE_TOKENS[matched]) return matched;
  if (fallbackPresetId && TEMPLATE_STYLE_TOKENS[fallbackPresetId]) return fallbackPresetId;
  return getTemplatePreset(theme, tone).id;
}

function extractSlideChartMode(slideHtml = '') {
  const source = String(slideHtml || '');
  const direct = normalizeChartMode(source.match(/data-chart-mode="([^"]*)"/i)?.[1] || '');
  if (direct) return direct;
  const layout = String(source.match(/data-layout="([^"]*)"/i)?.[1] || '').toLowerCase();
  if (layout.startsWith('metrics-')) {
    return normalizeChartMode(layout.slice('metrics-'.length));
  }
  return '';
}

function extractSlideUid(slideHtml = '') {
  const source = String(slideHtml || '');
  const uid = source.match(/data-slide-uid="([^"]+)"/i)?.[1] || '';
  return uid ? uid.trim() : '';
}

function extractSlideColorOverrides(slideHtml = '', theme = 'light', tone = 'business', fallbackPresetId = '') {
  const presetId = extractSlideTemplatePresetId(slideHtml, theme, tone, fallbackPresetId);
  const preset = getTemplatePreset(theme, tone, presetId);
  const baseTokens = TEMPLATE_STYLE_TOKENS[preset.id] || TEMPLATE_STYLE_TOKENS['light-business-classic'];
  const source = String(slideHtml || '');
  const canvasStart = source.match(/data-color-canvas-start="([^"]+)"/i)?.[1] || '';
  const canvasEnd = source.match(/data-color-canvas-end="([^"]+)"/i)?.[1] || '';
  const accentBg = source.match(/data-color-accent-bg="([^"]+)"/i)?.[1] || '';
  return {
    canvasStart: normalizeHexColor(canvasStart, baseTokens.canvasStart),
    canvasEnd: normalizeHexColor(canvasEnd, baseTokens.canvasEnd),
    accentBg: normalizeHexColor(accentBg, baseTokens.accentBg),
  };
}

function extractStreamDelta(parsed) {
  if (!parsed || typeof parsed !== 'object') return '';
  const delta = parsed?.choices?.[0]?.delta?.content;
  if (typeof delta === 'string') return delta;
  const text = parsed?.choices?.[0]?.text;
  if (typeof text === 'string') return text;
  const responseText = parsed?.response;
  if (typeof responseText === 'string') return responseText;
  const messageContent = parsed?.message?.content;
  if (typeof messageContent === 'string') return messageContent;
  return '';
}

function stripMarkdownCodeFence(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  const wrapped = trimmed.match(/^```(?:\s*html)?\s*([\s\S]*?)\s*```$/i);
  if (wrapped) return wrapped[1].trim();
  return trimmed.replace(/^```(?:\s*html)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function parseJsonObjectSequence(raw) {
  const objects = [];
  if (!raw || typeof raw !== 'string') return objects;
  let start = -1, depth = 0, inString = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (start === -1) {
      if (char === '{') { start = i; depth = 1; inString = false; escaped = false; }
      continue;
    }
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') { depth++; continue; }
    if (char === '}') {
      depth--;
      if (depth === 0) {
        try { objects.push(JSON.parse(raw.slice(start, i + 1))); } catch {}
        start = -1;
      }
    }
  }
  return objects;
}

function extractTextFromRawStream(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let extracted = '';
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith(':') || line.startsWith('event:')) continue;
    const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload);
      const delta = extractStreamDelta(parsed);
      if (delta) extracted += delta;
    } catch {}
  }
  if (extracted) return extracted;
  const seq = parseJsonObjectSequence(rawText);
  if (seq.length > 0) {
    const seqText = seq.map((item) => extractStreamDelta(item)).join('');
    if (seqText) return seqText;
  }

  const stripped = stripMarkdownCodeFence(rawText).trim();
  if (!stripped) return '';

  const likelyTransportPayload =
    /(^|\n)\s*(data:|event:|id:)\s*/i.test(rawText) ||
    /^\s*[\[{]/.test(stripped);
  if (likelyTransportPayload) return '';

  return stripped;
}

function normalizeGeneratedHtml(rawText) {
  const extracted = extractTextFromRawStream(rawText);
  return stripMarkdownCodeFence(extracted);
}

function splitSlides(raw = '') {
  return raw.split(SLIDE_BREAK_PATTERN).map((p) => p.trim()).filter(Boolean);
}

function hasSlideBreak(raw = '') {
  return /<!--\s*SLIDE_BREAK\s*-->/i.test(raw);
}

function splitSlidesLoosely(raw = '', expectedCount = 1) {
  const primary = splitSlides(raw);
  if (primary.length > 1 || expectedCount <= 1) return primary;

  const bySection = String(raw || '').split(/(?=<section\b[^>]*>)/i).map((p) => p.trim()).filter(Boolean);
  if (bySection.length > 1) return bySection;

  const byHeading = String(raw || '')
    .split(/(?=<h[1-2]\b[^>]*>)/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (byHeading.length > 1) return byHeading;

  return primary;
}

function buildOutlineFallbackSource(outline, index) {
  const title = String(outline?.title || `슬라이드 ${index + 1}`).trim();
  const description = String(outline?.description || '핵심 내용을 정리합니다.').trim();
  const keyPoints = Array.isArray(outline?.keyPoints) ? outline.keyPoints : [];
  const points = keyPoints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5);
  const lines = [];
  lines.push(`<h2>${escapeHtml(title)}</h2>`);
  lines.push(`<p>${escapeHtml(description)}</p>`);
  if (points.length > 0) {
    lines.push('<ul>');
    for (const point of points) lines.push(`<li>${escapeHtml(point)}</li>`);
    lines.push('</ul>');
  }
  return lines.join('\n');
}

function normalizeOutlineSlides(rawSlides = [], count = 1) {
  const targetCount = Number.isInteger(count) && count > 0 ? count : 1;
  const normalized = Array.isArray(rawSlides)
    ? rawSlides.slice(0, targetCount).map((slide, idx) => {
        const title = String(slide?.title || `슬라이드 ${idx + 1}`).trim();
        const description = String(slide?.description || '').trim();
        const generationHint = String(slide?.generationHint || '').trim();
        const keyPoints = Array.isArray(slide?.keyPoints)
          ? slide.keyPoints.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5)
          : [];
        const imagePrompt = String(slide?.imagePrompt || '').trim();
        const imagePlacement = String(slide?.imagePlacement || 'none').trim();
        const imageStyle = String(slide?.imageStyle || 'photo').trim();
        return { title, description, generationHint, keyPoints, imagePrompt, imagePlacement, imageStyle };
      })
    : [];

  while (normalized.length < targetCount) {
    normalized.push({
      title: `슬라이드 ${normalized.length + 1}`,
      description: '핵심 내용을 정리합니다.',
      generationHint: '',
      keyPoints: [],
      imagePrompt: '',
      imagePlacement: 'none',
      imageStyle: 'photo',
    });
  }

  return normalized;
}

function shouldRequestChartFromOutline(outline = null) {
  if (!outline || typeof outline !== 'object') return false;
  const title = String(outline.title || '');
  const description = String(outline.description || '');
  const points = Array.isArray(outline.keyPoints) ? outline.keyPoints.join(' ') : '';
  const hint = String(outline.generationHint || '');
  const merged = `${title} ${description} ${points} ${hint}`.toLowerCase();

  if (/(차트|그래프|지표|통계|수치|비율|분포|비중|매출|kpi|chart|graph|trend|ratio|share|metric)/.test(merged)) {
    return true;
  }

  const numericMatches = merged.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*%?/g) || [];
  return numericMatches.length >= 3;
}

function formatElapsedTime(ms = 0) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function loadPptHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(PPT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object');
  } catch {
    return [];
  }
}

function savePptHistoryToStorage(items) {
  try {
    localStorage.setItem(PPT_HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {
  }
}

function buildSlideDoc(html, theme = 'light', tone = 'business', isPreview = true) {
  const isDark = theme === 'dark';
  const frameStart = isDark ? '#0f172a' : '#eff6ff';
  const frameEnd = isDark ? '#1e3a8a' : '#bfdbfe';
  const textColor = isDark ? '#dbeafe' : '#0f172a';
  const radius = tone === 'casual' ? '20px' : '10px';
  const stageOpen = isPreview ? '<div class="preview-stage">' : '';
  const stageClose = isPreview ? '</div>' : '';
  const previewOverrides = isPreview
    ? [
        '  .slide-root .ppt-slide { min-height: 540px !important; height: 540px !important; padding: 24px !important; }',
        '  .slide-root .ppt-shell { min-height: calc(540px - 48px) !important; height: calc(540px - 48px) !important; }',
      ].join('\n')
    : '';
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; }
    body { font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background: linear-gradient(145deg, ${frameStart}, ${frameEnd}); color: ${textColor}; overflow: ${isPreview ? 'hidden' : 'auto'}; padding: ${isPreview ? '0' : '8px'}; ${isPreview ? 'display:flex;align-items:flex-start;justify-content:flex-start;' : ''} }
    .preview-stage { width: 960px; height: 540px; transform-origin: top left; transform: scale(min(calc(100vw / 960), calc(100vh / 540))); }
    .slide-root { ${isPreview ? 'width: 960px; height: 540px;' : 'width: 100%; min-height: 100vh;'} box-sizing: border-box; border-radius: ${radius}; overflow: hidden; background: #ffffff; border: 1px solid ${isDark ? 'rgba(96, 165, 250, 0.5)' : 'rgba(37, 99, 235, 0.25)'}; }
${previewOverrides}
  </style>
</head>
<body>
  ${stageOpen}<div class="slide-root">${html}</div>${stageClose}
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXT EDITOR UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function maskSlideBlocks(slideHtml = '') {
  let maskedHtml = String(slideHtml || '');
  const blocks = [];
  const mask = (pattern) => {
    maskedHtml = maskedHtml.replace(pattern, (match) => {
      const key = `__PPT_BLOCK_${blocks.length}__`;
      blocks.push({ key, match });
      return key;
    });
  };
  mask(/<style\b[^>]*>[\s\S]*?<\/style>/gi);
  mask(/<script\b[^>]*>[\s\S]*?<\/script>/gi);
  mask(/<div\s+class="ppt-source"[^>]*>[\s\S]*?<\/div>/gi);
  return { maskedHtml, blocks };
}

function unmaskSlideBlocks(maskedHtml = '', blocks = []) {
  let restored = String(maskedHtml || '');
  for (const block of blocks) {
    restored = restored.replace(block.key, block.match);
  }
  return restored;
}

function extractEditableTextSegments(slideHtml = '') {
  const extractedSource = extractTemplateContent(slideHtml);
  const sourceHtml = extractedSource || sanitizeSlideMarkupContent(slideHtml);
  const { maskedHtml } = maskSlideBlocks(sourceHtml);
  const segments = [];
  let editableIndex = 0;

  maskedHtml.replace(/>([^<]+)</g, (_, rawText) => {
    const text = normalizeWhitespace(rawText || '');
    if (!text) return _;
    segments.push({
      id: `txt-${editableIndex}`,
      text,
    });
    editableIndex += 1;
    return _;
  });

  return segments;
}

function applyEditableTextSegments(sourceHtml = '', textSegments = []) {
  const { maskedHtml, blocks } = maskSlideBlocks(sourceHtml);
  const queue = Array.isArray(textSegments)
    ? textSegments.map((item) => String(item?.text || ''))
    : [];
  let cursor = 0;

  const replaced = maskedHtml.replace(/>([^<]+)</g, (fullMatch, rawText) => {
    const originalText = normalizeWhitespace(rawText || '');
    if (!originalText) return fullMatch;
    const nextText = cursor < queue.length ? queue[cursor] : originalText;
    cursor += 1;
    return `>${escapeHtml(nextText)}<`;
  });

  return sanitizeSlideMarkupContent(unmaskSlideBlocks(replaced, blocks));
}

function SortableSlideThumbnail({ id, index, slide, theme, tone, isActive, onSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-44 flex-shrink-0 rounded-lg border p-1.5 transition-colors ${
        isActive
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          className="relative w-full pt-[56.25%] rounded-md overflow-hidden border border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-slate-900/70"
        >
          <iframe
            title={`thumb-slide-${index + 1}`}
            srcDoc={buildSlideDoc(slide, theme, tone, true)}
            sandbox="allow-same-origin"
            className="absolute inset-0 w-full h-full bg-transparent pointer-events-none"
          />
          <span className="absolute top-1 left-1 text-[10px] font-bold bg-black/65 text-white rounded px-1.5 py-0.5">
            {index + 1}
          </span>
        </button>
        <button
          type="button"
          aria-label={`슬라이드 ${index + 1} 순서 변경`}
          {...attributes}
          {...listeners}
          className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      </div>
      <button
        type="button"
        onClick={onSelect}
        className={`mt-1.5 w-full truncate text-[11px] text-left px-1 ${
          isActive ? 'text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-600 dark:text-gray-300'
        }`}
      >
        슬라이드 {index + 1}
      </button>
    </div>
  );
}

function ChartDataEditorModal({ slideIndex, slideHtml, theme, tone, templateId, totalSlides, onSave, onClose }) {
  const initialPoints = parseSlideSemantics(slideHtml).chartPoints || [];
  const [points, setPoints] = useState(initialPoints.map((p) => ({ ...p })));
  const [saving, setSaving] = useState(false);

  const updatePoint = (idx, field, value) => {
    setPoints((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: field === 'value' ? Number(value) || 0 : value } : p));
  };

  const addRow = () => {
    setPoints((prev) => [...prev, { label: `항목 ${prev.length + 1}`, value: 50, unit: 'number' }]);
  };

  const removeRow = (idx) => {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    setSaving(true);
    const sourceContent = extractTemplateContent(slideHtml) || sanitizeSlideMarkupContent(slideHtml);
    const colorOverrides = extractSlideColorOverrides(slideHtml, theme, tone, templateId);
    const chartModeOverride = extractSlideChartMode(slideHtml);
    const slideUid = extractSlideUid(slideHtml) || createSlideUid();
    const validPoints = points.filter((p) => p.label && Number.isFinite(p.value));
    const newSlideHtml = buildPresetSlideHtml(
      sourceContent, theme, tone, slideIndex, totalSlides,
      colorOverrides, templateId, chartModeOverride, slideUid,
      validPoints.length >= 2 ? validPoints : null
    );
    onSave(slideIndex, newSlideHtml);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-full max-w-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">차트 데이터 편집 — 슬라이드 {slideIndex + 1}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">레이블과 수치를 수정하면 차트가 자동으로 재계산됩니다.</p>
        <div className="overflow-auto max-h-64">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-200">레이블</th>
                <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-200">수치</th>
                <th className="text-left p-2 font-semibold text-gray-700 dark:text-gray-200">단위</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {points.map((pt, i) => (
                <tr key={i} className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-1">
                    <input
                      className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={pt.label}
                      onChange={(e) => updatePoint(i, 'label', e.target.value)}
                    />
                  </td>
                  <td className="p-1">
                    <input
                      type="number"
                      className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={pt.value}
                      onChange={(e) => updatePoint(i, 'value', e.target.value)}
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      value={pt.unit || 'number'}
                      onChange={(e) => updatePoint(i, 'unit', e.target.value)}
                    >
                      <option value="number">숫자</option>
                      <option value="percent">%</option>
                    </select>
                  </td>
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-xs text-rose-500 hover:text-rose-700 px-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
        >
          <Plus className="h-3 w-3" /> 항목 추가
        </button>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || points.filter((p) => Number.isFinite(p.value)).length < 2}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}


function SortableDoneSlideCard({
  id,
  index,
  slide,
  slideCount,
  chartMode,
  theme,
  tone,
  previewThemeClass,
  isActive,
  regenerating,
  onSelect,
  onOpenSlideshow,
  onOpenWysiwyg,
  onDuplicate,
  onDelete,
  onChartModeChange,
  onOpenRegenerate,
  onOpenChartEditor,
  setCardRef,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };
  const supportsChartControl = /data-layout="metrics/i.test(String(slide || ''));

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        if (typeof setCardRef === 'function') setCardRef(node);
      }}
      style={style}
      className={`border rounded-xl p-3 shadow-sm ${previewThemeClass} ${isActive ? 'ring-2 ring-blue-400/70' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={`슬라이드 ${index + 1} 순서 변경`}
            {...attributes}
            {...listeners}
            className="text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white/90 dark:bg-slate-900/70 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-3 w-3" />
          </button>
          <span className="text-xs font-semibold text-white/70 px-1">{index + 1} / {slideCount}</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <button
            onClick={onOpenSlideshow}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
          >
            ⛶ 전체화면
          </button>
          <button
            onClick={onOpenWysiwyg}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
          >
            <Pencil className="h-3 w-3" /> 편집
          </button>
          <button
            onClick={onDuplicate}
            className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-1"
          >
            <Copy className="h-3 w-3" /> 복제
          </button>
          <button
            onClick={onDelete}
            className="text-xs px-2 py-1 rounded border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> 삭제
          </button>
          {supportsChartControl ? (
            <select
              value={chartMode || 'auto'}
              onChange={(event) => {
                if (typeof onChartModeChange === 'function') onChartModeChange(event.target.value);
              }}
              className="text-xs px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-white/90 dark:bg-slate-900/70"
            >
              <option value="auto">차트 자동</option>
              <option value="bar">막대</option>
              <option value="line">꺾은선</option>
              <option value="donut">원형</option>
            </select>
          ) : null}
          {supportsChartControl ? (
            <button
              type="button"
              onClick={() => { if (typeof onOpenChartEditor === 'function') onOpenChartEditor(); }}
              className="text-xs px-2 py-1 rounded border border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" /> 데이터 편집
            </button>
          ) : null}
          <button
            onClick={onOpenRegenerate}
            disabled={regenerating}
            className="text-xs px-2 py-1 rounded border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-1 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} /> 재생성
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onSelect}
        className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border border-blue-200/80 dark:border-blue-400/40 bg-white/80 dark:bg-slate-900/70 backdrop-blur-sm text-left"
      >
        <iframe
          title={`slide-${index + 1}`}
          srcDoc={buildSlideDoc(slide, theme, tone, true)}
          sandbox="allow-same-origin"
          className="absolute inset-0 w-full h-full bg-transparent pointer-events-none"
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PPTMaker({ sidebarMenu = 'ppt-compose', onRequestSidebarMenuChange = null }) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [topic, setTopic] = useState('');
  const [brief, setBrief] = useState('');
  const [slideCount, setSlideCount] = useState(8);
  const [theme, setTheme] = useState('light');
  const [tone, setTone] = useState('business');
  const [templatePresetId, setTemplatePresetId] = useState('light-business-classic');
  const [allowUserModelOverride, setAllowUserModelOverride] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [modelOptions, setModelOptions] = useState([]);

  // ── Step state ───────────────────────────────────────────────────────────────
  // 'input' | 'outline' | 'generating' | 'done'
  const [step, setStep] = useState('input');

  // ── Outline state ────────────────────────────────────────────────────────────
  const [outlineSlides, setOutlineSlides] = useState([]);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [generationHistory, setGenerationHistory] = useState([]);

  // ── Generation state ─────────────────────────────────────────────────────────
  const [rawHtml, setRawHtml] = useState('');
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedCount, setGeneratedCount] = useState(0);
  const [displayedCount, setDisplayedCount] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // ── WYSIWYG Edit state ─────────────────────────────────────────────────────
  const [wysiwygIndex, setWysiwygIndex] = useState(-1);
  const wysiwygIframeRef = useRef(null);
  const [wysiwygColors, setWysiwygColors] = useState({ canvasStart: '#eff6ff', canvasEnd: '#bfdbfe', accentBg: '#2563eb' });
  const [wysiwygToolbar, setWysiwygToolbar] = useState({ bold: false, italic: false, underline: false });
  const [regenerateIndex, setRegenerateIndex] = useState(-1);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [rewritePreset, setRewritePreset] = useState('none');
  const [regeneratingIndex, setRegeneratingIndex] = useState(-1);

  // ── Slideshow state ───────────────────────────────────────────────────────────
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // ── Print modal state ─────────────────────────────────────────────────────────
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [chartEditorOpen, setChartEditorOpen] = useState(false);
  const [chartEditorSlideIdx, setChartEditorSlideIdx] = useState(-1);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const slidesRef = useRef(null);
  const slideCardRefs = useRef([]);

  const canGenerateOutline = topic.trim().length > 0 && !outlineLoading && !loading;
  const isHistoryMenu = sidebarMenu === 'ppt-history';
  const selectedTemplate = getTemplatePreset(theme, tone, templatePresetId);
  const selectedTemplateId = selectedTemplate.id;

  const slideDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const printSlides = useMemo(
    () => slides.map((slide, index) => ({ key: `${index}-${slide.length}`, html: slide })),
    [slides]
  );

  const slideStableIds = useMemo(() => {
    const used = new Set();
    return slides.map((slide, index) => {
      const parsed = extractSlideUid(slide) || `legacy-${simpleStringHash(slide).toString(36)}`;
      const unique = used.has(parsed) ? `${parsed}-${index}` : parsed;
      used.add(unique);
      return unique;
    });
  }, [slides]);

  const slideChartModes = useMemo(
    () => slides.map((slide) => extractSlideChartMode(slide) || ''),
    [slides]
  );

  // ── Preset handlers ──────────────────────────────────────────────────────────
  const applyPresetToCurrentSlides = (nextTheme, nextTone, nextPresetId) => {
    if (slides.length === 0) return;
    const recoloredSlides = reapplyTemplatePresetOnSlides(slides, nextTheme, nextTone, nextPresetId);
    if (recoloredSlides.length === 0) return;
    setSlides(recoloredSlides);
    setRawHtml(recoloredSlides.join(`\n${SLIDE_BREAK}\n`));
  };

  const handleTemplatePresetClick = (preset) => {
    const nextTheme = preset.theme;
    const nextTone = preset.tone;
    const nextPresetId = preset.id;
    setTheme(nextTheme);
    setTone(nextTone);
    setTemplatePresetId(nextPresetId);
    applyPresetToCurrentSlides(nextTheme, nextTone, nextPresetId);
  };

  const updateOutlineSlide = (index, updater) => {
    setOutlineSlides((prev) => {
      const next = [...prev];
      const current = next[index] || { title: `슬라이드 ${index + 1}`, description: '', keyPoints: [] };
      next[index] = typeof updater === 'function' ? updater(current) : current;
      return next;
    });
  };

  const saveCurrentRunToHistory = (nextSlides, nextOutline) => {
    if (!Array.isArray(nextSlides) || nextSlides.length === 0) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      topic,
      brief,
      slideCount,
      theme,
      tone,
      templatePresetId: selectedTemplateId,
      selectedModel,
      outlineSlides: nextOutline,
      slides: nextSlides,
    };
    setGenerationHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_PPT_HISTORY_ITEMS);
      savePptHistoryToStorage(next);
      return next;
    });
  };

  const applyHistoryRun = (entry) => {
    if (!entry || !Array.isArray(entry.slides) || entry.slides.length === 0) return;
    const restoredTheme = entry.theme === 'dark' ? 'dark' : 'light';
    const restoredTone = entry.tone === 'casual' ? 'casual' : 'business';
    const restoredPresetId = pickPresetIdByThemeTone(
      restoredTheme,
      restoredTone,
      String(entry.templatePresetId || '')
    );
    setTopic(String(entry.topic || ''));
    setBrief(String(entry.brief || ''));
    setTheme(restoredTheme);
    setTone(restoredTone);
    setTemplatePresetId(restoredPresetId);
    setSlideCount(Number(entry.slideCount) > 0 ? Number(entry.slideCount) : entry.slides.length);
    const restoredOutline = normalizeOutlineSlides(entry.outlineSlides || [], Number(entry.slideCount) || entry.slides.length);
    setOutlineSlides(restoredOutline);
    setSlides(Array.isArray(entry.slides) ? entry.slides : []);
    setRawHtml((Array.isArray(entry.slides) ? entry.slides : []).join(`\n${SLIDE_BREAK}\n`));
    setGeneratedCount((Array.isArray(entry.slides) ? entry.slides : []).length);
    setDisplayedCount((Array.isArray(entry.slides) ? entry.slides : []).length);
    setActiveSlideIndex(0);
    setError('');
    setStep('done');
    if (typeof onRequestSidebarMenuChange === 'function') {
      onRequestSidebarMenuChange('ppt-compose');
    }
  };

  // ── Settings ──────────────────────────────────────────────────────────────────
  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/webapp-ppt-generate', {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const settings = data?.settings || {};
      const defaultTheme = settings.defaultTheme === 'dark' ? 'dark' : 'light';
      const defaultTone = settings.defaultTone === 'casual' ? 'casual' : 'business';
      setSlideCount(Number(settings.defaultSlideCount || 8));
      setTheme(defaultTheme);
      setTone(defaultTone);
      setTemplatePresetId(pickPresetIdByThemeTone(defaultTheme, defaultTone));
      setAllowUserModelOverride(settings.allowUserModelOverride === true);
      setSelectedModel(settings.selectedModelId || '');
      setModelOptions(Array.isArray(data?.modelOptions) ? data.modelOptions : []);
    } catch {}
  };

  // ── Outline generation ────────────────────────────────────────────────────────
  const handleGenerateOutline = async () => {
    if (!canGenerateOutline) return;
    setOutlineLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/webapp-ppt-outline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({ topic, brief, slideCount, theme, tone, model: selectedModel }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || '개요 생성에 실패했습니다.');
      }
      const data = await response.json();
      const fetchedSlides = normalizeOutlineSlides(data?.slides || [], slideCount);
      if (fetchedSlides.length === 0) throw new Error('개요를 생성하지 못했습니다. 다시 시도해 주세요.');
      setOutlineSlides(fetchedSlides);
      setStep('outline');
    } catch (e) {
      setError(e.message || '개요 생성 중 오류가 발생했습니다.');
    } finally {
      setOutlineLoading(false);
    }
  };

  const requestOneSlide = async ({ token, safeOutline, index, extraPrompt = '' }) => {
    const outline = safeOutline[index];
    const shouldRequestChart = shouldRequestChartFromOutline(outline);
    const perSlideTimeoutMs = 120000;
    const requestController = new AbortController();
    const requestTimeout = setTimeout(() => requestController.abort(), perSlideTimeoutMs);

    const oneSlideBrief = [
      brief ? `발표 추가 맥락: ${brief}` : '',
      `전체 슬라이드 수: ${safeOutline.length}`,
      `현재 생성 대상: ${index + 1} / ${safeOutline.length}`,
      `현재 슬라이드 제목: ${outline.title}`,
      `현재 슬라이드 설명: ${outline.description || '없음'}`,
      `현재 슬라이드 핵심 포인트: ${(outline.keyPoints || []).join(', ') || '없음'}`,
      outline.generationHint ? `이 슬라이드 추가 요구사항: ${outline.generationHint}` : '',
      extraPrompt ? `재생성 추가 지시: ${extraPrompt}` : '',
      '가능하면 본문에 항목명+수치를 함께 작성하세요. 예: <li>고객 만족도 82%</li>, <li>월간 활성 사용자 1200명</li>.',
      shouldRequestChart
        ? '이 슬라이드는 데이터 중심입니다. 본문 마지막에 간단한 인라인 SVG 차트(<svg>...</svg>)를 포함해도 됩니다. 스크립트/스타일 태그는 절대 사용하지 마세요.'
        : '',
      '중요: 현재 슬라이드 1장 분량의 본문 HTML만 생성하고, 다른 슬라이드 내용은 포함하지 마세요.',
    ].filter(Boolean).join('\n');

    try {
      const response = await fetch('/api/webapp-ppt-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        signal: requestController.signal,
        body: JSON.stringify({
          topic: `${topic} - 슬라이드 ${index + 1}`,
          brief: oneSlideBrief,
          slideCount: 1,
          theme,
          tone,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `슬라이드 ${index + 1} 생성에 실패했습니다.`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isSSE = contentType.includes('text/event-stream');

      let accumulated = '';
      if (!isSSE) {
        accumulated = await response.text();
      } else {
        const reader = response.body?.getReader();
        if (!reader) throw new Error(`슬라이드 ${index + 1} 응답 스트림을 읽을 수 없습니다.`);

        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith(':') || trimmedLine.startsWith('event:')) continue;
            const data = trimmedLine.startsWith('data:') ? trimmedLine.slice(5).trim() : trimmedLine;
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = extractStreamDelta(parsed);
              if (delta) accumulated += delta;
            } catch {
              const seq = parseJsonObjectSequence(data);
              const seqDelta = seq.map((item) => extractStreamDelta(item)).join('');
              if (seqDelta) accumulated += seqDelta;
            }
          }
        }

        if (buffer.trim()) {
          const tail = buffer.trim();
          if (!tail.startsWith(':') && !tail.startsWith('event:')) {
            const data = tail.startsWith('data:') ? tail.slice(5).trim() : tail;
            if (data && data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                const delta = extractStreamDelta(parsed);
                if (delta) accumulated += delta;
              } catch {
                const seq = parseJsonObjectSequence(data);
                const seqDelta = seq.map((item) => extractStreamDelta(item)).join('');
                if (seqDelta) accumulated += seqDelta;
              }
            }
          }
        }
      }

      const normalized = normalizeGeneratedHtml(accumulated);
      const oneSlideSource = splitSlidesLoosely(normalized, 1)[0] || normalized;
      const content = sanitizeSlideMarkupContent(oneSlideSource)
        || buildOutlineFallbackSource(outline, index);
      return buildPresetSlideHtml(content, theme, tone, index, safeOutline.length, null, selectedTemplateId, '', createSlideUid());
    } finally {
      clearTimeout(requestTimeout);
    }
  };

  // ── PPT generation ────────────────────────────────────────────────────────────
  const handleGeneratePPT = async () => {
    const startedAt = Date.now();
    const safeOutline = normalizeOutlineSlides(outlineSlides, slideCount);
    const builtSlides = [];

    setLoading(true);
    setStep('generating');
    setError('');
    setRawHtml('');
    setSlides([]);
    setGeneratedCount(0);
    setDisplayedCount(0);
    setGenerationStartedAt(startedAt);
    setElapsedMs(0);

    setOutlineSlides(safeOutline);

    try {
      const token = localStorage.getItem('token');
      for (let index = 0; index < safeOutline.length; index += 1) {
        const slideHtml = await requestOneSlide({ token, safeOutline, index });
        builtSlides.push(slideHtml);

        setSlides([...builtSlides]);
        setRawHtml(builtSlides.join(`\n${SLIDE_BREAK}\n`));
        setGeneratedCount(builtSlides.length);
        setDisplayedCount(builtSlides.length);
      }

      saveCurrentRunToHistory(builtSlides, safeOutline);
      setActiveSlideIndex(0);
      setStep('done');
    } catch (e) {
      const elapsedText = formatElapsedTime(Date.now() - startedAt);
      const timeoutText = formatElapsedTime(120000);
      setError(
        e?.name === 'AbortError'
          ? `PPT 생성 시간이 초과되었습니다. 모델 서버 상태를 확인한 뒤 다시 시도해 주세요. (경과 시간: ${elapsedText}, 페이지당 허용 시간: ${timeoutText})`
          : (e.message || '슬라이드 생성 중 오류가 발생했습니다.')
      );
      if (builtSlides.length > 0) {
        saveCurrentRunToHistory(builtSlides, safeOutline);
        setSlides([...builtSlides]);
        setRawHtml(builtSlides.join(`\n${SLIDE_BREAK}\n`));
        setGeneratedCount(builtSlides.length);
        setDisplayedCount(builtSlides.length);
        setActiveSlideIndex(0);
        setStep('done');
      } else {
        setStep('outline');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Text editor ───────────────────────────────────────────────────────────────
  // ── WYSIWYG Editor ────────────────────────────────────────────
  const handleOpenWysiwyg = (index) => {
    const colorOverrides = extractSlideColorOverrides(slides[index] || '', theme, tone, selectedTemplateId);
    setWysiwygColors(colorOverrides);
    setWysiwygIndex(index);
  };

  const handleWysiwygIframeLoad = () => {
    const iframe = wysiwygIframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.querySelector('.ppt-source')?.remove();
    doc.designMode = 'on';
    try { doc.execCommand('styleWithCSS', false, true); } catch {}
    doc.addEventListener('selectionchange', () => {
      try {
        setWysiwygToolbar({
          bold: doc.queryCommandState('bold'),
          italic: doc.queryCommandState('italic'),
          underline: doc.queryCommandState('underline'),
        });
      } catch {}
    });
  };

  const applyWysiwygCommand = (command, value) => {
    const doc = wysiwygIframeRef.current?.contentDocument;
    if (!doc) return;
    try {
      doc.execCommand(command, false, value ?? null);
      setWysiwygToolbar({
        bold: doc.queryCommandState('bold'),
        italic: doc.queryCommandState('italic'),
        underline: doc.queryCommandState('underline'),
      });
    } catch {}
  };

  const handleWysiwygColorChange = (key, value) => {
    const newColors = { ...wysiwygColors, [key]: value };
    setWysiwygColors(newColors);
    const doc = wysiwygIframeRef.current?.contentDocument;
    if (!doc) return;
    const shell = doc.querySelector('[data-color-canvas-start]');
    if (shell) {
      shell.setAttribute('data-color-canvas-start', newColors.canvasStart);
      shell.setAttribute('data-color-canvas-end', newColors.canvasEnd);
      shell.setAttribute('data-color-accent-bg', newColors.accentBg);
    }
    let overrideEl = doc.getElementById('wysiwyg-color-override');
    if (!overrideEl) {
      overrideEl = doc.createElement('style');
      overrideEl.id = 'wysiwyg-color-override';
      doc.head?.appendChild(overrideEl);
    }
    overrideEl.textContent = [
      `.ppt-slide { background: linear-gradient(152deg, ${newColors.canvasStart}, ${newColors.canvasEnd}) !important; }`,
      `.ppt-cta, .ppt-item-check { background: ${newColors.accentBg} !important; }`,
    ].join('\n');
  };

  const handleSaveWysiwyg = () => {
    const doc = wysiwygIframeRef.current?.contentDocument;
    if (!doc || wysiwygIndex < 0) return;
    const slideRoot = doc.querySelector('.slide-root');
    if (!slideRoot) return;
    const shell = slideRoot.querySelector('[data-color-canvas-start]');
    if (shell) {
      shell.setAttribute('data-color-canvas-start', wysiwygColors.canvasStart);
      shell.setAttribute('data-color-canvas-end', wysiwygColors.canvasEnd);
      shell.setAttribute('data-color-accent-bg', wysiwygColors.accentBg);
    }
    slideRoot.querySelector('#wysiwyg-color-override')?.remove();
    const newSlideHtml = slideRoot.innerHTML;
    const currentSlide = slides[wysiwygIndex] || '';
    const detectedChartMode = extractSlideChartMode(newSlideHtml) || extractSlideChartMode(currentSlide);
    const slideUid = extractSlideUid(currentSlide) || extractSlideUid(newSlideHtml) || createSlideUid();
    const shouldRebuildChart = Boolean(detectedChartMode) || /data-layout="metrics/i.test(newSlideHtml) || /ppt-chart-shell/i.test(newSlideHtml);

    const rebuiltSlide = shouldRebuildChart
      ? buildPresetSlideHtml(
          extractTemplateContent(newSlideHtml) || sanitizeSlideMarkupContent(newSlideHtml),
          theme,
          tone,
          wysiwygIndex,
          slides.length,
          {
            canvasStart: normalizeHexColor(wysiwygColors.canvasStart, '#eff6ff'),
            canvasEnd: normalizeHexColor(wysiwygColors.canvasEnd, '#bfdbfe'),
            accentBg: normalizeHexColor(wysiwygColors.accentBg, '#2563eb'),
          },
          selectedTemplateId,
          detectedChartMode,
          slideUid
        )
      : newSlideHtml;

    const next = [...slides];
    next[wysiwygIndex] = rebuiltSlide;
    setSlides(next);
    setRawHtml(next.join(`\n${SLIDE_BREAK}\n`));
    saveCurrentRunToHistory(next, normalizeOutlineSlides(outlineSlides, next.length || slideCount));
    setWysiwygIndex(-1);
  };

  const handleRegenerateSlide = async () => {
    if (regenerateIndex < 0) return;
    const index = regenerateIndex;
    const presetInstruction = getRewritePresetInstruction(rewritePreset);
    const effectivePrompt = [presetInstruction, String(regeneratePrompt || '').trim()]
      .filter(Boolean)
      .join('\n');
    const safeOutline = normalizeOutlineSlides(outlineSlides, slides.length || slideCount);
    const nextOutline = [...safeOutline];
    nextOutline[index] = {
      ...nextOutline[index],
      generationHint: effectivePrompt,
    };
    setOutlineSlides(nextOutline);

    try {
      const token = localStorage.getItem('token');
      setRegeneratingIndex(index);
      setError('');
      const slideHtml = await requestOneSlide({
        token,
        safeOutline: nextOutline,
        index,
        extraPrompt: effectivePrompt,
      });

      const nextSlides = [...slides];
      nextSlides[index] = slideHtml;
      setSlides(nextSlides);
      setRawHtml(nextSlides.join(`\n${SLIDE_BREAK}\n`));
      saveCurrentRunToHistory(nextSlides, nextOutline);
      setRegenerateIndex(-1);
      setRegeneratePrompt('');
      setRewritePreset('none');
    } catch (e) {
      setError(e.message || `슬라이드 ${index + 1} 재생성 중 오류가 발생했습니다.`);
    } finally {
      setRegeneratingIndex(-1);
    }
  };

  const handleChartModeChange = (index, modeValue) => {
    if (index < 0 || index >= slides.length) return;
    const currentSlide = slides[index];
    if (!currentSlide) return;

    const extractedContent = extractTemplateContent(currentSlide) || sanitizeSlideMarkupContent(currentSlide);
    const finalContent = extractedContent || '<h2>슬라이드 내용을 생성하지 못했습니다.</h2><p>다시 생성해 주세요.</p>';
    const colorOverrides = extractSlideColorOverrides(currentSlide, theme, tone, selectedTemplateId);
    const chartModeOverride = normalizeChartMode(modeValue);
    const slideUid = extractSlideUid(currentSlide) || createSlideUid();

    const rebuiltSlide = buildPresetSlideHtml(
      finalContent,
      theme,
      tone,
      index,
      slides.length,
      colorOverrides,
      selectedTemplateId,
      chartModeOverride,
      slideUid
    );

    const nextSlides = [...slides];
    nextSlides[index] = rebuiltSlide;
    setSlides(nextSlides);
    setRawHtml(nextSlides.join(`\n${SLIDE_BREAK}\n`));
    saveCurrentRunToHistory(nextSlides, normalizeOutlineSlides(outlineSlides, nextSlides.length || slideCount));
    setError('');
  };

  const scrollToSlideCard = (index) => {
    const bounded = Math.max(0, Math.min(index, slides.length - 1));
    setActiveSlideIndex(bounded);
    const target = slideCardRefs.current[bounded];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSlideDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;

    const resolveSlideIndex = (id) => {
      const raw = String(id ?? '').trim();
      if (!raw) return -1;
      const normalized = raw
        .replace(/^slide-thumb-/, '')
        .replace(/^slide-card-/, '');
      return slideStableIds.findIndex((candidate) => candidate === normalized);
    };

    const fromIndex = resolveSlideIndex(active.id);
    const toIndex = resolveSlideIndex(over.id);
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= slides.length || toIndex >= slides.length) return;

    const movedSlides = arrayMove(slides, fromIndex, toIndex);
    const nextSlides = reapplyTemplatePresetOnSlides(movedSlides, theme, tone, selectedTemplateId);
    const safeOutline = normalizeOutlineSlides(outlineSlides, slides.length || slideCount);
    const nextOutline = arrayMove(safeOutline, fromIndex, toIndex);

    setSlides(nextSlides);
    setOutlineSlides(nextOutline);
    setRawHtml(nextSlides.join(`\n${SLIDE_BREAK}\n`));
    setActiveSlideIndex(remapIndexAfterMove(activeSlideIndex, fromIndex, toIndex));
    setSlideshowIndex((prev) => remapIndexAfterMove(prev, fromIndex, toIndex));

    if (wysiwygIndex >= 0) {
      setWysiwygIndex(remapIndexAfterMove(wysiwygIndex, fromIndex, toIndex));
    }
    if (regenerateIndex >= 0) {
      setRegenerateIndex(remapIndexAfterMove(regenerateIndex, fromIndex, toIndex));
    }

    saveCurrentRunToHistory(nextSlides, nextOutline);
  };

  const handleDuplicateSlide = (index) => {
    if (slides.length >= 30) {
      setError('슬라이드는 최대 30장까지 편집할 수 있습니다.');
      return;
    }
    const baseSlide = slides[index];
    if (!baseSlide) return;

    const safeOutline = normalizeOutlineSlides(outlineSlides, slides.length || slideCount);
    const sourceOutline = safeOutline[index] || { title: `슬라이드 ${index + 1}`, description: '', keyPoints: [] };
    const duplicatedOutline = {
      ...sourceOutline,
      keyPoints: [...(Array.isArray(sourceOutline.keyPoints) ? sourceOutline.keyPoints : [])],
    };

    const nextSlides = [...slides];
    nextSlides.splice(index + 1, 0, baseSlide);
    const nextOutline = [...safeOutline];
    nextOutline.splice(index + 1, 0, duplicatedOutline);

    const normalizedSlides = reapplyTemplatePresetOnSlides(nextSlides, theme, tone, selectedTemplateId);

    setSlides(normalizedSlides);
    setOutlineSlides(nextOutline);
    setRawHtml(normalizedSlides.join(`\n${SLIDE_BREAK}\n`));
    setSlideCount(normalizedSlides.length);
    setGeneratedCount(normalizedSlides.length);
    setDisplayedCount(normalizedSlides.length);
    setActiveSlideIndex(index + 1);
    setError('');

    saveCurrentRunToHistory(normalizedSlides, nextOutline);
  };

  const handleDeleteSlide = (index) => {
    if (slides.length <= 1) {
      setError('슬라이드는 최소 1장 이상 유지되어야 합니다.');
      return;
    }

    const nextSlides = slides.filter((_, i) => i !== index);
    const safeOutline = normalizeOutlineSlides(outlineSlides, slides.length || slideCount);
    const nextOutline = safeOutline.filter((_, i) => i !== index);

    const normalizedSlides = reapplyTemplatePresetOnSlides(nextSlides, theme, tone, selectedTemplateId);

    setSlides(normalizedSlides);
    setOutlineSlides(nextOutline);
    setRawHtml(normalizedSlides.join(`\n${SLIDE_BREAK}\n`));
    setSlideCount(normalizedSlides.length);
    setGeneratedCount(normalizedSlides.length);
    setDisplayedCount(normalizedSlides.length);
    setActiveSlideIndex((prev) => {
      if (prev > index) return prev - 1;
      if (prev === index) return Math.max(0, prev - 1);
      return prev;
    });
    setSlideshowIndex((prev) => {
      if (prev > index) return prev - 1;
      if (prev === index) return Math.max(0, prev - 1);
      return prev;
    });

    if (wysiwygIndex === index) {
      setWysiwygIndex(-1);
    } else if (wysiwygIndex > index) {
      setWysiwygIndex(wysiwygIndex - 1);
    }

    if (regenerateIndex === index) {
      setRegenerateIndex(-1);
      setRegeneratePrompt('');
      setRewritePreset('none');
    } else if (regenerateIndex > index) {
      setRegenerateIndex(regenerateIndex - 1);
    }

    setError('');
    saveCurrentRunToHistory(normalizedSlides, nextOutline);
  };

  // ── Print ─────────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (slides.length === 0) return;
    let cleaned = false;
    const cleanupPrintMode = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('ppt-print-mode', 'ppt-print-dark');
      window.removeEventListener('afterprint', cleanupPrintMode);
    };
    document.body.classList.add('ppt-print-mode');
    if (theme === 'dark') document.body.classList.add('ppt-print-dark');
    window.addEventListener('afterprint', cleanupPrintMode);
    window.print();
    setTimeout(cleanupPrintMode, 10000);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (typeof onRequestSidebarMenuChange === 'function') {
      onRequestSidebarMenuChange('ppt-compose');
    }
    setStep('input');
    setOutlineSlides([]);
    setRawHtml('');
    setSlides([]);
    setError('');
    setGeneratedCount(0);
    setDisplayedCount(0);
    setGenerationStartedAt(0);
    setElapsedMs(0);
    setWysiwygIndex(-1);
    setRegenerateIndex(-1);
    setRegeneratePrompt('');
    setRewritePreset('none');
    setRegeneratingIndex(-1);
    setActiveSlideIndex(0);
    slideCardRefs.current = [];
  };

  // ── Slideshow handlers ──────────────────────────────────────────────────────────────
  const openSlideshow = (index) => {
    setActiveSlideIndex(index);
    setSlideshowIndex(index);
    setSlideshowOpen(true);
  };

  // ── Print modal: new window print ─────────────────────────────────────────────
  const handlePrintAll = () => {
    if (slides.length === 0) return;
    const isDark = theme === 'dark';
    const frameStart = isDark ? '#0f172a' : '#eff6ff';
    const frameEnd = isDark ? '#1e3a8a' : '#bfdbfe';
    const radius = tone === 'casual' ? '20px' : '10px';
    const slidesHtml = slides
      .map(
        (slide) =>
          `<div class="print-slide"><div style="width:100%;height:100%;border-radius:${radius};overflow:hidden;background:#fff;border:1px solid ${isDark ? 'rgba(96,165,250,0.5)' : 'rgba(37,99,235,0.25)'}">${slide}</div></div>`
      )
      .join('');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; background: #fff; }
  .print-slide {
    width: 100%;
    height: 100vh;
    padding: 8px;
    background: linear-gradient(145deg, ${frameStart}, ${frameEnd});
    break-after: page;
    page-break-after: always;
    break-inside: avoid;
    page-break-inside: avoid;
    display: flex;
    align-items: stretch;
  }
  .print-slide:last-child { break-after: auto; page-break-after: auto; }
  @page { size: landscape; margin: 0; }
</style>
</head>
<body>${slidesHtml}</body>
</html>`);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  // ── Auto-scroll when done ─────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 'done' && slides.length > 0) {
      setTimeout(() => slidesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }, [step, slides.length]);

  useEffect(() => {
    loadSettings();
    setGenerationHistory(loadPptHistoryFromStorage());
  }, []);

  useEffect(() => {
    if (step !== 'generating') {
      setDisplayedCount(generatedCount);
      return;
    }
    if (displayedCount >= generatedCount) return;
    const timer = setTimeout(() => {
      setDisplayedCount((prev) => Math.min(prev + 1, generatedCount));
    }, 220);
    return () => clearTimeout(timer);
  }, [step, generatedCount, displayedCount]);

  useEffect(() => {
    if (step !== 'generating' || !generationStartedAt) return;
    const update = () => setElapsedMs(Date.now() - generationStartedAt);
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [step, generationStartedAt]);

  useEffect(() => {
    if (slides.length === 0) {
      setActiveSlideIndex(0);
      slideCardRefs.current = [];
      return;
    }
    setActiveSlideIndex((prev) => Math.min(prev, slides.length - 1));
    slideCardRefs.current = slideCardRefs.current.slice(0, slides.length);
  }, [slides.length]);

  // ── Slideshow keyboard navigation ────────────────────────────────────────────
  useEffect(() => {
    if (!slideshowOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setSlideshowOpen(false);
      if (e.key === 'ArrowRight') setSlideshowIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setSlideshowIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slideshowOpen, slides.length]);

  // ─────────────────────────────────────────────────────────────────────────────
  // TEMPLATE PREVIEW CARD (inline styles matching TEMPLATE_STYLE_TOKENS)
  // ─────────────────────────────────────────────────────────────────────────────
  const renderTemplatePreview = (preset, isActive, onClick) => {
    const tokens = TEMPLATE_STYLE_TOKENS[preset.id];
    return (
      <button
        key={preset.id}
        type="button"
        onClick={onClick}
        className={`text-left border rounded-xl p-3 transition-all hover:-translate-y-0.5 ${
          isActive
            ? 'border-blue-500 ring-2 ring-blue-300/70 shadow-lg bg-blue-50/70 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500/60 bg-white dark:bg-gray-800'
        }`}
      >
        {/* Thumbnail using actual token colors */}
        <div
          className="relative aspect-[16/9] rounded-lg overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${tokens.canvasStart}, ${tokens.canvasEnd})`,
            padding: '8px',
          }}
        >
          <div
            className="w-full h-full rounded-md p-2 flex flex-col justify-between"
            style={{
              background: tokens.shellBg,
              border: `1px solid ${tokens.shellBorder}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ background: tokens.accentBg, height: '5px', width: '20px', borderRadius: '999px', flexShrink: 0 }} />
              <span style={{ color: tokens.subColor, fontSize: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>
                {preset.caption}
              </span>
            </div>
            <div>
              <div style={{ color: tokens.titleColor, fontSize: '9px', fontWeight: 700, lineHeight: 1.3 }}>
                {preset.tone === 'business' ? 'Executive Summary' : 'Creative Brief'}
              </div>
              <div style={{ color: tokens.subColor, fontSize: '8px', marginTop: '2px' }}>
                {preset.theme === 'dark' ? 'Dark Blue UI' : 'Light Blue UI'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '3px' }}>
              <div style={{ background: tokens.accentBg, height: '4px', flex: 1, borderRadius: '999px' }} />
              <div style={{ background: tokens.neutral, opacity: 0.4, height: '4px', width: '12px', borderRadius: '999px' }} />
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
          <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
            preset.theme === 'light' ? 'bg-amber-100 text-amber-700' : 'bg-blue-200/30 text-blue-200'
          }`}>
            {preset.theme === 'light' ? 'L' : 'D'}
          </span>
          <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
            preset.tone === 'business'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-200'
              : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-200'
          }`}>
            {preset.tone === 'business' ? 'B' : 'C'}
          </span>
          <span className="text-xs font-semibold">{preset.label}</span>
        </div>
        <div className="text-[11px] mt-1 text-gray-500 dark:text-gray-400 leading-snug">
          {preset.description}
        </div>
      </button>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      {isHistoryMenu ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">생성 히스토리</h2>
          {generationHistory.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">저장된 히스토리가 없습니다.</div>
          ) : (
            <div className="space-y-2">
              {generationHistory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => applyHistoryRun(item)}
                  className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 hover:border-blue-300 dark:hover:border-blue-500"
                >
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{item.topic || '제목 없음'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(item.createdAt).toLocaleString('ko-KR')} · {item.slides?.length || 0}장 · {getTemplatePreset(item.theme || 'light', item.tone || 'business', item.templatePresetId || '').label}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* ── STEP: INPUT ──────────────────────────────────────────────────────── */}
      {step === 'input' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">주제</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                placeholder="예: 신한은행 2026 AI 전략"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                간단한 내용 <span className="text-gray-400 font-normal">(옵션)</span>
              </label>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder="예: 고객 맞춤형 AI 상담, 내부 업무 자동화, 리스크 관리 고도화"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">슬라이드 수</label>
              <input
                type="number"
                min={1}
                max={30}
                value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value || 1))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">테마</label>
              <select
                value={theme}
                onChange={(e) => {
                  const nextTheme = e.target.value;
                  const nextPresetId = pickPresetIdByThemeTone(nextTheme, tone, selectedTemplateId);
                  setTheme(nextTheme);
                  setTemplatePresetId(nextPresetId);
                  applyPresetToCurrentSlides(nextTheme, tone, nextPresetId);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="light">라이트</option>
                <option value="dark">다크</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">톤</label>
              <select
                value={tone}
                onChange={(e) => {
                  const nextTone = e.target.value;
                  const nextPresetId = pickPresetIdByThemeTone(theme, nextTone, selectedTemplateId);
                  setTone(nextTone);
                  setTemplatePresetId(nextPresetId);
                  applyPresetToCurrentSlides(theme, nextTone, nextPresetId);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="business">비즈니스</option>
                <option value="casual">캐주얼</option>
              </select>
            </div>

            {allowUserModelOverride && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">모델 선택 (관리자 허용 시)</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">기본 모델 사용</option>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id}>[{model.categoryLabel}] {model.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Template Preview */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  템플릿 미리보기 ({TEMPLATE_PRESETS.length}종)
                </label>
                <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                  선택됨: {selectedTemplate.label}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {TEMPLATE_PRESETS.map((preset) =>
                  renderTemplatePreview(
                    preset,
                    preset.id === selectedTemplateId,
                    () => handleTemplatePresetClick(preset)
                  )
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={handleGenerateOutline}
              disabled={!canGenerateOutline}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              {outlineLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              {outlineLoading ? '개요 생성 중...' : '생성'}
            </button>
            <button onClick={loadSettings} className="btn-secondary flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> 기본값 불러오기
            </button>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── STEP: OUTLINE ────────────────────────────────────────────────────── */}
      {step === 'outline' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">슬라이드 개요 확인</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  내용을 확인하고 필요하면 수정한 뒤 PPT를 생성하세요.
                </p>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  주제: <strong className="text-gray-600 dark:text-gray-300">{topic}</strong> | {outlineSlides.length}장 | {selectedTemplate.label}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => { setStep('input'); setError(''); }}
                  className="btn-secondary flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" /> 다시 설정
                </button>
                <button
                  onClick={handleGeneratePPT}
                  className="btn-primary flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" /> PPT 생성 진행
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Outline cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {outlineSlides.map((slide, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="flex-shrink-0 text-[11px] font-bold text-white bg-blue-600 rounded-full w-5 h-5 flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={slide.title}
                    onChange={(e) => updateOutlineSlide(idx, (current) => ({ ...current, title: e.target.value }))}
                    className="flex-1 text-sm font-semibold text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-400 focus:outline-none px-0.5 py-0.5 min-w-0"
                    placeholder="슬라이드 제목"
                  />
                </div>
                <div className="ml-7 mt-1.5 space-y-2">
                  <textarea
                    value={slide.description || ''}
                    onChange={(e) => updateOutlineSlide(idx, (current) => ({ ...current, description: e.target.value }))}
                    rows={2}
                    className="w-full text-xs text-gray-700 dark:text-gray-300 bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
                    placeholder="슬라이드 본문 요약(대본용)"
                  />

                  <textarea
                    value={slide.generationHint || ''}
                    onChange={(e) => updateOutlineSlide(idx, (current) => ({ ...current, generationHint: e.target.value }))}
                    rows={2}
                    className="w-full text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400"
                    placeholder="이 슬라이드 추가 요구사항 (선택): 예) 숫자 지표를 표 형태로 강조"
                  />

                  <div className="space-y-1.5">
                    {(Array.isArray(slide.keyPoints) ? slide.keyPoints : []).map((point, pi) => (
                      <div key={pi} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={point}
                          onChange={(e) =>
                            updateOutlineSlide(idx, (current) => {
                              const nextPoints = Array.isArray(current.keyPoints) ? [...current.keyPoints] : [];
                              nextPoints[pi] = e.target.value;
                              return { ...current, keyPoints: nextPoints };
                            })
                          }
                          className="flex-1 text-xs text-gray-700 dark:text-gray-300 bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400"
                          placeholder={`핵심 포인트 ${pi + 1}`}
                        />
                        <button
                          onClick={() =>
                            updateOutlineSlide(idx, (current) => ({
                              ...current,
                              keyPoints: (Array.isArray(current.keyPoints) ? current.keyPoints : []).filter((_, i) => i !== pi),
                            }))
                          }
                          className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        updateOutlineSlide(idx, (current) => ({
                          ...current,
                          keyPoints: [...(Array.isArray(current.keyPoints) ? current.keyPoints : []), ''],
                        }))
                      }
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> 포인트 추가
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button onClick={handleGeneratePPT} className="btn-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> PPT 생성 진행
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: GENERATING ─────────────────────────────────────────────────── */}
      {step === 'generating' && (
        <div className="space-y-4">
          {slides.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">완성된 페이지 미리보기</div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {slides.map((slide, idx) => {
                  const previewThemeClass = theme === 'dark'
                    ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 border-blue-400/40'
                    : 'bg-gradient-to-br from-blue-50 via-sky-100 to-blue-200 border-blue-300/70';
                  return (
                    <div key={`gen-${idx}`} className={`border rounded-xl p-3 shadow-sm ${previewThemeClass}`}>
                      <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border border-blue-200/80 dark:border-blue-400/40 bg-white/80 dark:bg-slate-900/70">
                        <iframe
                          title={`gen-slide-${idx + 1}`}
                          srcDoc={buildSlideDoc(slide, theme, tone, true)}
                          sandbox="allow-same-origin"
                          className="absolute inset-0 w-full h-full bg-transparent"
                        />
                        <div className="absolute top-2 right-2 bg-black/60 text-white text-[11px] font-bold px-2 py-0.5 rounded-full z-10 pointer-events-none select-none">
                          {idx + 1} / {slideCount}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-5">PPT 생성 중...</h2>

            {/* Progress steps */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400 font-medium whitespace-nowrap">개요 확인 완료</span>
              </div>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 min-w-4" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">슬라이드 생성 중</span>
              </div>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 min-w-4" />
              <div className="flex items-center gap-1.5 flex-shrink-0 opacity-35">
                <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                <span className="text-sm text-gray-400 whitespace-nowrap">완료</span>
              </div>
            </div>

            {/* Count & progress bar */}
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500 dark:text-gray-400">
                {displayedCount > 0
                  ? <><span className="font-semibold text-blue-600 dark:text-blue-400">{displayedCount}</span> / {slideCount}장 생성됨</>
                  : '슬라이드를 생성하고 있습니다...'}
              </span>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>경과 {formatElapsedTime(elapsedMs)}</span>
                {displayedCount > 0 && (
                  <span>{Math.round((displayedCount / slideCount) * 100)}%</span>
                )}
              </div>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${displayedCount > 0 ? Math.min(100, (displayedCount / slideCount) * 100) : 15}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: DONE — Slides shown first ──────────────────────────────────── */}
      {step === 'done' && slides.length > 0 && (
        <div ref={slidesRef} className="flex flex-col-reverse gap-4">
          {/* Control bar */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  총 {slides.length}장 생성 완료
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {topic} | {selectedTemplate.label}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> 다시 만들기
                </button>
                <button onClick={() => setPrintModalOpen(true)} disabled={slides.length === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-60">
                  <Download className="h-4 w-4" /> 인쇄 / PDF 저장
                </button>
              </div>
            </div>

            {/* Compact template switcher */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">템플릿 변경</div>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_PRESETS.map((preset) => {
                  const tokens = TEMPLATE_STYLE_TOKENS[preset.id];
                  const isActive = preset.id === selectedTemplateId;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleTemplatePresetClick(preset)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                      }`}
                    >
                      <div style={{ background: tokens.accentBg, width: '8px', height: '8px', borderRadius: '999px' }} />
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">슬라이드 썸네일 네비게이션</h3>
              <div className="text-xs text-gray-500 dark:text-gray-400">썸네일 드래그로 순서 변경</div>
            </div>
            <DndContext sensors={slideDndSensors} collisionDetection={closestCenter} onDragEnd={handleSlideDragEnd}>
              <SortableContext items={slideStableIds.map((id) => `slide-thumb-${id}`)} strategy={horizontalListSortingStrategy}>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {slides.map((slide, idx) => (
                    <SortableSlideThumbnail
                      key={`thumb-${slideStableIds[idx]}`}
                      id={`slide-thumb-${slideStableIds[idx]}`}
                      index={idx}
                      slide={slide}
                      theme={theme}
                      tone={tone}
                      isActive={activeSlideIndex === idx}
                      onSelect={() => scrollToSlideCard(idx)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">개요 / 발표 대본</h3>
            <div className="space-y-2">
              {normalizeOutlineSlides(outlineSlides, slides.length || slideCount).map((outline, idx) => (
                <div key={`script-${idx}`} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">{idx + 1}. {outline.title || `슬라이드 ${idx + 1}`}</div>
                  {outline.description ? (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap">{outline.description}</p>
                  ) : null}
                  {Array.isArray(outline.keyPoints) && outline.keyPoints.length > 0 ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {outline.keyPoints.map((point, pi) => (
                        <li key={pi} className="text-xs text-gray-500 dark:text-gray-400">- {point}</li>
                      ))}
                    </ul>
                  ) : null}
                  {outline.imagePrompt ? (
                    <div className="mt-1.5 flex items-start gap-1 text-xs text-gray-400 dark:text-gray-500">
                      <span className="flex-shrink-0">🖼️</span>
                      <span className="italic">{outline.imagePrompt}</span>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Slides grid */}
          <DndContext sensors={slideDndSensors} collisionDetection={closestCenter} onDragEnd={handleSlideDragEnd}>
            <SortableContext items={slideStableIds.map((id) => `slide-card-${id}`)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {slides.map((slide, idx) => {
                  const previewThemeClass = theme === 'dark'
                    ? 'bg-gradient-to-br from-slate-900 via-blue-950 to-blue-900 border-blue-400/40'
                    : 'bg-gradient-to-br from-blue-50 via-sky-100 to-blue-200 border-blue-300/70';

                  return (
                    <SortableDoneSlideCard
                      key={`slide-${slideStableIds[idx]}`}
                      id={`slide-card-${slideStableIds[idx]}`}
                      index={idx}
                      slide={slide}
                      slideCount={slides.length}
                      chartMode={slideChartModes[idx] || ''}
                      theme={theme}
                      tone={tone}
                      previewThemeClass={previewThemeClass}
                      isActive={activeSlideIndex === idx}
                      regenerating={regeneratingIndex === idx}
                      onSelect={() => setActiveSlideIndex(idx)}
                      onOpenSlideshow={() => { setActiveSlideIndex(idx); openSlideshow(idx); }}
                      onOpenWysiwyg={() => { setActiveSlideIndex(idx); handleOpenWysiwyg(idx); }}
                      onDuplicate={() => handleDuplicateSlide(idx)}
                      onDelete={() => handleDeleteSlide(idx)}
                      onChartModeChange={(value) => handleChartModeChange(idx, value)}
                      onOpenRegenerate={() => {
                        setActiveSlideIndex(idx);
                        setRegenerateIndex(idx);
                        setRegeneratePrompt(String(outlineSlides[idx]?.generationHint || ''));
                        setRewritePreset('none');
                      }}
                      onOpenChartEditor={() => {
                        setActiveSlideIndex(idx);
                        setChartEditorSlideIdx(idx);
                        setChartEditorOpen(true);
                      }}
                      setCardRef={(node) => { slideCardRefs.current[idx] = node; }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {chartEditorOpen && chartEditorSlideIdx >= 0 && slides[chartEditorSlideIdx] && (
        <ChartDataEditorModal
          slideIndex={chartEditorSlideIdx}
          slideHtml={slides[chartEditorSlideIdx]}
          theme={theme}
          tone={tone}
          templateId={selectedTemplateId}
          totalSlides={slides.length}
          onSave={(idx, newHtml) => {
            setSlides((prev) => prev.map((s, i) => i === idx ? newHtml : s));
          }}
          onClose={() => { setChartEditorOpen(false); setChartEditorSlideIdx(-1); }}
        />
      )}

      {regenerateIndex >= 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (regeneratingIndex >= 0) return;
              setRegenerateIndex(-1);
              setRegeneratePrompt('');
              setRewritePreset('none');
            }}
          />
          <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-full max-w-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">슬라이드 {regenerateIndex + 1} 재생성</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              이 슬라이드에만 추가 요구사항을 적용해 다시 생성합니다.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">AI 재작성 프리셋</label>
              <select
                value={rewritePreset}
                onChange={(e) => setRewritePreset(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {REWRITE_PRESET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <textarea
              rows={4}
              value={regeneratePrompt}
              onChange={(e) => setRegeneratePrompt(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="예: 핵심 숫자를 먼저 보여주고, 하단에는 간단한 액션 아이템 3개로 정리"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  if (regeneratingIndex >= 0) return;
                  setRegenerateIndex(-1);
                  setRegeneratePrompt('');
                  setRewritePreset('none');
                }}
                className="btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleRegenerateSlide}
                disabled={regeneratingIndex >= 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                {regeneratingIndex >= 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                재생성 실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WYSIWYG EDIT MODAL ─────────────────────────────────────────── */}
      {wysiwygIndex >= 0 && slides[wysiwygIndex] && (
        <div className="fixed inset-0 z-[55] bg-black flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap">
            <span className="text-white/50 text-xs font-medium mr-1 flex-shrink-0">슬라이드 {wysiwygIndex + 1} 편집</span>
            <div className="w-px h-4 bg-gray-600 flex-shrink-0" />
            <button
              onMouseDown={(e) => { e.preventDefault(); applyWysiwygCommand('bold'); }}
              className={`px-2 py-1 rounded text-sm font-bold flex-shrink-0 ${wysiwygToolbar.bold ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-gray-700'}`}
            >B</button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyWysiwygCommand('italic'); }}
              className={`px-2 py-1 rounded text-sm italic flex-shrink-0 ${wysiwygToolbar.italic ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-gray-700'}`}
            >I</button>
            <button
              onMouseDown={(e) => { e.preventDefault(); applyWysiwygCommand('underline'); }}
              className={`px-2 py-1 rounded text-sm underline flex-shrink-0 ${wysiwygToolbar.underline ? 'bg-blue-600 text-white' : 'text-white/70 hover:bg-gray-700'}`}
            >U</button>
            <div className="w-px h-4 bg-gray-600 flex-shrink-0" />
            <select
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => applyWysiwygCommand('fontSize', e.target.value)}
              defaultValue="3"
              className="text-xs bg-gray-800 text-white/80 border border-gray-600 rounded px-1.5 py-1 flex-shrink-0"
            >
              <option value="1">아주 작게</option>
              <option value="2">작게</option>
              <option value="3">보통</option>
              <option value="4">크게</option>
              <option value="5">아주 크게</option>
              <option value="6">특대</option>
            </select>
            <div className="w-px h-4 bg-gray-600 flex-shrink-0" />
            <label className="flex items-center gap-1 text-xs text-white/70 cursor-pointer flex-shrink-0">
              <span>글자색</span>
              <input
                type="color"
                defaultValue="#ffffff"
                onInput={(e) => applyWysiwygCommand('foreColor', e.target.value)}
                className="h-6 w-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-white/70 cursor-pointer flex-shrink-0">
              <span>하이라이트</span>
              <input
                type="color"
                defaultValue="#ffff00"
                onInput={(e) => applyWysiwygCommand('hiliteColor', e.target.value)}
                className="h-6 w-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
            <div className="w-px h-4 bg-gray-600 flex-shrink-0" />
            <label className="flex items-center gap-1 text-xs text-white/70 cursor-pointer flex-shrink-0">
              <span>배경 시작</span>
              <input
                type="color"
                value={normalizeHexColor(wysiwygColors.canvasStart, '#eff6ff')}
                onChange={(e) => handleWysiwygColorChange('canvasStart', normalizeHexColor(e.target.value, '#eff6ff'))}
                className="h-6 w-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-white/70 cursor-pointer flex-shrink-0">
              <span>배경 끝</span>
              <input
                type="color"
                value={normalizeHexColor(wysiwygColors.canvasEnd, '#bfdbfe')}
                onChange={(e) => handleWysiwygColorChange('canvasEnd', normalizeHexColor(e.target.value, '#bfdbfe'))}
                className="h-6 w-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-white/70 cursor-pointer flex-shrink-0">
              <span>강조색</span>
              <input
                type="color"
                value={normalizeHexColor(wysiwygColors.accentBg, '#2563eb')}
                onChange={(e) => handleWysiwygColorChange('accentBg', normalizeHexColor(e.target.value, '#2563eb'))}
                className="h-6 w-7 rounded border border-gray-600 bg-transparent cursor-pointer"
              />
            </label>
            <div className="flex-1" />
            <button
              onClick={() => setWysiwygIndex(-1)}
              className="px-3 py-1.5 rounded-lg border border-gray-600 text-white/70 hover:text-white hover:border-white/40 text-xs transition-colors flex-shrink-0"
            >취소</button>
            <button
              onClick={handleSaveWysiwyg}
              className="btn-primary text-xs flex-shrink-0"
            >저장</button>
          </div>
          {/* Editor iframe */}
          <div className="flex-1 overflow-hidden flex items-center justify-center">
            <iframe
              key={`wysiwyg-${wysiwygIndex}`}
              ref={wysiwygIframeRef}
              title={`wysiwyg-edit-${wysiwygIndex + 1}`}
              srcDoc={buildSlideDoc(slides[wysiwygIndex], theme, tone, true)}
              sandbox="allow-scripts allow-same-origin"
              onLoad={handleWysiwygIframeLoad}
              className="w-full h-full bg-transparent border-none"
            />
          </div>
        </div>
      )}

      {/* ── SLIDESHOW MODAL ───────────────────────────────────────────────────── */}
      {slideshowOpen && slides.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
            <span className="text-white/60 text-sm font-medium">
              {slideshowIndex + 1} / {slides.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSlideshowOpen(false); setActiveSlideIndex(slideshowIndex); handleOpenWysiwyg(slideshowIndex); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 flex items-center gap-1 transition-colors"
              >
                <Pencil className="h-3 w-3" /> 편집
              </button>
              <button
                onClick={() => setSlideshowOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
              >
                ✕ 닫기
              </button>
            </div>
          </div>

          {/* Slide area */}
          <div className="flex-1 relative overflow-hidden">
            <iframe
              key={`ss-${slideshowIndex}`}
              title={`slideshow-${slideshowIndex + 1}`}
              srcDoc={buildSlideDoc(slides[slideshowIndex], theme, tone, false)}
              sandbox="allow-same-origin"
              className="w-full h-full border-0"
            />

            {/* Left arrow */}
            {slideshowIndex > 0 && (
              <button
                onClick={() => setSlideshowIndex((i) => i - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg transition-colors"
              >
                ‹
              </button>
            )}

            {/* Right arrow */}
            {slideshowIndex < slides.length - 1 && (
              <button
                onClick={() => setSlideshowIndex((i) => i + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg transition-colors"
              >
                ›
              </button>
            )}
          </div>

          {/* Thumbnail dots */}
          <div className="flex-shrink-0 flex items-center justify-center gap-1.5 py-3 flex-wrap px-4">
            {slides.map((_, di) => (
              <button
                key={di}
                onClick={() => setSlideshowIndex(di)}
                className={`rounded-full transition-all ${
                  di === slideshowIndex
                    ? 'bg-white w-3.5 h-3.5'
                    : 'bg-white/30 hover:bg-white/60 w-2.5 h-2.5'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── PRINT / PDF MODAL ────────────────────────────────────────────────── */}
      {printModalOpen && slides.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPrintModalOpen(false)} />
          <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">인쇄 / PDF 저장</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  전체 {slides.length}장의 슬라이드를 확인하고 인쇄하세요. PDF는 인쇄 대화상자에서 저장할 수 있습니다.
                </p>
              </div>
              <button
                onClick={() => setPrintModalOpen(false)}
                className="btn-secondary text-sm flex-shrink-0"
              >
                닫기
              </button>
            </div>

            {/* Slide preview list */}
            <div className="overflow-y-auto flex-1 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slides.map((slide, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">슬라이드 {idx + 1}</div>
                    <div className="relative w-full pt-[56.25%] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                      <iframe
                        title={`print-preview-${idx + 1}`}
                        srcDoc={buildSlideDoc(slide, theme, tone, true)}
                        sandbox="allow-same-origin"
                        className="absolute inset-0 w-full h-full bg-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 flex-shrink-0">
              <button onClick={() => setPrintModalOpen(false)} className="btn-secondary">취소</button>
              <button
                onClick={() => { setPrintModalOpen(false); handlePrintAll(); }}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="h-4 w-4" /> 인쇄하기 (PDF 저장)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT CONTAINER ───────────────────────────────────────────────────── */}
      <div id="ppt-print-container" className="hidden">
        {printSlides.map((slide) => (
          <div key={slide.key} className="ppt-print-slide" dangerouslySetInnerHTML={{ __html: slide.html }} />
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body.ppt-print-mode #chat-layout * {
            visibility: hidden !important;
          }
          body.ppt-print-mode #ppt-print-container,
          body.ppt-print-mode #ppt-print-container * {
            visibility: visible !important;
          }
          body.ppt-print-mode #ppt-print-container {
            display: block !important;
            position: relative !important;
            inset: auto !important;
            width: 100% !important;
            background: #fff;
            z-index: auto !important;
            overflow: visible !important;
          }
          body.ppt-print-mode .ppt-print-slide {
            width: 100%;
            min-height: 100vh;
            height: auto;
            box-sizing: border-box;
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
            overflow: visible;
            padding: 8px;
            margin: 0;
            font-family: 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            background: linear-gradient(145deg, #eff6ff, #bfdbfe);
          }
          body.ppt-print-mode .ppt-print-slide > * {
            min-height: calc(100vh - 16px);
          }
          body.ppt-print-mode.ppt-print-dark .ppt-print-slide {
            background: linear-gradient(145deg, #0f172a, #1e3a8a);
          }
          body.ppt-print-mode .ppt-print-slide:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          @page {
            size: landscape;
            margin: 0;
          }
        }
      `}</style>
        </>
      )}
    </div>
  );
}
