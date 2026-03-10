import { NextResponse } from 'next/server';
import { verifyToken, requireAuth, requireAdmin } from './auth';
import {
  createErrorResponse,
  createAuthError,
  createForbiddenError,
  createValidationError,
  createNotFoundError,
  createServerError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from './errorHandler';
import { isValidUUID } from './utils';

/**
 * API 라우트 핸들러를 래핑하여 공통 에러 처리 및 인증 검증 제공
 * 
 * @param {Function} handler - API 핸들러 함수
 * @param {object} options - 옵션
 * @param {boolean} options.requireAuth - 인증 필요 여부 (기본값: false)
 * @param {boolean} options.requireAdmin - 관리자 권한 필요 여부 (기본값: false)
 * @param {string} options.logPrefix - 로그 접두사
 * @returns {Function} 래핑된 핸들러 함수
 */
export function withApiHandler(handler, options = {}) {
  const {
    requireAuth: needsAuth = false,
    requireAdmin: needsAdmin = false,
    logPrefix = '[API]',
  } = options;

  return async (request, context) => {
    try {
      // 인증 검증
      if (needsAdmin) {
        const adminResult = requireAdmin(request);
        if (!adminResult) {
          return createForbiddenError('관리자 권한이 필요합니다.');
        }
        // context에 user 정보 추가
        context.user = adminResult.user;
      } else if (needsAuth) {
        const authResult = requireAuth(request);
        if (!authResult) {
          return createAuthError('인증이 필요합니다.');
        }
        // context에 user 정보 추가
        context.user = authResult.user;
      }

      // 핸들러 실행
      const result = await handler(request, context);

      // NextResponse가 이미 반환된 경우 그대로 반환
      if (result instanceof NextResponse) {
        return result;
      }

      // 일반 객체인 경우 성공 응답으로 변환
      return NextResponse.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // 커스텀 에러 처리
      if (error instanceof ValidationError) {
        return createValidationError(error.message);
      }
      if (error instanceof UnauthorizedError) {
        return createAuthError(error.message);
      }
      if (error instanceof ForbiddenError) {
        return createForbiddenError(error.message);
      }
      if (error instanceof NotFoundError) {
        return createNotFoundError(error.message);
      }

      // 일반 에러 처리
      console.error(`${logPrefix} 에러:`, error);
      return createServerError(error);
    }
  };
}

/**
 * UUID 검증 미들웨어
 * @param {string} id - 검증할 UUID
 * @param {string} fieldName - 필드 이름 (에러 메시지용)
 * @throws {ValidationError} UUID가 유효하지 않은 경우
 */
export function validateUUID(id, fieldName = 'ID') {
  if (!id) {
    throw new ValidationError(`${fieldName}가 필요합니다.`);
  }
  if (!isValidUUID(id)) {
    throw new ValidationError(`유효하지 않은 ${fieldName}입니다.`);
  }
}

/**
 * 인증이 필요한 API 핸들러 래퍼
 */
export function withAuth(handler, logPrefix) {
  return withApiHandler(handler, {
    requireAuth: true,
    logPrefix,
  });
}

/**
 * 관리자 권한이 필요한 API 핸들러 래퍼
 */
export function withAdmin(handler, logPrefix) {
  return withApiHandler(handler, {
    requireAdmin: true,
    logPrefix,
  });
}

/**
 * 요청 본문 검증 헬퍼
 * @param {Request} request - Next.js Request 객체
 * @param {Array<string>} requiredFields - 필수 필드 목록
 * @returns {Promise<object>} 파싱된 요청 본문
 * @throws {ValidationError} 필수 필드가 없는 경우
 */
export async function validateRequestBody(request, requiredFields = []) {
  try {
    const body = await request.json();
    
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        throw new ValidationError(`${field} 필드는 필수입니다.`);
      }
    }
    
    return body;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('요청 본문을 파싱할 수 없습니다.');
  }
}

/**
 * 쿼리 파라미터 검증 헬퍼
 * @param {URLSearchParams} searchParams - URLSearchParams 객체
 * @param {Array<string>} requiredParams - 필수 파라미터 목록
 * @returns {object} 파싱된 쿼리 파라미터
 * @throws {ValidationError} 필수 파라미터가 없는 경우
 */
export function validateQueryParams(searchParams, requiredParams = []) {
  const params = {};
  
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  
  for (const param of requiredParams) {
    if (!params[param]) {
      throw new ValidationError(`${param} 파라미터는 필수입니다.`);
    }
  }
  
  return params;
}

