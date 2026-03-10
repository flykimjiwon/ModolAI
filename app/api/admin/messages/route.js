import { NextResponse } from 'next/server';
import { verifyAdminWithResult } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { createAuthError, createServerError } from '@/lib/errorHandler';

// 모델 ID를 표시 이름으로 변환하는 헬퍼 함수
async function getModelLabelMap() {
  const modelLabelMap = new Map();
  const allModels = [];

  try {
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
    const modelsResult = await query(
      'SELECT id, model_name, label FROM models ORDER BY display_order ASC'
    );

    if (modelsResult.rows.length > 0) {
      modelsResult.rows.forEach((model) => addModelToMap(model));

      console.log('[Messages] models 테이블에서 로드한 모델:', modelsResult.rows.length, '개');
    }

    // 레거시 model_config도 병합 (manual 모델 포함)
    const modelConfigResult = await query(
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
    console.warn('[Messages] 모델 설정 조회 실패:', error.message);
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
  
  // 2. modelName으로 정확한 매칭
  let foundModel = allModels.find((m) => m.modelName === normalizedModelId);
  if (foundModel) return foundModel.label;
  
  // 3. 부분 매칭 시도 (모델 ID가 설정의 ID 또는 modelName에 포함된 경우)
  const modelIdLower = normalizedModelId.toLowerCase();
  foundModel = allModels.find((m) => {
    if (!m.id && !m.modelName) return false;
    const mIdLower = m.id ? String(m.id).toLowerCase() : '';
    const mNameLower = m.modelName ? String(m.modelName).toLowerCase() : '';
    return mIdLower.includes(modelIdLower) || mNameLower.includes(modelIdLower);
  });
  if (foundModel) return foundModel.label;
  
  // 4. 역방향 매칭 (설정의 ID 또는 modelName이 모델 ID에 포함된 경우)
  foundModel = allModels.find((m) => {
    if (!m.id && !m.modelName) return false;
    const mIdLower = m.id ? String(m.id).toLowerCase() : '';
    const mNameLower = m.modelName ? String(m.modelName).toLowerCase() : '';
    return modelIdLower.includes(mIdLower) || modelIdLower.includes(mNameLower);
  });
  if (foundModel) return foundModel.label;
  
  // 5. 콜론(:)으로 구분된 기본 이름으로 매칭
  if (normalizedModelId.includes(':')) {
    const baseId = normalizedModelId.split(':')[0];
    foundModel = allModels.find((m) => {
      if (!m.id && !m.modelName) return false;
      const mIdLower = m.id ? String(m.id).toLowerCase() : '';
      const mNameLower = m.modelName ? String(m.modelName).toLowerCase() : '';
      return mIdLower.startsWith(baseId.toLowerCase() + ':') || mNameLower.startsWith(baseId.toLowerCase() + ':');
    });
    if (foundModel) return foundModel.label;
  }
  
  // 6. 슬래시(/)로 구분된 부분 매칭
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

    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const search = searchParams.get('search') || '';
    const department = searchParams.get('department') || '';
    const authType = searchParams.get('authType') || '';
    const model = searchParams.get('model') || '';
    const role = searchParams.get('role') || '';
    const feedback = searchParams.get('feedback') || '';
    const roomId = searchParams.get('roomId') || '';
    const user = searchParams.get('user') || ''; // 사용자 이름 또는 이메일로 필터링
    const dateRange = searchParams.get('dateRange') || '7d';
    const startDateParam = searchParams.get('startDate') || '';
    const endDateParam = searchParams.get('endDate') || '';
    const isExport = searchParams.get('export') === 'true';
    const limit = isExport ? 0 : 50; // 내보내기 시 제한 없음, 아니면 페이지당 50개

    // 날짜 범위 계산
    let startDate = null;
    let endDate = null;
    const now = new Date();

    const parseLocalDate = (value, isEnd) => {
      if (!value) return null;
      const suffix = isEnd ? 'T23:59:59.999' : 'T00:00:00';
      const parsed = new Date(`${value}${suffix}`);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed;
    };

    startDate = parseLocalDate(startDateParam, false);
    endDate = parseLocalDate(endDateParam, true);

    if (!startDate && !endDate) {
      switch (dateRange) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '365d':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          startDate = null;
          break;
      }
    }

    // 검색 조건 구성
    // 정규화: department는 users 테이블에서 조회
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(`m.text ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (department) {
      whereConditions.push(`u.department = $${paramIndex}`);
      params.push(department);
      paramIndex++;
    }

    if (authType) {
      whereConditions.push(`u.auth_type = $${paramIndex}`);
      params.push(authType);
      paramIndex++;
    }

    if (model) {
      whereConditions.push(`m.model ILIKE $${paramIndex}`);
      params.push(`%${model}%`);
      paramIndex++;
    }

    if (role) {
      whereConditions.push(`m.role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (roomId) {
      whereConditions.push(`m.room_id = $${paramIndex}`);
      params.push(roomId);
      paramIndex++;
    }

    // 사용자(이름/이메일) 필터 처리
    if (user) {
      whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      params.push(`%${user}%`);
      paramIndex++;
    }

    // 피드백 필터 처리: 빈 문자열이 아닐 때만 필터 적용
    if (feedback && feedback.trim() !== '') {
      const normalizedFeedback = feedback.trim().toLowerCase();
      if (normalizedFeedback === 'none') {
        // 피드백이 없는 경우: feedback이 없거나 null 또는 빈 문자열인 경우
        whereConditions.push(`(m.feedback IS NULL OR m.feedback = '')`);
      } else {
        // 피드백이 있는 경우: 대소문자 구분 없이 매칭 (like 또는 dislike)
        whereConditions.push(`LOWER(m.feedback) = $${paramIndex}`);
        params.push(normalizedFeedback);
        paramIndex++;
      }
    }

    if (startDate) {
      whereConditions.push(`m.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`m.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // CSV 내보내기 처리
    if (isExport) {
      // 정규화: users 테이블과 JOIN하여 사용자 정보 조회
      const messagesResult = await query(
        `SELECT m.*, 
                COALESCE(u.email, '') as email,
                COALESCE(u.name, '') as name,
                COALESCE(u.department, '') as department,
                COALESCE(u.cell, '') as cell
         FROM messages m
         LEFT JOIN users u ON m.user_id = u.id
         ${whereClause} 
         ORDER BY m.created_at DESC`,
        params
      );
      const messages = messagesResult.rows;

      // CSV 헤더
      const csvHeaders = [
        '시간',
        '이름',
        '이메일',
        '부서',
        'Cell',
        '역할',
        '모델',
        '방ID',
        'IP',
        '피드백',
        '메시지 내용',
      ];

      // CSV 데이터
      const csvRows = messages.map((msg) => [
        msg.created_at.toISOString(),
        msg.name || '',
        msg.email || '',
        msg.department || '',
        msg.cell || '',
        msg.role === 'user' ? '사용자' : 'AI',
        msg.model || '',
        msg.room_id || '',
        msg.client_ip || '',
        msg.feedback === 'like' ? '좋아요' : msg.feedback === 'dislike' ? '싫어요' : '',
        `"${(msg.text || '').replace(/"/g, '""')}"`, // CSV 문자열 이스케이프
      ]);

      // CSV 문자열 생성
      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map((row) => row.join(',')),
      ].join('\n');

      // CSV 파일로 응답
      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename=messages_${new Date()
            .toISOString()
            .slice(0, 10)}.csv`,
        },
      });
    }

    // 총 개수 조회
    // 정규화: users 테이블과 JOIN
    const countResult = await query(
      `SELECT COUNT(*) as count 
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // 메시지 목록 조회
    // 정규화: users 테이블과 JOIN하여 사용자 정보 조회
    const offset = (page - 1) * limit;
    const messagesResult = await query(
      `SELECT m.*, 
              COALESCE(u.email, '') as email,
              COALESCE(u.name, '') as name,
              COALESCE(u.department, '') as department,
              COALESCE(u.cell, '') as cell
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       ${whereClause} 
       ORDER BY m.created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
    let messages = messagesResult.rows;

    // chatHistory에서 피드백 병합
    // messages 테이블의 피드백이 null이거나 없을 경우 chatHistory에서 피드백을 가져옴
    const feedbackMap = new Map();
    
    if (messages.length > 0) {
      // room_id 목록 추출
      const roomIds = [...new Set(messages.map(m => m.room_id).filter(Boolean))];
      
      if (roomIds.length > 0) {
        // chatHistory에서 해당 room_id의 메시지들 중 피드백이 있는 것만 조회
        const chatHistoryResult = await query(
          `SELECT room_id, text, role, created_at, feedback 
           FROM chat_history 
           WHERE room_id = ANY($1) AND feedback IS NOT NULL AND feedback != ''`,
          [roomIds]
        );

        // chatHistory 메시지를 매핑 (room_id, text, role, created_at 기준)
        chatHistoryResult.rows.forEach(chMsg => {
          const key = `${chMsg.room_id}_${chMsg.text}_${chMsg.role}_${chMsg.created_at?.getTime()}`;
          if (chMsg.feedback && String(chMsg.feedback).trim() !== '') {
            feedbackMap.set(key, String(chMsg.feedback).trim());
          }
        });
      }
    }

    // 모델 설정 조회
    const { modelLabelMap, allModels } = await getModelLabelMap();

    let formattedMessages = messages.map((msg) => {
      // messages 테이블의 피드백이 있으면 사용, 없으면 chatHistory에서 찾기
      let messageFeedback = (msg.feedback && String(msg.feedback).trim() !== '') 
        ? String(msg.feedback).trim() 
        : null;
      
      // messages에 피드백이 없으면 chatHistory에서 찾기
      if (!messageFeedback) {
        const key = `${msg.room_id}_${msg.text}_${msg.role}_${msg.created_at?.getTime()}`;
        messageFeedback = feedbackMap.get(key) || null;
      }

      // 모델 ID를 표시 이름으로 변환
      const modelId = msg.model ? String(msg.model).trim() : null;
      let modelLabel = null;
      if (modelId && modelId.length > 0) {
        modelLabel = findModelLabel(modelId, modelLabelMap, allModels);
        // 표시 이름을 찾지 못하면 모델 ID 자체를 사용
        if (!modelLabel || modelLabel.trim().length === 0) {
          modelLabel = modelId;
        }
      }

      return {
        _id: msg.id,
        id: msg.id,
        email: msg.email,
        name: msg.name,
        department: msg.department,
        cell: msg.cell,
        role: msg.role,
        userRole: msg.user_role,
        model: msg.model,
        modelLabel: modelLabel, // 표시 이름 추가
        text: msg.text,
        roomId: msg.room_id,
        userId: msg.user_id,
        clientIP: msg.client_ip,
        createdAt: msg.created_at,
        feedback: messageFeedback,
      };
    });

    // Fallback: messages 테이블이 비어 있을 때 chatHistory에서 보강 조회
    if (formattedMessages.length === 0) {
      // chatHistory용 WHERE 조건 구성
      let chatWhereConditions = [];
      let chatParams = [];
      let chatParamIndex = 1;

      if (search) {
        chatWhereConditions.push(`ch.text ILIKE $${chatParamIndex}`);
        chatParams.push(`%${search}%`);
        chatParamIndex++;
      }

      if (department) {
        chatWhereConditions.push(`u.department = $${chatParamIndex}`);
        chatParams.push(department);
        chatParamIndex++;
      }

      if (authType) {
        chatWhereConditions.push(`u.auth_type = $${chatParamIndex}`);
        chatParams.push(authType);
        chatParamIndex++;
      }

      if (model) {
        chatWhereConditions.push(`ch.model ILIKE $${chatParamIndex}`);
        chatParams.push(`%${model}%`);
        chatParamIndex++;
      }

      if (role) {
        chatWhereConditions.push(`ch.role = $${chatParamIndex}`);
        chatParams.push(role);
        chatParamIndex++;
      }

      if (roomId) {
        chatWhereConditions.push(`ch.room_id = $${chatParamIndex}`);
        chatParams.push(roomId);
        chatParamIndex++;
      }

      if (user) {
        chatWhereConditions.push(`(u.name ILIKE $${chatParamIndex} OR u.email ILIKE $${chatParamIndex})`);
        chatParams.push(`%${user}%`);
        chatParamIndex++;
      }

      // 피드백 필터 처리
      if (feedback && feedback.trim() !== '') {
        const normalizedFeedback = feedback.trim().toLowerCase();
        if (normalizedFeedback === 'none') {
          chatWhereConditions.push(`(ch.feedback IS NULL OR ch.feedback = '')`);
        } else {
          chatWhereConditions.push(`LOWER(ch.feedback) = $${chatParamIndex}`);
          chatParams.push(normalizedFeedback);
          chatParamIndex++;
        }
      }

      if (startDate) {
        chatWhereConditions.push(`ch.created_at >= $${chatParamIndex}`);
        chatParams.push(startDate);
        chatParamIndex++;
      }

      if (endDate) {
        chatWhereConditions.push(`ch.created_at <= $${chatParamIndex}`);
        chatParams.push(endDate);
        chatParamIndex++;
      }

      const chatWhereClause = chatWhereConditions.length > 0 
        ? `WHERE ${chatWhereConditions.join(' AND ')}` 
        : '';

      const totalCountCHResult = await query(
        `SELECT COUNT(*) as count
         FROM chat_history ch
         LEFT JOIN users u ON ch.user_id = u.id
         ${chatWhereClause}`,
        chatParams
      );
      const totalCountCH = parseInt(totalCountCHResult.rows[0].count);
      const totalPagesCH = Math.ceil(
        (isExport ? totalCountCH : Math.min(totalCountCH, 1e9)) / (limit || 1)
      );

      const historyResult = await query(
        `SELECT ch.*,
                COALESCE(u.email, '') as email,
                COALESCE(u.name, '') as name,
                COALESCE(u.department, '') as department,
                COALESCE(u.cell, '') as cell
         FROM chat_history ch
         LEFT JOIN users u ON ch.user_id = u.id
         ${chatWhereClause}
         ORDER BY ch.created_at DESC
         LIMIT $${chatParamIndex} OFFSET $${chatParamIndex + 1}`,
        [...chatParams, limit || 0, (page - 1) * (limit || 0)]
      );
      const history = historyResult.rows;

      // 모델 설정 조회 (chatHistory fallback용)
      const { modelLabelMap: chModelLabelMap, allModels: chAllModels } = await getModelLabelMap();

      formattedMessages = history.map((msg) => {
        // 모델 ID를 표시 이름으로 변환
        const modelId = msg.model ? String(msg.model).trim() : null;
        let modelLabel = null;
        if (modelId && modelId.length > 0) {
          modelLabel = findModelLabel(modelId, chModelLabelMap, chAllModels);
          // 표시 이름을 찾지 못하면 모델 ID 자체를 사용
          if (!modelLabel || modelLabel.trim().length === 0) {
            modelLabel = modelId;
          }
        }
        
        return {
          _id: msg.id,
          id: msg.id,
          email: msg.email || '',
          name: msg.name || '',
          department: msg.department || '',
          cell: msg.cell || '',
          role: msg.role,
          userRole: 'user',
          model: msg.model || '',
          modelLabel: modelLabel, // 표시 이름 추가
          text: msg.text,
          roomId: msg.room_id,
          userId: msg.user_id,
          clientIP: null,
          createdAt: msg.created_at,
          feedback: (msg.feedback && String(msg.feedback).trim() !== '') ? String(msg.feedback).trim() : null,
        };
      });

      return NextResponse.json({
        success: true,
        messages: formattedMessages,
        pagination: {
          currentPage: page,
          totalPages: totalPagesCH,
          totalCount: totalCountCH,
          limit,
        },
      });
    }

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error('메시지 목록 조회 실패:', error);
    return createServerError(error, '메시지 목록 조회 실패');
  }
}
