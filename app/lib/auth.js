import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { JWT_SECRET } from './config';
import { createAuthError, createForbiddenError } from './errorHandler';
import { query } from './postgres';
/**
 * Authorization 헤더에서 Bearer 토큰 추출
 */
export function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || 
                     request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}

/**
 * Authorization 헤더에 들어있는 Bearer 토큰을 검증하고,
 * 유효하면 payload(디코딩된 토큰) 를 반환, 아니면 null.
 * 
 * @param {Request} request - Next.js Request 객체
 * @returns {object|null} 디코딩된 토큰 payload 또는 null
 */
export function verifyToken(request) {
  const token = extractBearerToken(request);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET || process.env.JWT_SECRET);
    // JWT 표준에 따라 sub(subject)를 사용자 ID로 사용
    // 하위 호환성을 위해 id도 제공하지만 sub 사용을 권장
    return { ...payload, id: payload.sub, userId: payload.sub };
  } catch (error) {
    console.error('JWT 토큰 검증 실패:', error.message);
    return null;
  }
}

/**
 * 토큰 검증 결과 객체 반환 (일부 파일에서 사용하는 형식과 호환)
 * @param {Request} request - Next.js Request 객체
 * @returns {{valid: boolean, user?: object, error?: string}}
 */
export function verifyTokenWithResult(request) {
  const token = extractBearerToken(request);
  
  if (!token) {
    return { valid: false, error: 'No authentication token.' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET || process.env.JWT_SECRET);
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: 'Invalid token.' };
  }
}

/**
 * 관리자 권한 검증
 * @param {Request} request - Next.js Request 객체
 * @returns {{valid: boolean, user?: object, error?: string}} | NextResponse
 */
export function verifyAdminWithResult(request) {
  const token = extractBearerToken(request);
  
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET || process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return { valid: false, error: 'Admin privileges required' };
    }
    return { valid: true, user: decoded };
  } catch (error) {
    return { valid: false, error: 'Invalid token' };
  }
}

/**
 * 인증이 필요한 API 라우트를 위한 미들웨어
 * @param {Request} request - Next.js Request 객체
 * @returns {object|null} {user: object} 또는 null (인증 실패 시)
 */
export function requireAuth(request) {
  const payload = verifyToken(request);
  if (!payload) {
    return null;
  }
  return { user: payload };
}

/**
 * 관리자 권한이 필요한 API 라우트를 위한 미들웨어
 * @param {Request} request - Next.js Request 객체
 * @returns {object|null} {user: object} 또는 null (인증/권한 실패 시)
 */
export function requireAdmin(request) {
  const payload = verifyToken(request);
  if (!payload) {
    return null;
  }
  if (payload.role !== 'admin') {
    return null;
  }
  return { user: payload };
}

/**
 * 마지막 활동 시각 업데이트 (10분 간격 throttle)
 * DB 쿼리: last_active_at < NOW() - 10분 일 때만 실제 업데이트 실행
 * @param {string} userId - 사용자 UUID
 */
export async function updateLastActive(userId) {
  if (!userId) return;
  try {
    await query(
      `UPDATE users SET last_active_at = NOW()
       WHERE id = $1
         AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '10 minutes')`,
      [userId]
    );
  } catch (err) {
    console.warn('[Auth] updateLastActive 실패:', err.message);
  }
}
