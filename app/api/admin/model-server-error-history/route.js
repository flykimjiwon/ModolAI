import { NextResponse } from 'next/server';
import { verifyAdminWithResult } from '@/lib/auth';
import { query } from '@/lib/postgres';
import {
  createAuthError,
  createValidationError,
  createServerError,
} from '@/lib/errorHandler';

// 모델 Server error 이력 조회
export async function GET(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdminWithResult(request);
    if (!adminCheck.valid) {
      return createAuthError(adminCheck.error);
    }

    const { searchParams } = new URL(request.url);
    const endpointUrl = searchParams.get('endpoint');
    const provider = searchParams.get('provider');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // 기본 쿼리 구성
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // 시간 범위 필터
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - hours);
    whereConditions.push(`checked_at >= $${paramIndex}`);
    params.push(hoursAgo.toISOString());
    paramIndex++;

    // endpoint 필터
    if (endpointUrl) {
      whereConditions.push(`endpoint_url = $${paramIndex}`);
      params.push(endpointUrl);
      paramIndex++;
    }

    // provider 필터
    if (provider) {
      whereConditions.push(`provider = $${paramIndex}`);
      params.push(provider);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // 오류 이력 조회
    const result = await query(
      `SELECT 
        id,
        endpoint_url,
        endpoint_name,
        provider,
        error_message,
        error_type,
        response_time,
        status,
        checked_at,
        metadata
       FROM model_server_error_history
       ${whereClause}
       ORDER BY checked_at DESC
       LIMIT $${paramIndex}`,
      [...params, limit]
    );

    // 통계 조회
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_errors,
        COUNT(DISTINCT endpoint_url) as unique_endpoints,
        COUNT(DISTINCT provider) as unique_providers,
        MIN(checked_at) as first_error,
        MAX(checked_at) as last_error
       FROM model_server_error_history
       ${whereClause}`,
      params
    );

    const stats = statsResult.rows[0] || {
      total_errors: 0,
      unique_endpoints: 0,
      unique_providers: 0,
      first_error: null,
      last_error: null,
    };

    // endpoint별 통계
    const endpointStatsResult = await query(
      `SELECT 
        endpoint_url,
        endpoint_name,
        provider,
        COUNT(*) as error_count,
        MAX(checked_at) as last_error_time
       FROM model_server_error_history
       ${whereClause}
       GROUP BY endpoint_url, endpoint_name, provider
       ORDER BY error_count DESC`,
      params
    );

    return NextResponse.json({
      success: true,
      errors: result.rows.map((row) => ({
        id: row.id,
        endpointUrl: row.endpoint_url,
        endpointName: row.endpoint_name,
        provider: row.provider,
        errorMessage: row.error_message,
        errorType: row.error_type,
        responseTime: row.response_time,
        status: row.status,
        checkedAt: row.checked_at,
        metadata: row.metadata,
      })),
      stats: {
        totalErrors: parseInt(stats.total_errors) || 0,
        uniqueEndpoints: parseInt(stats.unique_endpoints) || 0,
        uniqueProviders: parseInt(stats.unique_providers) || 0,
        firstError: stats.first_error,
        lastError: stats.last_error,
      },
      endpointStats: endpointStatsResult.rows.map((row) => ({
        endpointUrl: row.endpoint_url,
        endpointName: row.endpoint_name,
        provider: row.provider,
        errorCount: parseInt(row.error_count) || 0,
        lastErrorTime: row.last_error_time,
      })),
    });
  } catch (error) {
    console.error('모델 Server error 이력 조회 실패:', error);
    return createServerError(error, '오류 이력을 불러오는데 실패했습니다.');
  }
}

// 모델 Server error 이력 삭제
export async function DELETE(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdminWithResult(request);
    if (!adminCheck.valid) {
      return createAuthError(adminCheck.error);
    }

    const { searchParams } = new URL(request.url);
    const endpointUrl = searchParams.get('endpoint');

    if (!endpointUrl) {
      return createValidationError('endpoint 파라미터가 필요합니다.');
    }

    // 특정 endpoint의 오류 이력 전체 삭제
    const result = await query(
      `DELETE FROM model_server_error_history 
       WHERE endpoint_url = $1`,
      [endpointUrl]
    );

    return NextResponse.json({
      success: true,
      message: '오류 이력이 성공적으로 Deleted.',
      deletedCount: result.rowCount || 0,
    });
  } catch (error) {
    console.error('모델 Server error 이력 삭제 실패:', error);
    return createServerError(error, '오류 이력 삭제에 실패했습니다.');
  }
}
