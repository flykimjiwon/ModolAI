/**
 * JWT 유틸리티 함수
 * UTF-8 문자(한글 등)가 포함된 JWT 토큰을 안전하게 처리
 */

/**
 * JWT 토큰의 페이로드를 디코딩 (UTF-8 안전)
 * @param {string} token - JWT 토큰
 * @returns {object} 디코딩된 페이로드 객체
 * @throws {Error} 토큰이 유효하지 않은 경우
 */
export function decodeJWTPayload(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('유효하지 않은 토큰입니다.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT 토큰 형식이 올바르지 않습니다.');
  }

  const base64Payload = parts[1];

  try {
    // Base64URL을 일반 Base64로 변환
    const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');

    // Base64 디코딩 후 UTF-8 문자열로 변환
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // UTF-8 디코딩
    const decoder = new TextDecoder('utf-8');
    const jsonString = decoder.decode(bytes);

    return JSON.parse(jsonString);
  } catch (error) {
    // TextDecoder가 없는 환경을 위한 폴백
    try {
      const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(
        decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
      );
    } catch (fallbackError) {
      throw new Error('토큰 페이로드 디코딩 실패: ' + fallbackError.message);
    }
  }
}

/**
 * JWT 토큰이 만료되었는지 확인
 * @param {string} token - JWT 토큰
 * @returns {boolean} 만료 여부 (만료됨 = true)
 */
export function isTokenExpired(token) {
  try {
    const payload = decodeJWTPayload(token);
    if (!payload.exp) {
      return false; // exp 클레임이 없으면 만료되지 않은 것으로 처리
    }
    return Date.now() >= payload.exp * 1000;
  } catch (error) {
    return true; // 파싱 실패 시 만료된 것으로 처리
  }
}

/**
 * JWT 토큰에서 사용자 정보 추출
 * @param {string} token - JWT 토큰
 * @returns {object|null} 사용자 정보 또는 null
 */
export function getUserFromToken(token) {
  try {
    const payload = decodeJWTPayload(token);
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role || 'user',
      department: payload.department,
      cell: payload.cell,
      employeeNo: payload.employeeNo,
    };
  } catch (error) {
    console.error('토큰에서 사용자 정보 추출 실패:', error);
    return null;
  }
}
