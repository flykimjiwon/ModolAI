import { NextResponse } from 'next/server';
import {
  getNextModelServerEndpointWithIndex,
  resolveModelId,
  parseModelName,
  getModelServerEndpointByName,
  getModelServerEndpointByLabel,
} from '@/lib/modelServers';
import { logQARequest } from '@/lib/qaLogger';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { logOpenAIRequest } from '@/lib/modelServerMonitor';
import { getClientIP } from '@/lib/ip';
import { verifyToken } from '@/lib/auth';
import {
  JWT_SECRET,
  MODEL_SERVER_TIMEOUT_STREAM,
  MODEL_SERVER_TIMEOUT_NORMAL,
  MODEL_SERVER_RETRY_DELAY,
} from '@/lib/config';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// OpenAI-compatible Chat Completions API
// Convert Ollama-format responses to OpenAI format

const createChatCompletionId = () =>
  `chatcmpl-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

function getValueByPath(source, path) {
  if (!source || !path) return undefined;
  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let current = source;
  for (const token of tokens) {
    if (current == null) return undefined;
    current = current[token];
  }
  return current;
}

function applyTemplate(value, context) {
  if (typeof value === 'string') {
    if (value === '{{messages}}') return context.messages;
    if (value === '{{message}}') return context.message;
    let output = value;
    if (output.includes('{{OPENAI_API_KEY}}')) {
      output = output.replaceAll('{{OPENAI_API_KEY}}', context.apiKey || '');
    }
    if (output.includes('{{messages}}')) {
      output = output.replaceAll(
        '{{messages}}',
        JSON.stringify(context.messages)
      );
    }
    if (output.includes('{{message}}')) {
      output = output.replaceAll('{{message}}', context.message || '');
    }
    return output;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyTemplate(item, context));
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      next[key] = applyTemplate(val, context);
    });
    return next;
  }
  return value;
}

function normalizeToolsPayload(inputTools) {
  if (!Array.isArray(inputTools)) return inputTools;

  return inputTools
    .map((tool) => {
      if (!tool || typeof tool !== 'object') return null;
      if (tool.type !== 'function') return tool;
      if (!tool.function || typeof tool.function !== 'object') return tool;

      const fn = tool.function;
      if (typeof fn.name !== 'string' || !fn.name.trim()) return tool;

      return {
        type: 'function',
        function: {
          name: fn.name,
          ...(fn.description !== undefined && { description: fn.description }),
          ...(fn.parameters !== undefined && { parameters: fn.parameters }),
          ...(fn.strict !== undefined && { strict: fn.strict }),
        },
      };
    })
    .filter(Boolean);
}

function normalizeToolChoicePayload(inputToolChoice) {
  if (inputToolChoice === undefined) return inputToolChoice;
  if (typeof inputToolChoice === 'string') return inputToolChoice;
  if (!inputToolChoice || typeof inputToolChoice !== 'object') {
    return inputToolChoice;
  }

  if (inputToolChoice.type === 'function') {
    const functionName =
      inputToolChoice.function?.name || inputToolChoice.name || null;
    if (typeof functionName === 'string' && functionName.trim()) {
      return {
        type: 'function',
        function: {
          name: functionName,
        },
      };
    }
  }

  return inputToolChoice;
}

function isToolChoiceRequired(inputToolChoice) {
  if (typeof inputToolChoice === 'string') {
    return inputToolChoice === 'required' || inputToolChoice === 'function';
  }

  if (!inputToolChoice || typeof inputToolChoice !== 'object') {
    return false;
  }

  return (
    inputToolChoice.type === 'function' || inputToolChoice.type === 'required'
  );
}

function isToolUnsupportedByModelError(statusCode, errorText) {
  if (statusCode !== 400 && statusCode !== 422) return false;
  if (typeof errorText !== 'string') return false;

  const normalizedError = errorText.toLowerCase();
  return (
    normalizedError.includes('does not support tools') ||
    normalizedError.includes('tools are not supported') ||
    normalizedError.includes('unsupported tools') ||
    normalizedError.includes('tool calling is not supported') ||
    normalizedError.includes('function calling is not supported') ||
    normalizedError.includes('unrecognized request argument supplied: tools') ||
    normalizedError.includes('unknown field "tools"') ||
    normalizedError.includes("unknown field 'tools'") ||
    (normalizedError.includes('unknown argument') &&
      normalizedError.includes('tools'))
  );
}

async function getModelConfig() {
  try {
    const { getModelsFromTables } = await import('@/lib/modelTables');
    let categories = await getModelsFromTables();

    if (!categories) {
      const { query } = await import('@/lib/postgres');
      const modelConfigResult = await query(
        'SELECT config FROM model_config WHERE config_type = $1 LIMIT 1',
        ['models']
      );
      categories = modelConfigResult.rows[0]?.config?.categories || null;
    }

    return categories ? { categories } : null;
  } catch (error) {
    console.warn('[Model Config] Model settings query failed:', error.message);
    return null;
  }
}

async function findModelRecord(modelId) {
  if (!modelId) return null;
  const modelConfig = await getModelConfig();
  if (!modelConfig?.categories) return null;

  const allModels = [];
  Object.values(modelConfig.categories).forEach((category) => {
    if (category.models && Array.isArray(category.models)) {
      allModels.push(...category.models);
    }
  });

  let found = allModels.find((m) => m.id === modelId);
  if (!found) {
    found = allModels.find((m) => m.modelName === modelId);
  }
  if (!found) {
    found = allModels.find(
      (m) => m.label && m.label.toLowerCase() === String(modelId).toLowerCase()
    );
  }
  if (!found) {
    const modelBase = String(modelId).split(':')[0];
    found = allModels.find((m) => {
      if (!m.modelName) return false;
      const mNameLower = m.modelName.toLowerCase();
      const modelIdLower = String(modelId).toLowerCase();
      return (
        mNameLower.includes(modelIdLower) ||
        mNameLower.startsWith(modelBase.toLowerCase() + ':')
      );
    });
  }
  return found || null;
}

function applyMultiturnLimit(messages, limit, unlimited) {
  if (!Array.isArray(messages)) return messages;
  if (unlimited) return messages;
  const numericLimit = Number.parseInt(limit, 10);
  if (!numericLimit || numericLimit <= 0) return messages;

  const systemMessages = messages.filter((msg) => msg?.role === 'system');
  const otherMessages = messages.filter((msg) => msg?.role !== 'system');
  const trimmed = otherMessages.slice(-(numericLimit * 2));
  return [...systemMessages, ...trimmed];
}

async function logOpenAIProxyRequest(data) {
  try {
    const { query } = await import('@/lib/postgres');
    const resolvedUserId =
      data.userId || data.user_id || data.jwtUserId || data.user?.id || null;
    await query(
      `INSERT INTO model_logs (type, level, category, method, endpoint, model, message, error, timestamp, metadata, provider, client_ip, user_agent, response_time, status_code, is_stream, prompt_tokens, completion_tokens, total_tokens, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        'openai_proxy_chat',
        data.level || 'info',
        data.category || 'openai_proxy_chat',
        data.method || 'POST',
        data.endpoint || '/v1/chat/completions',
        data.model || 'unknown',
        data.message || null,
        data.error || null,
        data.timestamp || new Date(),
        JSON.stringify(data.metadata || {}),
        data.provider || 'openai-compatible',
        data.clientIP || null,
        data.userAgent || null,
        data.responseTime || null,
        data.statusCode || null,
        data.isStream !== undefined ? data.isStream : null,
        data.promptTokens || null,
        data.completionTokens || null,
        data.totalTokens || null,
        resolvedUserId,
      ]
    );
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

// API token verification function
async function verifyApiToken(token) {
  try {
    // Verify JWT token
    const tokenPayload = jwt.verify(token, JWT_SECRET);

    // Check whether this is an API token (type must be 'api_token')
    if (tokenPayload.type !== 'api_token') {
      return { valid: false, error: 'Invalid token type. API token required.' };
    }

    // Create token hash
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
      .substring(0, 16);

    // Retrieve token info from DB
    const { query } = await import('@/lib/postgres');
    const userId = tokenPayload.sub || tokenPayload.id;

    const tokenResult = await query(
      'SELECT * FROM api_tokens WHERE token_hash = $1 AND user_id = $2 LIMIT 1',
      [tokenHash, userId]
    );

    if (tokenResult.rows.length === 0) {
      return { valid: false, error: 'API token not found.' };
    }

    const apiToken = {
      _id: tokenResult.rows[0].id,
      tokenHash: tokenResult.rows[0].token_hash,
      userId: tokenResult.rows[0].user_id,
      name: tokenResult.rows[0].name,
      isActive: tokenResult.rows[0].is_active,
      expiresAt: tokenResult.rows[0].expires_at,
      lastUsedAt: tokenResult.rows[0].last_used_at,
      createdAt: tokenResult.rows[0].created_at,
    };

    // Check whether token is active
    if (!apiToken.isActive) {
      return { valid: false, error: 'API token is inactive.' };
    }

    // Check whether token is expired
    if (apiToken.expiresAt && new Date(apiToken.expiresAt) < new Date()) {
      return { valid: false, error: 'API token has expired.' };
    }

    // Check whether JWT is expired
    if (tokenPayload.exp && tokenPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'API token has expired.' };
    }

    // Update token last-used time
    await query('UPDATE api_tokens SET last_used_at = $1 WHERE id = $2', [
      new Date(),
      apiToken._id,
    ]);

    return {
      valid: true,
      userInfo: {
        userId: tokenPayload.sub || tokenPayload.id,
        email: tokenPayload.email,
        name: tokenPayload.name,
        role: tokenPayload.role,
        department: tokenPayload.department,
        cell: tokenPayload.cell,
      },
      tokenInfo: {
        tokenHash,
        tokenId: apiToken._id.toString(),
        name: apiToken.name,
        issuedAt: tokenPayload.iat
          ? new Date(tokenPayload.iat * 1000).toISOString()
          : null,
        expiresAt: tokenPayload.exp
          ? new Date(tokenPayload.exp * 1000).toISOString()
          : null,
      },
    };
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'Invalid API token.' };
    }
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'API token has expired.' };
    }
    console.error('[API Token Verification] Error:', error);
    return { valid: false, error: 'Token verification failed.' };
  }
}

