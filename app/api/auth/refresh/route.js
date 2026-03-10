import { NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '@/lib/postgres';
import { JWT_SECRET } from '@/lib/config';

const ACCESS_TOKEN_EXPIRES = '1h';
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

/**
 * POST /api/auth/refresh
 * httpOnly cookie의 refresh token으로 새 access token + refresh token 발급 (rotation)
 */
export async function POST(request) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'refresh token이 없습니다.', errorType: 'no_refresh_token' },
        { status: 401 }
      );
    }

    // DB에서 refresh token 검증
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenResult = await query(
      `SELECT rt.*, u.id as uid, u.email, u.name, u.department, u.cell, u.role,
              u.employee_no, u.auth_type
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
         AND rt.revoked = FALSE
         AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      // 만료되거나 revoke된 토큰 — cookie 삭제
      const response = NextResponse.json(
        { error: 'refresh token이 만료되었거나 유효하지 않습니다.', errorType: 'refresh_expired' },
        { status: 401 }
      );
      response.cookies.set('refresh_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/api/auth',
      });
      return response;
    }

    const tokenRow = tokenResult.rows[0];
    const userId = tokenRow.uid;

    // 기존 refresh token revoke
    await query(
      `UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );

    // 새 refresh token 생성
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;
    const userAgent = request.headers.get('user-agent') || null;

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, newTokenHash, newExpiresAt, ipAddress, userAgent]
    );

    // 새 access token 발급
    const newAccessToken = jwt.sign(
      {
        sub: userId,
        email: tokenRow.email,
        name: tokenRow.name,
        department: tokenRow.department,
        cell: tokenRow.cell,
        role: tokenRow.role || 'user',
        employeeNo: tokenRow.employee_no,
        authType: tokenRow.auth_type,
      },
      JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRES }
    );

    // last_active_at 업데이트 (refresh = 활동 중)
    await query(
      `UPDATE users SET last_active_at = NOW()
       WHERE id = $1
         AND (last_active_at IS NULL OR last_active_at < NOW() - INTERVAL '10 minutes')`,
      [userId]
    );

    const response = NextResponse.json({ token: newAccessToken });
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60,
      path: '/api/auth',
    });
    return response;

  } catch (error) {
    console.error('[Auth Refresh] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', errorType: 'server_error' },
      { status: 500 }
    );
  }
}
