import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { query } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';
import {
  getNextModelServerEndpointWithIndex,
  resolveModelId,
} from '@/lib/modelServers';
import { logExternalApiRequest } from '@/lib/externalApiLogger';
import { getClientIP } from '@/lib/ip';
import { saveMessageDual } from '@/lib/messageLogger';
import { getModelsFromTables } from '@/lib/modelTables';

function getValueByPath(source, path) {
  if (!source || !path) return undefined;
  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let current = source;
  for (const token of tokens) {
    if (current == null) return undefined;
    current = current[token];
  }
  return current;
}

function applyTemplate(value, context) {
  if (typeof value === 'string') {
    if (value === '{{messages}}') return context.messages;
    if (value === '{{message}}') return context.message;
    let output = value;
    if (output.includes('{{OPENAI_API_KEY}}')) {
      output = output.replaceAll(
        '{{OPENAI_API_KEY}}',
        context.apiKey || ''
      );
    }
    if (output.includes('{{messages}}')) {
      output = output.replaceAll(
        '{{messages}}',
        JSON.stringify(context.messages)
      );
    }
    if (output.includes('{{message}}')) {
      output = output.replaceAll('{{message}}', context.message || '');
    }
    return output;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyTemplate(item, context));
  }
  if (value && typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, val]) => {
      next[key] = applyTemplate(val, context);
    });
    return next;
  }
  return value;
}

function convertToResponsesInput(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages
    .map((msg) => {
      if (!msg || typeof msg !== 'object') return null;
      const role = msg.role === 'assistant' ? 'assistant' : msg.role || 'user';
      const text = msg.content ? String(msg.content) : '';
      if (!text) return null;
      return {
        role,
        content: [
          {
            type: role === 'assistant' ? 'output_text' : 'input_text',
            text,
          },
        ],
      };
    })
    .filter(Boolean);
}

