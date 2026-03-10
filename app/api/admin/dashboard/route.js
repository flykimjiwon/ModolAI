import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdminWithResult } from '@/lib/auth';
import { createAuthError, createServerError } from '@/lib/errorHandler';

// 모델 ID를 표시 이름으로 변환하는 헬퍼 함수
async function getModelLabelMap() {
  const modelLabelMap = new Map();
  const allModels = [];

  try {
    const { query: queryPostgres } = await import('@/lib/postgres');
    const addModelToMap = (model) => {
      const modelData = {
        id: model.id,
        modelName: model.model_name || model.modelName,
        label: model.label,
      };
      allModels.push(modelData);

      if (modelData.id && !modelLabelMap.has(modelData.id)) {
        modelLabelMap.set(modelData.id, modelData.label);
      }

      if (modelData.modelName) {
        if (!modelLabelMap.has(modelData.modelName)) {
          modelLabelMap.set(modelData.modelName, modelData.label);
        }

        if (modelData.modelName.includes('/')) {
          const shortId = modelData.modelName.split('/').pop();
          if (shortId && !modelLabelMap.has(shortId)) {
            modelLabelMap.set(shortId, modelData.label);
          }
        }

        if (modelData.modelName.includes(':')) {
          const baseId = modelData.modelName.split(':')[0];
          if (baseId && !modelLabelMap.has(baseId)) {
            modelLabelMap.set(baseId, modelData.label);
          }
        }
      }
    };

    // 새 테이블 구조에서 모델 조회 (models 테이블 직접 조회)
    const modelsResult = await queryPostgres(
      'SELECT id, model_name, label FROM models ORDER BY display_order ASC'
    );

    if (modelsResult.rows.length > 0) {
      modelsResult.rows.forEach((model) => addModelToMap(model));

      console.log('[Dashboard] models 테이블에서 로드한 모델:', modelsResult.rows.length, '개');
    }

    const modelConfigResult = await queryPostgres(
      'SELECT config FROM model_config WHERE config_type = $1',
      ['models']
    );

    if (modelConfigResult.rows.length > 0) {
      const modelConfig = modelConfigResult.rows[0].config;

      if (modelConfig && modelConfig.categories) {
        Object.values(modelConfig.categories).forEach((category) => {
          if (category.models && Array.isArray(category.models)) {
            category.models.forEach((model) => {
              if (model.id && model.label) {
                addModelToMap({
                  id: model.id,
                  model_name: model.modelName,
                  label: model.label,
                });

                if (model.modelName && model.modelName.includes(':')) {
                  const baseModelName = model.modelName.split(':')[0];
                  if (baseModelName && !modelLabelMap.has(baseModelName)) {
                    modelLabelMap.set(baseModelName, model.label);
                  }
                }
              }
            });
          }
        });
      }
    }
  } catch (error) {
    console.warn('[Dashboard] 모델 설정 조회 실패:', error.message);
  }

  return { modelLabelMap, allModels };
}

// 모델 ID로 표시 이름 찾기 (강화된 매칭 로직)
function findModelLabel(modelId, modelLabelMap, allModels) {
  if (!modelId) return null;
  
  // 문자열로 변환하고 공백 제거
  const normalizedModelId = String(modelId).trim();
  if (!normalizedModelId) return null;
  
  // 1. 정확한 매칭
  let label = modelLabelMap.get(normalizedModelId);
  if (label) return label;
  
  // 2. 부분 매칭 시도 (모델 ID가 설정의 ID에 포함된 경우)
  const modelIdLower = normalizedModelId.toLowerCase();
  let foundModel = allModels.find((m) => {
    if (!m.id) return false;
    const mIdLower = String(m.id).toLowerCase();
    return mIdLower.includes(modelIdLower);
  });
  if (foundModel) return foundModel.label;
  
  // 3. 역방향 매칭 (설정의 ID가 모델 ID에 포함된 경우)
  foundModel = allModels.find((m) => {
    if (!m.id) return false;
    const mIdLower = String(m.id).toLowerCase();
    return modelIdLower.includes(mIdLower);
  });
  if (foundModel) return foundModel.label;
  
  // 4. 콜론(:)으로 구분된 기본 이름으로 매칭
  if (normalizedModelId.includes(':')) {
    const baseId = normalizedModelId.split(':')[0];
    foundModel = allModels.find((m) => {
      if (!m.id) return false;
      const mIdLower = String(m.id).toLowerCase();
      return mIdLower.startsWith(baseId.toLowerCase() + ':');
    });
    if (foundModel) return foundModel.label;
  }
  
  // 5. 슬래시(/)로 구분된 부분 매칭
  if (normalizedModelId.includes('/')) {
    const shortId = normalizedModelId.split('/').pop();
    if (shortId) {
      label = modelLabelMap.get(shortId);
      if (label) return label;
    }
  }
  
  return null;
}

