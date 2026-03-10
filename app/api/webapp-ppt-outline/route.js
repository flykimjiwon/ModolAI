import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';

const ALLOWED_THEMES = new Set(['light', 'dark']);
const ALLOWED_TONES = new Set(['business', 'casual']);

const DEFAULT_SETTINGS = {
  selectedModelId: '',
  defaultSlideCount: 8,
  defaultTheme: 'light',
  defaultTone: 'business',
  allowUserModelOverride: false,
};

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
  } catch {
    return DEFAULT_SETTINGS;
  }
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
  if (permissions.length === 0) return true;

  const allPermission = permissions.find((p) => p.permission_type === 'all');
  if (allPermission) return allPermission.is_allowed === true;

  const userPermission = permissions.find(
    (p) => p.permission_type === 'user' && p.permission_value === userId
  );
  if (userPermission) return userPermission.is_allowed === true;

  const rolePermission = permissions.find(
    (p) => p.permission_type === 'role' && p.permission_value === user?.role
  );
  if (rolePermission) return rolePermission.is_allowed === true;

  const deptPermission = permissions.find(
    (p) => p.permission_type === 'department' && p.permission_value === user?.department
  );
  if (deptPermission) return deptPermission.is_allowed === true;

  return false;
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
  return '';
}

function accumulateSseStream(rawText) {
  let extracted = '';
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith(':') || line.startsWith('event:')) continue;
    const payload = line.startsWith('data:') ? line.slice(5).trim() : line;
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload);
      const delta = extractDeltaText(parsed);
      if (delta) extracted += delta;
    } catch {
      if (payload && payload !== '[DONE]') extracted += payload;
    }
  }
  return extracted || rawText;
}

function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') return null;
  const jsonMatch = text.match(/\{[\s\S]*"slides"[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed.slides) && parsed.slides.length > 0) return parsed;
  } catch {
    // Try stripping trailing commas
    try {
      const cleaned = jsonMatch[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/'/g, '"');
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed.slides) && parsed.slides.length > 0) return parsed;
    } catch {}
  }
  return null;
}

function generatePlaceholderOutlines(topic, slideCount) {
  const slides = [];
  slides.push({
    title: `${topic} 소개`,
    description: '주제 배경과 발표 목적을 설명합니다.',
    keyPoints: ['배경 및 현황', '발표 목적 및 범위', '핵심 메시지'],
  });

  const bodyCount = Math.max(0, slideCount - 2);
  const bodyTemplates = [
    { title: '현황 분석', description: '현재 상황과 주요 과제를 분석합니다.', keyPoints: ['현황 데이터', '주요 이슈', '원인 분석'] },
    { title: '핵심 전략', description: '목표 달성을 위한 핵심 전략을 제시합니다.', keyPoints: ['전략 방향', '실행 계획', '기대 효과'] },
    { title: '세부 실행 계획', description: '단계별 실행 계획과 일정을 안내합니다.', keyPoints: ['단기 계획', '중기 계획', '장기 로드맵'] },
    { title: '기대 성과', description: '목표 수치와 기대되는 성과를 설명합니다.', keyPoints: ['정량적 목표', '정성적 효과', '성과 측정 방법'] },
    { title: '리스크 및 대응', description: '예상 리스크와 대응 방안을 다룹니다.', keyPoints: ['주요 리스크', '대응 전략', '모니터링 계획'] },
    { title: '조직 및 역할', description: '실행 조직 구성과 역할 분담을 설명합니다.', keyPoints: ['담당 조직', '역할과 책임', '협업 체계'] },
  ];

  for (let i = 0; i < bodyCount; i++) {
    const template = bodyTemplates[i % bodyTemplates.length];
    slides.push({ ...template });
  }

  slides.push({
    title: '결론 및 다음 단계',
    description: '핵심 내용을 요약하고 다음 단계를 제안합니다.',
    keyPoints: ['주요 내용 요약', '다음 단계 제안', '문의 및 협력'],
  });

  return slides.slice(0, slideCount);
}

