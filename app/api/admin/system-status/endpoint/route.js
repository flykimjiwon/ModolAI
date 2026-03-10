import { NextResponse } from 'next/server';
import { verifyAdminWithResult } from '@/lib/auth';
import {
  getAllEndpoints,
  checkModelServerHealth,
  checkOpenAICompatibleHealth,
  checkGeminiHealth,
} from '@/lib/modelServerMonitor';
import {
  createAuthError,
  createValidationError,
  createNotFoundError,
  createServerError,
} from '@/lib/errorHandler';

// 개별 endpoint 상태 조회
export async function GET(request) {
  const authResult = verifyAdminWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const endpointUrl = searchParams.get('url');

    if (!endpointUrl) {
      return createValidationError('endpoint URL이 필요합니다.');
    }

    // 등록된 endpoint 목록에서 찾기
    const allEndpoints = await getAllEndpoints();
    const endpoint = allEndpoints.find((ep) => ep.url === endpointUrl);

    if (!endpoint) {
      return createNotFoundError('등록되지 않은 endpoint입니다.');
    }

    // 비활성화된 서버는 상태 조회 스킵
    if (endpoint.isActive === false) {
      return NextResponse.json({
        success: true,
        endpoint: {
          endpoint: endpoint.url,
          name: endpoint.name || endpoint.url,
          provider: endpoint.provider || 'model-server',
          status: 'inactive',
          message: '비활성화됨',
          responseTime: null,
          modelsCount: 0,
          isActive: false,
        },
      });
    }

    // URL 기반으로 provider 재확인 (이중 체크)
    let provider = endpoint.provider;
    if (endpoint.url) {
      const url = endpoint.url.toLowerCase();
      if (url.includes('generativelanguage.googleapis.com')) {
        provider = 'gemini';
      } else if (url.includes('/v1/models') || url.includes('/v1/chat')) {
        provider = 'openai-compatible';
      }
    }

    // Provider에 따라 상태 확인
    let result;
    if (provider === 'openai-compatible') {
      result = await checkOpenAICompatibleHealth({ ...endpoint, provider });
    } else if (provider === 'gemini') {
      result = await checkGeminiHealth({ ...endpoint, provider });
    } else {
      result = await checkModelServerHealth({
        ...endpoint,
        provider: provider || 'model-server',
      });
    }

    // 결과 형식 통일
    const formattedResult = {
      endpoint: result.url,
      name: result.name || result.url,
      provider: result.provider || 'model-server',
      status:
        result.status === 'healthy'
          ? 'operational'
          : result.status === 'unhealthy'
          ? 'error'
          : 'warning',
      message:
        result.modelCount !== undefined
          ? `${result.modelCount} models loaded`
          : result.error || 'Unknown',
      responseTime: result.responseTime,
      modelsCount: result.modelCount || 0,
      error: result.error || null,
    };

    return NextResponse.json({
      success: true,
      endpoint: formattedResult,
    });
  } catch (error) {
    console.error('[system-status/endpoint] 실패:', error);

    // 타임아웃 에러를 명시적으로 처리
    if (
      error.name === 'TimeoutError' ||
      error.name === 'AbortError' ||
      error.name === 'ConnectTimeoutError' ||
      error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      error.message?.includes('timeout') ||
      error.message?.includes('aborted')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'endpoint 상태 조회 타임아웃',
          message:
            '모델 서버 연결 타임아웃입니다. 모델 서버가 실행 중인지 확인하세요.',
          errorType: 'timeout',
        },
        { status: 504 }
      );
    }

    return createServerError(error, 'endpoint 상태 조회 실패');
  }
}
