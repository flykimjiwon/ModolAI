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
