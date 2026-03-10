import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';
import { detectAndMaskPII } from '@/lib/piiFilter';

const REMOTE_FAILURE_REASONS = new Set([
  'missing-endpoint',
  'http-error',
  'fetch-failed',
  'invalid-json',
]);

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildFailureMessage(result) {
  switch (result?.reason) {
    case 'missing-endpoint':
      return 'PII endpoint is empty. Check env var (PII_DETECT_API_URL) or the entered endpoint.';
    case 'http-error':
      return `PII API returned HTTP ${result?.statusCode ?? 'error'}. Check response body/headers.`;
    case 'fetch-failed':
      return `PII API network call failed: ${
        result?.errorMessage || 'Unknown network error'
      }`;
    case 'invalid-json':
      return 'PII API response is not valid JSON. Check rawResponse and response headers.';
    default:
      return result?.reason
        ? `PII API call failed (${result.reason})`
        : 'PII API call failed';
  }
}

function buildSuccessMessage(result) {
  if (result?.skipped) {
    if (result.reason === 'empty-text') {
      return 'Input text is empty, so validation was skipped.';
    }
    return `PII filter was skipped due to ${result?.reason || 'unknown'}, so the original text was used.`;
  }

  if (result?.detected) {
    return `Detected ${result?.detectedCnt || 0} PII item(s) and returned a masked result.`;
  }

  return 'No PII was detected, so the original text was kept.';
}

async function findLatestPiiTestLog({ userId, endpoint, startedAt }) {
  try {
    const whereConditions = [
      "api_type = 'pii-detect'",
      "model = 'admin-pii-test'",
      'timestamp >= $1',
    ];
    const params = [startedAt];

    if (userId) {
      whereConditions.push(`user_id = $${params.length + 1}`);
      params.push(userId);
    }

    if (endpoint) {
      whereConditions.push(`endpoint = $${params.length + 1}`);
      params.push(endpoint);
    }

    const result = await query(
      `SELECT
         id,
         timestamp,
         endpoint,
         status_code,
         error,
         response_time,
         first_response_time,
         final_response_time,
         source,
         client_ip,
         user_agent,
         session_hash,
         request_headers,
         request_body,
         response_headers,
         response_body
       FROM external_api_logs
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY timestamp DESC
       LIMIT 1`,
      params
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      timestamp: row.timestamp,
      endpoint: row.endpoint,
      statusCode:
        row.status_code === null || row.status_code === undefined
          ? null
          : Number(row.status_code),
      error: row.error || null,
      responseTimeMs:
        row.response_time === null || row.response_time === undefined
          ? null
          : Number(row.response_time),
      firstResponseTimeMs:
        row.first_response_time === null || row.first_response_time === undefined
          ? null
          : Number(row.first_response_time),
      finalResponseTimeMs:
        row.final_response_time === null || row.final_response_time === undefined
          ? null
          : Number(row.final_response_time),
      source: row.source || null,
      clientIP: row.client_ip || null,
      userAgent: row.user_agent || null,
      sessionHash: row.session_hash || null,
      requestHeaders: parseMaybeJson(row.request_headers),
      requestBody: parseMaybeJson(row.request_body),
      responseHeaders: parseMaybeJson(row.response_headers),
      responseBody: parseMaybeJson(row.response_body),
    };
  } catch (error) {
    return {
      lookupError: error.message || 'Failed to retrieve logs',
    };
  }
}

export async function POST(request) {
  const authResult = verifyAdminWithResult(request);
  if (!authResult.valid) {
    return NextResponse.json(
      { success: false, error: authResult.error || 'Admin authentication failed' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text : '';
    const endpoint =
      typeof body.endpoint === 'string' && body.endpoint.trim()
        ? body.endpoint.trim()
        : process.env.PII_DETECT_API_URL;
    const txtVrf =
      body.txtVrf !== undefined ? body.txtVrf !== false : body.mxtVrf !== false;
    const maskOpt = body.maskOpt !== false;
    const requestStartedAt = Date.now();
    const userId = authResult.user?.sub || authResult.user?.id || null;

    const result = await detectAndMaskPII(
      text,
      {
        mxtVrf: txtVrf,
        maskOpt,
        endpoint,
      },
      {
        model: 'admin-pii-test',
        roomId: null,
        clientIP: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        xForwardedFor: request.headers.get('x-forwarded-for'),
        xRealIP: request.headers.get('x-real-ip'),
        acceptLanguage: request.headers.get('accept-language'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        jwtUserId: userId,
        jwtEmail: authResult.user?.email || null,
        jwtName: authResult.user?.name || null,
        jwtRole: authResult.user?.role || null,
      }
    );
    const requestEndedAt = Date.now();

    const log = await findLatestPiiTestLog({
      userId,
      endpoint,
      startedAt: new Date(requestStartedAt - 60000),
    });

    const isRemoteFailure =
      result?.skipped === true && REMOTE_FAILURE_REASONS.has(result.reason);
    const success = !isRemoteFailure;
    const reasonMessage = success
      ? buildSuccessMessage(result)
      : buildFailureMessage(result);

    const statusCode =
      result?.statusCode ??
      (log && typeof log.statusCode === 'number' ? log.statusCode : null);

    return NextResponse.json(
      {
        success,
        endpoint,
        request: {
          original_text: text,
          mxt_vrf: txtVrf,
          mask_opt: maskOpt,
        },
        diagnostics: {
          verdict: success ? 'success' : 'failure',
          reasonCode: result?.reason || null,
          reasonMessage,
          statusCode,
          statusText: result?.statusText || null,
          durationMs: requestEndedAt - requestStartedAt,
          startedAt: new Date(requestStartedAt).toISOString(),
          finishedAt: new Date(requestEndedAt).toISOString(),
          endpointSource:
            typeof body.endpoint === 'string' && body.endpoint.trim()
              ? 'custom-input'
              : 'env-default',
        },
        result,
        log,
        error: success ? null : reasonMessage,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'PII test failed' },
      { status: 500 }
    );
  }
}
