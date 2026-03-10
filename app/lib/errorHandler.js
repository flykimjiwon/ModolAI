import { NextResponse } from 'next/server';
import { logAppError } from '@/lib/appErrorLogger';

/**
 * 표준화된 에러 응답 생성
 */
export function createErrorResponse(error, status = 500) {
  const errorResponse = {
    success: false,
    error: error.message || error,
    timestamp: new Date().toISOString(),
    status
  };

  // 개발 환경에서만 상세 정보 포함
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  console.error(`[ERROR ${status}]`, error);
  if (status >= 400) {
    const source = status >= 500 ? 'server' : 'api';
    const level = status >= 500 ? 'error' : 'warn';
    logAppError({
      source,
      level,
      message: error.message || String(error),
      stack: error.stack,
      context: { status },
    });
  }

  return NextResponse.json(errorResponse, { status });
}

/**
 * 표준화된 성공 응답 생성
 */
export function createSuccessResponse(data, status = 200) {
  const successResponse = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  return NextResponse.json(successResponse, { status });
}

/**
 * 인증 에러 응답
 */
export function createAuthError(message = '인증이 필요합니다.') {
  return createErrorResponse(new Error(message), 401);
}

/**
 * 권한 에러 응답
 */
export function createForbiddenError(message = '접근 권한이 없습니다.') {
  return createErrorResponse(new Error(message), 403);
}

/**
 * 찾을 수 없음 에러 응답
 */
export function createNotFoundError(message = '요청한 리소스를 찾을 수 없습니다.') {
  return createErrorResponse(new Error(message), 404);
}

/**
 * 검증 에러 응답
 */
export function createValidationError(message) {
  return createErrorResponse(new Error(message), 400);
}

/**
 * 서버 에러 응답
 */
export function createServerError(error, message = '서버 내부 오류가 발생했습니다.') {
  return createErrorResponse(error || new Error(message), 500);
}

/**
 * API 에러 처리 헬퍼 (기존 라우트 호환)
 */
export function handleApiError(error, context = '') {
  if (context) {
    console.error(`[API ERROR] ${context}`, error);
  } else {
    console.error('[API ERROR]', error);
  }
  return createServerError(error);
}

/**
 * 비동기 함수를 래핑하여 에러를 자동으로 처리
 */
export function withErrorHandler(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error.name === 'ValidationError') {
        return createValidationError(error.message);
      }
      if (error.name === 'UnauthorizedError') {
        return createAuthError(error.message);
      }
      if (error.name === 'ForbiddenError') {
        return createForbiddenError(error.message);
      }
      if (error.name === 'NotFoundError') {
        return createNotFoundError(error.message);
      }
      
      return createServerError(error);
    }
  };
}

/**
 * 커스텀 에러 클래스들
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = '인증이 필요합니다.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = '접근 권한이 없습니다.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message = '요청한 리소스를 찾을 수 없습니다.') {
    super(message);
    this.name = 'NotFoundError';
  }
}
