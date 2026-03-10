/**
 * Next.js Request에서 클라이언트 IP 주소를 추출합니다.
 * 프록시, 로드밸런서, CDN을 고려하여 실제 IP를 찾습니다.
 */
export function getClientIP(request) {
  // 1. x-forwarded-for 헤더 (가장 일반적)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // 첫 번째 IP가 원본 클라이언트 IP (프록시 체인의 경우)
    return forwarded.split(',')[0].trim();
  }

  // 2. x-real-ip 헤더 (nginx 등에서 사용)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // 3. x-client-ip 헤더
  const clientIP = request.headers.get('x-client-ip');
  if (clientIP) {
    return clientIP.trim();
  }

  // 4. cf-connecting-ip 헤더 (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP.trim();
  }

  // 5. x-cluster-client-ip 헤더
  const clusterIP = request.headers.get('x-cluster-client-ip');
  if (clusterIP) {
    return clusterIP.trim();
  }

  // 6. 개발환경에서의 fallback
  // Next.js에서는 직접적인 connection info 접근이 제한적
  return '127.0.0.1'; // localhost fallback
}

/**
 * IP 주소 유효성 검사 및 정규화
 */
export function normalizeIP(ip) {
  if (!ip) return '127.0.0.1';
  
  // IPv4 정규식
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 정규식 (간단한 버전)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  const trimmedIP = ip.trim();
  
  if (ipv4Regex.test(trimmedIP) || ipv6Regex.test(trimmedIP)) {
    return trimmedIP;
  }
  
  // 유효하지 않은 IP인 경우 localhost 반환
  return '127.0.0.1';
}

/**
 * IP 주소의 지역 정보 등을 위한 추가 유틸리티 (선택적)
 */
export function getIPInfo(ip) {
  const normalizedIP = normalizeIP(ip);
  
  return {
    ip: normalizedIP,
    isLocal: normalizedIP === '127.0.0.1' || normalizedIP === '::1',
    isPrivate: isPrivateIP(normalizedIP)
  };
}

/**
 * 사설 IP 주소인지 확인
 */
function isPrivateIP(ip) {
  if (!ip) return true;
  
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);
  
  // 10.0.0.0/8
  if (first === 10) return true;
  
  // 172.16.0.0/12
  if (first === 172 && second >= 16 && second <= 31) return true;
  
  // 192.168.0.0/16
  if (first === 192 && second === 168) return true;
  
  return false;
}