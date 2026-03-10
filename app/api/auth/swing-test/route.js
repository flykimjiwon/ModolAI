import { NextResponse } from 'next/server';

// Swing SSO test proxy API (CORS bypass)
export async function POST(request) {
  try {
    const { swingUrl, payload } = await request.json();

    if (!swingUrl || !payload) {
      return NextResponse.json(
        { error: 'swingUrl and payload are required.' },
        { status: 400 }
      );
    }

    const endpoint = `${swingUrl}/cau/v1/idpw-authorize`;

    console.log('[Swing Test] API call:', endpoint);

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

    console.log('[Swing Test] Response:', {
      status: response.status,
      resultCode: json?.common?.resultCode,
      authResult: json?.data?.authResult,
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Swing API response error',
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
    console.error('[Swing Test] Error:', error);
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
        error: 'Swing API call failed',
        detail: 'An error occurred while calling the Swing API from the server.',
        errorDetails: details,
      },
      { status: 500 }
    );
  }
}
