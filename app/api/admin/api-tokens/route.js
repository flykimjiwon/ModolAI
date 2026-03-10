import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { isValidUUID } from '@/lib/utils';
import { createAuthError, createValidationError, createNotFoundError, createServerError } from '@/lib/errorHandler';

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
    console.error('[Admin API Keys] 키 복호화 실패:', error);
    return null;
  }
}

// 날짜를 ISO 문자열로 변환하는 헬퍼 함수
function toISOString(dateValue) {
  if (!dateValue) return null;
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
  }
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (typeof dateValue === 'number') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

// 사용자별 API 토큰 목록 조회
export async function GET(request) {
  try {
    const authResult = verifyAdminWithResult(request);
    if (!authResult.valid) {
      return createAuthError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 100);
    const skip = (page - 1) * limit;

    // 필터 구성
    let sql = 'SELECT * FROM api_tokens';
    const params = [];
    let paramIndex = 1;

    if (userId) {
      sql += ` WHERE user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, skip);

    // 토큰 목록 조회
    const tokensResult = await query(sql, params);
    const tokens = tokensResult.rows.map((row) => ({
      _id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      encryptedToken: row.encrypted_token,
      name: row.name,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      createdBy: row.created_by,
    }));

    // 사용자 정보 조인
    const userIds = [...new Set(tokens.map((t) => t.userId).filter(Boolean))];
    let usersResult;
    if (userIds.length > 0) {
      const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
      usersResult = await query(
        `SELECT id, email, name, department, cell, role FROM users WHERE id IN (${placeholders})`,
        userIds
      );
    } else {
      usersResult = { rows: [] };
    }
    const users = usersResult.rows.map((row) => ({
      _id: row.id,
      id: row.id,
      email: row.email,
      name: row.name,
      department: row.department,
      cell: row.cell,
      role: row.role,
    }));

    const userMap = {};
    users.forEach((user) => {
      // PostgreSQL 호환성: id 또는 _id 사용
      const userId = user._id || user.id;
      if (!userId) {
        console.warn('[API Tokens GET] 사용자 ID가 없는 사용자 발견:', user);
        return;
      }
      const userIdStr = userId.toString();
      userMap[userIdStr] = {
        _id: userIdStr,
        email: user.email,
        name: user.name,
        department: user.department,
        cell: user.cell,
        role: user.role,
      };
    });

    // 사용자 정보 추가
    const tokensWithUsers = tokens.map((token) => {
      // PostgreSQL 호환성: id 또는 _id 사용
      const tokenId = token._id || token.id;
      return {
        ...token,
        _id: tokenId ? tokenId.toString() : null,
        userId: token.userId,
        user: userMap[token.userId] || null,
        // 날짜 필드를 ISO 문자열로 변환
        createdAt: toISOString(token.createdAt),
        expiresAt: toISOString(token.expiresAt),
        lastUsedAt: toISOString(token.lastUsedAt),
      };
    });

    // 통계 조회
    let countSql = 'SELECT COUNT(*) as count FROM api_tokens';
    const countParams = [];
    if (userId) {
      countSql += ' WHERE user_id = $1';
      countParams.push(userId);
    }
    const countResult = await query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    // 사용량 통계 (PostgreSQL의 external_api_logs에서 조회)
    const tokenHashes = tokens.map((t) => t.tokenHash).filter(Boolean);
    let usageMap = {};
    
    if (tokenHashes.length > 0) {
      try {
        const placeholders = tokenHashes.map((_, i) => `$${i + 1}`).join(', ');
        const usageStatsResult = await query(
          `SELECT token_hash as _id,
                  COUNT(*)::INTEGER as request_count,
                  COALESCE(SUM(total_token_count), 0)::INTEGER as total_tokens,
                  MAX(timestamp) as last_used
           FROM external_api_logs
           WHERE token_hash IN (${placeholders})
           GROUP BY token_hash`,
          tokenHashes
        );
        
        usageStatsResult.rows.forEach((stat) => {
          usageMap[stat._id] = {
            requestCount: parseInt(stat.request_count || 0),
            totalTokens: parseInt(stat.total_tokens || 0),
            lastUsed: stat.last_used,
          };
        });
      } catch (usageError) {
        console.error('[API Tokens GET] 사용량 통계 조회 실패:', usageError);
        // 사용량 조회 실패해도 토큰 목록은 반환
      }
    }

    // 사용량 정보 추가
    const tokensWithUsage = tokensWithUsers.map((token) => {
      const decryptedToken = token.encryptedToken
        ? decryptToken(token.encryptedToken)
        : null;
      return {
        ...token,
        originalToken: decryptedToken,
        usage: {
          requestCount: usageMap[token.tokenHash]?.requestCount || 0,
          totalTokens: usageMap[token.tokenHash]?.totalTokens || 0,
          lastUsed: toISOString(usageMap[token.tokenHash]?.lastUsed),
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
    console.error('[API Tokens GET] 오류:', error);
    return createServerError(error, '키 목록 조회 실패');
  }
}

// 새 API 토큰 발급
export async function POST(request) {
  try {
    const authResult = verifyAdminWithResult(request);
    if (!authResult.valid) {
      return createAuthError(authResult.error);
    }

    const body = await request.json();
    const { userId, name, expiresInDays = 90 } = body;

    if (!userId) {
      return createValidationError('사용자 ID가 필요합니다.');
    }

    // UUID 검증
    if (!isValidUUID(userId)) {
      return createValidationError('유효하지 않은 사용자 ID입니다.');
    }

    // 사용자 정보 조회
    const userResult = await query(
      'SELECT id, email, name, department, cell, role FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return createNotFoundError('User not found.');
    }
    
    const user = userResult.rows[0];
    const userDbIdStr = user.id.toString();

    // JWT 토큰 생성
    const expiresIn = expiresInDays * 24 * 60 * 60; // 일을 초로 변환
    const tokenPayload = {
      sub: userDbIdStr,
      email: user.email,
      name: user.name,
      department: user.department,
      cell: user.cell,
      role: user.role || 'user',
      type: 'api_token', // API 토큰임을 표시
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: `${expiresInDays}d`,
    });

    // 토큰 해시 생성
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex')
      .substring(0, 16);

    // 토큰 정보 저장
    const tokenDoc = {
      userId: userDbIdStr,
      tokenHash,
      name: name || `API Token ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      isActive: true,
      lastUsedAt: null,
      createdBy: authResult.user.id || authResult.user.sub,
    };

    const insertResult = await query(
      `INSERT INTO api_tokens (user_id, token_hash, name, created_at, expires_at, is_active, last_used_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tokenDoc.userId,
        tokenDoc.tokenHash,
        tokenDoc.name,
        tokenDoc.createdAt,
        tokenDoc.expiresAt,
        tokenDoc.isActive,
        tokenDoc.lastUsedAt,
        tokenDoc.createdBy,
      ]
    );

    const insertedToken = insertResult.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        token, // 처음 발급 시에만 토큰 반환
        tokenInfo: {
          _id: insertedToken.id.toString(),
          tokenHash,
          name: tokenDoc.name,
          userId: tokenDoc.userId,
          user: {
            email: user.email,
            name: user.name,
            department: user.department,
          },
          createdAt: toISOString(tokenDoc.createdAt),
          expiresAt: toISOString(tokenDoc.expiresAt),
          isActive: tokenDoc.isActive,
        },
      },
      message: '키가 성공적으로 발급되었습니다. 이 키는 이번에만 표시됩니다.',
    });
  } catch (error) {
    console.error('[API Tokens POST] 오류:', error);
    return createServerError(error, '키 발급 실패');
  }
}

// 토큰 삭제 또는 비활성화
export async function DELETE(request) {
  try {
    const authResult = verifyAdminWithResult(request);
    if (!authResult.valid) {
      return createAuthError(authResult.error);
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('id');

    if (!tokenId) {
      return createValidationError('키 ID가 필요합니다.');
    }

    // UUID 검증
    if (!isValidUUID(tokenId)) {
      return createValidationError('유효하지 않은 키 ID입니다.');
    }

    // 토큰 삭제
    const result = await query(
      'DELETE FROM api_tokens WHERE id = $1',
      [tokenId]
    );

    if (result.rowCount === 0) {
      return createNotFoundError('키를 Not found.');
    }

    return NextResponse.json({
      success: true,
      message: '키가 Deleted.',
    });
  } catch (error) {
    console.error('[API Tokens DELETE] 오류:', error);
    return createServerError(error, '키 삭제 실패');
  }
}

// 토큰 활성화/비활성화
export async function PATCH(request) {
  try {
    const authResult = verifyAdminWithResult(request);
    if (!authResult.valid) {
      return createAuthError(authResult.error);
    }

    const body = await request.json();
    const { id, isActive } = body;

    if (!id || typeof isActive !== 'boolean') {
      return createValidationError('키 ID와 isActive 상태가 필요합니다.');
    }

    // UUID 검증
    if (!isValidUUID(id)) {
      return createValidationError('유효하지 않은 키 ID입니다.');
    }

    const result = await query(
      'UPDATE api_tokens SET is_active = $1, updated_at = $2 WHERE id = $3',
      [isActive, new Date(), id]
    );

    if (result.rowCount === 0) {
      return createNotFoundError('키를 Not found.');
    }

    return NextResponse.json({
      success: true,
      message: `키가 ${isActive ? '활성화' : '비활성화'}되었습니다.`,
    });
  } catch (error) {
    console.error('[API Tokens PATCH] 오류:', error);
    return createServerError(error, '키 상태 변경 실패');
  }
}
