// 컨텍스트 크기 관리 시스템

// 사용자 질문 최대 허용 길이 (관리자 설정값 없을 때 기본값)
const DEFAULT_MAX_USER_QUESTION_LENGTH = 300000;

// 모델별 제한 대신 단일 컨텍스트 한도 사용
const DEFAULT_MAX_CONTEXT_TOKENS = 300000;

// 대략적인 토큰-문자 비율 (영어 기준 1토큰 ≈ 4자, 한국어는 더 적음)
const CHAR_TO_TOKEN_RATIO = 3;

export function estimateTokens(text) {
  return Math.ceil(text.length / CHAR_TO_TOKEN_RATIO);
}

export function canFitInContext(
  prompt,
  multiturnHistory,
  modelName,
  fileContent = ''
) {
  const maxTokens = DEFAULT_MAX_CONTEXT_TOKENS;

  const promptTokens = estimateTokens(prompt);
  const historyTokens = estimateTokens(multiturnHistory);
  const fileTokens = estimateTokens(fileContent);
  const responseBuffer = 500; // 응답을 위한 여유 공간

  const totalTokens =
    promptTokens + historyTokens + fileTokens + responseBuffer;

  return {
    canFit: totalTokens <= maxTokens,
    totalTokens,
    maxTokens,
    breakdown: {
      prompt: promptTokens,
      history: historyTokens,
      file: fileTokens,
      buffer: responseBuffer,
    },
  };
}

export function truncateToFit(content, maxTokens) {
  const maxChars = maxTokens * CHAR_TO_TOKEN_RATIO;
  if (content.length <= maxChars) return content;

  // 단어 경계에서 자르기
  const truncated = content.substring(0, maxChars);
  const lastSpaceIndex = truncated.lastIndexOf(' ');

  return lastSpaceIndex > maxChars * 0.8
    ? truncated.substring(0, lastSpaceIndex) + '...'
    : truncated + '...';
}

// 사용자 질문 길이 검증
export function validateUserQuestion(
  userPrompt,
  maxLength = DEFAULT_MAX_USER_QUESTION_LENGTH
) {
  // null/undefined 체크 추가
  if (!userPrompt || typeof userPrompt !== 'string') {
    return {
      valid: false,
      error: 'Please enter a question.',
    };
  }
  
  if (userPrompt.length > maxLength) {
    return {
      valid: false,
      error: `질문이 너무 깁니다. 최대 ${maxLength.toLocaleString()}자까지 입력 가능합니다. (현재: ${userPrompt.length.toLocaleString()}자)`,
    };
  }
  return { valid: true };
}

// 시스템 메시지나 상태 메시지 필터링
function isSystemMessage(text) {
  const systemPatterns = [
    /^✅ 요청 성공/,
    /^❌ error 요청 실패/,
    /^🐣 요청 안내/,
    /^⚡ 응답 중단/,
    /^😊 잘 지내시죠/,
    /^🌟/,
    /성공.*😊/,
    /실패.*error/,
  ];
  return systemPatterns.some((pattern) => pattern.test(text.trim()));
}

// 멀티턴 히스토리를 스마트하게 잘라내기 (시스템 메시지 필터링 + 가장 긴 대화부터 제거)
export function trimMultiturnHistory(messages, maxLength) {
  if (!messages || messages.length === 0) return '';

  // 시스템 메시지나 상태 메시지 필터링
  let workingMessages = messages.filter((msg) => !isSystemMessage(msg.text));

  let currentLength = workingMessages.reduce(
    (sum, msg) => sum + msg.text.length,
    0
  );

  while (currentLength > maxLength && workingMessages.length > 1) {
    // 가장 긴 메시지 찾기
    let longestIndex = 0;
    let longestLength = 0;

    workingMessages.forEach((msg, index) => {
      if (msg.text.length > longestLength) {
        longestLength = msg.text.length;
        longestIndex = index;
      }
    });

    // 가장 긴 메시지 제거
    const removedMsg = workingMessages.splice(longestIndex, 1)[0];
    currentLength -= removedMsg.text.length;
  }

  return workingMessages
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');
}

