import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';

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
    title: `Introduction to ${topic}`,
    description: 'Explains the topic background and presentation purpose.',
    keyPoints: ['Background and current status', 'Presentation purpose and scope', 'Key message'],
  });

  const bodyCount = Math.max(0, slideCount - 2);
  const bodyTemplates = [
    { title: 'Current Status Analysis', description: 'Analyzes the current situation and key challenges.', keyPoints: ['Current data', 'Key issues', 'Root cause analysis'] },
    { title: 'Core Strategy', description: 'Presents core strategies for achieving objectives.', keyPoints: ['Strategic direction', 'Execution plan', 'Expected outcomes'] },
    { title: 'Detailed Execution Plan', description: 'Outlines step-by-step execution plans and schedules.', keyPoints: ['Short-term plan', 'Mid-term plan', 'Long-term roadmap'] },
    { title: 'Expected Results', description: 'Explains target metrics and expected outcomes.', keyPoints: ['Quantitative goals', 'Qualitative effects', 'Performance measurement methods'] },
    { title: 'Risks and Mitigation', description: 'Covers anticipated risks and mitigation strategies.', keyPoints: ['Key risks', 'Mitigation strategies', 'Monitoring plan'] },
    { title: 'Organization and Roles', description: 'Explains the execution organization structure and role assignments.', keyPoints: ['Responsible teams', 'Roles and responsibilities', 'Collaboration framework'] },
  ];

  for (let i = 0; i < bodyCount; i++) {
    const template = bodyTemplates[i % bodyTemplates.length];
    slides.push({ ...template });
  }

  slides.push({
    title: 'Conclusion and Next Steps',
    description: 'Summarizes key content and proposes next steps.',
    keyPoints: ['Summary of key points', 'Proposed next steps', 'Inquiries and collaboration'],
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
      return NextResponse.json({ error: 'PPT agent access denied.' }, { status: 403 });
    }

    const body = await request.json();
    const topic = String(body?.topic || '').trim();
    const brief = String(body?.brief || '').trim();
    const requestedSlideCount = Number(body?.slideCount);
    const requestedTheme = String(body?.theme || '').trim();
    const requestedTone = String(body?.tone || '').trim();
    const requestedModel = String(body?.model || '').trim();

    if (!topic) {
      return NextResponse.json({ error: 'Please enter a topic.' }, { status: 400 });
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
    const toneText = tone === 'casual' ? 'friendly and easy-to-understand tone' : 'polite business tone';

    const systemPrompt = [
      'You are a presentation outline generation expert.',
      'You must respond only in the JSON format below. Output only JSON without any other text, explanations, or markdown.',
      `{"slides":[{"title":"Slide Title","description":"One or two line description","keyPoints":["Point 1","Point 2","Point 3"]},...]}`,
      `Create exactly ${slideCount} slide outlines.`,
      `Use a ${toneText} for the writing style.`,
      'The first slide should be an intro and the last slide should be a conclusion.',
      'Include 2-4 key points in each slide.',
    ].join('\n');

    const userPrompt = [
      `Topic: ${topic}`,
      `Brief description: ${brief || 'None'}`,
      `Number of slides: ${slideCount}`,
      `Theme: ${theme}, Tone: ${tone}`,
      `Based on the above information, create exactly ${slideCount} slide outlines in JSON format.`,
    ].join('\n');

    const origin = new URL(request.url).origin;
    const authHeader = request.headers.get('authorization') || '';
    const userId = authResult.user?.sub || authResult.user?.id || '';
    const llmStartTime = Date.now();

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
      logExternalApiRequest({
        sourceType: 'internal', provider: 'model-server', apiType: 'ppt-outline',
        endpoint: `${origin}/api/webapp-generate`, model: resolvedModelName,
        promptTokenCount: userPrompt.length, responseTokenCount: 0,
        responseTime: Date.now() - llmStartTime, statusCode: upstreamResponse.status,
        isStream: true, jwtUserId: userId, error: `HTTP ${upstreamResponse.status}`,
      }).catch(() => {});
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

    logExternalApiRequest({
      sourceType: 'internal', provider: 'model-server', apiType: 'ppt-outline',
      endpoint: `${origin}/api/webapp-generate`, model: resolvedModelName,
      promptTokenCount: userPrompt.length, responseTokenCount: accumulatedText.length,
      responseTime: Date.now() - llmStartTime, statusCode: 200,
      isStream: true, jwtUserId: userId,
    }).catch(() => {});

    const parsed = extractJsonFromText(accumulatedText);

    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      // Fallback
      const slides = generatePlaceholderOutlines(topic, slideCount);
      return NextResponse.json({ slides, fallback: true });
    }

    // Normalize slides array
    const slides = parsed.slides.slice(0, slideCount).map((s, i) => ({
      title: String(s?.title || `Slide ${i + 1}`),
      description: String(s?.description || ''),
      keyPoints: Array.isArray(s?.keyPoints)
        ? s.keyPoints.map((k) => String(k)).filter(Boolean)
        : [],
    }));

    // Pad if fewer slides than requested
    while (slides.length < slideCount) {
      const placeholders = generatePlaceholderOutlines(topic, slideCount);
      slides.push(placeholders[slides.length] || { title: `Slide ${slides.length + 1}`, description: '', keyPoints: [] });
    }

    return NextResponse.json({ slides });
  } catch (error) {
    console.error('[webapp-ppt-outline] error:', error);
    // Fallback
    try {
      const body = await request.json().catch(() => ({}));
      const topic = String(body?.topic || 'Presentation');
      const slideCount = Number(body?.slideCount) || 8;
      const slides = generatePlaceholderOutlines(topic, Math.min(slideCount, 30));
      return NextResponse.json({ slides, fallback: true });
    } catch {
      return NextResponse.json({ error: 'Failed to generate outline.' }, { status: 500 });
    }
  }
}
