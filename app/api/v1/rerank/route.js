import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '@/lib/postgres';
import {
  getNextModelServerEndpointWithIndex,
  getModelServerEndpointByName,
  getModelServerEndpointByLabel,
  parseModelName,
} from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { JWT_SECRET } from '@/lib/config';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function verifyApiToken(token) {
  try {
    const tokenPayload = jwt.verify(token, JWT_SECRET);
    if (tokenPayload.type !== 'api_token') {
      return { valid: false, error: 'Invalid token type. API token required.' };
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
    const userId = tokenPayload.sub || tokenPayload.id;
    const tokenResult = await query(
      'SELECT * FROM api_tokens WHERE token_hash = $1 AND user_id = $2 LIMIT 1',
      [tokenHash, userId]
    );

    if (tokenResult.rows.length === 0) {
      return { valid: false, error: 'API token not found.' };
    }

    const apiToken = tokenResult.rows[0];
    if (!apiToken.is_active) {
      return { valid: false, error: 'API token is inactive.' };
    }

    if (apiToken.expires_at && new Date(apiToken.expires_at) < new Date()) {
      return { valid: false, error: 'API token has expired.' };
    }

    if (tokenPayload.exp && tokenPayload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false, error: 'API token has expired.' };
    }

    return {
      valid: true,
      tokenInfo: {
        tokenHash,
        userId,
      },
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'API token has expired.' };
    }
    return { valid: false, error: 'Invalid API token.' };
  }
}

async function resolveEndpoint(modelId) {
  if (modelId) {
    const { serverName, modelName } = parseModelName(modelId);
    if (serverName) {
      const serverEndpoint = await getModelServerEndpointByName(serverName);
      if (serverEndpoint) {
        return { ...serverEndpoint, modelName };
      }
    }

    const labelEndpoint = await getModelServerEndpointByLabel(modelId);
    if (labelEndpoint) {
      return { ...labelEndpoint, modelName: modelId };
    }
  }

  const fallback = await getNextModelServerEndpointWithIndex();
  if (!fallback?.endpoint) {
    return null;
  }
  return { ...fallback, modelName: modelId };
}