// 방 이름 생성 API
export async function POST(request) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const payload = verifyToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const { roomId, userMessage, assistantMessage } = await request.json();

    if (!roomId) {
      return NextResponse.json(
        { error: '방 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!userMessage) {
      return NextResponse.json(
        { error: '사용자 메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    // UUID 검증
    if (!isValidUUID(roomId)) {
      return NextResponse.json(
        { error: '올바른 방 ID 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 채팅방 조회 및 소유자 확인
    const roomResult = await query(
      `SELECT cr.id, cr.user_id, cr.name, u.email, u.name as user_name, 
              u.department, u.cell, u.role as user_role
       FROM chat_rooms cr
       JOIN users u ON cr.user_id = u.id
       WHERE cr.id = $1`,
      [roomId]
    );

    if (roomResult.rows.length === 0) {
      return NextResponse.json(
        { error: '채팅방을 Not found.' },
        { status: 404 }
      );
    }

    const roomRow = roomResult.rows[0];
    const room = {
      _id: roomRow.id,
      id: roomRow.id,
      userId: roomRow.user_id,
      name: roomRow.name,
    };

    const roomOwner = {
      _id: roomRow.user_id,
      id: roomRow.user_id,
      email: roomRow.email,
      name: roomRow.user_name,
      department: roomRow.department,
      cell: roomRow.cell,
      role: roomRow.user_role,
    };

    // 채팅방 소유자 확인
    if (roomOwner.email !== payload.email) {
      return NextResponse.json(
        {
          error: '채팅방에 접근할 Unauthorized.',
          shouldLogout: true,
          message: 'Authentication expired. Please log in again.',
        },
        { status: 403 }
      );
    }

    // 방 이름이 이미 변경되었는지 확인 (New Chat이 아니면 이미 생성됨)
    if (room.name !== 'New Chat') {
      return NextResponse.json({
        success: true,
        roomName: room.name,
        message: '방 이름이 이미 설정되어 있습니다.',
      });
    }

    // 첫 대화인지 확인: chat_history에서 해당 방의 실제 대화 메시지 개수 확인
    // 로그 메시지([방제목 생성], [파일 파싱] 등)는 제외
    const messageCountResult = await query(
      `SELECT COUNT(*) as count FROM chat_history 
       WHERE room_id = $1 
       AND text NOT LIKE '[%'`,
      [roomId]
    );
    const messageCount = parseInt(messageCountResult.rows[0]?.count || 0);

    // 관리자 설정에서 대화방명 생성 모델 정보 가져오기 (일관성을 위해 먼저 조회)
    const settingsResult = await query(
      `SELECT room_name_generation_model, file_parsing_model FROM settings WHERE config_type = 'general' LIMIT 1`
    );
    const model =
      settingsResult.rows.length > 0 &&
      settingsResult.rows[0].room_name_generation_model
        ? settingsResult.rows[0].room_name_generation_model
        : settingsResult.rows.length > 0 &&
          settingsResult.rows[0].file_parsing_model
        ? settingsResult.rows[0].file_parsing_model
        : 'gemma3:4b';
    let modelRecord = null;
    try {
      const categories = await getModelsFromTables();
      const allModels = [];
      if (categories) {
        Object.values(categories).forEach((category) => {
          if (category.models && Array.isArray(category.models)) {
            allModels.push(...category.models);
          }
        });
      }
      modelRecord =
        allModels.find((m) => m.id === model) ||
        allModels.find((m) => m.modelName === model) ||
        allModels.find(
          (m) => m.label && m.label.toLowerCase() === String(model).toLowerCase()
        ) ||
        null;
    } catch (error) {
      console.warn('[generate-room-name] 모델 레코드 조회 실패:', error.message);
    }

    const resolvedModel = await resolveModelId(model);
    const modelForRequest = resolvedModel || model;
    try {
      if (!modelRecord) {
        const categories = await getModelsFromTables();
        const allModels = [];
        if (categories) {
          Object.values(categories).forEach((category) => {
            if (category.models && Array.isArray(category.models)) {
              allModels.push(...category.models);
            }
          });
        }
        modelRecord =
          allModels.find((m) => m.id === modelForRequest) ||
          allModels.find((m) => m.modelName === modelForRequest) ||
          allModels.find(
            (m) =>
              m.label &&
              m.label.toLowerCase() ===
                String(modelForRequest).toLowerCase()
          ) ||
          null;
      }
    } catch (error) {
      console.warn('[generate-room-name] 모델 레코드 조회 실패:', error.message);
    }
    console.log('[generate-room-name] 모델 선택:', {
      model: modelForRequest,
      endpoint: modelRecord?.endpoint || null,
      hasApiConfig: !!modelRecord?.apiConfig,
      hasApiKey: !!modelRecord?.apiKey,
    });

    // 메시지 개수 확인 (2개 초과면 이미 여러 대화가 진행된 것)
    if (messageCount > 2) {
      // 요청 로그 기록 (사용자 요청) - 모델 정보 포함
      try {
        const requestText =
          userMessage.length > 100
            ? `${userMessage.substring(0, 100)}...`
            : userMessage;
        await saveMessageDual({
          roomId: roomId,
          userId: room.userId,
          role: 'user',
          text: `[방제목 생성 요청] ${requestText}`,
          model: modelForRequest,
          email: roomOwner.email || payload.email,
          name: roomOwner.name || payload.name || '',
          department: roomOwner.department || '',
          cell: roomOwner.cell || '',
          userRole: roomOwner.role || 'user',
          clientIP: clientIP,
        });
      } catch (msgLogError) {
        console.warn(
          '[generate-room-name] 요청 로그 저장 실패(무시):',
          msgLogError.message
        );
      }

      // API 호출 로그 기록 (이미 메시지가 있는 경우)
      try {
        await saveMessageDual({
          roomId: roomId,
          userId: room.userId,
          role: 'assistant',
          text: `[방제목 생성 응답] 첫 대화가 아니므로 방제목 생성 스킵 (메시지 ${messageCount}개 존재)`,
          model: modelForRequest,
          email: roomOwner.email || payload.email,
          name: roomOwner.name || payload.name || '',
          department: roomOwner.department || '',
          cell: roomOwner.cell || '',
          userRole: roomOwner.role || 'user',
          clientIP: clientIP,
        });
      } catch (msgLogError) {
        console.warn(
          '[generate-room-name] 메시지 저장 실패(무시):',
          msgLogError.message
        );
      }

      return NextResponse.json({
        success: true,
        roomName: room.name,
        message: '첫 대화가 아니므로 방 이름 생성을 하지 않습니다.',
      });
    }

    // LLM을 사용하여 방 이름 생성
    // 사용자 메시지가 너무 길 경우 앞 100자, 뒤 100자만 사용
    let processedUserMessage = userMessage;
    if (userMessage && userMessage.length > 200) {
      const frontPart = userMessage.substring(0, 100);
      const backPart = userMessage.substring(userMessage.length - 100);
      processedUserMessage = `${frontPart}...${backPart}`;
    }

    let prompt;
    if (assistantMessage) {
      // 응답이 있는 경우 (기존 방식)
      prompt = `다음 대화 내용을 바탕으로 적절한 채팅방 이름을 생성해주세요. 
사용자 요청이 길 경우 앞 100자와 뒤 100자만 사용하여 방 제목을 설정합니다.
방 이름은 30자 이내로 간결하고 명확하게 작성해주세요.
방 이름만 출력하고, 다른 설명은 포함하지 마세요.

사용자: ${processedUserMessage}
응답: ${assistantMessage}

방 이름:`;
    } else {
      // 사용자 요청만 있는 경우 (context 절약)
      prompt = `다음 사용자 요청을 바탕으로 적절한 채팅방 이름을 생성해주세요. 
사용자 요청이 길 경우 앞 100자와 뒤 100자만 사용하여 방 제목을 설정합니다.
방 이름은 30자 이내로 간결하고 명확하게 작성해주세요.
방 이름만 출력하고, 다른 설명은 포함하지 마세요.

사용자 요청: ${processedUserMessage}

방 이름:`;
    }


    // 방제목 생성 요청 로그 기록 (사용자 요청) - 모델 정보 포함
    try {
      const requestText =
        userMessage.length > 100
          ? `${userMessage.substring(0, 100)}...`
          : userMessage;
      await saveMessageDual({
        roomId: roomId,
        userId: room.userId,
        role: 'user',
        text: `[방제목 생성 요청] ${requestText}`,
        model: modelForRequest,
        email: roomOwner.email || payload.email,
        name: roomOwner.name || payload.name || '',
        department: roomOwner.department || '',
        cell: roomOwner.cell || '',
        userRole: roomOwner.role || 'user',
        clientIP: clientIP,
      });
    } catch (msgLogError) {
      console.warn(
        '[generate-room-name] 요청 로그 저장 실패(무시):',
        msgLogError.message
      );
    }

    try {
      if (modelRecord?.endpoint === 'manual' || modelRecord?.apiConfig) {
        const manualConfig =
          typeof modelRecord.apiConfig === 'string'
            ? JSON.parse(modelRecord.apiConfig)
            : modelRecord.apiConfig;
        if (!manualConfig?.url) {
          throw new Error('수동 API URL이 설정되지 않았습니다.');
        }
        const responsePath = manualConfig?.responseMapping?.path || null;

        const baseMessages = [
          ...(modelRecord.systemPrompt && modelRecord.systemPrompt.length > 0
            ? [
                {
                  role: 'system',
                  content: modelRecord.systemPrompt
                    .filter((line) => line.trim() !== '')
                    .join('\n'),
                },
              ]
            : []),
          { role: 'user', content: prompt },
        ];
        const context = {
          apiKey: (modelRecord.apiKey || process.env.OPENAI_API_KEY || '').trim(),
          messages: baseMessages,
          message: prompt,
        };
        const manualUrl = applyTemplate(manualConfig.url, context);
        const method = (manualConfig.method || 'POST').toUpperCase();
        const headers = applyTemplate(manualConfig.headers || {}, context);
        let body = applyTemplate(manualConfig.body || {}, context);
        const logLink = `/admin/external-api-logs?apiType=generate-room-name&model=${encodeURIComponent(
          modelForRequest
        )}&provider=manual`;
        if (body && typeof body === 'object' && body.stream !== false) {
          body = { ...body, stream: false };
        }
        if (manualUrl.includes('/v1/responses') && body && typeof body === 'object') {
          if (body.input === context.message) {
            body = { ...body, input: context.message };
          }
          if (Array.isArray(body.input)) {
            body = { ...body, input: convertToResponsesInput(body.input) };
          } else if (Array.isArray(context.messages) && context.messages.length > 0) {
            body = { ...body, input: convertToResponsesInput(context.messages) };
          }
        }
        console.log('[generate-room-name] 수동 API 요청:', {
          url: manualUrl,
          method,
          hasBody: body !== undefined,
          responsePath: manualConfig?.responseMapping?.path || null,
        });

        const requestOptions = { method, headers };
        if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
          requestOptions.body =
            typeof body === 'string' ? body : JSON.stringify(body);
        }

        const manualStartTime = Date.now();
        const manualRes = await fetch(manualUrl, requestOptions);
        const responseTime = Date.now() - manualStartTime;
        if (!manualRes.ok) {
          const errorText = await manualRes.text().catch(() => '');
          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'manual',
            apiType: 'generate-room-name',
            endpoint: manualUrl,
            model: modelForRequest,
            prompt: prompt,
            promptTokenCount: prompt.length,
            responseTokenCount: 0,
            responseTime,
            statusCode: manualRes.status,
            isStream: false,
            error: `수동 API 요청 실패: HTTP ${manualRes.status} (responseMapping: ${
              responsePath || 'none'
            })`,
            clientIP: clientIP,
            userAgent: userAgent,
            jwtEmail: payload.email,
            jwtUserId: payload.userId || null,
            jwtName: payload.name || null,
          });
          throw new Error(
            `수동 API 요청 실패: HTTP ${manualRes.status} ${errorText}`
          );
        }

        let responseText = '';
        let responseData = null;
        const manualContentType = manualRes.headers.get('content-type') || '';
        if (manualContentType.includes('application/json')) {
          responseData = await manualRes.json();
        } else {
          responseText = await manualRes.text().catch(() => '');
        }

        let generatedName = responseText;
        if (responsePath && responseData) {
          const extracted = getValueByPath(responseData, responsePath);
          if (extracted !== undefined) {
            generatedName = Array.isArray(extracted)
              ? extracted.join('')
              : String(extracted);
          }
        } else if (!generatedName && responseData) {
          generatedName =
            responseData?.response ||
            responseData?.choices?.[0]?.message?.content ||
            '';
        }

        generatedName = (generatedName || '').trim();
        const responseIssue =
          !generatedName || generatedName.length < 2
            ? `응답 파싱 실패 또는 빈 결과 (responseMapping: ${
                responsePath || 'none'
              })`
            : null;
        if (responseIssue) {
          generatedName = '새 대화';
        }
        generatedName = generatedName
          .replace(/^방 이름:\s*/i, '')
          .replace(/^["']|["']$/g, '')
          .trim()
          .substring(0, 30);

        try {
          await logExternalApiRequest({
            sourceType: 'internal',
            provider: 'manual',
            apiType: 'generate-room-name',
            endpoint: manualUrl,
            model: modelForRequest,
            prompt: prompt,
            promptTokenCount: prompt.length,
            responseTokenCount: generatedName.length,
            responseTime,
            statusCode: manualRes.status,
            isStream: false,
            error: responseIssue || null,
            clientIP: clientIP,
            userAgent: userAgent,
            jwtEmail: payload.email,
            jwtUserId: payload.userId || null,
            jwtName: payload.name || null,
          });
        } catch (logError) {
          console.warn('[generate-room-name] 로깅 실패(무시):', logError.message);
        }

        await query(
          `UPDATE chat_rooms 
           SET name = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [generatedName, roomId]
        );

        await saveMessageDual({
          roomId: roomId,
          userId: room.userId,
          role: 'assistant',
          text: `[방제목 생성 성공] ${generatedName}${
            responseIssue ? ` (주의: ${responseIssue}, 로그: ${logLink})` : ''
          }`,
          model: modelForRequest,
          email: roomOwner.email || payload.email,
          name: roomOwner.name || payload.name || '',
          department: roomOwner.department || '',
          cell: roomOwner.cell || '',
          userRole: roomOwner.role || 'user',
          clientIP: clientIP,
        });

        return NextResponse.json({
          success: true,
          roomName: generatedName,
        });
      }

      const endpointInfo = await getNextModelServerEndpointWithIndex();
      const llmEndpoint = endpointInfo.endpoint;
      const provider = endpointInfo.provider || 'model-server';
      const llmUrl = `${llmEndpoint}/api/generate`;

      const requestBody = {
        model: modelForRequest,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          max_length: 100,
        },
      };

      const llmStartTime = Date.now();
      const response = await fetch(llmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseTime = Date.now() - llmStartTime;

      if (!response.ok) {
        const errorText = await response.text();

        // 에러 시에도 로깅
        try {
          await logExternalApiRequest({
            sourceType: 'internal',
            provider: provider,
            apiType: 'generate-room-name',
            endpoint: llmUrl,
            model: modelForRequest,
            prompt: prompt,
            promptTokenCount: prompt.length,
            responseTokenCount: 0,
            responseTime: responseTime,
            statusCode: response.status,
            isStream: false,
            error: `LLM API 실패: ${response.status} - ${errorText}`,
            clientIP: clientIP,
            userAgent: userAgent,
            jwtEmail: payload.email,
            jwtUserId: payload.userId || null,
            jwtName: payload.name || null,
          });
        } catch (logError) {
          console.warn(
            '[generate-room-name] 로깅 실패(무시):',
            logError.message
          );
        }

        // 메시지 관리 화면에서 집계되도록 messages 테이블에 저장 (HTTP 에러)
        try {
          await saveMessageDual({
            roomId: roomId,
            userId: room.userId,
            role: 'assistant',
            text: `[방제목 생성 실패] HTTP ${
              response.status
            }: ${errorText.substring(0, 100)}`,
            model: modelForRequest,
            email: roomOwner.email || payload.email,
            name: roomOwner.name || payload.name || '',
            department: roomOwner.department || '',
            cell: roomOwner.cell || '',
            userRole: roomOwner.role || 'user',
            clientIP: clientIP,
          });
        } catch (msgLogError) {
          console.warn(
            '[generate-room-name] 메시지 저장 실패(무시):',
            msgLogError.message
          );
        }

        throw new Error(`LLM API 실패: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      let generatedName = (result.response || '').trim();

      // 성공 시 로깅
      try {
        const responseText = generatedName || '';
        await logExternalApiRequest({
          sourceType: 'internal',
          provider: provider,
          apiType: 'generate-room-name',
          endpoint: llmUrl,
          model: modelForRequest,
          prompt: prompt,
          promptTokenCount: prompt.length,
          responseTokenCount: responseText.length,
          responseTime: responseTime,
          statusCode: response.status,
          isStream: false,
          clientIP: clientIP,
          userAgent: userAgent,
          jwtEmail: payload.email,
          jwtUserId: payload.userId || null,
          jwtName: payload.name || null,
        });
      } catch (logError) {
        console.warn('[generate-room-name] 로깅 실패(무시):', logError.message);
      }

      // 방 이름 정리 (30자 이내로 제한)
      generatedName = generatedName
        .replace(/^방 이름:\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .trim()
        .substring(0, 30);

      // 빈 이름이거나 너무 짧은 경우 기본값 사용
      if (!generatedName || generatedName.length < 2) {
        generatedName = '새 대화';
      }

      // 방 이름 업데이트
      await query(
        `UPDATE chat_rooms 
         SET name = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [generatedName, roomId]
      );

      // 메시지 관리 화면에서 집계되도록 messages 테이블에 저장 (성공)
      try {
        await saveMessageDual({
          roomId: roomId,
          userId: room.userId,
          role: 'assistant',
          text: `[방제목 생성 성공] ${generatedName}`,
          model: modelForRequest,
          email: roomOwner.email || payload.email,
          name: roomOwner.name || payload.name || '',
          department: roomOwner.department || '',
          cell: roomOwner.cell || '',
          userRole: roomOwner.role || 'user',
          clientIP: clientIP,
        });
      } catch (msgLogError) {
        console.warn(
          '[generate-room-name] 메시지 저장 실패(무시):',
          msgLogError.message
        );
      }

      return NextResponse.json({
        success: true,
        roomName: generatedName,
      });
    } catch (llmError) {
      console.error('방 이름 생성 실패:', llmError);

      // 에러 시 로깅
      let modelForLog = null;
      try {
        const endpointInfo = await getNextModelServerEndpointWithIndex();
        const llmEndpoint = endpointInfo.endpoint;
        const provider = endpointInfo.provider || 'model-server';
        const llmUrl = `${llmEndpoint}/api/generate`;
        const settingsResult = await query(
          `SELECT file_parsing_model FROM settings WHERE config_type = 'general' LIMIT 1`
        );
        const model =
          settingsResult.rows.length > 0 &&
          settingsResult.rows[0].file_parsing_model
            ? settingsResult.rows[0].file_parsing_model
            : 'gemma3:4b';
        const resolvedFallbackModel = await resolveModelId(model);
        modelForLog = resolvedFallbackModel || model;

        await logExternalApiRequest({
          sourceType: 'internal',
          provider: provider,
          apiType: 'generate-room-name',
          endpoint: llmUrl,
          model: modelForLog,
          prompt: prompt,
          promptTokenCount: prompt.length,
          responseTokenCount: 0,
          responseTime: Date.now() - startTime,
          statusCode: 500,
          isStream: false,
          error: llmError.message || String(llmError),
          clientIP: clientIP,
          userAgent: userAgent,
          jwtEmail: payload.email,
          jwtUserId: payload.userId || null,
          jwtName: payload.name || null,
        });
      } catch (logError) {
        console.warn(
          '[generate-room-name] 에러 로깅 실패(무시):',
          logError.message
        );
      }

      // LLM 실패 시 기본 이름 사용
      const defaultName = '새 대화';
      await query(
        `UPDATE chat_rooms 
         SET name = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [defaultName, roomId]
      );

      // 메시지 관리 화면에서 집계되도록 messages 테이블에 저장 (실패 - 기본값 사용)
      try {
        await saveMessageDual({
          roomId: roomId,
          userId: room.userId,
          role: 'assistant',
          text: `[방제목 생성 실패] 기본값으로 설정: ${defaultName} (오류: ${
            llmError.message || '알 수 없는 오류'
          }) (로그: /admin/external-api-logs?apiType=generate-room-name&model=${encodeURIComponent(
            modelForLog || modelForRequest
          )})`,
          model: modelForLog || null,
          email: roomOwner.email || payload.email,
          name: roomOwner.name || payload.name || '',
          department: roomOwner.department || '',
          cell: roomOwner.cell || '',
          userRole: roomOwner.role || 'user',
          clientIP: clientIP,
        });
      } catch (msgLogError) {
        console.warn(
          '[generate-room-name] 메시지 저장 실패(무시):',
          msgLogError.message
        );
      }

      return NextResponse.json({
        success: true,
        roomName: defaultName,
        message: '기본 이름으로 설정되었습니다.',
      });
    }
  } catch (error) {
    console.error('방 이름 생성 API 오류:', error);
    return NextResponse.json(
      { error: '방 이름 생성 실패', details: error.message },
      { status: 500 }
    );
  }
}
