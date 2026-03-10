import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyToken } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { isValidUUID } from '@/lib/utils';
import { createAuthError, createValidationError, createNotFoundError, createServerError } from '@/lib/errorHandler';

// 암호화/복호화 함수
function encryptToken(token) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(encryptedToken) {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET || 'default-secret', 'salt', 32);
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('키 복호화 실패:', error);
    return null;
  }
}

// 본인 API 토큰 목록 조회
export async function GET(request) {
  try {
    const tokenPayload = verifyToken(request);
    if (!tokenPayload) {
      return createAuthError('Authentication required.');
    }

    const userId = tokenPayload.sub || tokenPayload.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 100);
    const skip = (page - 1) * limit;

    // UUID 검증
    if (!isValidUUID(userId)) {
      return createValidationError('유효하지 않은 사용자 ID입니다.');
    }

    // 토큰 목록 조회
    const tokensResult = await query(
      `SELECT id, user_id, token_hash, encrypted_token, name, expires_at, is_active, 
              last_used_at, created_by, created_at, updated_at
       FROM api_tokens
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, skip]
    );

    const tokens = tokensResult.rows;

    // 전체 개수 조회
    const totalCountResult = await query(
      `SELECT COUNT(*) as count FROM api_tokens WHERE user_id = $1`,
      [userId]
    );
    const totalCount = parseInt(totalCountResult.rows[0].count);

    // 사용량 통계 (external_api_logs에서)
    const tokenHashes = tokens.map((t) => t.token_hash).filter(Boolean);
    let usageStats = [];
    
    if (tokenHashes.length > 0) {
      const placeholders = tokenHashes.map((_, i) => `$${i + 1}`).join(', ');
      const usageStatsResult = await query(
        `SELECT token_hash as _id,
                COUNT(*) as request_count,
                SUM(total_token_count) as total_tokens,
                MAX(timestamp) as last_used
         FROM external_api_logs
         WHERE token_hash IN (${placeholders})
         GROUP BY token_hash`,
        tokenHashes
      );
      usageStats = usageStatsResult.rows;
    }

    const usageMap = {};
    usageStats.forEach((stat) => {
      usageMap[stat._id] = {
        requestCount: parseInt(stat.request_count || 0),
        totalTokens: parseInt(stat.total_tokens || 0),
        lastUsed: stat.last_used,
      };
    });

    // 사용량 정보 추가 및 원본 토큰 복호화
    const tokensWithUsage = tokens.map((token) => {
      let decryptedToken = null;
      if (token.encrypted_token) {
        decryptedToken = decryptToken(token.encrypted_token);
      }
      return {
        _id: token.id,
        userId: token.user_id,
        tokenHash: token.token_hash,
        encryptedToken: token.encrypted_token,
        name: token.name,
        expiresAt: token.expires_at,
        isActive: token.is_active,
        lastUsedAt: token.last_used_at,
        createdBy: token.created_by,
        createdAt: token.created_at,
        updatedAt: token.updated_at,
        originalToken: decryptedToken, // 복호화된 원본 토큰 (개인 키 관리 화면에서만 사용)
        usage: usageMap[token.token_hash] || {
          requestCount: 0,
          totalTokens: 0,
          lastUsed: null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tokens: tokensWithUsage,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error('[User API Tokens GET] 오류:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
    const hint = error.hint || (error.code === '42P01' ? 'api_tokens 테이블이 존재하지 않습니다. 스키마를 생성해주세요.' : null);
    return createServerError(error, `키 목록 조회 실패: ${errorMessage}${hint ? ` (${hint})` : ''}`);
  }
}

// 새 API 토큰 발급 (본인용)
export async function POST(request) {
  try {
    const tokenPayload = verifyToken(request);
    if (!tokenPayload) {
      return createAuthError('Authentication required.');
    }

    const userId = tokenPayload.sub || tokenPayload.id;
    const body = await request.json();
    const { name, expiresInDays = 90 } = body;

    // UUID 검증
    if (!isValidUUID(userId)) {
      return createValidationError('유효하지 않은 사용자 ID입니다.');
    }

    // 사용자 정보 조회
    const userResult = await query(
      `SELECT id, email, name, department, cell, role FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return createNotFoundError('User not found.');
    }

    const user = userResult.rows[0];

    // 기존 활성 토큰이 있는지 확인 (1인당 1개 제한)
    const existingTokenResult = await query(
      `SELECT COUNT(*) as count FROM api_tokens WHERE user_id = $1 AND is_active = true`,
      [userId]
    );
    if (parseInt(existingTokenResult.rows[0].count) > 0) {
      return createValidationError('이미 발급된 키가 있습니다. 기존 키를 삭제한 후 새 키를 발급하세요.');
    }

    // JWT 토큰 생성
    const expiresIn = expiresInDays * 24 * 60 * 60; // 일을 초로 변환
    const tokenPayloadData = {
      sub: user.id,
      email: user.email,
      name: user.name,
      department: user.department,
      cell: user.cell,
      role: user.role || 'user',
      type: 'api_token', // API 토큰임을 표시
    };

    const token = jwt.sign(tokenPayloadData, process.env.JWT_SECRET, {
      expiresIn: `${expiresInDays}d`,
    });

    // 토큰 해시 생성
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
      .substring(0, 16);

    // 원본 토큰 암호화 저장 (개인 키 관리 화면에서만 사용)
    const encryptedToken = encryptToken(token);

    // 토큰 정보 저장
    const tokenName = name || `API Token ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const insertResult = await query(
      `INSERT INTO api_tokens (user_id, token_hash, encrypted_token, name, expires_at, is_active, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, user_id, token_hash, name, expires_at, is_active, created_at`,
      [userId, tokenHash, encryptedToken, tokenName, expiresAt, true, userId]
    );

    const tokenInfo = insertResult.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        token, // 처음 발급 시에만 토큰 반환
        tokenInfo: {
          _id: tokenInfo.id,
          tokenHash: tokenInfo.token_hash,
          name: tokenInfo.name,
          userId: tokenInfo.user_id,
          createdAt: tokenInfo.created_at,
          expiresAt: tokenInfo.expires_at,
          isActive: tokenInfo.is_active,
        },
      },
      message: '키가 성공적으로 발급되었습니다. 이 키는 이번에만 표시됩니다.',
    });
  } catch (error) {
    console.error('[User API Tokens POST] 오류:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    return createServerError(error, `키 발급 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`);
  }
}

// 토큰 삭제 (본인 토큰만)
export async function DELETE(request) {
  try {
    const tokenPayload = verifyToken(request);
    if (!tokenPayload) {
      return createAuthError('Authentication required.');
    }

    const userId = tokenPayload.sub || tokenPayload.id;
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return createValidationError('키 ID가 필요합니다.');
    }

    // UUID 검증
    if (!isValidUUID(tokenId) || !isValidUUID(userId)) {
      return createValidationError('유효하지 않은 키 ID입니다.');
    }

    // 본인의 토큰인지 확인 후 삭제
    const result = await query(
      `DELETE FROM api_tokens WHERE id = $1 AND user_id = $2`,
      [tokenId, userId]
    );

    if (result.rowCount === 0) {
      return createNotFoundError('키를 찾을 수 없거나 삭제 Unauthorized.');
    }

    return NextResponse.json({
      success: true,
      message: '키가 Deleted.',
    });
  } catch (error) {
    console.error('[User API Tokens DELETE] 오류:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    return createServerError(error, `키 삭제 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`);
  }
}

// 토큰 활성화/비활성화 (본인 토큰만)
export async function PATCH(request) {
  try {
    const tokenPayload = verifyToken(request);
    if (!tokenPayload) {
      return createAuthError('Authentication required.');
    }

    const userId = tokenPayload.sub || tokenPayload.id;
    const body = await request.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== 'boolean') {
      return createValidationError('키 ID와 isActive 상태가 필요합니다.');
    }

    // UUID 검증
    if (!isValidUUID(id) || !isValidUUID(userId)) {
      return createValidationError('유효하지 않은 키 ID입니다.');
    }

    // 본인의 토큰인지 확인 후 업데이트
    const result = await query(
      `UPDATE api_tokens SET is_active = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`,
      [isActive, id, userId]
    );

    if (result.rowCount === 0) {
      return createNotFoundError('키를 찾을 수 없거나 수정 Unauthorized.');
    }

    return NextResponse.json({
      success: true,
      message: `키가 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
    });
  } catch (error) {
    console.error('[User API Tokens PATCH] 오류:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    return createServerError(error, `키 상태 변경 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`);
  }
}
