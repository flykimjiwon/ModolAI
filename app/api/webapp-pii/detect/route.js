import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { detectAndMaskPII } from '@/lib/piiFilter';
import { resolveModelId } from '@/lib/modelServers';
import { getModelsFromTables } from '@/lib/modelTables';
import { getClientIP } from '@/lib/ip';

async function findModelRecord(actualModelName) {
  const grouped = await getModelsFromTables();
  if (!grouped) return null;
  for (const category of Object.values(grouped)) {
    const models = Array.isArray(category?.models) ? category.models : [];
    const match = models.find((m) => {
      const idValue = m.modelName || m.id;
      return idValue === actualModelName;
    });
    if (match) return match;
  }
  return null;
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const model = body?.model;
    const text = typeof body?.text === 'string' ? body.text : '';
    const direction = body?.direction === 'response' ? 'response' : 'request';

    const actualModelName = await resolveModelId(model);
    const matchedModel = await findModelRecord(actualModelName);

    const enabled =
      direction === 'request'
        ? matchedModel?.piiFilterRequest === true
        : matchedModel?.piiFilterResponse === true;

    if (!enabled) {
      return NextResponse.json({
        success: true,
        enabled: false,
        result: {
          detected: false,
          maskedText: text,
          detectedList: [],
          detectedCnt: 0,
          skipped: true,
          reason: 'model-filter-disabled',
        },
      });
    }

    const enabledTypes = matchedModel?.piiEnabledTypes || null; // null = all types

    const result = await detectAndMaskPII(
      text,
      { enabledTypes },
      {
        model: actualModelName,
        roomId: body?.roomId || null,
        clientIP: getClientIP(request),
        userAgent: request.headers.get('user-agent') || 'unknown',
        xForwardedFor: request.headers.get('x-forwarded-for'),
        xRealIP: request.headers.get('x-real-ip'),
        acceptLanguage: request.headers.get('accept-language'),
        referer: request.headers.get('referer'),
        origin: request.headers.get('origin'),
        jwtUserId: payload?.sub || null,
        jwtEmail: payload?.email || null,
        jwtName: payload?.name || null,
        jwtRole: payload?.role || null,
      }
    );

    return NextResponse.json({ success: true, enabled: true, result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'PII pre-check failed' },
      { status: 500 }
    );
  }
}