export function smartContextManager(
  userPrompt,
  multiturnMessages,
  fileContent,
  modelName,
  systemPrompt = null,
  maxMultiturnCount = null
) {
  console.log(
    '[smartContextManager] 받은 multiturnMessages:',
    multiturnMessages
  ); // 로그 추가
  // 1순위: 사용자 질문 길이 검증
  const userValidation = validateUserQuestion(userPrompt);
  if (!userValidation.valid) {
    return {
      error: true,
      message: userValidation.error,
    };
  }

  const maxTokens = DEFAULT_MAX_CONTEXT_TOKENS;
  const maxChars = maxTokens * CHAR_TO_TOKEN_RATIO;

  const userPromptLength = userPrompt.length;
  const fileContentLength = fileContent ? fileContent.length : 0;
  const systemPromptLength = systemPrompt ? systemPrompt.length : 0;
  const responseBuffer = 2000; // 응답을 위한 여유 공간 (문자 기준)

  // 사용자 질문 + 파일 내용 + 시스템 프롬프트 + 응답 버퍼는 보장
  const guaranteedLength =
    userPromptLength + fileContentLength + systemPromptLength + responseBuffer;
  const remainingForHistory = maxChars - guaranteedLength;

  let multiturnHistory = '';
  let warning = null;

  if (multiturnMessages && multiturnMessages.length > 0) {
    if (remainingForHistory > 0) {
      // 남은 공간에 멀티턴 히스토리 맞추기
      multiturnHistory = trimMultiturnHistory(
        multiturnMessages,
        remainingForHistory
      );

      // 원본과 비교해서 잘렸는지 확인
      // 단, maxMultiturnCount가 설정되어 있고 아직 최대 개수에 도달하지 않았다면 경고하지 않음
      const originalLength = multiturnMessages.reduce(
        (sum, msg) => sum + msg.text.length,
        0
      );
      const trimmedLength = multiturnHistory.split('\n').filter(line => line.trim()).length;
      const originalMessageCount = multiturnMessages.length;
      
      // 컨텍스트 제한으로 인해 잘렸는지 확인
      // maxMultiturnCount가 설정되어 있고, 아직 최대 개수에 도달하지 않았다면 경고하지 않음
      const isTruncated = multiturnHistory.length < originalLength;
      const isAtMaxCount = maxMultiturnCount !== null && originalMessageCount >= maxMultiturnCount;
      
      if (isTruncated && (maxMultiturnCount === null || isAtMaxCount)) {
        warning = `대화 히스토리가 컨텍스트 제한으로 인해 일부 제외되었습니다. (${originalMessageCount}개 중 일부)`;
      }
    } else {
      // 공간이 부족하면 히스토리 없이 진행
      warning = '컨텍스트 제한으로 인해 이전 대화 내용을 포함할 수 없습니다.';
    }
  }

  // 최종 프롬프트 구성
  let finalPrompt;
  const systemPart = systemPrompt ? `${systemPrompt}\n\n` : '';
  const historyPart = multiturnHistory ? `${multiturnHistory}\n` : '';

  // 파일 내용이 있을 경우, 히스토리와 파일 내용을 모두 포함
  // fileContent 자체에 이미 강력한 지시사항이 포함되어 있음
  const mainContent = fileContent
    ? `${historyPart}${fileContent}\n`
    : historyPart;

  finalPrompt = `${systemPart}${mainContent}User: ${userPrompt}\nAssistant:`;

  return {
    error: false,
    finalPrompt,
    warning,
    stats: {
      userPromptLength,
      fileContentLength,
      systemPromptLength,
      historyLength: multiturnHistory.length,
      totalLength: finalPrompt.length,
      maxAllowed: maxChars,
    },
  };
}
