/**
 * 입력 검증 및 보안 관련 유틸리티 함수들
 */

// HTML 특수문자 이스케이프
export function escapeHtml(text) {
  if (typeof text !== 'string') return text;

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// SQL 인젝션 방지를 위한 기본 검증
export function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  // 위험한 SQL 키워드 제거
  const sqlKeywords =
    /\b(select|insert|update|delete|drop|create|alter|exec|execute|union|script|javascript|vbscript|onload|onerror)\b/gi;
  return input.replace(sqlKeywords, '');
}

// 문자열 길이 검증
export function validateLength(text, minLength = 0, maxLength = 100000) {
  if (typeof text !== 'string')
    return { valid: false, error: 'Not a text value.' };
  if (text.length < minLength)
    return { valid: false, error: `최소 ${minLength}자 이상이어야 합니다.` };
  if (text.length > maxLength)
    return { valid: false, error: `최대 ${maxLength}자까지 입력 가능합니다.` };
  return { valid: true };
}

// 이메일 형식 검증
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format.' };
  }
  return { valid: true };
}

// UUID 형식 검증 (PostgreSQL 사용)
export function validateUUID(id) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return { valid: false, error: 'Invalid UUID format.' };
  }
  return { valid: true };
}

// 허용된 역할 검증
export function validateRole(role) {
  const allowedRoles = ['user', 'assistant', 'admin'];
  if (!allowedRoles.includes(role)) {
    return { valid: false, error: 'Role not allowed.' };
  }
  return { valid: true };
}

// 허용된 사용자 역할 검증
export function validateUserRole(userRole) {
  const allowedUserRoles = ['user', 'admin'];
  if (!allowedUserRoles.includes(userRole)) {
    return { valid: false, error: 'User role not allowed.' };
  }
  return { valid: true };
}

// AI 모델명 검증
export function validateModel(model) {
  if (!model) return { valid: true }; // 모델명은 선택사항

  // 허용된 문자만 포함하는지 검증 (영문, 숫자, 하이픈, 콜론, 점, 공백, 괄호)
  // 확장: OpenAI/HuggingFace 모델명, label (예: "Gemma 3 4B (복사)")
  const modelRegex = /^[a-zA-Z0-9_\-:./() ㄱ-ㅎ가-힣]+$/;
  if (!modelRegex.test(model)) {
    return { valid: false, error: 'Model name format not allowed.' };
  }

  if (model.length > 100) {
    return { valid: false, error: 'Model name cannot exceed 100 characters.' };
  }

  return { valid: true };
}

// 종합 메시지 검증
export function validateMessage(messageData) {
  const { role, text, model, roomId } = messageData;

  // 역할 검증
  const roleValidation = validateRole(role);
  if (!roleValidation.valid) return roleValidation;

  // 텍스트 검증
  const textValidation = validateLength(text, 1, 100000);
  if (!textValidation.valid) return textValidation;

  // 모델명 검증
  const modelValidation = validateModel(model);
  if (!modelValidation.valid) return modelValidation;

  // 방 ID 검증
  if (roomId && roomId !== 'general') {
    const roomIdValidation = validateUUID(roomId);
    if (!roomIdValidation.valid) return roomIdValidation;
  }

  return { valid: true };
}

// 페이지네이션 파라미터 검증
export function validatePagination(page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;

  if (pageNum < 1)
    return { valid: false, error: 'Page number must be 1 or greater.' };
  if (limitNum < 1 || limitNum > 100)
    return {
      valid: false,
      error: '한 페이지당 항목 수는 1-100 사이여야 합니다.',
    };

  return { valid: true, page: pageNum, limit: limitNum };
}

// 날짜 범위 검증
export function validateDateRange(dateRange) {
  const allowedRanges = ['1d', '7d', '30d', '90d', '365d', 'all'];
  if (!allowedRanges.includes(dateRange)) {
    return { valid: false, error: 'Date range not allowed.' };
  }
  return { valid: true };
}