export async function GET(request) {
  // 관리자 권한 확인
  const authResult = verifyAdminWithResult(request);
  if (!authResult.valid) {
    return createAuthError(authResult.error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 날짜 파싱 함수
    const parseDate = (dateStr, isEnd) => {
      if (!dateStr) return null;
      const suffix = isEnd ? 'T23:59:59.999' : 'T00:00:00';
      const parsed = new Date(`${dateStr}${suffix}`);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    // 기간 설정 (기본값: 최근 7일)
    const today = new Date();
    const endDate = parseDate(endDateParam, true) || today;
    const startDate = parseDate(startDateParam, false) || new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 이전 기간 계산 (증감 비교용)
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - periodLength);

    const startOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // 병렬로 데이터 조회
    const [
      totalUsersResult,
      prevUsersResult,
      totalMessagesResult,
      prevMessagesResult,
      todayMessagesResult,
      activeUsersResult,
      prevActiveUsersResult,
      topModelsResult,
      tokenUsageResult,
      recentActivityResult,
      modelConfigData,
    ] = await Promise.all([
      // 현재 기간 사용자 수 (기간 내 가입)
      query('SELECT COUNT(*) as count FROM users WHERE created_at >= $1 AND created_at <= $2', [startDate, endDate]),

      // 이전 기간 사용자 수
      query('SELECT COUNT(*) as count FROM users WHERE created_at >= $1 AND created_at <= $2', [prevStartDate, prevEndDate]),

      // 현재 기간 메시지 수
      query(
        `SELECT COUNT(*) as count
         FROM external_api_logs
         WHERE (api_type IS NULL OR api_type <> 'pii-detect')
           AND timestamp >= $1
           AND timestamp <= $2`,
        [startDate, endDate]
      ),

      // 이전 기간 메시지 수
      query(
        `SELECT COUNT(*) as count
         FROM external_api_logs
         WHERE (api_type IS NULL OR api_type <> 'pii-detect')
           AND timestamp >= $1
           AND timestamp <= $2`,
        [prevStartDate, prevEndDate]
      ),

      // 오늘 메시지 수
      query(
        `SELECT COUNT(*) as count
         FROM external_api_logs
         WHERE (api_type IS NULL OR api_type <> 'pii-detect')
           AND timestamp >= $1`,
        [startOfToday]
      ),

      // 현재 기간 활성 사용자
      query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM external_api_logs
         WHERE timestamp >= $1
           AND timestamp <= $2
           AND user_id IS NOT NULL
           AND (api_type IS NULL OR api_type <> 'pii-detect')`,
        [startDate, endDate]
      ),

      // 이전 기간 활성 사용자
      query(
        `SELECT COUNT(DISTINCT user_id) as count
         FROM external_api_logs
         WHERE timestamp >= $1
           AND timestamp <= $2
           AND user_id IS NOT NULL
           AND (api_type IS NULL OR api_type <> 'pii-detect')`,
        [prevStartDate, prevEndDate]
      ),

      // 인기 모델 TOP 10 - models 테이블과 JOIN하여 model_name 가져오기, model_server와 JOIN하여 서버명 가져오기
      query(
        `SELECT 
           COALESCE(models.model_name, t.model) as _id, 
           SUM(t.count) as count,
           COALESCE(models.model_name, t.model) as model_name,
           MAX(model_server.name) as server_name
         FROM (
           SELECT model, COUNT(*) as count
           FROM external_api_logs
           WHERE (api_type IS NULL OR api_type <> 'pii-detect')
             AND model IS NOT NULL
           GROUP BY model
           ) t
         LEFT JOIN models ON t.model = models.id::text OR t.model = models.model_name
         LEFT JOIN model_server ON models.endpoint = model_server.endpoint
         GROUP BY COALESCE(models.model_name, t.model)
         ORDER BY count DESC 
         LIMIT 10`
      ),

      // 총 토큰 사용량 (웹채팅 + 외부API)
      query(
        `SELECT
          COALESCE(SUM(combined.prompt_tokens), 0)::BIGINT as prompt_tokens,
          COALESCE(SUM(combined.response_tokens), 0)::BIGINT as response_tokens,
          COALESCE(SUM(combined.total_tokens), 0)::BIGINT as total_tokens
        FROM (
          SELECT prompt_token_count as prompt_tokens, response_token_count as response_tokens, total_token_count as total_tokens
          FROM external_api_logs
          WHERE timestamp >= $1 AND timestamp <= $2 AND (api_type IS NULL OR api_type <> 'pii-detect')
          UNION ALL
          SELECT prompt_tokens, completion_tokens as response_tokens, total_tokens
          FROM model_logs
          WHERE timestamp >= $1 AND timestamp <= $2
        ) combined`,
        [startDate, endDate]
      ),

      // 최근 활동 (최근 20개) - 정규화: users 테이블과 JOIN, models 테이블과 JOIN하여 model_name 가져오기
      query(
        `SELECT 
           activity.email,
           activity.model,
           activity.created_at,
           activity.department,
           activity.cell,
           activity.model_name
         FROM (
           SELECT 
             u.email as email,
             l.model as model,
             l.timestamp as created_at,
             u.department as department,
             u.cell as cell,
             COALESCE(models.model_name, l.model) as model_name
            FROM external_api_logs l
            INNER JOIN users u ON l.user_id = u.id
            LEFT JOIN models ON l.model = models.id::text OR l.model = models.model_name
            WHERE (l.api_type IS NULL OR l.api_type <> 'pii-detect')
          ) activity
         ORDER BY activity.created_at DESC
         LIMIT 20`
      ),

      // 모델 설정 조회
      getModelLabelMap(),
    ]);

    const totalUsers = parseInt(totalUsersResult.rows[0]?.count || 0);
    const prevUsers = parseInt(prevUsersResult.rows[0]?.count || 0);
    const totalMessages = parseInt(totalMessagesResult.rows[0]?.count || 0);
    const prevMessages = parseInt(prevMessagesResult.rows[0]?.count || 0);
    const todayMessages = parseInt(todayMessagesResult.rows[0]?.count || 0);
    const activeUsers = parseInt(activeUsersResult.rows[0]?.count || 0);
    const prevActiveUsers = parseInt(prevActiveUsersResult.rows[0]?.count || 0);

    // 토큰 사용량
    const tokenUsage = {
      promptTokens: parseInt(tokenUsageResult.rows[0]?.prompt_tokens || 0),
      responseTokens: parseInt(tokenUsageResult.rows[0]?.response_tokens || 0),
      totalTokens: parseInt(tokenUsageResult.rows[0]?.total_tokens || 0),
    };

    // 증감률 계산 함수
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const usersChange = calculateChange(totalUsers, prevUsers);
    const messagesChange = calculateChange(totalMessages, prevMessages);
    const activeUsersChange = calculateChange(activeUsers, prevActiveUsers);
    const topModels = topModelsResult.rows
      .filter((row) => row._id) // null이 아닌 모델만 필터링
      .map((row) => ({
        _id: String(row._id).trim(), // 문자열로 변환하고 공백 제거
        count: parseInt(row.count),
        model_name: row.model_name ? String(row.model_name).trim() : null, // model_name 추가
        server_name: row.server_name ? String(row.server_name).trim() : null, // server_name 추가
      }));
    const recentActivity = recentActivityResult.rows.map((row) => ({
      email: row.email,
      model: row.model ? String(row.model).trim() : null, // 문자열로 변환하고 공백 제거
      model_name: row.model_name ? String(row.model_name).trim() : null, // model_name 추가
      createdAt: row.created_at,
      department: row.department,
      cell: row.cell,
    }));

    const { modelLabelMap, allModels } = modelConfigData;

    // 디버깅: 모델 설정 정보 로그
    console.log('[Dashboard] 모델 설정 개수:', allModels.length);
    console.log('[Dashboard] 모델 라벨 맵 크기:', modelLabelMap.size);
    if (allModels.length > 0) {
      console.log('[Dashboard] 샘플 모델 설정:', allModels.slice(0, 3).map(m => ({ id: m.id, label: m.label })));
    }

    // 모델 ID를 표시 이름으로 변환 (model_name 우선 사용)
    const topModelsWithLabels = topModels.map((model) => {
      const modelId = model._id || model.model || null;
      let label = null;
      
      // model_name이 있으면 우선 사용
      if (model.model_name) {
        label = model.model_name;
      } else if (modelId) {
        // 디버깅: 실제 모델 ID 로그
        console.log('[Dashboard] 매칭 시도 - 모델 ID:', modelId);
        
        label = findModelLabel(modelId, modelLabelMap, allModels);
        
        // 디버깅: 매칭 결과 로그
        if (!label) {
          console.log('[Dashboard] 매칭 실패 - 모델 ID:', modelId, '사용 가능한 모델 ID들:', Array.from(modelLabelMap.keys()).slice(0, 5));
        } else {
          console.log('[Dashboard] 매칭 성공 - 모델 ID:', modelId, '-> 라벨:', label);
        }
        
        // 여전히 없으면 모델 ID 자체를 사용
        if (!label) {
          label = modelId;
        }
      } else {
        label = '알 수 없음';
      }
      
      return {
        ...model,
        label: label,
      };
    });

    const recentActivityWithLabels = recentActivity.map((activity) => {
      const modelId = activity.model || null;
      let modelLabel = '알 수 없음';
      
      // model_name이 있으면 우선 사용
      if (activity.model_name) {
        modelLabel = activity.model_name;
      } else if (modelId) {
        modelLabel = findModelLabel(modelId, modelLabelMap, allModels) || modelId;
      }
      
      return {
        ...activity,
        modelLabel: modelLabel,
      };
    });

    return NextResponse.json({
      totalUsers,
      totalMessages,
      todayMessages,
      activeUsers,
      tokenUsage,
      usersChange: Number(usersChange.toFixed(1)),
      messagesChange: Number(messagesChange.toFixed(1)),
      activeUsersChange: Number(activeUsersChange.toFixed(1)),
      topModels: topModelsWithLabels,
      recentActivity: recentActivityWithLabels,
      periodStart: startDate.toISOString(),
      periodEnd: endDate.toISOString(),
      prevPeriodStart: prevStartDate.toISOString(),
      prevPeriodEnd: prevEndDate.toISOString(),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('대시보드 데이터 조회 실패:', error);
    return createServerError(error, '데이터 조회에 실패했습니다.');
  }
}
