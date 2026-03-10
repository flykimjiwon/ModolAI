import { NextResponse } from 'next/server';
import { verifyAdminWithResult } from '@/lib/auth';
import { query } from '@/lib/postgres';
import {
  getAllEndpoints,
  checkModelServerHealth,
  checkOpenAICompatibleHealth,
  checkGeminiHealth,
} from '@/lib/modelServerMonitor';
import { createAuthError, createServerError } from '@/lib/errorHandler';

export async function GET(request) {
  // 관리자 권한 확인
  const authResult = verifyAdminWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const systemStatus = {
      database: { status: 'unknown', message: 'Unknown', responseTime: null },
      apiServer: {
        status: 'operational',
        message: 'Operational',
        responseTime: 0,
      },
      modelServers: {
        status: 'unknown',
        message: 'Unknown',
        responseTime: null,
      },
      modelServerEndpoints: [],
    };

    // 1. 데이터베이스 상태 확인
    try {
      const dbStart = Date.now();
      await query('SELECT 1');
      const dbTime = Date.now() - dbStart;

      systemStatus.database = {
        status: 'operational',
        message: 'Connected',
        responseTime: dbTime,
      };
    } catch (error) {
      systemStatus.database = {
        status: 'error',
        message: 'Connection Failed',
        responseTime: null,
        error: error.message,
      };
    }

    // 2. API 서버 상태 (현재 응답하고 있으므로 정상)
    systemStatus.apiServer = {
      status: 'operational',
      message: 'Operational',
      responseTime: 0,
      timestamp: new Date().toISOString(),
    };

    // 3. 등록된 모든 endpoint 상태 확인
    try {
      // 등록된 모든 endpoint 가져오기
      const registeredEndpoints = await getAllEndpoints();

      let endpointsToCheck = [];

      if (registeredEndpoints.length === 0) {
        // 등록된 endpoint가 없으면 기본값 사용 (개발 환경에서만)
        const isDevelopment = process.env.NODE_ENV !== 'production';
        endpointsToCheck = isDevelopment
          ? [
              {
                url: 'http://localhost:11434',
                host: 'localhost',
                port: '11434',
                name: '로컬 개발 서버',
                provider: 'model-server',
              },
            ]
          : [];

        if (!isDevelopment) {
          console.warn(
            '[System Status] 등록된 모델서버가 없습니다. 관리자 설정에서 모델서버를 등록해주세요.'
          );
        }
      } else {
        endpointsToCheck = registeredEndpoints;
      }

      // 각 endpoint의 상태를 병렬로 확인 (비활성화된 서버는 스킵)
      const endpointStatuses = await Promise.all(
        endpointsToCheck.map(async (endpoint) => {
          // 비활성화된 서버는 상태 조회 스킵
          if (endpoint.isActive === false) {
            return {
              endpoint: endpoint.url,
              url: endpoint.url,
              name: endpoint.name || endpoint.url,
              provider: endpoint.provider || 'model-server',
              status: 'inactive',
              message: '비활성화됨',
              responseTime: null,
              modelsCount: 0,
              isActive: false,
            };
          }

          try {
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
            
            let result;
            if (provider === 'openai-compatible') {
              result = await checkOpenAICompatibleHealth({ ...endpoint, provider });
            } else if (provider === 'gemini') {
              result = await checkGeminiHealth({ ...endpoint, provider });
            } else {
              result = await checkModelServerHealth({ ...endpoint, provider: provider || 'model-server' });
            }

            // 상태를 UI에 맞게 변환
            const status =
              result.status === 'healthy'
                ? 'operational'
                : result.status === 'unhealthy'
                ? 'error'
                : 'warning';

            return {
              endpoint: result.url,
              url: result.url,
              name: result.name || result.url,
              provider: result.provider || 'model-server',
              status,
              message:
                result.modelCount !== undefined
                  ? `${result.modelCount}개 모델 로드됨`
                  : result.error || 'Unknown',
              responseTime: result.responseTime,
              modelsCount: result.modelCount || 0,
              isActive: endpoint.isActive !== false,
            };
          } catch (error) {
            return {
              endpoint: endpoint.url,
              url: endpoint.url,
              name: endpoint.name || endpoint.url,
              provider: endpoint.provider || 'model-server',
              status: 'error',
              message: error.message || 'Check Failed',
              responseTime: null,
              modelsCount: 0,
              isActive: endpoint.isActive !== false,
            };
          }
        })
      );

      systemStatus.modelServerEndpoints = endpointStatuses;

      // 전체 요약 상태 계산
      const operationalCount = endpointStatuses.filter(
        (ep) => ep.status === 'operational'
      ).length;
      const errorCount = endpointStatuses.filter(
        (ep) => ep.status === 'error'
      ).length;
      const warningCount = endpointStatuses.filter(
        (ep) => ep.status === 'warning'
      ).length;

      if (
        operationalCount === endpointStatuses.length &&
        endpointStatuses.length > 0
      ) {
        systemStatus.modelServers = {
          status: 'operational',
          message: `모든 모델 서버 정상 (${operationalCount}개)`,
          responseTime: Math.max(
            ...endpointStatuses
              .map((ep) => ep.responseTime)
              .filter((rt) => rt !== null)
          ),
        };
      } else if (errorCount > 0) {
        systemStatus.modelServers = {
          status: 'error',
          message: `${errorCount}개 모델 서버 오류`,
          responseTime: null,
        };
      } else if (warningCount > 0) {
        systemStatus.modelServers = {
          status: 'warning',
          message: `${warningCount}개 모델 서버 경고`,
          responseTime: null,
        };
      } else {
        systemStatus.modelServers = {
          status: 'checking',
          message: 'Checking endpoints...',
          responseTime: null,
        };
      }
    } catch (error) {
      systemStatus.modelServers = {
        status: 'error',
        message: 'Check Failed',
        responseTime: null,
        error: error.message,
      };
      systemStatus.modelServerEndpoints = [];
    }

    return NextResponse.json({
      success: true,
      status: systemStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('시스템 상태 조회 실패:', error);
    return createServerError(error, '시스템 상태 조회 실패');
  }
}
