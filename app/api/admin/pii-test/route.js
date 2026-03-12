import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import { getClientIP } from '@/lib/ip';
import { detectAndMaskPII } from '@/lib/piiFilter';

async function findLatestPiiTestLog({ userId, startedAt }) {
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

    const parseMaybeJson = (value) => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };

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
    const enabledTypes = Array.isArray(body.enabledTypes) ? body.enabledTypes : null;
    const requestStartedAt = Date.now();
    const userId = authResult.user?.sub || authResult.user?.id || null;

    const result = await detectAndMaskPII(
      text,
      {
        enabledTypes,
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
      startedAt: new Date(requestStartedAt - 60000),
    });

    return NextResponse.json(
      {
        success: true,
        result: {
          detected: result?.detected || false,
          maskedText: result?.maskedText || text,
          detectedList: result?.detectedList || [],
          detectedCnt: result?.detectedCnt || 0,
          skipped: result?.skipped || false,
          reason: result?.reason || null,
        },
        diagnostics: {
          durationMs: requestEndedAt - requestStartedAt,
          startedAt: new Date(requestStartedAt).toISOString(),
          finishedAt: new Date(requestEndedAt).toISOString(),
          source: 'local-regex',
        },
        log,
        error: null,
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
