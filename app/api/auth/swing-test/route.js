import { NextResponse } from 'next/server';

// Swing SSO 테스트용 프록시 API (CORS 우회)
export async function POST(request) {
  try {
    const { swingUrl, payload } = await request.json();

    if (!swingUrl || !payload) {
      return NextResponse.json(
        { error: 'swingUrl과 payload가 필요합니다.' },
        { status: 400 }
      );
    }

    const endpoint = `${swingUrl}/cau/v1/idpw-authorize`;

    console.log('[Swing Test] API 호출:', endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let json = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
      json = null;
    }

    console.log('[Swing Test] 응답:', {
      status: response.status,
      resultCode: json?.common?.resultCode,
      authResult: json?.data?.authResult,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Swing API 응답 오류',
          detail: response.statusText,
          status: response.status,
          data: json,
          rawTextPreview: rawText ? rawText.slice(0, 1000) : null,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      status: response.status,
      data: json,
      rawTextPreview: rawText ? rawText.slice(0, 1000) : null,
    });
  } catch (error) {
    console.error('[Swing Test] 오류:', error);
    const details = {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      cause: error?.cause ? String(error.cause) : null,
      stack: error?.stack,
    };
    return NextResponse.json(
      {
        error: 'Swing API 호출 실패',
        detail: '서버에서 Swing API 호출 중 오류가 발생했습니다.',
        errorDetails: details,
      },
      { status: 500 }
    );
  }
}