export async function POST(request) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent =
    request.headers.get('user-agent') ||
    request.headers.get('x-client-name') ||
    'unknown';

  // API token verification (required)
  let userInfo = null;
  let tokenHash = null;
  let tokenInfo = null;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      {
        error: {
          message:
            'Authorization header is required. Please provide a valid API token.',
          type: 'invalid_request_error',
        },
      },
      { status: 401 }
    );
  }

  const token = authHeader.split(' ')[1];
  const verificationResult = await verifyApiToken(token);

  if (!verificationResult.valid) {
    return NextResponse.json(
      {
        error: {
          message: verificationResult.error || 'Invalid API token.',
          type: 'invalid_request_error',
        },
      },
      { status: 401 }
    );
  }

  userInfo = verificationResult.userInfo;
  tokenInfo = verificationResult.tokenInfo;
  tokenHash = tokenInfo.tokenHash;

  // If X-User-Name header is missing, fetch actual name from DB
  let actualUserName = request.headers.get('x-user-name');
  if (!actualUserName && userInfo?.userId) {
    try {
      const { query } = await import('@/lib/postgres');
      const userResult = await query(
        'SELECT name FROM users WHERE id = $1 LIMIT 1',
        [userInfo.userId]
      );
      if (userResult.rows.length > 0 && userResult.rows[0].name) {
        actualUserName = userResult.rows[0].name;
      }
    } catch (error) {
      console.error('[X-User-Name] DB query failed:', error);
      // Continue even if lookup fails
    }
  }

  // Collect additional header metadata for external API logging
  const identificationHeaders = {
    // === Basic proxy information ===
    xForwardedFor: request.headers.get('x-forwarded-for'),
    xRealIP: request.headers.get('x-real-ip'),
    xForwardedProto: request.headers.get('x-forwarded-proto'),
    xForwardedHost: request.headers.get('x-forwarded-host'),

    // === Client information ===
    acceptLanguage: request.headers.get('accept-language'),
    acceptEncoding: request.headers.get('accept-encoding'),
    acceptCharset: request.headers.get('accept-charset'),
    referer: request.headers.get('referer'),
    origin: request.headers.get('origin'),
    contentType: request.headers.get('content-type'),

    // === Security and authentication ===
    authorization: authHeader ? 'present' : 'absent',
    tokenHash: tokenHash || null,

    // === User info extracted from JWT (if available) ===
    ...(userInfo && {
      jwtUserId: userInfo.userId,
      jwtEmail: userInfo.email,
      jwtName: userInfo.name,
      jwtRole: userInfo.role,
      jwtDepartment: userInfo.department,
      jwtCell: userInfo.cell,
    }),

    // === Token metadata ===
    ...(tokenInfo && {
      tokenIssuedAt: tokenInfo.issuedAt,
      tokenExpiresAt: tokenInfo.expiresAt,
      tokenIsExpired: tokenInfo.isExpired,
    }),

    // === Custom identification headers (priority: header > DB lookup > JWT) ===
    // User identification
    xUserId: request.headers.get('x-user-id') || userInfo?.userId || null,
    xUserName: actualUserName || null,
    xUserEmail: request.headers.get('x-user-email') || userInfo?.email || null,

    // Organization/project identification
    xOrganizationId: request.headers.get('x-organization-id'),
    xProjectId: request.headers.get('x-project-id'),
    xEnvironment: request.headers.get('x-environment'), // 'dev', 'staging', 'prod'

    // Client information
    xRequestedWith: request.headers.get('x-requested-with'),
    xClientName: request.headers.get('x-client-name'),
    xClientVersion: request.headers.get('x-client-version'),
    xWorkspace: request.headers.get('x-workspace'),
    xSessionId: request.headers.get('x-session-id'),
    xRequestId: request.headers.get('x-request-id'), // Unique ID for request tracing

    // === Timezone information ===
    timezone:
      request.headers.get('x-timezone') ||
      request.headers.get('timezone') ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-User-Id, X-Organization-Id, X-Project-Id, X-Environment, X-Client-Name, X-Client-Version, X-User-Name, X-Workspace, X-Session-Id, X-Request-Id',
  };

  try {
    // Read and preserve raw request body text first (for recovering improperly serialized objects)
    let rawBodyText = null;
    let body;
    try {
      rawBodyText = await request.text();
      body = JSON.parse(rawBodyText);
    } catch (jsonError) {
      console.error('[OpenAI Chat Completions] JSON parse error:', jsonError);
      if (rawBodyText) {
        console.error(
          '[OpenAI Chat Completions] Raw body that failed to parse:',
          rawBodyText.substring(0, 1000)
        );
      }
      return NextResponse.json(
        {
          error: {
            message: 'Invalid JSON in request body',
            type: 'invalid_request_error',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate OpenAI format
    if (!body.model || !body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        {
          error: {
            message: 'Missing required fields: model and messages',
            type: 'invalid_request_error',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    let { model, messages, stream = false, tools, tool_choice, temperature, max_tokens, top_p, stop, presence_penalty, frequency_penalty, seed, response_format, n, user } = body;
    tools = normalizeToolsPayload(tools);
    tool_choice = normalizeToolChoicePayload(tool_choice);

    // Validate and normalize the content field in the messages array
    // Handle cases where content is an object or array, and detect improperly serialized "[object Object]" strings
    // Create a deep copy to preserve the original
    const originalMessages = JSON.parse(JSON.stringify(body.messages || []));

    for (let index = 0; index < messages.length; index++) {
      const msg = messages[index];

      if (!msg || typeof msg !== 'object') {
        console.warn(
          `[OpenAI Chat Completions] Invalid message format (index ${index}):`,
          msg
        );
        continue;
      }

      const { role, content } = msg;

      // If content is an improperly serialized string starting with "[object Object]"
      if (typeof content === 'string' && content.includes('[object Object]')) {
        console.warn(
          `[OpenAI Chat Completions] Detected improperly serialized content (index ${index}): "${content.substring(
            0,
            100
          )}"`
        );

        // Re-check this message's content in the original body
        const originalMsg = originalMessages[index];
        if (
          originalMsg &&
          originalMsg.content &&
          typeof originalMsg.content !== 'string'
        ) {
          // If original is object/array, use it correctly
          messages[index] = {
            ...msg,
            content: originalMsg.content,
          };
          continue;
        }

        // If original is also a string, try checking raw data from original body
        const rawBodyMsg = body.messages && body.messages[index];
        if (
          rawBodyMsg &&
          rawBodyMsg.content &&
          typeof rawBodyMsg.content !== 'string'
        ) {
          messages[index] = {
            ...msg,
            content: rawBodyMsg.content,
          };
          continue;
        }

        // If original is also a string, try extracting this message from raw JSON text
        if (rawBodyText) {
          try {
            const rawBodyParsed = JSON.parse(rawBodyText);
            const rawMessage =
              rawBodyParsed.messages && rawBodyParsed.messages[index];
            if (
              rawMessage &&
              rawMessage.content &&
              typeof rawMessage.content !== 'string'
            ) {
              messages[index] = {
                ...msg,
                content: rawMessage.content,
              };
              continue;
            }
          } catch (e) {
            console.warn(
              '[OpenAI Chat Completions] Failed to parse rawBody:',
              e?.message || e
            );
          }
        }

        // If original is also a string, return an error
        console.error(
          `[OpenAI Chat Completions] Unable to recover improperly serialized content (index ${index})`
        );
        return NextResponse.json(
          {
            error: {
              message: `Invalid content format in message at index ${index}. Content appears to be incorrectly serialized: "${content.substring(
                0,
                100
              )}". Please ensure content is properly serialized as a string, array, or valid object.`,
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }

      // If content is an object (single object, not array) - might not be OpenAI multimodal format
      if (content && typeof content === 'object' && !Array.isArray(content)) {
        // Check whether it is OpenAI multimodal format (has type field)
        if (!content.type) {
          console.warn(
            `[OpenAI Chat Completions] content is object format but not multimodal format (index ${index}). Converting to JSON string.`
          );
          // Convert object to JSON string
          try {
            messages[index] = {
              ...msg,
              content: JSON.stringify(content),
            };
          } catch (e) {
            console.error(
              `[OpenAI Chat Completions] Failed to serialize content object (index ${index}):`,
              e
            );
            return NextResponse.json(
              {
                error: {
                  message: `Failed to serialize content object in message at index ${index}.`,
                  type: 'invalid_request_error',
                },
              },
              { status: 400, headers: corsHeaders }
            );
          }
        }
      }
    }

    // Parse server info from model name (e.g., "spark-ollama-gemma3:27b")
    let { serverName, modelName: parsedModelName } = parseModelName(model);

    // Determine actual model name (use parsed model name if server info exists, otherwise use original)
    let actualModelName = serverName ? parsedModelName : model;

    // Convert model name to actual model ID (supports display names)
    const resolvedModel = await resolveModelId(actualModelName);
    if (resolvedModel !== actualModelName) {
      actualModelName = resolvedModel;
    }

    // Set final model name
    model = actualModelName;

    const matchedModel =
      (await findModelRecord(model)) || (await findModelRecord(actualModelName));
    if (matchedModel) {
      messages = applyMultiturnLimit(
        messages,
        matchedModel.multiturnLimit,
        matchedModel.multiturnUnlimited
      );
    }
    const manualEndpoint =
      matchedModel?.endpoint && String(matchedModel.endpoint).trim().toLowerCase() === 'manual';

    if (manualEndpoint) {
      if (!matchedModel?.apiConfig) {
        return NextResponse.json(
          {
            error: {
               message: 'Manual API configuration is missing.',
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }

      let manualConfig;
      try {
        manualConfig =
          typeof matchedModel.apiConfig === 'string'
            ? JSON.parse(matchedModel.apiConfig)
            : matchedModel.apiConfig;
      } catch (error) {
        return NextResponse.json(
          {
            error: {
               message: 'Failed to parse Manual API configuration JSON.',
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const lastUserMessage = [...messages]
        .reverse()
        .find((msg) => msg?.role === 'user')?.content;

      const context = {
        apiKey: (matchedModel.apiKey || process.env.OPENAI_API_KEY || '').trim(),
        messages,
        message:
          typeof lastUserMessage === 'string'
            ? lastUserMessage
            : JSON.stringify(lastUserMessage || ''),
      };

      const manualUrl = applyTemplate(manualConfig?.url, context);
      if (!manualUrl) {
        return NextResponse.json(
          {
            error: {
               message: 'Manual API URL is not configured.',
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const method = (manualConfig?.method || 'POST').toUpperCase();
      const headers = applyTemplate(manualConfig?.headers || {}, context);
      let body = applyTemplate(manualConfig?.body, context);
      const manualStreamSupported = manualConfig?.stream === true;
      const manualStreamEnabled = stream === true;

      if (
        manualUrl.includes('/v1/responses') &&
        body &&
        typeof body === 'object' &&
        body.input === context.message &&
        Array.isArray(context.messages) &&
        context.messages.length > 1
      ) {
        body = { ...body, input: context.messages };
      }

      if (manualStreamEnabled && !manualStreamSupported) {
        return NextResponse.json(
          {
            error: {
              message: 'Manual API does not support streaming on this endpoint.',
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }

      if (body && typeof body === 'object') {
        if (manualStreamEnabled) {
          body = { ...body, stream: true };
        } else if (body.stream !== undefined) {
          body = { ...body, stream: false };
        }
      }

      const requestOptions = {
        method,
        headers,
      };
      if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
        requestOptions.body =
          typeof body === 'string' ? body : JSON.stringify(body);
      }

      const startAt = Date.now();
      let manualRes;
      try {
        manualRes = await fetch(manualUrl, requestOptions);
      } catch (error) {
        return NextResponse.json(
          {
            error: {
              message: `Model server connection error: ${error.message}`,
              type: 'server_error',
              details: {
                endpoint: manualUrl,
                error: error.message,
              },
            },
          },
          { status: 500, headers: corsHeaders }
        );
      }

      const responseTime = Date.now() - startAt;
      const promptTokens = messages.reduce(
        (acc, msg) => acc + (msg.content?.length || 0),
        0
      );

      const manualRetryCount = 0;

      if (!manualRes.ok) {
        const errorText = await manualRes.text().catch(() => '');
        Promise.all([
          logOpenAIProxyRequest({
            provider: 'manual',
            level: 'error',
            category: 'openai_proxy_chat',
            endpoint: '/v1/chat/completions',
            model,
            clientIP,
            userAgent,
            userId: userInfo?.userId,
            responseTime,
            statusCode: manualRes.status,
            error: errorText,
            promptTokens,
            completionTokens: 0,
            totalTokens: promptTokens,
          }),
          logExternalApiRequest({
            sourceType: 'external',
            provider: 'manual',
            apiType: 'chat',
            endpoint: '/v1/chat/completions',
            model,
            messages: [
              ...messages,
              ...(responseContent
                ? [{ role: 'assistant', content: responseContent }]
                : []),
            ],
            responseTokenCount: 0,
            promptTokenCount: promptTokens,
            responseTime,
            statusCode: manualRes.status,
            isStream: false,
            error: errorText,
            retryCount: manualRetryCount,
            clientIP,
            userAgent,
            jwtUserId: userInfo?.userId,
            jwtEmail: userInfo?.email,
            jwtName: actualUserName || userInfo?.name,
            jwtRole: userInfo?.role,
            jwtDepartment: userInfo?.department,
            jwtCell: userInfo?.cell,
            tokenHash: tokenInfo?.tokenHash,
            tokenName: tokenInfo?.name,
            ...identificationHeaders,
          }),
        ]).catch((logError) => {
          console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
        });

        return NextResponse.json(
          {
            error: {
              message: `Model server error: ${manualRes.status}`,
              type: 'server_error',
            },
          },
          { status: manualRes.status, headers: corsHeaders }
        );
      }

      if (manualStreamEnabled) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8');
        let streamedResponseLength = 0;
        let streamedResponseText = '';
        let sawDelta = false;
        let firstResponseAt = null;

        const streamResponse = new ReadableStream({
          async start(controller) {
            const reader = manualRes.body.getReader();
            let buffer = '';
            let currentEvent = '';

            const emitDelta = (text) => {
              if (!text) return;
              sawDelta = true;
              if (!firstResponseAt) {
                firstResponseAt = Date.now();
              }
              streamedResponseText += text;
              streamedResponseLength += text.length;
              const payload = {
                id: createChatCompletionId(),
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [
                  {
                    index: 0,
                    delta: { content: text },
                    finish_reason: null,
                  },
                ],
              };
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
              );
            };

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (!line.trim()) {
                    currentEvent = '';
                    continue;
                  }
                  if (line.startsWith('event:')) {
                    currentEvent = line.slice(6).trim();
                    continue;
                  }
                  if (!line.startsWith('data:')) continue;

                  const data = line.slice(5).trim();
                  if (data === '[DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                    return;
                  }

                  let parsed;
                  try {
                    parsed = JSON.parse(data);
                  } catch (error) {
                    continue;
                  }

                  if (parsed?.choices?.[0]?.delta?.content) {
                    emitDelta(parsed.choices[0].delta.content);
                    continue;
                  }

                  if (
                    currentEvent === 'response.output_text.delta' ||
                    parsed?.type === 'response.output_text.delta'
                  ) {
                    emitDelta(parsed?.delta);
                    continue;
                  }

                  if (
                    currentEvent === 'response.output_text.done' ||
                    parsed?.type === 'response.output_text.done'
                  ) {
                    if (!sawDelta) {
                      emitDelta(parsed?.text);
                    }
                  }
                }
              }
            } catch (streamError) {
              controller.error(streamError);
            } finally {
              const loggedMessages = streamedResponseText
                ? [
                    ...messages,
                    { role: 'assistant', content: streamedResponseText },
                  ]
                : messages;
              Promise.all([
                logOpenAIProxyRequest({
                  provider: 'manual',
                  level: 'info',
                  category: 'openai_proxy_chat',
                  endpoint: '/v1/chat/completions',
                  model,
                  clientIP,
                  userAgent,
                  userId: userInfo?.userId,
                  responseTime: Date.now() - startAt,
                  statusCode: manualRes.status,
                  promptTokens,
                  completionTokens: streamedResponseLength,
                  totalTokens: promptTokens + streamedResponseLength,
                }),
                logExternalApiRequest({
                  sourceType: 'external',
                  provider: 'manual',
                  apiType: 'chat',
                  endpoint: '/v1/chat/completions',
                  model,
                  messages: loggedMessages,
                  responseTokenCount: streamedResponseLength,
                  promptTokenCount: promptTokens,
                  responseTime: Date.now() - startAt,
                  firstResponseTime: firstResponseAt
                    ? firstResponseAt - startAt
                    : Date.now() - startAt,
                  finalResponseTime: Date.now() - startAt,
                  statusCode: manualRes.status,
                  isStream: true,
                  retryCount: manualRetryCount,
                  clientIP,
                  userAgent,
                  jwtUserId: userInfo?.userId,
                  jwtEmail: userInfo?.email,
                  jwtName: actualUserName || userInfo?.name,
                  jwtRole: userInfo?.role,
                  jwtDepartment: userInfo?.department,
                  jwtCell: userInfo?.cell,
                  tokenHash: tokenInfo?.tokenHash,
                  tokenName: tokenInfo?.name,
                  ...identificationHeaders,
                }),
              ]).catch((logError) => {
                console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
              });

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          },
        });

        return new Response(streamResponse, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            ...corsHeaders,
          },
        });
      }

      let responseText = '';
      let responseJson = null;
      const contentType = manualRes.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        responseJson = await manualRes.json();
      } else {
        responseText = await manualRes.text();
      }

      let responseContent = '';
      if (responseJson && manualConfig?.responseMapping?.path) {
        const mapped = getValueByPath(
          responseJson,
          manualConfig.responseMapping.path
        );
        responseContent =
          typeof mapped === 'string' ? mapped : JSON.stringify(mapped || '');
      } else if (responseJson) {
        responseContent =
          responseJson.choices?.[0]?.message?.content ||
          responseJson.choices?.[0]?.text ||
          JSON.stringify(responseJson);
      } else {
        responseContent = responseText;
      }

      const completionTokens = responseContent.length;
      const openaiResponse = {
        id: createChatCompletionId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseContent,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };

      Promise.all([
        logOpenAIProxyRequest({
          provider: 'manual',
          level: 'info',
          category: 'openai_proxy_chat',
          endpoint: '/v1/chat/completions',
          model,
          clientIP,
          userAgent,
          userId: userInfo?.userId,
          responseTime,
          statusCode: manualRes.status,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        }),
        logExternalApiRequest({
          sourceType: 'external',
          provider: 'manual',
          apiType: 'chat',
          endpoint: '/v1/chat/completions',
          model,
          messages,
          responseTokenCount: completionTokens,
          promptTokenCount: promptTokens,
          responseTime,
          statusCode: manualRes.status,
          isStream: false,
          retryCount: manualRetryCount,
          clientIP,
          userAgent,
          jwtUserId: userInfo?.userId,
          jwtEmail: userInfo?.email,
          jwtName: actualUserName || userInfo?.name,
          jwtRole: userInfo?.role,
          jwtDepartment: userInfo?.department,
          jwtCell: userInfo?.cell,
          tokenHash: tokenInfo?.tokenHash,
          tokenName: tokenInfo?.name,
          ...identificationHeaders,
        }),
      ]).catch((logError) => {
        console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
      });

      return NextResponse.json(openaiResponse, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 모델 ID가 변환되었으면 다시 파싱하여 서버 이름 추출
    // (부분 일치로 변환된 경우 서버 이름이 달라질 수 있음)
    const reparsed = parseModelName(model);

    // DB 설정에서 서버 이름 확인 (가장 정확함)
    const { getServerNameForModel, getModelServerEndpointsByName } =
      await import('@/lib/modelServers');
    const dbServerName = await getServerNameForModel(model);

    if (dbServerName) {
      // DB 설정에서 찾은 서버 이름이 실제로 존재하는지 확인
      const serverEndpoints = await getModelServerEndpointsByName(dbServerName);
      if (serverEndpoints && serverEndpoints.length > 0) {
        // 실제로 존재하는 서버 이름이므로 사용
        serverName = dbServerName;
      } else {
        // DB에서 찾은 서버 이름이 실제로 존재하지 않으므로 무시
        console.warn(
          `[OpenAI Chat Completions] DB에서 찾은 서버 이름 "${dbServerName}"이 실제로 존재하지 않습니다. 서버 이름을 사용하지 않습니다.`
        );
        serverName = null;
      }
    } else if (!serverName && reparsed.serverName) {
      // DB에서 찾지 못했고 원본 파싱에 서버 이름이 없으면, 재파싱 결과 검증 후 사용
      const serverEndpoints = await getModelServerEndpointsByName(
        reparsed.serverName
      );
      if (serverEndpoints && serverEndpoints.length > 0) {
        serverName = reparsed.serverName;
      } else {
        // 파싱된 서버 이름이 실제로 존재하지 않으므로 무시
        serverName = null;
      }
    }

    // 서버 이름이 지정된 경우 해당 서버로 직접 호출, 없으면 라운드로빈 사용
    let modelServerEndpoint;
    let provider;
    let roundRobinIndex = null;

    if (serverName) {
      // 지정된 서버 이름으로 호출 (같은 이름의 서버가 여러 개 있으면 라운드로빈)
      const serverEndpoint = await getModelServerEndpointByName(serverName);
      if (serverEndpoint) {
        modelServerEndpoint = serverEndpoint.endpoint;
        provider = serverEndpoint.provider;
        roundRobinIndex = serverEndpoint.index;
      } else {
        console.error(
          `[OpenAI Chat Completions] 서버 이름 "${serverName}"을 Not found. 모델 "${model}"은(는) 해당 서버 그룹에만 존재합니다.`
        );
        return NextResponse.json(
          {
            error: {
              message: `Model server group "${serverName}" not found for model "${model}". Please check the model configuration.`,
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    } else {
      // 서버 이름이 없는 경우, 표시 이름 기반 라운드로빈 시도
      const labelBasedEndpoint = await getModelServerEndpointByLabel(model);
      if (labelBasedEndpoint) {
        modelServerEndpoint = labelBasedEndpoint.endpoint;
        provider = labelBasedEndpoint.provider;
        roundRobinIndex = labelBasedEndpoint.index;
      } else {
        // 표시 이름 기반 라운드로빈도 실패하면 전체 라운드로빈 사용
        const roundRobinResult = await getNextModelServerEndpointWithIndex();
        modelServerEndpoint = roundRobinResult.endpoint;
        provider = roundRobinResult.provider;
        roundRobinIndex = roundRobinResult.index;
      }
    }

    if (!modelServerEndpoint) {
      console.error(
        '[OpenAI Chat Completions] 모델 서버 엔드포인트가 설정되지 않았습니다.'
      );
      return NextResponse.json(
        {
          error: {
            message:
              'Model server endpoint not configured. Please configure model server in admin settings or set OLLAMA_ENDPOINTS environment variable.',
            type: 'server_error',
          },
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // API key 가져오기 (Gemini provider용)
    let apiKey = '';
    if (provider === 'gemini') {
      try {
        const { query } = await import('@/lib/postgres');
        const settingsResult = await query(
          'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
          ['general']
        );
        if (settingsResult.rows.length > 0) {
          const customEndpoints = settingsResult.rows[0].custom_endpoints || [];
          const endpointConfig = customEndpoints.find(
            (e) => e.url && e.url.trim() === modelServerEndpoint.trim()
          );
          if (endpointConfig && endpointConfig.apiKey) {
            apiKey = endpointConfig.apiKey;
          }
        }
      } catch (e) {
        console.warn('[OpenAI Chat Completions] API key 조회 실패:', e.message);
      }
      if (!apiKey) {
        return NextResponse.json(
          {
            error: {
              message: 'Gemini API key is required but not configured.',
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // provider에 따라 엔드포인트 경로 결정
    // openai-compatible: /v1/chat/completions
    // gemini: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    // model-server (Ollama): /api/chat
    let modelServerUrl;
    if (provider === 'gemini') {
      const baseUrl =
        modelServerEndpoint.replace(/\/+$/, '') ||
        'https://generativelanguage.googleapis.com';

      // Gemini 모델 이름 정규화
      // 1. "models/" 접두사 제거 (Gemini API에서 반환하는 형식)
      // 2. 버전 태그(:latest 등) 제거
      // 3. 공백 제거
      // 예: "models/gemini-pro:latest" -> "gemini-pro"
      let normalizedModel = model.trim();

      // "models/" 접두사 제거
      if (normalizedModel.startsWith('models/')) {
        normalizedModel = normalizedModel.substring(7);
      }

      // 버전 태그 제거 (콜론 이후 부분)
      normalizedModel = normalizedModel.split(':')[0].trim();

      // 슬래시가 남아있으면 제거 (안전장치)
      normalizedModel = normalizedModel.split('/').pop().trim();

      if (!normalizedModel) {
        return NextResponse.json(
          {
            error: {
              message: `유효하지 않은 모델 이름입니다: "${model}"`,
              type: 'invalid_request_error',
            },
          },
          { status: 400, headers: corsHeaders }
        );
      }

      const action = stream ? 'streamGenerateContent' : 'generateContent';
      modelServerUrl = `${baseUrl}/v1beta/models/${normalizedModel}:${action}?key=${apiKey}`;

      console.log(
        `[OpenAI Chat Completions] Gemini API 호출: 모델=${normalizedModel} (원본=${model})`
      );
    } else {
      const endpointPath =
        provider === 'openai-compatible' ? '/v1/chat/completions' : '/api/chat';
      modelServerUrl = `${modelServerEndpoint}${endpointPath}`;
    }

    // provider에 따라 요청 본문 형식 결정
    let requestBody;
    if (provider === 'gemini') {
      // Gemini API 형식으로 변환
      const convertToGeminiFormat = (messages) => {
        const contents = [];
        for (const msg of messages) {
          const role = msg.role === 'assistant' ? 'model' : 'user';
          const parts = [];

          // content를 문자열로 변환
          let textContent = '';
          if (typeof msg.content === 'string') {
            textContent = msg.content;
          } else if (Array.isArray(msg.content)) {
            textContent = msg.content
              .map((item) => {
                if (typeof item === 'string') return item;
                if (item?.type === 'text' && item.text) return item.text;
                return '';
              })
              .filter(Boolean)
              .join('\n');
          } else if (msg.content && typeof msg.content === 'object') {
            textContent = JSON.stringify(msg.content);
          } else {
            textContent = String(msg.content || '');
          }

          if (textContent) {
            parts.push({ text: textContent });
          }

          if (parts.length > 0) {
            contents.push({ role, parts });
          }
        }
        return { contents };
      };

      requestBody = convertToGeminiFormat(messages);
    } else if (provider === 'openai-compatible') {
      // OpenAI 호환 서버: 원본 OpenAI 형식 그대로 사용 (tools, tool_choice 포함 모든 파라미터 pass-through)
      requestBody = {
        model,
        messages,
        stream,
        ...(tools !== undefined && { tools }),
        ...(tool_choice !== undefined && { tool_choice }),
        ...(temperature !== undefined && { temperature }),
        ...(max_tokens !== undefined && { max_tokens }),
        ...(top_p !== undefined && { top_p }),
        ...(stop !== undefined && { stop }),
        ...(presence_penalty !== undefined && { presence_penalty }),
        ...(frequency_penalty !== undefined && { frequency_penalty }),
        ...(seed !== undefined && { seed }),
        ...(response_format !== undefined && { response_format }),
        ...(n !== undefined && { n }),
        ...(user !== undefined && { user }),
      };
    } else {
      // Ollama 서버: OpenAI 형식을 Ollama 형식으로 변환
      // Ollama는 content를 문자열로만 받지만, OpenAI는 배열(멀티모달)도 지원
      const convertContentToString = (content) => {
        if (typeof content === 'string') {
          return content;
        }
        if (Array.isArray(content)) {
          // 멀티모달 콘텐츠 배열 처리
          return content
            .map((item) => {
              if (typeof item === 'string') {
                return item;
              }
              if (item && typeof item === 'object') {
                // OpenAI 멀티모달 형식 처리
                if (item.type === 'text' && item.text) {
                  return item.text;
                }
                if (item.type === 'image_url') {
                  // Ollama는 이미지 미지원이므로 경고만 남기고 무시
                  console.warn(
                    '[OpenAI Chat Completions] 이미지 콘텐츠는 Ollama에서 지원되지 않습니다.'
                  );
                  return '';
                }
                // type 필드가 없는 일반 객체인 경우 JSON 문자열로 변환
                try {
                  return JSON.stringify(item, null, 2);
                } catch (e) {
                  console.warn(
                    '[OpenAI Chat Completions] 배열 항목 직렬화 실패:',
                    e
                  );
                  return String(item);
                }
              }
              // 기타 타입은 문자열로 변환
              return String(item || '');
            })
            .filter(Boolean)
            .join('\n');
        }
        // 객체인 경우 JSON 문자열로 변환
        if (content && typeof content === 'object') {
          try {
            return JSON.stringify(content, null, 2);
          } catch (e) {
            console.warn(
              `[OpenAI Chat Completions] ⚠️ content 객체 직렬화 실패: 원본 타입=${typeof content}, 값=${JSON.stringify(
                content
              )}`
            );
            return String(content || '');
          }
        }
        // 기타 타입은 문자열로 변환
        const converted = String(content || '');
        if (
          converted === '[object Object]' ||
          converted.includes('[object Object]')
        ) {
          console.warn(
            `[OpenAI Chat Completions] ⚠️ content가 "[object Object]"로 변환됨: 원본 타입=${typeof content}, 값=${JSON.stringify(
              content
            )}`
          );
        }
        return converted;
      };

      const ollamaMessages = messages.map((msg, idx) => {
        const originalContent = msg.content;
        const convertedContent = convertContentToString(msg.content);

        return {
          role: msg.role,
          content: convertedContent,
        };
      });

      // Ollama options 구성 (temperature 등은 options 하위에 위치)
      const ollamaOptions = {};
      if (temperature !== undefined) ollamaOptions.temperature = temperature;
      if (top_p !== undefined) ollamaOptions.top_p = top_p;
      if (max_tokens !== undefined) ollamaOptions.num_predict = max_tokens;
      if (stop !== undefined) ollamaOptions.stop = Array.isArray(stop) ? stop : [stop];

      requestBody = {
        model,
        messages: ollamaMessages,
        stream,
        ...(tools !== undefined && { tools }),
        ...(tool_choice !== undefined && { tool_choice }),
        ...(Object.keys(ollamaOptions).length > 0 && { options: ollamaOptions }),
      };
    }

    /**
     * 단일 모델 서버 호출 실행
     * @param {string} url - 모델 서버 URL
     * @param {object} options - fetch 옵션
     * @returns {Promise<Response>} 모델 서버 응답
     */
    async function fetchModelServer(url, options) {
      // 타임아웃 설정 (환경변수로 설정 가능)
      const timeoutMs = stream
        ? MODEL_SERVER_TIMEOUT_STREAM
        : MODEL_SERVER_TIMEOUT_NORMAL;

      // AbortController를 사용한 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      try {
        const fetchOptions = {
          ...options,
          signal: controller.signal,
        };

        const response = await fetch(url, fetchOptions);

        // 성공 시 타임아웃 정리
        clearTimeout(timeoutId);

        return response;
      } catch (fetchErr) {
        // fetch 실패 시 타임아웃 정리
        clearTimeout(timeoutId);
        throw fetchErr;
      }
    }

    /**
     * 모델 서버 호출 헬퍼 (재시도 로직 포함)
     * 첫 번째 시도에서 성공하면 재시도 로직을 실행하지 않음
     * @param {string} url - 모델 서버 URL
     * @param {object} options - fetch 옵션
     * @param {number} maxRetries - 최대 재시도 횟수
     * @param {string} specifiedServerName - 지정된 서버 이름 (있는 경우)
     * @param {string} currentProvider - 현재 provider
     * @param {string} modelId - 모델 ID (표시 이름 기반 라운드로빈용)
     * @returns {Promise<{response: Response, retryCount: number}>} 모델 서버 응답과 재시도 횟수
     */
    async function fetchWithRetry(
      url,
      options,
      maxRetries = 2,
      specifiedServerName = null,
      currentProvider = 'model-server',
      modelId = null
    ) {
      // 첫 번째 시도 (1번만에 성공하면 재시도 로직 실행 안 함)
      try {
        const response = await fetchModelServer(url, options);

        // HTTP 응답 상태 코드 확인
        if (!response.ok) {
          const status = response.status;
          const isRetryableHttpError =
            status === 404 || // Not Found
            status === 502 || // Bad Gateway
            status === 503 || // Service Unavailable
            status === 504; // Gateway Timeout

          // HTTP 오류 응답 본문 읽기 (에러 정보 확인용)
          let errorBody = '';
          try {
            const clonedResponse = response.clone();
            errorBody = await clonedResponse.text();
          } catch (e) {
            console.warn(
              '[OpenAI Chat Completions] 응답 본문 읽기 실패:',
              e?.message || e
            );
          }

          if (isRetryableHttpError && maxRetries > 0) {
            console.error(
              `[OpenAI Chat Completions] HTTP ${status} 오류, 재시도 예정`
            );
          } else {
            console.error(
              `[OpenAI Chat Completions] HTTP ${status} 오류: ${errorBody.substring(
                0,
                200
              )}`
            );
            return { response, retryCount: 1 };
          }

          // 재시도 가능한 오류면 재시도 로직으로 진행
        } else {
          // 첫 번째 시도에서 성공 - 재시도 로직 실행 안 함
          return { response, retryCount: 1 };
        }
      } catch (error) {
        // 네트워크 오류인지 확인
        const isRetryable =
          error.name === 'AbortError' ||
          error.name === 'TimeoutError' ||
          error.code === 'ECONNREFUSED' ||
          error.code === 'ETIMEDOUT' ||
          error.message?.includes('fetch failed') ||
          error.message?.includes('timeout');

        // 재시도 불가능한 오류면 바로 throw
        if (!isRetryable || maxRetries === 0) {
          console.error(
            `[OpenAI Chat Completions] 모델 서버 호출 실패 (재시도 불가): ${error.message}`
          );
          throw error;
        }

        // 재시도 가능한 오류면 재시도 로직으로 진행
        console.warn(
          `[OpenAI Chat Completions] 모델 서버 호출 실패, 재시도 예정: ${error.message}`
        );
      }

      // 재시도 로직 (첫 번째 시도가 실패한 경우에만 실행)
      let lastError;
      let lastResponse;
      let retryUrl = url; // 초기값은 원본 URL

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // 지정된 서버가 있으면 같은 서버로 재시도, 없으면 다른 인스턴스로 재시도
          let nextEndpoint;
          let nextProvider;

          if (specifiedServerName) {
            // 지정된 서버로 재시도 (같은 이름의 서버가 여러 개 있으면 라운드로빈)
            const serverEndpoint = await getModelServerEndpointByName(
              specifiedServerName
            );
            if (serverEndpoint) {
              nextEndpoint = serverEndpoint.endpoint;
              nextProvider = serverEndpoint.provider;
            } else {
              // 지정된 서버를 찾을 수 없으면 원본 URL 사용
              nextEndpoint = url.split('/api/')[0].split('/v1/')[0];
              nextProvider = currentProvider;
            }
          } else {
            // 서버 이름이 없는 경우, 표시 이름 기반 라운드로빈 시도
            if (modelId) {
              const labelBasedEndpoint = await getModelServerEndpointByLabel(
                modelId
              );
              if (labelBasedEndpoint) {
                nextEndpoint = labelBasedEndpoint.endpoint;
                nextProvider = labelBasedEndpoint.provider;
              } else {
                // 표시 이름 기반 라운드로빈도 실패하면 전체 라운드로빈 사용
                const roundRobinResult =
                  await getNextModelServerEndpointWithIndex();
                nextEndpoint = roundRobinResult.endpoint;
                nextProvider = roundRobinResult.provider;
              }
            } else {
              // 라운드로빈: 다른 모델 서버 인스턴스로 재시도
              const roundRobinResult =
                await getNextModelServerEndpointWithIndex();
              nextEndpoint = roundRobinResult.endpoint;
              nextProvider = roundRobinResult.provider;
            }
          }

          // Gemini provider인 경우 API key 가져오기 및 URL 구성
          if (nextProvider === 'gemini') {
            let nextApiKey = '';
            try {
              const { query } = await import('@/lib/postgres');
              const settingsResult = await query(
                'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
                ['general']
              );
              if (settingsResult.rows.length > 0) {
                const customEndpoints =
                  settingsResult.rows[0].custom_endpoints || [];
                const endpointConfig = customEndpoints.find(
                  (e) => e.url && e.url.trim() === nextEndpoint.trim()
                );
                if (endpointConfig && endpointConfig.apiKey) {
                  nextApiKey = endpointConfig.apiKey;
                }
              }
            } catch (e) {
              console.warn(
                '[OpenAI Chat Completions] 재시도 시 API key 조회 실패:',
                e.message
              );
            }
            if (nextApiKey) {
              const baseUrl =
                nextEndpoint.replace(/\/+$/, '') ||
                'https://generativelanguage.googleapis.com';
              const action = stream
                ? 'streamGenerateContent'
                : 'generateContent';
              retryUrl = `${baseUrl}/v1beta/models/${
                modelId || model
              }:${action}?key=${nextApiKey}`;
            } else {
              // API key가 없으면 재시도 불가
              throw new Error('Gemini API key not found for retry');
            }
          } else {
            const nextEndpointPath =
              nextProvider === 'openai-compatible'
                ? '/v1/chat/completions'
                : '/api/chat';
            retryUrl = `${nextEndpoint}${nextEndpointPath}`;
          }

          // 재시도 전 대기 (환경변수로 설정 가능)
          await new Promise((resolve) =>
            setTimeout(resolve, MODEL_SERVER_RETRY_DELAY)
          );

          const response = await fetchModelServer(retryUrl, options);

          // HTTP 응답 상태 코드 확인
          if (!response.ok) {
            const status = response.status;
            const isRetryableHttpError =
              status === 404 ||
              status === 502 ||
              status === 503 ||
              status === 504;

            // HTTP 오류 응답 본문 읽기
            let errorBody = '';
            try {
              const clonedResponse = response.clone();
              errorBody = await clonedResponse.text();
            } catch (e) {
              console.warn(
                '[OpenAI Chat Completions] 응답 본문 읽기 실패:',
                e?.message || e
              );
            }

            if (isRetryableHttpError && attempt < maxRetries) {
              console.warn(
                `[OpenAI Chat Completions] HTTP ${status} 오류, 재시도 중...`
              );
              lastResponse = response;
              continue;
            }

            // 재시도 불가능한 HTTP 오류면 응답 반환
            console.error(
              `[OpenAI Chat Completions] HTTP ${status} 오류: ${errorBody.substring(
                0,
                200
              )}`
            );
            return { response, retryCount: attempt + 1 };
          }

          // 성공 응답
          return { response, retryCount: attempt + 1 };
        } catch (error) {
          lastError = error;

          // 재시도 가능한 네트워크 오류인지 확인
          const isRetryable =
            error.name === 'AbortError' ||
            error.name === 'TimeoutError' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('fetch failed') ||
            error.message?.includes('timeout');

          // 재시도 가능한 오류이고 마지막 시도가 아니면 계속
          if (isRetryable && attempt < maxRetries) {
            console.warn(
              `[OpenAI Chat Completions] 재시도 ${
                attempt + 1
              }/${maxRetries} 실패: ${error.message}`
            );
            continue;
          }

          // 재시도 불가능하거나 마지막 시도면 에러 throw
          console.error(
            `[OpenAI Chat Completions] 모델 서버 호출 실패: ${error.message}`
          );
          throw error;
        }
      }

      // 모든 재시도 실패 시 마지막 응답 또는 에러 반환
      if (lastResponse) {
        return { response: lastResponse, retryCount: maxRetries + 1 };
      }
      throw lastError;
    }

    const stringifiedBody = JSON.stringify(requestBody);

    let modelServerRes;
    let retryCount = 1; // 기본값: 첫 시도에서 성공
    try {
      const fetchResult = await fetchWithRetry(
        modelServerUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: stringifiedBody,
        },
        2, // 최대 2회 재시도 (총 3회 시도)
        serverName || null, // 지정된 서버 이름 전달
        provider, // 현재 provider 전달
        model // 모델 ID (표시 이름 기반 라운드로빈용)
      );
      modelServerRes = fetchResult.response;
      retryCount = fetchResult.retryCount;
    } catch (fetchError) {
      const responseTime = Date.now() - startTime;
      const errorMessage = fetchError.message || 'Unknown error';
      const isConnectionRefused =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('fetch failed');
      const isTimeout =
        errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT');

      console.error('[OpenAI Chat Completions] 모델 서버 연결 오류:', {
        url: modelServerUrl,
        error: errorMessage,
        type: fetchError.name || 'Unknown',
        code: fetchError.code,
      });

      // Docker 환경에서의 연결 문제 안내
      if (isConnectionRefused) {
        console.error(
          '[OpenAI Chat Completions] 연결 거부됨. Docker 환경인 경우:',
          '- 호스트의 Ollama 서버에 접근하려면 http://host.docker.internal:11434 사용',
          '- 또는 docker compose.yml에서 같은 네트워크 사용',
          '- 또는 OLLAMA_ENDPOINTS 환경변수 설정'
        );
      }

      // 로깅을 fire-and-forget 방식으로 실행 (응답 속도 향상)
      Promise.all([
        logOpenAIProxyRequest({
          provider: 'openai-compatible',
          level: 'error',
          category: 'openai_proxy_chat',
          endpoint: '/v1/chat/completions',
          model,
          clientIP,
          userAgent,
          userId: userInfo?.userId,
          responseTime,
          statusCode: 503,
          error: `Connection error: ${errorMessage}`,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        }),
        logExternalApiRequest({
          sourceType: 'external',
          provider: 'openai-compatible',
          apiType: 'chat',
          endpoint: '/v1/chat/completions',
          model,
          messages,
          responseTokenCount: 0,
          promptTokenCount: 0,
          responseTime,
          statusCode: 503,
          isStream: false,
          error: `Connection error: ${errorMessage}`,
          retryCount: 3, // 최대 재시도 횟수 (실패)
          clientIP,
          userAgent,
          jwtUserId: userInfo?.userId,
          jwtEmail: userInfo?.email,
          jwtName: actualUserName || userInfo?.name,
          jwtRole: userInfo?.role,
          jwtDepartment: userInfo?.department,
          jwtCell: userInfo?.cell,
          tokenHash: tokenInfo?.tokenHash,
          tokenName: tokenInfo?.name,
          ...identificationHeaders,
        }),
      ]).catch((logError) => {
        console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
      });

      // 더 명확한 에러 메시지 제공
      let userFriendlyMessage = `Model server connection error: ${errorMessage}`;
      if (isConnectionRefused) {
        userFriendlyMessage +=
          '. Please check if the model server is running and accessible.';
      } else if (isTimeout) {
        userFriendlyMessage +=
          '. The request timed out. Please check the model server status.';
      }

      return NextResponse.json(
        {
          error: {
            message: userFriendlyMessage,
            type: 'server_error',
            details: {
              endpoint: modelServerUrl,
              error: errorMessage,
            },
          },
        },
        { status: 503, headers: corsHeaders }
      );
    }

    if (!modelServerRes.ok) {
      let errorText = await modelServerRes.text();

      const hasRequestedTools = Array.isArray(tools) && tools.length > 0;

      if (
        hasRequestedTools &&
        isToolUnsupportedByModelError(modelServerRes.status, errorText) &&
        !isToolChoiceRequired(tool_choice)
      ) {
        try {
          const fallbackBodyObj = { ...requestBody };
          delete fallbackBodyObj.tools;
          delete fallbackBodyObj.tool_choice;

          const fallbackRes = await fetchModelServer(modelServerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(fallbackBodyObj),
          });

          if (fallbackRes.ok) {
            console.warn(
              '[OpenAI Chat Completions] 모델이 tools 미지원으로 응답하여 tools 제거 후 재시도 성공'
            );
            modelServerRes = fallbackRes;
            retryCount += 1;
          } else {
            errorText = await fallbackRes.text();
            modelServerRes = fallbackRes;
          }
        } catch (fallbackError) {
          console.error(
            '[OpenAI Chat Completions] tools 제거 fallback 재시도 실패:',
            fallbackError?.message || fallbackError
          );
        }
      }

      if (!modelServerRes.ok) {
        const responseTime = Date.now() - startTime;
        console.error(
          `[OpenAI Chat Completions] 모델 Server error: ${modelServerRes.status}`,
          {
            url: modelServerUrl,
            status: modelServerRes.status,
            statusText: modelServerRes.statusText,
            error: errorText,
            requestBody: JSON.stringify(requestBody).substring(0, 500),
          }
        );

        // 프롬프트 토큰 추정
        const promptTokens = messages.reduce(
          (acc, msg) => acc + (msg.content?.length || 0),
          0
        );

        // 로깅을 fire-and-forget 방식으로 실행 (응답 속도 향상)
        Promise.all([
          logOpenAIProxyRequest({
            provider: 'openai-compatible',
            level: 'error',
            category: 'openai_proxy_chat',
            endpoint: '/v1/chat/completions',
            model,
            clientIP,
            userAgent,
            userId: userInfo?.userId,
            responseTime,
            statusCode: modelServerRes.status,
            error: errorText,
            promptTokens,
            completionTokens: 0,
            totalTokens: promptTokens,
          }),
          logExternalApiRequest({
            sourceType: 'external',
            provider: 'openai-compatible',
            apiType: 'chat',
            endpoint: '/v1/chat/completions',
            model,
            messages,
            responseTokenCount: 0,
            promptTokenCount: promptTokens,
            responseTime,
            statusCode: modelServerRes.status,
            isStream: false,
            error: errorText,
            retryCount: retryCount,
            clientIP,
            userAgent,
            jwtUserId: userInfo?.userId,
            jwtEmail: userInfo?.email,
            jwtName: actualUserName || userInfo?.name,
            jwtRole: userInfo?.role,
            jwtDepartment: userInfo?.department,
            jwtCell: userInfo?.cell,
            tokenHash: tokenInfo?.tokenHash,
            tokenName: tokenInfo?.name,
            ...identificationHeaders,
          }),
        ]).catch((logError) => {
          console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
        });

        return NextResponse.json(
          {
            error: {
              message: `Model server error: ${modelServerRes.status}`,
              type: 'server_error',
            },
          },
          { status: modelServerRes.status, headers: corsHeaders }
        );
      }
    }

    // 프롬프트 토큰 추정
    const promptTokens = messages.reduce(
      (acc, msg) => acc + (msg.content?.length || 0),
      0
    );

    if (stream) {
      // 스트리밍 응답 처리
      const encoder = new TextEncoder();
      let accumulatedResponse = '';
      let responseId = createChatCompletionId();
      let created = Math.floor(Date.now() / 1000);

      const stream = new ReadableStream({
        async start(controller) {
          const reader = modelServerRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          let controllerClosed = false;
          let sseBuffer = '';
          let firstResponseAt = null;

          // 안전한 enqueue 헬퍼 함수
          const safeEnqueue = (chunk) => {
            if (!controllerClosed) {
              try {
                if (!firstResponseAt) {
                  firstResponseAt = Date.now();
                }
                controller.enqueue(chunk);
              } catch (e) {
                if (e.name === 'TypeError' && e.message.includes('closed')) {
                  controllerClosed = true;
                } else {
                  throw e;
                }
              }
            }
          };

          // 안전한 close 헬퍼 함수
          const safeClose = async () => {
            // Next.js App Router race condition 방지:
            // controller.close()를 즉시 호출하면 [DONE] 청크가 TCP flush 되기 전에
            // 연결이 닫혀 Continue/Cline에서 "premature close" 오류가 발생함.
            // 20ms 대기로 마지막 청크가 클라이언트에 전달될 시간을 확보.
            await new Promise((r) => setTimeout(r, 20));
            if (!controllerClosed) {
              try {
                controller.close();
                controllerClosed = true;
              } catch (e) {
                if (e.name === 'TypeError' && e.message.includes('closed')) {
                  controllerClosed = true;
                }
                // 다른 에러는 무시 (이미 닫혔거나 에러 상태)
              }
            }
          };

          const processSseText = (text) => {
            if (!text) return;
            sseBuffer += text;
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const data = trimmed.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const parsed = JSON.parse(data);
                const content =
                  parsed?.choices?.[0]?.delta?.content ||
                  parsed?.choices?.[0]?.message?.content ||
                  '';
                if (content) accumulatedResponse += content;
              } catch (e) {
                continue;
              }
            }
          };

          try {
            // 첫 번째 청크를 읽어서 형식 감지
            let firstChunk = null;
            let isSSEFormat =
              provider === 'openai-compatible' || provider === 'gemini';

            if (provider === 'gemini') {
              // Gemini API 스트리밍 응답 처리
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split('\n');

                  for (const line of lines) {
                    if (!line.trim() || controllerClosed) continue;

                    try {
                      // Gemini 스트리밍 응답은 JSON 객체가 줄바꿈으로 구분됨
                      const geminiData = JSON.parse(line);

                      if (geminiData.candidates && geminiData.candidates[0]) {
                        const candidate = geminiData.candidates[0];
                        const content = candidate.content;

                        if (content && content.parts && content.parts[0]) {
                          const text = content.parts[0].text || '';
                          if (text) {
                            accumulatedResponse += text;

                            // OpenAI SSE 형식으로 변환
                            const openaiChunk = {
                              id: responseId,
                              object: 'chat.completion.chunk',
                              created,
                              model,
                              choices: [
                                {
                                  index: 0,
                                  delta: { content: text },
                                  finish_reason: candidate.finishReason || null,
                                },
                              ],
                            };

                            safeEnqueue(
                              encoder.encode(
                                `data: ${JSON.stringify(openaiChunk)}\n\n`
                              )
                            );
                          }
                        }

                        // 완료 신호 처리
                        if (candidate.finishReason) {
                          const finalChunk = {
                            id: responseId,
                            object: 'chat.completion.chunk',
                            created,
                            model,
                            choices: [
                              {
                                index: 0,
                                delta: {},
                                finish_reason: candidate.finishReason,
                              },
                            ],
                          };
                          safeEnqueue(
                            encoder.encode(
                              `data: ${JSON.stringify(finalChunk)}\n\n`
                            )
                          );
                          safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                          await safeClose();
                          return;
                        }
                      }
                    } catch (e) {
                      // JSON 파싱 실패 무시 (빈 줄 등)
                      if (line.trim()) {
                        console.warn(
                          '[OpenAI Chat Completions] Gemini JSON 파싱 실패:',
                          line.substring(0, 100)
                        );
                      }
                    }
                  }
                }

                // 스트림 종료
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
                await safeClose();
              } catch (error) {
                console.error(
                  '[OpenAI Chat Completions] Gemini 스트리밍 오류:',
                  error
                );
                await safeClose();
              }
              return;
            }

            if (!isSSEFormat) {
              // provider가 model-server인 경우, 실제 응답 형식을 확인
              const peekResult = await reader.read();
              if (peekResult.done) {
                await safeClose();
                return;
              }
              firstChunk = peekResult.value;
              const peekText = decoder.decode(firstChunk, { stream: true });
              // SSE 형식 감지: "data: "로 시작하는지 확인
              isSSEFormat = peekText.trim().startsWith('data:');

              // 첫 번째 청크를 버퍼에 추가
              buffer = peekText;
            }

            if (isSSEFormat || provider === 'openai-compatible') {
              // OpenAI 호환 서버 또는 SSE 형식: 원본 SSE 스트림을 그대로 전달
              if (firstChunk) {
                // 이미 읽은 첫 번째 청크 전달
                safeEnqueue(firstChunk);
                processSseText(decoder.decode(firstChunk, { stream: true }));
              }

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                safeEnqueue(value);
                processSseText(decoder.decode(value, { stream: true }));
                if (controllerClosed) break;
              }
              // openai-compatible: 업스트림이 [DONE]을 보내지 않는 경우를 대비해 명시적으로 전송
              // (업스트림이 이미 [DONE]을 보냈다면 Continue는 중복을 무해하게 처리함)
              if (!controllerClosed) {
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
              }
            } else {
              // Ollama 서버: JSONL → OpenAI SSE 형식으로 변환
              let ollamaToolCallsEmitted = false;
              if (firstChunk) {
                buffer = decoder.decode(firstChunk, { stream: true });
              }
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (controllerClosed) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (!line.trim() || controllerClosed) continue;
                  try {
                    const ollamaResponse = JSON.parse(line);
                    const content =
                      ollamaResponse.response ||
                      ollamaResponse.message?.content ||
                      '';
                    const toolCalls = ollamaResponse.message?.tool_calls;

                    if (content) {
                      accumulatedResponse += content;
                      const openaiChunk = {
                        id: responseId,
                        object: 'chat.completion.chunk',
                        created,
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: { role: 'assistant', content },
                            finish_reason: null,
                          },
                        ],
                      };
                      const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                      safeEnqueue(encoder.encode(sseData));
                    } else if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
                      ollamaToolCallsEmitted = true;
                      const openaiToolCalls = toolCalls.map((tc, idx) => ({
                        index: idx,
                        id: `call_${Date.now()}_${idx}`,
                        type: 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: typeof tc.function?.arguments === 'string'
                            ? tc.function.arguments
                            : JSON.stringify(tc.function?.arguments || {}),
                        },
                      }));
                      const toolCallChunk = {
                        id: responseId,
                        object: 'chat.completion.chunk',
                        created,
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: { role: 'assistant', content: '', tool_calls: openaiToolCalls },
                            finish_reason: null,
                          },
                        ],
                      };
                      safeEnqueue(encoder.encode(`data: ${JSON.stringify(toolCallChunk)}\n\n`));
                    }
                  } catch (e) {
                    if (!line.trim().startsWith('data:')) {
                      console.warn(
                        '[OpenAI Chat Completions] JSON 파싱 실패:',
                        line.substring(0, 100)
                      );
                    }
                  }
                }
              }

              // 남은 버퍼 처리 및 종료 신호
              if (!controllerClosed) {
                if (buffer.trim()) {
                  try {
                    const ollamaResponse = JSON.parse(buffer);
                    const content =
                      ollamaResponse.response ||
                      ollamaResponse.message?.content ||
                      '';
                    const toolCalls = ollamaResponse.message?.tool_calls;

                    if (content) {
                      accumulatedResponse += content;
                      const openaiChunk = {
                        id: responseId,
                        object: 'chat.completion.chunk',
                        created,
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: { role: 'assistant', content },
                            finish_reason: null,
                          },
                        ],
                      };
                      const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                      safeEnqueue(encoder.encode(sseData));
                    } else if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
                      ollamaToolCallsEmitted = true;
                      const openaiToolCalls = toolCalls.map((tc, idx) => ({
                        index: idx,
                        id: `call_${Date.now()}_${idx}`,
                        type: 'function',
                        function: {
                          name: tc.function?.name || '',
                          arguments: typeof tc.function?.arguments === 'string'
                            ? tc.function.arguments
                            : JSON.stringify(tc.function?.arguments || {}),
                        },
                      }));
                      const toolCallChunk = {
                        id: responseId,
                        object: 'chat.completion.chunk',
                        created,
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: { role: 'assistant', content: '', tool_calls: openaiToolCalls },
                            finish_reason: null,
                          },
                        ],
                      };
                      safeEnqueue(encoder.encode(`data: ${JSON.stringify(toolCallChunk)}\n\n`));
                    }
                  } catch (e) {
                    if (process.env.NODE_ENV === 'development') {
                      console.debug(
                        '[OpenAI Chat Completions] Ollama JSON 파싱 실패:',
                        e?.message || e
                      );
                    }
                  }
                }
              // 종료 신호 (Ollama 변환 시에만)
                const doneChunk = {
                  id: responseId,
                  object: 'chat.completion.chunk',
                  created,
                  model,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: ollamaToolCallsEmitted ? 'tool_calls' : 'stop',
                    },
                  ],
                };
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`)
                );
                safeEnqueue(encoder.encode('data: [DONE]\n\n'));
              }
            }

            // 로깅 (controller를 닫기 전에 로깅 완료)
            const responseTime = Date.now() - startTime;
            const firstResponseTime = firstResponseAt
              ? firstResponseAt - startTime
              : responseTime;
            const completionTokens = accumulatedResponse.length;

            // 로깅은 비동기로 실행하되, 에러가 발생해도 스트림 종료에 영향을 주지 않음
            Promise.all([
              logOpenAIProxyRequest({
                provider: 'openai-compatible',
                level: 'info',
                category: 'openai_proxy_chat',
                endpoint: '/v1/chat/completions',
                model,
                clientIP,
                userAgent,
                userId: userInfo?.userId,
                responseTime,
                statusCode: modelServerRes.status,
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
              }),
              logQARequest({
                clientIP,
                model,
                prompt: messages,
                response: null,
                isStream: true,
                responseTime,
                statusCode: modelServerRes.status,
              }),
              logExternalApiRequest({
                sourceType: 'external',
                provider: 'openai-compatible',
                apiType: 'chat',
                endpoint: '/v1/chat/completions',
                model,
                messages: [
                  ...messages,
                  ...(accumulatedResponse
                    ? [{ role: 'assistant', content: accumulatedResponse }]
                    : []),
                ],
                responseTokenCount: completionTokens,
                promptTokenCount: promptTokens,
                responseTime,
                firstResponseTime,
                finalResponseTime: responseTime,
                statusCode: modelServerRes.status,
                isStream: true,
                retryCount: retryCount,
                clientIP,
                userAgent,
                jwtUserId: userInfo?.userId,
                jwtEmail: userInfo?.email,
                jwtName: actualUserName || userInfo?.name,
                jwtRole: userInfo?.role,
                jwtDepartment: userInfo?.department,
                jwtCell: userInfo?.cell,
                tokenHash: tokenInfo?.tokenHash,
                tokenName: tokenInfo?.name,
                ...identificationHeaders,
              }),
              logOpenAIRequest(`openai-proxy-${roundRobinIndex}`, {
                method: 'POST',
                endpoint: '/v1/chat/completions',
                model,
                messages,
                userAgent,
                clientIP,
                requestSize: JSON.stringify(body).length,
                responseTime,
                responseStatus: modelServerRes.status,
                responseSize: completionTokens,
                isStream: true,
                level: 'info',
                roundRobinIndex,
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                userId: userInfo?.userId,
                roomId: null,
              }),
            ]).catch((logError) => {
              // 로깅 실패는 무시 (스트림 종료에 영향 없음)
              console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
            });

            // 스트림 정상 종료
            await safeClose();
          } catch (e) {
            console.error('[OpenAI Chat Completions] 스트림 처리 오류:', e);
            if (!controllerClosed) {
              try {
                controller.error(e);
                controllerClosed = true;
              } catch (err) {
                // controller가 이미 닫혔거나 에러 상태면 무시
                controllerClosed = true;
              }
            }
          }
        },
      });

      return new Response(stream, {
        status: modelServerRes.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...corsHeaders,
        },
      });
    } else {
      // 비스트리밍 응답 처리
      const responseData = await modelServerRes.text();
      const responseTime = Date.now() - startTime;

      let openaiResponse;
      let completionTokens = 0;
      let responseContent = '';

      if (provider === 'gemini') {
        // Gemini API: 응답을 OpenAI 형식으로 변환
        try {
          const geminiResponse = JSON.parse(responseData);
          if (geminiResponse.candidates && geminiResponse.candidates[0]) {
            const candidate = geminiResponse.candidates[0];
            const content = candidate.content;

            if (content && content.parts && content.parts[0]) {
              responseContent = content.parts[0].text || '';
            }
          }

          completionTokens = responseContent.length;

          // OpenAI 형식으로 변환
          openaiResponse = {
            id: createChatCompletionId(),
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: responseContent,
                },
                finish_reason:
                  geminiResponse.candidates?.[0]?.finishReason || 'stop',
              },
            ],
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: promptTokens + completionTokens,
            },
          };
        } catch (e) {
          console.error('[OpenAI Chat Completions] Gemini 응답 파싱 실패:', e);
          return NextResponse.json(
            {
              error: {
                message: 'Failed to parse Gemini API response',
                type: 'server_error',
              },
            },
            { status: 500, headers: corsHeaders }
          );
        }
      } else if (provider === 'openai-compatible') {
        // OpenAI 호환 서버: 원본 응답을 그대로 사용
        try {
          openaiResponse = JSON.parse(responseData);
          // OpenAI 응답 형식이 이미 올바르므로 그대로 사용
          responseContent =
            openaiResponse.choices?.[0]?.message?.content || '';
          completionTokens =
            openaiResponse.usage?.completion_tokens ||
            responseContent.length ||
            0;
        } catch (e) {
          console.error('[OpenAI Chat Completions] 응답 파싱 실패:', e);
          return NextResponse.json(
            {
              error: {
                message: 'Failed to parse model server response',
                type: 'server_error',
              },
            },
            { status: 500, headers: corsHeaders }
          );
        }
      } else {
        // Ollama 서버: JSON → OpenAI JSON 형식으로 변환
        let ollamaToolCalls = null;
        try {
          const ollamaResponse = JSON.parse(responseData);
          responseContent =
            ollamaResponse.message?.content || ollamaResponse.response || '';
          completionTokens = responseContent.length;
          ollamaToolCalls = ollamaResponse.message?.tool_calls || null;
        } catch (e) {
          console.error('[OpenAI Chat Completions] 응답 파싱 실패:', e);
          return NextResponse.json(
            {
              error: {
                message: 'Failed to parse model server response',
                type: 'server_error',
              },
            },
            { status: 500, headers: corsHeaders }
          );
        }

        // message 에 tool_calls 포함
        const messageObj = { role: 'assistant', content: responseContent || null };
        if (ollamaToolCalls && ollamaToolCalls.length > 0) {
          messageObj.tool_calls = ollamaToolCalls.map((tc, idx) => ({
            id: `call_${Date.now()}_${idx}`,
            type: 'function',
            function: {
              name: tc.function?.name || '',
              arguments: typeof tc.function?.arguments === 'string'
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments || {}),
            },
          }));
        }
        // OpenAI 형식으로 변환
        openaiResponse = {
          id: createChatCompletionId(),
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [
            {
              index: 0,
              message: messageObj,
              finish_reason: (ollamaToolCalls && ollamaToolCalls.length > 0) ? 'tool_calls' : 'stop',
            },
          ],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens,
          },
        };
      }

      // 요청 헤더 수집
      const requestHeadersObj = {};
      request.headers.forEach((value, key) => {
        requestHeadersObj[key] = value;
      });

      // 요청 본문 수집
      const requestBodyObj = {
        model,
        messages,
        ...(body.temperature !== undefined && {
          temperature: body.temperature,
        }),
        ...(body.max_tokens !== undefined && { max_tokens: body.max_tokens }),
        ...(body.stream !== undefined && { stream: body.stream }),
        ...(body.top_p !== undefined && { top_p: body.top_p }),
        ...(body.frequency_penalty !== undefined && {
          frequency_penalty: body.frequency_penalty,
        }),
        ...(body.presence_penalty !== undefined && {
          presence_penalty: body.presence_penalty,
        }),
      };

      // 응답 헤더 수집
      const responseHeadersObj = {};
      modelServerRes.headers.forEach((value, key) => {
        responseHeadersObj[key] = value;
      });

      // 응답 본문 수집 (이미 읽은 responseContent 사용)
      let responseBodyObj = null;
      if (!stream && responseContent) {
        try {
          // openaiResponse 객체가 있으면 사용, 없으면 responseContent 파싱
          responseBodyObj = openaiResponse || JSON.parse(responseContent);
        } catch (e) {
          // 이미 파싱된 객체인 경우
          try {
            responseBodyObj =
              typeof responseContent === 'string'
                ? JSON.parse(responseContent)
                : responseContent;
          } catch (e2) {
            responseBodyObj = { content: responseContent };
          }
        }
      }

      // 로깅을 fire-and-forget 방식으로 실행 (응답 속도 향상)
      Promise.all([
        logOpenAIProxyRequest({
          provider: 'openai-compatible',
          level: 'info',
          category: 'openai_proxy_chat',
          endpoint: '/v1/chat/completions',
          model,
          clientIP,
          userAgent,
          userId: userInfo?.userId,
          responseTime,
          statusCode: modelServerRes.status,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        }),
        logQARequest({
          clientIP,
          model,
          prompt: messages,
          response: responseContent,
          isStream: false,
          responseTime,
          statusCode: modelServerRes.status,
        }),
        logExternalApiRequest({
          sourceType: 'external',
          provider: 'openai-compatible',
          apiType: 'chat',
          endpoint: '/v1/chat/completions',
          model,
          messages: [
            ...messages,
            ...(responseContent
              ? [{ role: 'assistant', content: responseContent }]
              : []),
          ],
          responseTokenCount: completionTokens,
          promptTokenCount: promptTokens,
          responseTime,
          statusCode: modelServerRes.status,
          isStream: false,
          retryCount: retryCount,
          clientIP,
          userAgent,
          jwtUserId: userInfo?.userId,
          jwtEmail: userInfo?.email,
          jwtName: actualUserName || userInfo?.name,
          jwtRole: userInfo?.role,
          jwtDepartment: userInfo?.department,
          jwtCell: userInfo?.cell,
          tokenHash: tokenInfo?.tokenHash,
          tokenName: tokenInfo?.name,
          requestHeaders: requestHeadersObj,
          requestBody: requestBodyObj,
          responseHeaders: responseHeadersObj,
          responseBody: responseBodyObj,
          ...identificationHeaders,
        }),
        logOpenAIRequest(`openai-proxy-${roundRobinIndex}`, {
          method: 'POST',
          endpoint: '/v1/chat/completions',
          model,
          messages,
          userAgent,
          clientIP,
          requestSize: JSON.stringify(body).length,
          responseTime,
          responseStatus: modelServerRes.status,
          responseSize: responseContent.length,
          isStream: false,
          level: 'info',
          roundRobinIndex,
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          userId: userInfo?.userId,
          roomId: null,
        }),
      ]).catch((logError) => {
        console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
      });

      return NextResponse.json(openaiResponse, {
        status: modelServerRes.status,
        headers: corsHeaders,
      });
    }
  } catch (error) {
    console.error('[OpenAI Chat Completions] Server error:', error);

    const responseTime = Date.now() - startTime;
    const errorMessage = error.message || 'Internal server error';

    // 로깅을 fire-and-forget 방식으로 실행 (응답 속도 향상)
    Promise.all([
      logOpenAIProxyRequest({
        provider: 'openai-compatible',
        level: 'error',
        category: 'openai_proxy_chat',
        endpoint: '/v1/chat/completions',
        model: 'unknown',
        clientIP,
        userAgent,
        userId: userInfo?.userId,
        responseTime,
        statusCode: 500,
        error: errorMessage,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }),
      logExternalApiRequest({
        sourceType: 'external',
        provider: 'openai-compatible',
        apiType: 'chat',
        endpoint: '/v1/chat/completions',
        model: 'unknown',
        messages: null,
        responseTokenCount: 0,
        promptTokenCount: 0,
        responseTime,
        statusCode: 500,
        isStream: false,
        error: errorMessage,
        retryCount: 0, // Server error로 재시도 전에 실패
        clientIP,
        userAgent,
        jwtUserId: userInfo?.userId,
        jwtEmail: userInfo?.email,
        jwtName: actualUserName || userInfo?.name,
        jwtRole: userInfo?.role,
        jwtDepartment: userInfo?.department,
        jwtCell: userInfo?.cell,
        tokenHash: tokenInfo?.tokenHash,
        tokenName: tokenInfo?.name,
        ...identificationHeaders,
      }),
    ]).catch((logError) => {
      console.error('[OpenAI Chat Completions] 로깅 실패:', logError);
    });

    return NextResponse.json(
      {
        error: {
          message: errorMessage,
          type: 'server_error',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(request) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-User-Id, X-Organization-Id, X-Project-Id, X-Environment, X-Client-Name, X-Client-Version, X-User-Name, X-Workspace, X-Session-Id, X-Request-Id',
      },
    }
  );
}
