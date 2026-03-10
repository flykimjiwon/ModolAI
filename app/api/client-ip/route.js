import { NextResponse } from 'next/server';

// 클라이언트 IP를 서버사이드에서 감지하는 API
// 외부 IP 서비스 호출 없이 요청 헤더에서 직접 추출

export async function GET(request) {
  try {
    // 1. 프록시/로드밸런서를 거친 경우 x-forwarded-for 헤더 확인
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const ip = forwarded.split(',')[0].trim();
      if (ip && !isLocalIP(ip)) {
        return NextResponse.json({ ip, source: 'x-forwarded-for' });
      }
    }

    // 2. x-real-ip 헤더 확인
    const realIP = request.headers.get('x-real-ip');
    if (realIP && !isLocalIP(realIP)) {
      return NextResponse.json({ ip: realIP, source: 'x-real-ip' });
    }

    // 3. cf-connecting-ip (Cloudflare)
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP && !isLocalIP(cfIP)) {
      return NextResponse.json({ ip: cfIP, source: 'cf-connecting-ip' });
    }

    // 4. true-client-ip (Akamai, Cloudflare Enterprise)
    const trueClientIP = request.headers.get('true-client-ip');
    if (trueClientIP && !isLocalIP(trueClientIP)) {
      return NextResponse.json({ ip: trueClientIP, source: 'true-client-ip' });
    }

    // 5. 외부 서비스에서 IP 조회 시도 (서버사이드에서 호출하면 SSL 문제 없음)
    const externalIP = await getIPFromExternalService();
    if (externalIP) {
      return NextResponse.json({ ip: externalIP, source: 'external-service' });
    }

    // IP를 감지할 수 없는 경우
    return NextResponse.json({ ip: null, source: 'not-detected' });

  } catch (error) {
    console.error('[Client IP API] 오류:', error.message);
    return NextResponse.json({ ip: null, source: 'error', error: error.message });
  }
}

// 외부 IP 서비스에서 조회 (서버사이드)
async function getIPFromExternalService() {
  const services = [
    { url: 'https://api.ipify.org?format=json', parser: (d) => d.ip },
    { url: 'https://ipapi.co/json/', parser: (d) => d.ip },
    { url: 'https://httpbin.org/ip', parser: (d) => d.origin },
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(service.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Modol-Server/1.0',
        },
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const ip = service.parser(data);
        if (ip && !isLocalIP(ip)) {
          return ip;
        }
      }
    } catch (error) {
      // 다음 서비스로 시도
      continue;
    }
  }

  return null;
}

// 로컬/사설 IP 확인
function isLocalIP(ip) {
  if (!ip) return true;

  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;

  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);

  // 사설 IP 대역
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;

  return false;
}
