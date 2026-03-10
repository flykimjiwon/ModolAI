import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { getAllEndpoints } from '@/lib/modelServerMonitor';

export async function GET(request) {
  try {
    // Admin auth check
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      // verifyAdmin에서 반환된 NextResponse 객체를 그대로 반환
      return adminCheck;
    }

    // 등록된 endpoint 목록 가져오기
    const allEndpoints = await getAllEndpoints();

    if (allEndpoints.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '등록된 endpoint가 없습니다.',
          models: [],
        },
        { status: 404 }
      );
    }

    // OpenAI 호환 API Key 조회
    let openaiApiKey = process.env.OPENAI_COMPAT_API_KEY || '';
    try {
      const { query } = await import('@/lib/postgres');
      const settingsResult = await query(
        `SELECT * FROM settings WHERE config_type = $1 LIMIT 1`,
        ['general']
      );
      const settings = settingsResult.rows[0];
      if (settings?.openai_compat_api_key) {
        openaiApiKey = settings.openai_compat_api_key;
      }
    } catch (e) {
      console.warn(
        '[get-local-models] settings 조회 실패, ENV 사용:',
        e?.message || e
      );
    }

    const allModels = [];
    const endpointResults = [];

    // 모든 endpoint에서 모델 수집
    for (const endpoint of allEndpoints) {
      try {
        const provider = endpoint.provider || 'llm';
        let models = [];

        if (provider === 'gemini') {
          // Gemini API: /v1beta/models
          const apiKey = endpoint.apiKey || '';
          if (!apiKey) {
            console.warn(`[get-local-models] Gemini API key가 없습니다: ${endpoint.url}`);
            endpointResults.push({
              endpoint: endpoint.url,
              endpointName: endpoint.name || endpoint.url,
              provider: 'gemini',
              count: 0,
              success: false,
              error: 'API key가 설정되지 않았습니다.',
            });
            continue;
          }

          const base = endpoint.url.replace(/\/+$/, '') || 'https://generativelanguage.googleapis.com';
          const url = `${base}/v1beta/models?key=${apiKey}`;
          const headers = { 'Content-Type': 'application/json' };

          console.log(`[get-local-models] Gemini 모델서버 조회: ${url}`);

          const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(30000),
          });

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            const rawModels = Array.isArray(data?.models) ? data.models : [];
            
            models = rawModels
              .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
              .map((m) => ({
                name: m.name || '',
                size: null,
                modified_at: null,
                digest: null,
                details: m,
                provider: 'gemini',
                endpoint: endpoint.url,
                endpointName: endpoint.name || endpoint.url,
              }));
          } else {
            console.warn(
              `[get-local-models] Gemini 모델서버 실패: ${endpoint.url} - ${response.status}`
            );
          }
        } else if (provider === 'openai-compatible') {
          // OpenAI 호환 API: /v1/models
          const base = endpoint.url.replace(/\/+$/, '');
          const path = /\/v1(\/|$)/.test(base) ? '/models' : '/v1/models';
          const url = `${base}${path}`;
          const headers = { 'Content-Type': 'application/json' };
          if (openaiApiKey) {
            headers['Authorization'] = `Bearer ${openaiApiKey}`;
          }

          console.log(`[get-local-models] OpenAI 호환 모델서버 조회: ${url}`);

          const response = await fetch(url, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(30000),
          });

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            const rawModels = Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.models)
              ? data.models
              : [];

            models = rawModels.map((m) => ({
              name: m.id || m.name || '',
              size: null,
              modified_at: m.created || m.modified_at || null,
              digest: null,
              details: m,
              provider: 'openai-compatible',
              endpoint: endpoint.url,
              endpointName: endpoint.name || endpoint.url,
            }));
          } else {
            console.warn(
              `[get-local-models] OpenAI 호환 모델서버 실패: ${endpoint.url} - ${response.status}`
            );
          }
        } else {
          // LLM API: /api/tags
          console.log(`[get-local-models] LLM 모델서버 조회: ${endpoint.url}`);

          const response = await fetch(`${endpoint.url}/api/tags`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
            signal: AbortSignal.timeout(30000),
          });

          if (response.ok) {
            const data = await response.json();
            models = (data.models || []).map((model) => ({
              name: model.name,
              size: model.size,
              modified_at: model.modified_at,
              digest: model.digest,
              details: model.details,
              provider: 'llm',
              endpoint: endpoint.url,
              endpointName: endpoint.name || endpoint.url,
            }));
          } else {
            console.warn(
              `[get-local-models] LLM 모델서버 실패: ${endpoint.url} - ${response.status}`
            );
          }
        }

        if (models.length > 0) {
          allModels.push(...models);
          endpointResults.push({
            endpoint: endpoint.url,
            endpointName: endpoint.name || endpoint.url,
            provider: provider,
            count: models.length,
            success: true,
          });
        } else {
          endpointResults.push({
            endpoint: endpoint.url,
            endpointName: endpoint.name || endpoint.url,
            provider: provider,
            count: 0,
            success: false,
            error: '모델이 없거나 조회 실패',
          });
        }
      } catch (error) {
        console.error(
          `[get-local-models] 모델서버 ${endpoint.url} 조회 실패:`,
          error.message
        );
        endpointResults.push({
          endpoint: endpoint.url,
          endpointName: endpoint.name || endpoint.url,
          provider: endpoint.provider || 'llm',
          count: 0,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(
      `[get-local-models] 총 ${allModels.length}개 모델 발견 (${endpointResults.length}개 endpoint)`
    );

    return NextResponse.json({
      success: true,
      models: allModels,
      endpoints: endpointResults,
      count: allModels.length,
    });
  } catch (error) {
    console.error('[get-local-models] 실패:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch local models: ' + error.message,
        models: [],
      },
      { status: 500 }
    );
  }
}
