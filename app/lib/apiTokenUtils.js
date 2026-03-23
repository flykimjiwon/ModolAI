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

export async function verifyApiToken(token) {
  try {
    const tokenPayload = jwt.verify(token, JWT_SECRET);
    if (tokenPayload.type !== 'api_token') {
      return { valid: false, error: 'Invalid token type. API token required.' };
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
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

export async function resolveEndpoint(modelId) {
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

export function buildOpenAiUrl(endpoint, path) {
  const trimmed = endpoint.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1')) {
    return `${trimmed}${path}`;
  }
  return `${trimmed}/v1${path}`;
}

export function getValueByPath(source, path) {
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

export function applyTemplate(value, context) {
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

export async function getModelConfig() {
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

export async function findModelRecord(modelId) {
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