export async function POST(request) {
  const authResult = verifyTokenWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const hasPermission = await checkAgentPermissionForUser(authResult.user, '7');
    if (!hasPermission) {
      return NextResponse.json({ error: 'PPT 에이전트 Access denied.' }, { status: 403 });
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

    const settings = await getAgent7Settings();
    const slideCount =
      Number.isInteger(requestedSlideCount) && requestedSlideCount >= 1 && requestedSlideCount <= 30
        ? requestedSlideCount
        : settings.defaultSlideCount;
    const theme = ALLOWED_THEMES.has(requestedTheme) ? requestedTheme : settings.defaultTheme;
    const tone = ALLOWED_TONES.has(requestedTone) ? requestedTone : settings.defaultTone;

    let model = settings.selectedModelId || getDefaultModel();
    if (settings.allowUserModelOverride && requestedModel) {
      model = requestedModel;
    }

    const resolvedModelName = await resolveModelId(model);
    const toneText = tone === 'casual' ? '친근하고 이해하기 쉬운 톤' : '정중한 비즈니스 톤';

    const systemPrompt = [
      '당신은 프레젠테이션 개요 생성 전문가입니다.',
      '반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트, 설명, 마크다운 없이 JSON만 출력하세요.',
      `{"slides":[{"title":"슬라이드 제목","description":"한두 줄 설명","keyPoints":["포인트1","포인트2","포인트3"]},...]}`,
      `정확히 ${slideCount}개의 슬라이드 개요를 만드세요.`,
      `문체는 ${toneText}을 사용하세요.`,
      '첫 슬라이드는 인트로, 마지막 슬라이드는 결론으로 구성하세요.',
      '각 슬라이드에 2~4개의 핵심 포인트를 포함하세요.',
    ].join('\n');

    const userPrompt = [
      `주제: ${topic}`,
      `간단한 내용: ${brief || '없음'}`,
      `슬라이드 수: ${slideCount}`,
      `테마: ${theme}, 톤: ${tone}`,
      `위 정보로 정확히 ${slideCount}장의 슬라이드 개요를 JSON 형식으로 만들어주세요.`,
    ].join('\n');

    const origin = new URL(request.url).origin;
    const authHeader = request.headers.get('authorization') || '';

    const upstreamResponse = await fetch(`${origin}/api/webapp-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        model: resolvedModelName,
        question: userPrompt,
        prompt: userPrompt,
        requestPurpose: 'ppt-outline',
        multiturnHistory: [{ role: 'system', text: systemPrompt }],
        stream: true,
        options: {
          temperature: 0.3,
          max_length: 2000,
        },
      }),
    });

    if (!upstreamResponse.ok) {
      // Fallback to placeholder outlines
      const slides = generatePlaceholderOutlines(topic, slideCount);
      return NextResponse.json({ slides, fallback: true });
    }

    const contentType = upstreamResponse.headers.get('content-type') || '';
    const isSSE = contentType.includes('text/event-stream');

    let rawText = '';
    if (!isSSE) {
      rawText = await upstreamResponse.text();
    } else {
      // Accumulate streaming response
      const reader = upstreamResponse.body?.getReader();
      if (!reader) {
        const slides = generatePlaceholderOutlines(topic, slideCount);
        return NextResponse.json({ slides, fallback: true });
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      rawText = buffer;
    }

    const accumulatedText = accumulateSseStream(rawText);
    const parsed = extractJsonFromText(accumulatedText);

    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      // Fallback
      const slides = generatePlaceholderOutlines(topic, slideCount);
      return NextResponse.json({ slides, fallback: true });
    }

    // Normalize slides array
    const slides = parsed.slides.slice(0, slideCount).map((s, i) => ({
      title: String(s?.title || `슬라이드 ${i + 1}`),
      description: String(s?.description || ''),
      keyPoints: Array.isArray(s?.keyPoints)
        ? s.keyPoints.map((k) => String(k)).filter(Boolean)
        : [],
    }));

    // Pad if fewer slides than requested
    while (slides.length < slideCount) {
      const placeholders = generatePlaceholderOutlines(topic, slideCount);
      slides.push(placeholders[slides.length] || { title: `슬라이드 ${slides.length + 1}`, description: '', keyPoints: [] });
    }

    return NextResponse.json({ slides });
  } catch (error) {
    console.error('[webapp-ppt-outline] error:', error);
    // Fallback
    try {
      const body = await request.json().catch(() => ({}));
      const topic = String(body?.topic || '프레젠테이션');
      const slideCount = Number(body?.slideCount) || 8;
      const slides = generatePlaceholderOutlines(topic, Math.min(slideCount, 30));
      return NextResponse.json({ slides, fallback: true });
    } catch {
      return NextResponse.json({ error: '개요 생성에 실패했습니다.' }, { status: 500 });
    }
  }
}