function buildOpenAiUrl(endpoint, path) {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}${path}`;
  }
  return `${trimmed}/v1${path}`;
}

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
    if (value === '{{prompt}}') return context.prompt;
    let output = value;
    if (output.includes('{{OPENAI_API_KEY}}')) {
      output = output.replaceAll('{{OPENAI_API_KEY}}', context.apiKey || '');
    }
    if (output.includes('{{prompt}}')) {
      output = output.replaceAll(
        '{{prompt}}',
        typeof context.prompt === 'string'
          ? context.prompt
          : JSON.stringify(context.prompt || '')
      );
    }
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => applyTemplate(item, context));
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      next[key] = applyTemplate(val, context);
    });
    return next;
  }
  return value;
}

async function getModelConfig() {
  try {
    const { getModelsFromTables } = await import('@/lib/modelTables');
    let categories = await getModelsFromTables();
    if (!categories) {
      const { query: pgQuery } = await import('@/lib/postgres');
      const modelConfigResult = await pgQuery(
        'SELECT config FROM model_config WHERE config_type = $1 LIMIT 1',
        ['models']
      );
      categories = modelConfigResult.rows[0]?.config?.categories || null;
    }
    return categories ? { categories } : null;
  } catch (error) {
    console.warn('[Model Config] Failed to load model config:', error.message);
    return null;
  }
}

async function findModelRecord(modelId) {
  if (!modelId) return null;
  const modelConfig = await getModelConfig();
  if (!modelConfig?.categories) return null;
  const allModels = [];
  Object.values(modelConfig.categories).forEach((category) => {
    if (category.models && Array.isArray(category.models)) allModels.push(...category.models);
  });
  let found = allModels.find((m) => m.id === modelId);
  if (!found) found = allModels.find((m) => m.modelName === modelId);
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
      return (
        mNameLower.includes(String(modelId).toLowerCase()) ||
        mNameLower.startsWith(modelBase.toLowerCase() + ':')
      );
    });
  }
  return found || null;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: {
            message:
              'Authorization header is required. Please provide a valid API token.',
            type: 'authentication_error',
          },
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.split(' ')[1];
    const verificationResult = await verifyApiToken(token);
    if (!verificationResult.valid) {
      return NextResponse.json(
        {
          error: {
            message: verificationResult.error || 'Invalid API token.',
            type: 'authentication_error',
          },
        },
        { status: 401, headers: corsHeaders }
      );
    }

    const startTime = Date.now();
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '';
    const userAgent = request.headers.get('user-agent') || '';

    const body = await request.json().catch(() => ({}));
    const model = body.model || body.modelId;
    const queryText = body.query;
    const documents = body.documents;
    if (!model || !queryText || !Array.isArray(documents)) {
      return NextResponse.json(
        {
          error: {
            message: 'model, query, and documents are required.',
            type: 'invalid_request_error',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const matchedModel = await findModelRecord(model);
    const manualEndpoint =
      matchedModel?.endpoint &&
      String(matchedModel.endpoint).trim().toLowerCase() === 'manual';

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
      } catch {
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

      const context = {
        apiKey: (matchedModel.apiKey || process.env.OPENAI_API_KEY || '').trim(),
        prompt: {
          query: queryText,
          documents,
          top_n: body.top_n,
        },
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
      const reqHeaders = applyTemplate(manualConfig?.headers || {}, context);
      const reqBody = applyTemplate(manualConfig?.body, context);
      const requestOptions = { method, headers: reqHeaders };
      if (method !== 'GET' && method !== 'HEAD' && reqBody !== undefined) {
        requestOptions.body =
          typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody);
      }

      let manualRes;
      try {
        manualRes = await fetch(manualUrl, {
          ...requestOptions,
          signal: AbortSignal.timeout(30000),
        });
      } catch (error) {
        return NextResponse.json(
          {
            error: {
              message: `Model server connection error: ${error.message}`,
              type: 'server_error',
            },
          },
          { status: 500, headers: corsHeaders }
        );
      }

      if (!manualRes.ok) {
        const errorText = await manualRes.text().catch(() => '');
        return NextResponse.json(
          {
            error: {
              message: `Model server error: ${manualRes.status} ${errorText}`.trim(),
              type: 'server_error',
            },
          },
          { status: manualRes.status, headers: corsHeaders }
        );
      }

      const manualData = await manualRes.json().catch(() => ({}));
      const responsePath = manualConfig?.responseMapping?.path;
      const finalData = responsePath
        ? getValueByPath(manualData, responsePath) || manualData
        : manualData;

      logExternalApiRequest({
        sourceType: 'external',
        provider: 'manual',
        apiType: 'rerank',
        endpoint: '/v1/rerank',
        model,
        promptTokenCount: 0,
        responseTokenCount: 0,
        isStream: false,
        responseTime: Date.now() - startTime,
        statusCode: manualRes.status,
        clientIP,
        userAgent,
        jwtUserId: verificationResult.tokenInfo?.userId,
        tokenHash: verificationResult.tokenInfo?.tokenHash,
      }).catch(() => {});

      return NextResponse.json(finalData, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const endpointInfo = await resolveEndpoint(model);
    if (!endpointInfo) {
      return NextResponse.json(
        {
          error: {
            message: 'No model server endpoint available.',
            type: 'server_error',
          },
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const { endpoint, provider, modelName, apiKey } = endpointInfo;
    const resolvedModel = modelName || model;

    if (provider !== 'openai-compatible') {
      return NextResponse.json(
        {
          error: {
            message:
              'Rerank requires an openai-compatible endpoint that supports /v1/rerank.',
            type: 'invalid_request_error',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const targetUrl = buildOpenAiUrl(endpoint, '/rerank');
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: resolvedModel,
        query: queryText,
        documents,
        top_n: body.top_n,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await response.json().catch(() => ({}));

    logExternalApiRequest({
      sourceType: 'external',
      provider: endpointInfo.type || 'openai-compatible',
      apiType: 'rerank',
      endpoint: '/v1/rerank',
      model: resolvedModel,
      promptTokenCount: 0,
      responseTokenCount: 0,
      isStream: false,
      responseTime: Date.now() - startTime,
      statusCode: response.status,
      clientIP,
      userAgent,
      jwtUserId: verificationResult.tokenInfo?.userId,
      tokenHash: verificationResult.tokenInfo?.tokenHash,
    }).catch(() => {});

    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message: error.message || 'Internal server error',
          type: 'server_error',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}
