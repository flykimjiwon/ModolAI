import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import { createAuthError, createServerError } from '@/lib/errorHandler';

export async function GET(request) {
  try {
    // 관리자 권한 확인
    const authCheck = verifyAdminWithResult(request);
    if (!authCheck.valid) {
      return createAuthError(authCheck.error);
    }

    const { searchParams } = new URL(request.url);

    // 페이지네이션 파라미터
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(searchParams.get('limit')) || 50, 100); // 최대 100개
    const skip = (page - 1) * limit;

    // 필터링 파라미터
    const apiType = searchParams.get('apiType');
    const model = searchParams.get('model');
    const clientTool = searchParams.get('clientTool');
    const clientIP = searchParams.get('clientIP'); // IP 필터 추가
    const timeRange = searchParams.get('timeRange') || '24h'; // '1h' | '6h' | '24h' | '7d' | '30d' | 'custom'
    const source = searchParams.get('source'); // 'external' | 'internal'
    const statusCode = searchParams.get('statusCode');
    const isStream = searchParams.get('isStream');
    const endpoint = searchParams.get('endpoint');
    const provider = searchParams.get('provider');
    // 세션 필터 파라미터
    const sessionHash = searchParams.get('sessionHash');
    const userId = searchParams.get('userId');
    const tokenHash = searchParams.get('tokenHash');
    const sessionFilter = searchParams.get('sessionFilter'); // 'exact' | 'user' | 'session'
    const conversationId = searchParams.get('conversationId'); // 대화 세션 ID
    const groupByConversation = searchParams.get('groupByConversation') === 'true'; // 대화 세션별 그룹화
    // custom 날짜 파라미터
    const customStartDateParam = searchParams.get('startDate');
    const customEndDateParam = searchParams.get('endDate');

    // 시간 범위 계산
    const now = new Date();
    let startDate;
    let endDate = now;

    // custom 날짜 파싱 함수
    const parseCustomDate = (dateStr, isEnd) => {
      if (!dateStr) return null;
      const suffix = isEnd ? 'T23:59:59.999' : 'T00:00:00';
      const parsed = new Date(`${dateStr}${suffix}`);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    if (timeRange === 'custom') {
      // 기간 지정 모드
      startDate = parseCustomDate(customStartDateParam, false);
      endDate = parseCustomDate(customEndDateParam, true) || now;

      // startDate가 없으면 기본값 24시간
      if (!startDate) {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    } else {
      // 기존 시간 범위 옵션
      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          startDate = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }
    }

    // 필터 조건 구성
    const whereConditions = ['timestamp >= $1'];
    const queryParams = [startDate];
    let paramIndex = 2;

    if (source === 'external') {
      whereConditions.push(
        "(source = 'external' OR (source NOT IN ('internal','external') AND token_hash IS NOT NULL))"
      );
    } else if (source === 'internal') {
      whereConditions.push(
        "(source = 'internal' OR (source NOT IN ('internal','external') AND token_hash IS NULL))"
      );
    }

    if (apiType) {
      whereConditions.push(`api_type = $${paramIndex}`);
      queryParams.push(apiType);
      paramIndex++;
    } else {
      whereConditions.push(`(api_type IS NULL OR api_type <> 'pii-detect')`);
    }
    if (model) {
      whereConditions.push(`model ILIKE $${paramIndex}`);
      queryParams.push(`%${model}%`);
      paramIndex++;
    }
    if (clientTool) {
      whereConditions.push(`client_tool = $${paramIndex}`);
      queryParams.push(clientTool);
      paramIndex++;
    }
    if (clientIP) {
      whereConditions.push(`client_ip ILIKE $${paramIndex}`);
      queryParams.push(`%${clientIP}%`);
      paramIndex++;
    }
    if (statusCode) {
      whereConditions.push(`status_code = $${paramIndex}`);
      queryParams.push(parseInt(statusCode));
      paramIndex++;
    }
    if (isStream === 'true' || isStream === 'false') {
      whereConditions.push(`is_stream = $${paramIndex}`);
      queryParams.push(isStream === 'true');
      paramIndex++;
    }
    if (endpoint) {
      whereConditions.push(`endpoint ILIKE $${paramIndex}`);
      queryParams.push(`%${endpoint}%`);
      paramIndex++;
    }
    if (provider) {
      whereConditions.push(`provider = $${paramIndex}`);
      queryParams.push(provider);
      paramIndex++;
    }

    // 세션 필터 처리
    if (sessionFilter === 'exact' && sessionHash && userId && tokenHash) {
      // 정확한 세션 매칭: sessionHash + userId + tokenHash 모두 일치
      whereConditions.push(`session_hash = $${paramIndex}`);
      queryParams.push(sessionHash);
      paramIndex++;
      whereConditions.push(`user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
      whereConditions.push(`token_hash = $${paramIndex}`);
      queryParams.push(tokenHash);
      paramIndex++;
    } else if (sessionFilter === 'user' && userId && tokenHash) {
      // 사용자 + 토큰 매칭: 같은 사용자가 같은 토큰으로 보낸 요청
      whereConditions.push(`user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
      whereConditions.push(`token_hash = $${paramIndex}`);
      queryParams.push(tokenHash);
      paramIndex++;
    } else if (sessionFilter === 'session' && sessionHash && userId) {
      // 세션 + 사용자 매칭: 같은 사용자가 같은 세션에서 보낸 요청
      whereConditions.push(`session_hash = $${paramIndex}`);
      queryParams.push(sessionHash);
      paramIndex++;
      whereConditions.push(`user_id = $${paramIndex}`);
      queryParams.push(userId);
      paramIndex++;
    } else {
      // 개별 필터 (하위 호환성)
      if (sessionHash) {
        whereConditions.push(`session_hash = $${paramIndex}`);
        queryParams.push(sessionHash);
        paramIndex++;
      }
      if (userId) {
        whereConditions.push(`user_id = $${paramIndex}`);
        queryParams.push(userId);
        paramIndex++;
      }
      if (tokenHash) {
        whereConditions.push(`token_hash = $${paramIndex}`);
        queryParams.push(tokenHash);
        paramIndex++;
      }
    }

    // conversationId 필터 추가
    if (conversationId) {
      whereConditions.push(`conversation_id = $${paramIndex}`);
      queryParams.push(conversationId);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // 전체 개수 조회
    const countResult = await query(
      `SELECT COUNT(*) as count FROM external_api_logs WHERE ${whereClause}`,
      queryParams
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // external_api_prompts 테이블 존재 여부 확인
    let promptsTableExists = false;
    try {
      const tableCheckResult = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'external_api_prompts'
        ) as exists`
      );
      promptsTableExists = tableCheckResult.rows[0]?.exists || false;
    } catch (checkError) {
      // 테이블 확인 실패 시 false로 설정 (JOIN 없이 진행)
      console.warn('[External API Logs] 테이블 존재 여부 확인 실패:', checkError.message);
      promptsTableExists = false;
    }

    // 로그 데이터 조회 (프롬프트 데이터 JOIN - 테이블이 있을 경우만)
    // 정규화: users 테이블과 JOIN하여 사용자 정보 조회
    const logsQuery = promptsTableExists
      ? `SELECT 
          l.*,
          COALESCE(models.model_name, l.model) as model_name,
          p.prompt as full_prompt,
          p.messages as full_messages,
          COALESCE(u.email, '') as user_email,
          COALESCE(u.name, '') as user_name,
          COALESCE(u.role, 'user') as user_role,
          COALESCE(u.department, '') as user_department,
          COALESCE(u.cell, '') as user_cell
        FROM external_api_logs l
        LEFT JOIN models ON l.model = models.id::text OR l.model = models.model_name
        LEFT JOIN external_api_prompts p ON l.prompt_id = p.id
        LEFT JOIN users u ON l.user_id = u.id
        WHERE ${whereClause}
        ORDER BY l.timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
      : `SELECT 
          l.*,
          COALESCE(models.model_name, l.model) as model_name,
          NULL as full_prompt,
          NULL as full_messages,
          COALESCE(u.email, '') as user_email,
          COALESCE(u.name, '') as user_name,
          COALESCE(u.role, 'user') as user_role,
          COALESCE(u.department, '') as user_department,
          COALESCE(u.cell, '') as user_cell
        FROM external_api_logs l
        LEFT JOIN models ON l.model = models.id::text OR l.model = models.model_name
        LEFT JOIN users u ON l.user_id = u.id
        WHERE ${whereClause}
        ORDER BY l.timestamp DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const logsResult = await query(logsQuery, [...queryParams, limit, skip]);

    // 로그 데이터 변환
    const logs = logsResult.rows.map((row) => {
      const derivedSource =
        row.source === 'internal' || row.source === 'external'
          ? row.source
          : row.token_hash
          ? 'external'
          : 'internal';
      const log = {
        _id: row.id,
        apiType: row.api_type,
        endpoint: row.endpoint,
        model: row.model,
        modelLabel: row.model_name || row.model,
        provider: row.provider,
        prompt: row.full_prompt || row.prompt, // 전체 프롬프트 우선 사용
        messages: row.full_messages 
          ? (typeof row.full_messages === 'string' ? JSON.parse(row.full_messages) : row.full_messages)
          : (row.messages ? (typeof row.messages === 'string' ? JSON.parse(row.messages) : row.messages) : null), // 전체 메시지 우선 사용
        responseTokenCount: row.response_token_count,
        promptTokenCount: row.prompt_token_count,
        totalTokenCount: row.total_token_count,
        responseTime: row.response_time,
        firstResponseTime: row.first_response_time ?? row.response_time,
        finalResponseTime: row.final_response_time ?? row.response_time,
        statusCode: row.status_code,
        isStream: row.is_stream,
        error: row.error,
        retryCount: row.retry_count,
        clientIP: row.client_ip,
        userAgent: row.user_agent,
        xForwardedFor: row.x_forwarded_for,
        xRealIP: row.x_real_ip,
        xForwardedProto: row.x_forwarded_proto,
        xForwardedHost: row.x_forwarded_host,
        clientTool: row.client_tool,
        clientToolVersion: row.client_tool_version,
        operatingSystem: row.operating_system,
        architecture: row.architecture,
        acceptLanguage: row.accept_language,
        acceptEncoding: row.accept_encoding,
        acceptCharset: row.accept_charset,
        referer: row.referer,
        origin: row.origin,
        authorization: row.authorization,
        contentType: row.content_type,
        xRequestedWith: row.x_requested_with,
        xClientName: row.x_client_name,
        xClientVersion: row.x_client_version,
        xUserName: row.x_user_name,
        xWorkspace: row.x_workspace,
        userId: row.user_id,
        userEmail: row.user_email,
        userName: row.user_name,
        userRole: row.user_role,
        userDepartment: row.user_department,
        userCell: row.user_cell,
        tokenHash: row.token_hash,
        tokenName: row.token_name,
        requestTime: row.request_time,
        timezone: row.timezone,
        sessionHash: row.session_hash,
        fingerprintHash: row.fingerprint_hash,
        userIdentifier: row.user_identifier,
        conversationId: row.conversation_id,
        timestamp: row.timestamp,
        source: derivedSource,
        rawSource: row.source,
        // HTTP 전체 정보
        requestHeaders: row.request_headers ? (typeof row.request_headers === 'string' ? JSON.parse(row.request_headers) : row.request_headers) : null,
        requestBody: row.request_body ? (typeof row.request_body === 'string' ? JSON.parse(row.request_body) : row.request_body) : null,
        responseHeaders: row.response_headers ? (typeof row.response_headers === 'string' ? JSON.parse(row.response_headers) : row.response_headers) : null,
        responseBody: row.response_body ? (typeof row.response_body === 'string' ? JSON.parse(row.response_body) : row.response_body) : null,
      };
      return log;
    });

    // 통계 데이터 계산
    const statsQueries = {
      byApiType: `SELECT api_type as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens,
                    AVG(COALESCE(first_response_time, response_time)) as avg_first_response_time,
                    AVG(COALESCE(final_response_time, response_time)) as avg_final_response_time
                   FROM external_api_logs WHERE ${whereClause} GROUP BY api_type ORDER BY count DESC`,
      byClientTool: `SELECT client_tool as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens,
                       AVG(COALESCE(first_response_time, response_time)) as avg_first_response_time,
                       AVG(COALESCE(final_response_time, response_time)) as avg_final_response_time
                     FROM external_api_logs WHERE ${whereClause} GROUP BY client_tool ORDER BY count DESC`,
      byProvider: `SELECT provider as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens,
                     AVG(COALESCE(first_response_time, response_time)) as avg_first_response_time,
                     AVG(COALESCE(final_response_time, response_time)) as avg_final_response_time
                   FROM external_api_logs WHERE ${whereClause} AND provider IS NOT NULL GROUP BY provider ORDER BY count DESC`,
      byEndpoint: `SELECT endpoint as _id, COUNT(*) as count, SUM(total_token_count) as total_tokens,
                     AVG(COALESCE(first_response_time, response_time)) as avg_first_response_time,
                     AVG(COALESCE(final_response_time, response_time)) as avg_final_response_time
                   FROM external_api_logs WHERE ${whereClause} GROUP BY endpoint ORDER BY count DESC`,
      byModel: `SELECT COALESCE(models.model_name, l.model) as _id, COUNT(*) as count, SUM(l.total_token_count) as total_tokens,
                  AVG(COALESCE(l.first_response_time, l.response_time)) as avg_first_response_time,
                  AVG(COALESCE(l.final_response_time, l.response_time)) as avg_final_response_time
                FROM external_api_logs l
                LEFT JOIN models ON l.model = models.id::text OR l.model = models.model_name
                WHERE ${whereClause} GROUP BY COALESCE(models.model_name, l.model) ORDER BY count DESC LIMIT 10`,
      byStatusCode: `SELECT status_code as _id, COUNT(*) as count
                     FROM external_api_logs WHERE ${whereClause} GROUP BY status_code ORDER BY status_code`,
      overall: `SELECT 
                  COUNT(*) as total_requests,
                  SUM(total_token_count) as total_tokens,
                  AVG(COALESCE(first_response_time, response_time)) as avg_first_response_time,
                  AVG(COALESCE(final_response_time, response_time)) as avg_final_response_time,
                  SUM(CASE WHEN is_stream THEN 1 ELSE 0 END) as streaming_requests,
                  SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) as success_requests
                FROM external_api_logs WHERE ${whereClause}`,
    };

    const [byApiType, byClientTool, byProvider, byEndpoint, byModel, byStatusCode, overall] = await Promise.all([
      query(statsQueries.byApiType, queryParams),
      query(statsQueries.byClientTool, queryParams),
      query(statsQueries.byProvider, queryParams),
      query(statsQueries.byEndpoint, queryParams),
      query(statsQueries.byModel, queryParams),
      query(statsQueries.byStatusCode, queryParams),
      query(statsQueries.overall, queryParams),
    ]);

    // 대화 세션별 그룹화 처리
    let processedLogs = logs.map((log) => ({
      ...log,
      _id: log._id.toString(),
    }));

    if (groupByConversation) {
      // conversationId별로 그룹화
      const groupedByConversation = {};
      processedLogs.forEach((log) => {
        const convId = log.conversationId || 'no-conversation';
        if (!groupedByConversation[convId]) {
          groupedByConversation[convId] = {
            conversationId: convId,
            logs: [],
            firstMessage: null,
            totalRequests: 0,
            totalTokens: 0,
            startTime: null,
            endTime: null,
          };
        }
        groupedByConversation[convId].logs.push(log);
        groupedByConversation[convId].totalRequests++;
        groupedByConversation[convId].totalTokens += log.totalTokenCount || 0;
        
        // 첫 번째 메시지 추출
        if (!groupedByConversation[convId].firstMessage && log.messages) {
          const firstUserMsg = Array.isArray(log.messages) 
            ? log.messages.find(msg => msg.role === 'user')
            : null;
          if (firstUserMsg) {
            groupedByConversation[convId].firstMessage = 
              typeof firstUserMsg.content === 'string' 
                ? firstUserMsg.content.substring(0, 100)
                : JSON.stringify(firstUserMsg.content).substring(0, 100);
          }
        }
        
        // 시간 범위 업데이트
        const logTime = new Date(log.timestamp);
        if (!groupedByConversation[convId].startTime || logTime < new Date(groupedByConversation[convId].startTime)) {
          groupedByConversation[convId].startTime = log.timestamp;
        }
        if (!groupedByConversation[convId].endTime || logTime > new Date(groupedByConversation[convId].endTime)) {
          groupedByConversation[convId].endTime = log.timestamp;
        }
      });

      // 그룹화된 데이터를 배열로 변환 (최신 대화 세션부터)
      processedLogs = Object.values(groupedByConversation)
        .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
        .map((group) => ({
          ...group,
          logs: group.logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
        }));
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: processedLogs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
        stats: {
          byApiType: byApiType.rows.map((r) => ({
            _id: r._id,
            count: parseInt(r.count),
            totalTokens: parseInt(r.total_tokens || 0),
            avgFirstResponseTime: parseFloat(r.avg_first_response_time || 0),
            avgFinalResponseTime: parseFloat(r.avg_final_response_time || 0),
          })),
          byClientTool: byClientTool.rows.map((r) => ({
            _id: r._id,
            count: parseInt(r.count),
            totalTokens: parseInt(r.total_tokens || 0),
            avgFirstResponseTime: parseFloat(r.avg_first_response_time || 0),
            avgFinalResponseTime: parseFloat(r.avg_final_response_time || 0),
          })),
          byProvider: byProvider.rows.map((r) => ({
            _id: r._id,
            count: parseInt(r.count),
            totalTokens: parseInt(r.total_tokens || 0),
            avgFirstResponseTime: parseFloat(r.avg_first_response_time || 0),
            avgFinalResponseTime: parseFloat(r.avg_final_response_time || 0),
          })),
          byEndpoint: byEndpoint.rows.map((r) => ({
            _id: r._id,
            count: parseInt(r.count),
            totalTokens: parseInt(r.total_tokens || 0),
            avgFirstResponseTime: parseFloat(r.avg_first_response_time || 0),
            avgFinalResponseTime: parseFloat(r.avg_final_response_time || 0),
          })),
          byModel: byModel.rows.map((r) => ({
            _id: r._id,
            count: parseInt(r.count),
            totalTokens: parseInt(r.total_tokens || 0),
            avgFirstResponseTime: parseFloat(r.avg_first_response_time || 0),
            avgFinalResponseTime: parseFloat(r.avg_final_response_time || 0),
          })),
          byStatusCode: byStatusCode.rows.map((r) => ({
            _id: r._id?.toString(),
            count: parseInt(r.count),
          })),
          overall: overall.rows[0]
            ? {
              totalRequests: parseInt(overall.rows[0].total_requests || 0),
              totalTokens: parseInt(overall.rows[0].total_tokens || 0),
              avgFirstResponseTime: parseFloat(overall.rows[0].avg_first_response_time || 0),
              avgFinalResponseTime: parseFloat(overall.rows[0].avg_final_response_time || 0),
              streamingRequests: parseInt(overall.rows[0].streaming_requests || 0),
              successRequests: parseInt(overall.rows[0].success_requests || 0),
            }
          : {
              totalRequests: 0,
              totalTokens: 0,
              avgFirstResponseTime: 0,
              avgFinalResponseTime: 0,
              streamingRequests: 0,
              successRequests: 0,
            },
        },
        filters: {
          apiType,
          model,
          clientTool,
          clientIP,
          timeRange,
          statusCode,
          isStream,
          startDate,
          endDate: now,
        },
      },
    });
  } catch (error) {
    console.error('[External API Logs] 조회 실패:', error);
    console.error('[External API Logs] 에러 스택:', error.stack);
    console.error('[External API Logs] 에러 상세:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    return createServerError(error, `로그 조회에 실패했습니다: ${error.message}`);
  }
}
