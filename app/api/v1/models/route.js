import { NextResponse } from 'next/server';
import { getNextModelServerEndpoint } from '@/lib/modelServers';

// OpenAI 호환 Models API
// 모델 서버의 모델 목록을 OpenAI 형식으로 반환

export async function GET(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // 모델 서버 엔드포인트 가져오기
    const modelServerEndpoint = await getNextModelServerEndpoint();
    const modelsUrl = `${modelServerEndpoint}/api/tags`;

    console.log('[OpenAI Models] 모델 목록 조회:', modelsUrl);

    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(
        `[OpenAI Models] 모델 서버 오류: ${res.status} ${res.statusText}`
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

    // Ollama 형식: { models: [{ name, ... }] }
    // OpenAI 형식: { data: [{ id, object: "model", created, owned_by }] }
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
    console.error('[OpenAI Models] 서버 오류:', error);

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
