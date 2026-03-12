import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { detectPII } from '@/lib/piiDetector';

/**
 * Detect and mask PII in text using the local regex-based engine.
 *
 * @param {string}  text              Input text to scan
 * @param {object}  options
 * @param {string[]|null} options.enabledTypes  PII type keys to detect (null = all)
 * @param {boolean} [options.mxtVrf]            Legacy flag (ignored, kept for compat)
 * @param {boolean} [options.maskOpt]           Legacy flag (ignored, kept for compat)
 * @param {string}  [options.endpoint]          Legacy field (ignored, kept for compat)
 * @param {object}  context           Logging context
 * @returns {Promise<object>} Detection result
 */
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

  const startedAt = Date.now();
  const enabledTypes = options.enabledTypes || null;

  async function safeLog(logData) {
    try {
      await logExternalApiRequest({
        sourceType: 'internal',
        provider: 'pii-local',
        apiType: 'pii-detect',
        endpoint: 'local-regex',
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
              enabledTypes: enabledTypes,
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
        requestHeaders: { source: 'local-regex' },
        requestBody: {
          original_text: text,
          enabledTypes: enabledTypes,
        },
        responseHeaders: null,
        responseBody: logData.responseBody || null,
      });
    } catch (logError) {
      console.warn('[PII] Log recording failed (ignored):', logError.message);
    }
  }

  try {
    const result = detectPII(text, enabledTypes);

    const output = {
      detected: result.detected,
      maskedText: result.maskedText,
      detectedList: result.detectedList,
      detectedCnt: result.detectedCnt,
      skipped: false,
      reason: null,
      statusCode: 200,
      statusText: 'OK',
    };

    await safeLog({
      ...output,
      responseBody: result,
    });

    return output;
  } catch (err) {
    console.warn('[PII] Local detection failed:', err.message);
    const result = {
      detected: false,
      maskedText: text,
      detectedList: [],
      detectedCnt: 0,
      skipped: true,
      reason: 'detection-error',
      statusCode: 500,
      statusText: 'DETECTION_ERROR',
      errorMessage: err.message,
    };
    await safeLog({
      ...result,
      error: err.message,
    });
    return result;
  }
}
