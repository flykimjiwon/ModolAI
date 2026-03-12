import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '@/lib/postgres';
import { getNextModelServerEndpoint } from '@/lib/modelServers';
import { JWT_SECRET } from '@/lib/config';

// OpenAI-compatible Models API
// Returns model server's model list in OpenAI format

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
    return { valid: true, tokenInfo: { tokenHash, userId } };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'API token has expired.' };
    }
    return { valid: false, error: 'Invalid API token.' };
  }
}
export async function GET(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Verify API token
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) {
      return NextResponse.json(
        { error: { message: 'API token required.', type: 'auth_error' } },
        { status: 401, headers: corsHeaders }
      );
    }
    const verificationResult = await verifyApiToken(token);
    if (!verificationResult.valid) {
      return NextResponse.json(
        { error: { message: verificationResult.error, type: 'auth_error' } },
        { status: 401, headers: corsHeaders }
      );
    }

    // Get model server endpoint
    const modelServerEndpoint = await getNextModelServerEndpoint();
    const modelsUrl = `${modelServerEndpoint}/api/tags`;

    console.log('[OpenAI Models] Fetching model list:', modelsUrl);

    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(
        `[OpenAI Models] Model server error: ${res.status} ${res.statusText}`
      );
      return NextResponse.json(
        {
          error: {
            message: `Failed to fetch models: ${res.status} ${res.statusText}`,
            type: 'server_error',
          },
        },
        { status: res.status, headers: corsHeaders }
      );
    }

    const data = await res.json().catch(() => ({}));

    // Ollama format: { models: [{ name, ... }] }
    // OpenAI format: { data: [{ id, object: "model", created, owned_by }] }
    const ollamaModels = Array.isArray(data.models) ? data.models : [];
    const openaiModels = ollamaModels.map((model, index) => ({
      id: model.name || `model-${index}`,
      object: 'model',
      created: model.modified_at
        ? Math.floor(new Date(model.modified_at).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      owned_by: 'ollama',
    }));

    const openaiResponse = {
      object: 'list',
      data: openaiModels,
    };

    return NextResponse.json(openaiResponse, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('[OpenAI Models] Server error:', error);

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

export async function OPTIONS(request) {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}
