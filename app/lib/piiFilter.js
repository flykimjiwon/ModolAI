import { logExternalApiRequest } from '@/lib/externalApiLogger';

const PII_API_URL = process.env.PII_DETECT_API_URL;

function parseJsonSafe(rawText) {
  if (typeof rawText !== 'string') return null;
  if (!rawText.trim()) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function headersToObject(headers) {
  const result = {};
  if (!headers || typeof headers.entries !== 'function') {
    return result;
  }
  for (const [key, value] of headers.entries()) {
    result[key] = value;
  }
  return result;
}

export async function detectAndMaskPII(text, options = {}, context = {}) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return {
      detected: false,
      maskedText: text,
      detectedList: [],
      detectedCnt: 0,
      skipped: true,
      reason: 'empty-text',
    };
  }

  const mxtVrf = options.mxtVrf !== false;
  const maskOpt = options.maskOpt !== false;
  const endpoint = options.endpoint || PII_API_URL;
  const vrfFieldMode = options.vrfFieldMode === 'txt' ? 'txt' : 'mxt';
  const startedAt = Date.now();

  const baseResult = {
    detected: false,
    maskedText: text,
    detectedList: [],
    detectedCnt: 0,
    skipped: false,
    reason: null,
  };

  const requestBody = {
    original_text: text,
    mask_opt: maskOpt,
  };

  if (vrfFieldMode === 'txt') {
    requestBody.txt_vrf = mxtVrf;
  } else {
    requestBody.mxt_vrf = mxtVrf;
  }
  const requestHeaders = {
    accept: 'application/json',
    'Content-Type': 'application/json',
  };

  async function safeLog(logData) {
    try {
      await logExternalApiRequest({
        sourceType: 'internal',
        provider: 'pii-api',
        apiType: 'pii-detect',
        endpoint,
        model: context.model || 'pii-detect',
        messages: [
          { role: 'user', content: text },
          {
            role: 'assistant',
            content: JSON.stringify({
              detected: logData.detected,
              detectedCnt: logData.detectedCnt,
              maskedTextPreview: (logData.maskedText || '').slice(0, 200),
              reason: logData.reason || null,
            }),
          },
        ],
        promptTokenCount: text.length,
        responseTokenCount: (logData.maskedText || '').length,
        responseTime: Date.now() - startedAt,
        statusCode: logData.statusCode || 200,
        isStream: false,
        error: logData.error || null,
        roomId: context.roomId || null,
        jwtUserId: context.jwtUserId || null,
        jwtEmail: context.jwtEmail || null,
        jwtName: context.jwtName || null,
        jwtRole: context.jwtRole || null,
        clientIP: context.clientIP || 'unknown',
        userAgent: context.userAgent || 'unknown',
        xForwardedFor: context.xForwardedFor || null,
        xRealIP: context.xRealIP || null,
        acceptLanguage: context.acceptLanguage || null,
        referer: context.referer || null,
        origin: context.origin || null,
        requestHeaders: logData.requestHeaders || requestHeaders,
        requestBody,
        responseHeaders: logData.responseHeaders || null,
        responseBody: logData.responseBody || null,
      });
    } catch (logError) {
      console.warn('[PII] Log recording failed (ignored):', logError.message);
    }
  }

  try {
    if (!endpoint) {
      console.warn('[PII] PII_DETECT_API_URL not configured - skipping filtering');
      const result = {
        ...baseResult,
        skipped: true,
        reason: 'missing-endpoint',
        statusCode: 0,
        statusText: 'NOT_CONFIGURED',
        errorMessage: 'PII endpoint is not configured',
      };
      await safeLog({
        ...result,
        statusCode: 0,
        error: result.errorMessage,
        requestHeaders,
      });
      return result;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });
    const responseHeaders = headersToObject(res.headers);
    const rawResponseBody = await res.text();
    const parsedResponseBody = parseJsonSafe(rawResponseBody);

    if (!res.ok) {
      console.warn(`[PII] API response error: ${res.status}`);
      const responseBody =
        parsedResponseBody !== null
          ? parsedResponseBody
          : rawResponseBody || null;
      const result = {
        ...baseResult,
        skipped: true,
        reason: 'http-error',
        statusCode: res.status,
        statusText: res.statusText || null,
        responseBody,
        errorMessage: `PII API HTTP ${res.status}${
          res.statusText ? ` ${res.statusText}` : ''
        }`,
      };
      await safeLog({
        ...result,
        statusCode: res.status,
        error: result.errorMessage,
        requestHeaders,
        responseHeaders,
        responseBody,
      });
      return result;
    }

    if (parsedResponseBody === null || typeof parsedResponseBody !== 'object') {
      const result = {
        ...baseResult,
        skipped: true,
        reason: 'invalid-json',
        statusCode: res.status,
        statusText: res.statusText || null,
        rawResponse: rawResponseBody
          ? rawResponseBody.slice(0, 2000)
          : null,
        errorMessage: 'PII API returned a non-JSON response',
      };
      await safeLog({
        ...result,
        statusCode: res.status,
        error: result.errorMessage,
        requestHeaders,
        responseHeaders,
        responseBody: result.rawResponse,
      });
      return result;
    }

    const data = parsedResponseBody;
    const result = {
      detected: data.detected === true,
      maskedText: data.masked_text || text,
      detectedList: data.detected_list || [],
      detectedCnt: data.detected_cnt || 0,
      skipped: false,
      reason: null,
      statusCode: res.status,
      statusText: res.statusText || null,
    };
    await safeLog({
      ...result,
      statusCode: res.status,
      requestHeaders,
      responseHeaders,
      responseBody: data,
    });
    return result;
  } catch (err) {
    console.warn('[PII] API call failed (skipping filtering):', err.message);
    const result = {
      ...baseResult,
      skipped: true,
      reason: 'fetch-failed',
      statusCode: 0,
      statusText: 'FETCH_FAILED',
      errorMessage: err.message,
    };
    await safeLog({
      ...result,
      statusCode: 0,
      error: err.message,
      requestHeaders,
    });
    return result;
  }
}
