import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';
import { resolveModelId, getDefaultModel } from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';

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
      label: 'Light x Casual',
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
      note: 'Bright and light rhythm, actively use card/chip elements',
    },
    'light-business': {
      id: 'light-business',
      label: 'Light x Business',
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
      note: 'Structured corporate layout with minimal excessive decoration',
    },
    'dark-casual': {
      id: 'dark-casual',
      label: 'Dark x Casual',
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
      note: 'Vivid blue highlights and flexible cards on a dark background',
    },
    'dark-business': {
      id: 'dark-business',
      label: 'Dark x Business',
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
      note: 'Strong report/consulting-style contrast with linear structure',
    },
  };

  return variants[key] || variants['light-business'];
}

function buildBlueThemeTemplate(theme, tone) {
  const variant = getBlueTemplateVariant(theme, tone);

  return [
    `[Selected template: ${variant.label} (${variant.id})]`,
    `Template characteristics: ${variant.note}`,
    'Maintain a similar visual language based on the sample template below.',
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
        '    <p class="ppt-kicker">ModolAI Template</p>',
    '    <h1 class="ppt-title">Main Slide Title</h1>',
    '    <p class="ppt-subtitle">Deliver the core message in one sentence</p>',
    '    <div class="ppt-grid">',
    '      <article class="ppt-card">',
    '        <h3 class="ppt-card-title">Key Point A</h3>',
    '        <p class="ppt-card-body">Place sentence-style explanation and <span class="ppt-accent">highlighted keywords</span> together</p>',
    '      </article>',
    '      <article class="ppt-card">',
    '        <h3 class="ppt-card-title">Key Point B</h3>',
    '        <p class="ppt-card-body">Present business metrics or action items concisely</p>',
    '      </article>',
    '    </div>',
    '    <p class="ppt-footer">2026 | Internal Draft</p>',
    '  </div>',
    '</section>',
  ].join('\n');
}

function buildPptSystemPrompt({ theme, tone, slideCount }) {
  const toneText = tone === 'casual' ? 'friendly and easy-to-understand tone' : 'polite, report-style business tone';
  const themeText = theme === 'dark' ? 'dark background based' : 'light background based';
  const selectedVariant = getBlueTemplateVariant(theme, tone);
  const designTemplate = buildBlueThemeTemplate(theme, tone);

  return [
    'You are a presentation content generator.',
    `You must generate exactly ${slideCount} slides.`,
    `Use ${themeText} for style and ${toneText} for writing tone.`,
    `The selected design template is ${selectedVariant.label} (${selectedVariant.id}).`,
    'Do not mix templates; keep the tone and structure aligned with the selected template.',
    'Important: Design/CSS is forcibly applied on the client, so do not write style tags or inline styles.',
    'Important: For each slide, write only content centered around semantic tags (h1/h2/h3/p/ul/li, etc.).',
    'Internally follow the sequence below, then output only the final result.',
    '1) First design the slide outline (must match the exact number of slides).',
    '2) The first slide should focus on the title and one-line core message.',
    '3) Middle slides should balance lists/comparisons/metric explanations.',
    '4) The final slide should conclude with conclusion/requests/contact points.',
    'In the final output, continuously output only the HTML body fragments for each slide.',
    'Each slide should contain only one slide-worth of content.',
    'Recommended template (can be adapted per slide):',
    '<h1>Slide Title</h1>',
    '<p>Core description</p>',
    '<ul><li>Point A</li><li>Point B</li></ul>',
    designTemplate,
    'Separate slides with exactly <!-- SLIDE_BREAK --> between them.',
    'Never use markdown code blocks (``` ).',
    'Never use script tags (<script>), style tags (<style>), or on* event attributes.',
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
    console.warn('[webapp-ppt-generate] Failed to query agent_settings:', error.message);
    return DEFAULT_SETTINGS;
  }
}

async function getModelOptionsForRole(role = 'user') {
  const { getModelsFromTables } = await import('@/lib/modelTables');
  const categories = await getModelsFromTables();
  if (!categories || typeof categories !== 'object') return [];

  const isAdmin = ['admin', 'manager'].includes(role);
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
          { error: 'Access denied to PPT agent.' },
          { status: 403 }
        );
    }

    const settings = await getAgent7Settings();
    const modelOptions = await getModelOptionsForRole(authResult.user?.role || 'user');
    return NextResponse.json({ settings, modelOptions });
  } catch (error) {
    console.error('[webapp-ppt-generate:GET] error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve PPT default settings.' },
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
        { error: 'Access denied to PPT agent.' },
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
      return NextResponse.json({ error: 'Please enter a topic.' }, { status: 400 });
    }
    if (topic.length > 500) {
      return NextResponse.json({ error: 'Please enter a topic with 500 characters or fewer.' }, { status: 400 });
    }
    if (brief.length > 3000) {
      return NextResponse.json({ error: 'Please enter the brief content with 3000 characters or fewer.' }, { status: 400 });
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
          { error: 'The selected model cannot be used.' },
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
      `Topic: ${topic}`,
      `Brief content: ${brief || 'None'}`,
      `Number of slides: ${slideCount}`,
      `Theme: ${theme}`,
      `Tone: ${tone}`,
      'Request: Generate presentation slide content with the conditions above. Provide only slide body HTML fragments.',
    ].join('\n');

    const origin = new URL(request.url).origin;
    const authHeader = request.headers.get('authorization') || '';
    const userId = authResult.user?.sub || authResult.user?.id || '';
    const llmStartTime = Date.now();
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
          { error: `PPT generation timed out. Please try again shortly. (Allowed time: ${timeoutSec} seconds)` },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(upstreamTimeout);
    }

    if (!upstreamResponse.ok) {
      const text = await upstreamResponse.text().catch(() => '');
      logExternalApiRequest({
        sourceType: 'internal', provider: 'model-server', apiType: 'ppt-generate',
        endpoint: `${origin}/api/webapp-generate`, model: resolvedModelName,
        promptTokenCount: prompt.length, responseTokenCount: 0,
        responseTime: Date.now() - llmStartTime, statusCode: upstreamResponse.status,
        isStream: true, jwtUserId: userId, error: `HTTP ${upstreamResponse.status}`,
      }).catch(() => {});
      return NextResponse.json(
        {
          error: `PPT generation call failed (HTTP ${upstreamResponse.status})`,
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
      logExternalApiRequest({
        sourceType: 'internal', provider: 'model-server', apiType: 'ppt-generate',
        endpoint: `${origin}/api/webapp-generate`, model: resolvedModelName,
        promptTokenCount: prompt.length, responseTokenCount: sanitized.length,
        responseTime: Date.now() - llmStartTime, statusCode: 200,
        isStream: false, jwtUserId: userId,
      }).catch(() => {});
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
            const fallback = sanitizeHtmlForPpt(error?.message || 'An error occurred while processing the PPT stream.');
            const normalizedError = JSON.stringify({
               choices: [{ delta: { content: `\n[Error] ${fallback}` } }],
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
      { error: 'Failed to process the PPT generation request.' },
      { status: 500 }
    );
  }
}
