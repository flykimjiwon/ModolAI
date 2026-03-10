import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';

const DEFAULT_SETTINGS = {
  selectedModelId: '',
  defaultSlideCount: 8,
  defaultTheme: 'light',
  defaultTone: 'business',
  allowUserModelOverride: false,
};

const ALLOWED_THEMES = new Set(['light', 'dark']);
const ALLOWED_TONES = new Set(['business', 'casual']);

function sanitizeHtmlForPpt(html) {
  if (!html || typeof html !== 'string') return '';
  const noScript = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  return noScript.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '');
}

function stripMarkdownCodeFence(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  const wrapped = trimmed.match(/^```(?:\s*html)?\s*([\s\S]*?)\s*```$/i);
  if (wrapped) {
    return wrapped[1].trim();
  }

  return trimmed
    .replace(/^```(?:\s*html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractDeltaText(payload) {
  if (!payload || typeof payload !== 'object') return '';

  const choiceDelta = payload?.choices?.[0]?.delta?.content;
  if (typeof choiceDelta === 'string') return choiceDelta;

  const choiceText = payload?.choices?.[0]?.text;
  if (typeof choiceText === 'string') return choiceText;

  const responseText = payload?.response;
  if (typeof responseText === 'string') return responseText;

  const messageContent = payload?.message?.content;
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.text === 'string') return item.text;
        return '';
      })
      .join('');
  }

  const contentText = payload?.content;
  if (typeof contentText === 'string') return contentText;

  return '';
}

function parseJsonObjectSequence(raw) {
  const objects = [];
  if (!raw || typeof raw !== 'string') return objects;

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];

    if (start === -1) {
      if (char === '{') {
        start = index;
        depth = 1;
        inString = false;
        escaped = false;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = raw.slice(start, index + 1);
        try {
          objects.push(JSON.parse(candidate));
        } catch {
        }
        start = -1;
      }
    }
  }

  return objects;
}

function extractTextFromRawStream(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let extracted = '';
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith(':') || line.startsWith('event:')) continue;
    const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload);
      const delta = extractDeltaText(parsed);
      if (delta) extracted += delta;
    } catch {
    }
  }

  if (extracted) return extracted;

  const sequenceObjects = parseJsonObjectSequence(rawText);
  if (sequenceObjects.length > 0) {
    const sequenceText = sequenceObjects
      .map((item) => extractDeltaText(item))
      .join('');
    if (sequenceText) return sequenceText;
  }

  return rawText;
}

function normalizePptHtml(rawText) {
  const extracted = extractTextFromRawStream(rawText);
  const unwrapped = stripMarkdownCodeFence(extracted);
  return sanitizeHtmlForPpt(unwrapped || extracted);
}

function normalizeSsePayload(rawPayload) {
  if (!rawPayload) return null;
  if (rawPayload === '[DONE]') return '[DONE]';

  try {
    const parsed = JSON.parse(rawPayload);
    const delta = extractDeltaText(parsed);

    if (delta) {
      const sanitizedDelta = sanitizeHtmlForPpt(delta);

      if (
        parsed?.choices &&
        Array.isArray(parsed.choices) &&
        parsed.choices[0]?.delta &&
        typeof parsed.choices[0].delta === 'object'
      ) {
        parsed.choices[0].delta.content = sanitizedDelta;
        return JSON.stringify(parsed);
      }

      return JSON.stringify({
        choices: [{ delta: { content: sanitizedDelta } }],
      });
    }

    if (parsed?.done === true) return '[DONE]';

    return JSON.stringify(parsed);
  } catch {
    const sanitized = sanitizeHtmlForPpt(rawPayload);
    if (!sanitized) return null;
    return JSON.stringify({
      choices: [{ delta: { content: sanitized } }],
    });
  }
}

function getBlueTemplateVariant(theme, tone) {
  const key = `${theme === 'dark' ? 'dark' : 'light'}-${tone === 'casual' ? 'casual' : 'business'}`;

  const variants = {
    'light-casual': {
      id: 'light-casual',
      label: '라이트 x 캐주얼',
      bgStart: '#eff6ff',
      bgEnd: '#dbeafe',
      panel: 'rgba(255, 255, 255, 0.92)',
      card: 'rgba(186, 230, 253, 0.45)',
      textMain: '#0f172a',
      textSub: '#0369a1',
      accent: '#0ea5e9',
      border: 'rgba(14, 165, 233, 0.28)',
      radius: '34px',
      titleWeight: '900',
      subtitleWeight: '600',
      kickerSpacing: '0.16em',
      cardShadow: '0 18px 40px rgba(56, 189, 248, 0.16)',
      note: '밝고 가벼운 리듬, 카드/칩 요소를 적극 활용',
    },
    'light-business': {
      id: 'light-business',
      label: '라이트 x 비즈니스',
      bgStart: '#f8fbff',
      bgEnd: '#dbeafe',
      panel: 'rgba(255, 255, 255, 0.97)',
      card: 'rgba(219, 234, 254, 0.46)',
      textMain: '#0b172f',
      textSub: '#1d4ed8',
      accent: '#1d4ed8',
      border: 'rgba(29, 78, 216, 0.32)',
      radius: '14px',
      titleWeight: '800',
      subtitleWeight: '500',
      kickerSpacing: '0.12em',
      cardShadow: '0 12px 28px rgba(30, 64, 175, 0.10)',
      note: '정돈된 기업형 레이아웃, 과한 장식 최소화',
    },
    'dark-casual': {
      id: 'dark-casual',
      label: '다크 x 캐주얼',
      bgStart: '#0b1226',
      bgEnd: '#082f49',
      panel: 'rgba(12, 25, 48, 0.88)',
      card: 'rgba(14, 116, 144, 0.34)',
      textMain: '#e0f2fe',
      textSub: '#7dd3fc',
      accent: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.44)',
      radius: '26px',
      titleWeight: '850',
      subtitleWeight: '600',
      kickerSpacing: '0.18em',
      cardShadow: '0 20px 52px rgba(8, 47, 73, 0.35)',
      note: '어두운 배경 위에 선명한 블루 포인트와 유연한 카드',
    },
    'dark-business': {
      id: 'dark-business',
      label: '다크 x 비즈니스',
      bgStart: '#0a1022',
      bgEnd: '#1e293b',
      panel: 'rgba(15, 23, 42, 0.9)',
      card: 'rgba(30, 64, 175, 0.26)',
      textMain: '#dbeafe',
      textSub: '#93c5fd',
      accent: '#60a5fa',
      border: 'rgba(96, 165, 250, 0.33)',
      radius: '10px',
      titleWeight: '760',
      subtitleWeight: '500',
      kickerSpacing: '0.13em',
      cardShadow: '0 16px 36px rgba(15, 23, 42, 0.44)',
      note: '리포트/컨설팅 톤의 묵직한 대비와 선형 구조',
    },
  };

  return variants[key] || variants['light-business'];
}

function buildBlueThemeTemplate(theme, tone) {
  const variant = getBlueTemplateVariant(theme, tone);

  return [
    `[선택 템플릿: ${variant.label} (${variant.id})]`,
    `템플릿 특징: ${variant.note}`,
    '아래 샘플 템플릿을 기준으로 유사한 시각 언어를 유지하세요.',
    '<section class="ppt-slide">',
    '  <style>',
    `    .ppt-slide { min-height: 100vh; width: 100%; box-sizing: border-box; padding: 4.2vw; background: linear-gradient(150deg, ${variant.bgStart}, ${variant.bgEnd}); color: ${variant.textMain}; font-family: "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; }`,
    `    .ppt-surface { min-height: calc(100vh - 8.4vw); border-radius: ${variant.radius}; border: 1px solid ${variant.border}; background: ${variant.panel}; padding: 2.1rem 2.2rem; display: flex; flex-direction: column; gap: 1.1rem; box-shadow: ${variant.cardShadow}; }`,
    `    .ppt-kicker { letter-spacing: ${variant.kickerSpacing}; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; color: ${variant.accent}; margin: 0; }`,
    `    .ppt-title { margin: 0; font-size: clamp(2.05rem, 3.35vw, 3.2rem); line-height: 1.14; font-weight: ${variant.titleWeight}; color: ${variant.textMain}; }`,
    `    .ppt-subtitle { margin: 0; font-size: clamp(1.04rem, 1.62vw, 1.35rem); font-weight: ${variant.subtitleWeight}; color: ${variant.textSub}; }`,
    '    .ppt-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.9rem; margin-top: 0.58rem; }',
    `    .ppt-card { border-radius: calc(${variant.radius} * 0.5); border: 1px solid ${variant.border}; background: ${variant.card}; padding: 0.95rem 1rem; }`,
    '    .ppt-card-title { margin: 0 0 0.4rem; font-size: 0.98rem; font-weight: 700; }',
    '    .ppt-card-body { margin: 0; font-size: 0.92rem; line-height: 1.58; }',
    `    .ppt-accent { color: ${variant.accent}; font-weight: 700; }`,
    '    .ppt-footer { margin-top: auto; font-size: 0.82rem; opacity: 0.85; }',
    '  </style>',
    '  <div class="ppt-surface">',
    '    <p class="ppt-kicker">Modol AI Template</p>',
    '    <h1 class="ppt-title">슬라이드 대제목</h1>',
    '    <p class="ppt-subtitle">핵심 메시지를 한 문장으로 전달</p>',
    '    <div class="ppt-grid">',
    '      <article class="ppt-card">',
    '        <h3 class="ppt-card-title">핵심 포인트 A</h3>',
    '        <p class="ppt-card-body">문장형 설명과 <span class="ppt-accent">강조 키워드</span>를 함께 배치</p>',
    '      </article>',
    '      <article class="ppt-card">',
    '        <h3 class="ppt-card-title">핵심 포인트 B</h3>',
    '        <p class="ppt-card-body">비즈니스 수치 또는 실행 항목을 간결하게 배치</p>',
    '      </article>',
    '    </div>',
    '    <p class="ppt-footer">2026 | Internal Draft</p>',
    '  </div>',
    '</section>',
  ].join('\n');
}

function buildPptSystemPrompt({ theme, tone, slideCount }) {
  const toneText = tone === 'casual' ? '친근하고 이해하기 쉬운 톤' : '정중하고 보고서형 비즈니스 톤';
  const themeText = theme === 'dark' ? '다크 배경 기반' : '라이트 배경 기반';
  const selectedVariant = getBlueTemplateVariant(theme, tone);
  const designTemplate = buildBlueThemeTemplate(theme, tone);

  return [
    '당신은 프레젠테이션 콘텐츠 생성기입니다.',
    `반드시 ${slideCount}장의 슬라이드를 생성하세요.`,
    `스타일은 ${themeText}, 문체는 ${toneText}을 사용하세요.`,
    `선택된 디자인 템플릿은 ${selectedVariant.label}(${selectedVariant.id}) 입니다.`,
    '템플릿 혼합은 금지하고, 선택된 템플릿에 맞는 톤과 구조를 유지하세요.',
    '중요: 디자인/CSS는 클라이언트에서 강제 적용되므로 style 태그와 인라인 스타일을 작성하지 마세요.',
    '중요: 각 슬라이드는 의미 태그(h1/h2/h3/p/ul/li 등) 중심으로 콘텐츠만 작성하세요.',
    '내부적으로 아래 순서를 지킨 뒤 최종 결과만 출력하세요.',
    '1) 먼저 슬라이드 개요를 설계한다(장수와 정확히 일치).',
    '2) 첫 슬라이드는 제목/한 줄 핵심 메시지 중심으로 작성한다.',
    '3) 중간 슬라이드는 목록/비교/지표 설명을 균형 있게 배치한다.',
    '4) 마지막 슬라이드는 결론/요청사항/연락 포인트로 마무리한다.',
    '최종 출력은 슬라이드별 HTML 본문 조각만 연속으로 출력한다.',
    '각 슬라이드는 한 장 분량의 콘텐츠만 작성하세요.',
    '권장 템플릿(슬라이드마다 변형 가능):',
    '<h1>슬라이드 제목</h1>',
    '<p>핵심 설명</p>',
    '<ul><li>포인트 A</li><li>포인트 B</li></ul>',
    designTemplate,
    '슬라이드와 슬라이드 사이는 정확히 <!-- SLIDE_BREAK --> 로 구분하세요.',
    '절대 markdown 코드블록(```)을 사용하지 마세요.',
    '스크립트 태그(<script>), style 태그(<style>), on* 이벤트 속성을 절대 사용하지 마세요.',
  ].join('\n');
}

async function getAgent7Settings() {
  try {
    const result = await query(
      `SELECT selected_model_id, default_slide_count, default_theme, default_tone, allow_user_model_override
       FROM agent_settings
       WHERE agent_id = '7'
       LIMIT 1`
    );
    const row = result.rows[0];
    if (!row) return DEFAULT_SETTINGS;
    return {
      selectedModelId: row.selected_model_id || '',
      defaultSlideCount: row.default_slide_count || DEFAULT_SETTINGS.defaultSlideCount,
      defaultTheme: row.default_theme || DEFAULT_SETTINGS.defaultTheme,
      defaultTone: row.default_tone || DEFAULT_SETTINGS.defaultTone,
      allowUserModelOverride: row.allow_user_model_override === true,
    };
  } catch (error) {
    console.warn('[webapp-ppt-generate] agent_settings 조회 실패:', error.message);
    return DEFAULT_SETTINGS;
  }
}

async function getModelOptionsForRole(role = 'user') {
  const { getModelsFromTables } = await import('@/lib/modelTables');
  const categories = await getModelsFromTables();
  if (!categories || typeof categories !== 'object') return [];

  const isAdmin = role === 'admin';
  const result = [];
  for (const [categoryKey, category] of Object.entries(categories)) {
    const models = Array.isArray(category?.models) ? category.models : [];
    for (const model of models) {
      if (!model || model.visible === false) continue;
      if (!isAdmin && model.adminOnly === true) continue;
      const id = String(model.modelName || model.id || '').trim();
      if (!id) continue;
      result.push({
        id,
        label: model.label || id,
        categoryLabel: category?.label || categoryKey,
      });
    }
  }
  return result;
}

async function checkAgentPermissionForUser(user, agentId = '7') {
  const userId = user?.id || user?.sub || user?.userId;
  if (!userId) return false;

  const permissionsResult = await query(
    `SELECT permission_type, permission_value, is_allowed
     FROM agent_permissions
     WHERE agent_id = $1`,
    [agentId]
  );

  const permissions = permissionsResult.rows;
  if (permissions.length === 0) {
    return true;
  }

  const allPermission = permissions.find((p) => p.permission_type === 'all');
  if (allPermission) {
    return allPermission.is_allowed === true;
  }

  const userPermission = permissions.find(
    (p) => p.permission_type === 'user' && p.permission_value === userId
  );
  if (userPermission) {
    return userPermission.is_allowed === true;
  }

  const rolePermission = permissions.find(
    (p) => p.permission_type === 'role' && p.permission_value === user?.role
  );
  if (rolePermission) {
    return rolePermission.is_allowed === true;
  }

  const deptPermission = permissions.find(
    (p) => p.permission_type === 'department' && p.permission_value === user?.department
  );
  if (deptPermission) {
    return deptPermission.is_allowed === true;
  }

  return false;
}

export async function GET(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '7');
    if (!hasPermission) {
        return NextResponse.json(
          { error: 'PPT 에이전트 Access denied.' },
          { status: 403 }
        );
    }

    const settings = await getAgent7Settings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    return NextResponse.json({ settings, modelOptions });
  } catch (error) {
    console.error('[webapp-ppt-generate:GET] error:', error);
    return NextResponse.json(
      { error: 'PPT 기본 설정 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '7');
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'PPT 에이전트 Access denied.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const topic = String(body?.topic || '').trim();
    const brief = String(body?.brief || '').trim();
    const requestedSlideCount = Number(body?.slideCount);
    const requestedTheme = String(body?.theme || '').trim();
    const requestedTone = String(body?.tone || '').trim();
    const requestedModel = String(body?.model || '').trim();

    if (!topic) {
      return NextResponse.json({ error: '주제를 입력해 주세요.' }, { status: 400 });
    }
    if (topic.length > 500) {
      return NextResponse.json({ error: '주제는 500자 이하로 입력해 주세요.' }, { status: 400 });
    }
    if (brief.length > 3000) {
      return NextResponse.json({ error: '간단한 내용은 3000자 이하로 입력해 주세요.' }, { status: 400 });
    }

    const settings = await getAgent7Settings();

    const slideCount =
      Number.isInteger(requestedSlideCount) && requestedSlideCount >= 1 && requestedSlideCount <= 30
        ? requestedSlideCount
        : settings.defaultSlideCount;
    const theme = ALLOWED_THEMES.has(requestedTheme)
      ? requestedTheme
      : settings.defaultTheme;
    const tone = ALLOWED_TONES.has(requestedTone)
      ? requestedTone
      : settings.defaultTone;

    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    const modelOptionIds = new Set(modelOptions.map((item) => item.id));

    let model = settings.selectedModelId || getDefaultModel();
    if (settings.allowUserModelOverride && requestedModel) {
      if (!modelOptionIds.has(requestedModel)) {
        return NextResponse.json(
          { error: '선택한 모델을 사용할 수 없습니다.' },
          { status: 400 }
        );
      }
      model = requestedModel;
    }

    const resolvedModelName = await resolveModelId(model);
    const systemPrompt = buildPptSystemPrompt({
      theme,
      tone,
      slideCount,
    });

    const prompt = [
      `주제: ${topic}`,
      `간단한 내용: ${brief || '없음'}`,
      `슬라이드 수: ${slideCount}`,
      `테마: ${theme}`,
      `톤: ${tone}`,
      '요청: 위 조건으로 발표용 슬라이드 콘텐츠를 생성하세요. 반드시 슬라이드 본문 HTML 조각만 제공합니다.',
    ].join('\n');

    const origin = new URL(request.url).origin;
    const authHeader = request.headers.get('authorization') || '';
    const timeoutMs = Math.max(120000, slideCount * 120000);
    const upstreamController = new AbortController();
    const upstreamTimeout = setTimeout(() => upstreamController.abort(), timeoutMs);
    let upstreamResponse;
    try {
      upstreamResponse = await fetch(`${origin}/api/webapp-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        signal: upstreamController.signal,
        body: JSON.stringify({
          model: resolvedModelName,
          question: prompt,
          prompt,
          requestPurpose: 'ppt-generate',
          multiturnHistory: [{ role: 'system', text: systemPrompt }],
          stream: true,
          options: {
            temperature: 0.5,
            max_length: 3000,
          },
        }),
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutSec = Math.floor(timeoutMs / 1000);
        return NextResponse.json(
          { error: `PPT 생성 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요. (허용 시간: ${timeoutSec}초)` },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error: `PPT 생성 호출 실패 (HTTP ${upstreamResponse.status})`,
          details: text,
        },
        { status: upstreamResponse.status }
      );
    }

    const contentType = upstreamResponse.headers.get('content-type') || 'text/event-stream';
    const isSSE = contentType.includes('text/event-stream');
    if (!upstreamResponse.body) {
      const rawText = await upstreamResponse.text();
      const sanitized = normalizePptHtml(rawText);
      return new Response(sanitized, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamResponse.body.getReader();
        if (!reader) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        let buffer = '';
        let streamClosed = false;
        const emitDone = () => {
          if (streamClosed) return;
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          streamClosed = true;
        };
        const relayPayload = (rawPayload) => {
          const normalized = normalizeSsePayload(rawPayload);
          if (!normalized) return false;
          if (normalized === '[DONE]') {
            emitDone();
            return true;
          }
          controller.enqueue(encoder.encode(`data: ${normalized}\n\n`));
          return false;
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;
              if (isSSE && (trimmedLine.startsWith(':') || trimmedLine.startsWith('event:'))) continue;

              const data = trimmedLine.startsWith('data:')
                ? trimmedLine.slice(5).trim()
                : trimmedLine;
              if (!data) continue;
              const shouldClose = relayPayload(data);
              if (shouldClose) return;
            }
          }

          const remaining = buffer.trim();
          if (remaining && !(isSSE && (remaining.startsWith(':') || remaining.startsWith('event:')))) {
            if (isSSE) {
              const remainingPayload = remaining.startsWith('data:')
                ? remaining.slice(5).trim()
                : remaining;
              if (remainingPayload) relayPayload(remainingPayload);
            } else {
              const candidates = parseJsonObjectSequence(remaining);
              if (candidates.length > 0) {
                for (const candidate of candidates) {
                  const shouldClose = relayPayload(JSON.stringify(candidate));
                  if (shouldClose) return;
                }
              } else {
                const shouldClose = relayPayload(remaining);
                if (shouldClose) return;
              }
            }
          }

          emitDone();
        } catch (error) {
          if (!streamClosed) {
            const fallback = sanitizeHtmlForPpt(error?.message || 'PPT 스트림 처리 중 오류가 발생했습니다.');
            const normalizedError = JSON.stringify({
              choices: [{ delta: { content: `\n[오류] ${fallback}` } }],
            });
            controller.enqueue(encoder.encode(`data: ${normalizedError}\n\n`));
            emitDone();
            return;
          }
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[webapp-ppt-generate] error:', error);
    return NextResponse.json(
      { error: 'PPT 생성 요청 처리에 실패했습니다.' },
      { status: 500 }
    );
  }
}
