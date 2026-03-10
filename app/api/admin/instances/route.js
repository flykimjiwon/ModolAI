import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdmin } from '@/lib/adminAuth';
import {
  checkAllModelServerInstances,
  saveendpointStatus,
} from '@/lib/modelServerMonitor';

// Ollama 인스턴스 목록 조회
export async function GET(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck;
    }

    const url = new URL(request.url);
    const shouldRefresh = url.searchParams.get('refresh') === 'true';

    // 비활성화된 서버 목록 확인
    const settingsResult = await query(
      'SELECT custom_endpoints FROM settings WHERE config_type = $1 LIMIT 1',
      ['general']
    );
    
    const inactiveUrls = new Set();
    if (settingsResult.rows.length > 0) {
      const settings = settingsResult.rows[0];
      const customEndpoints = settings.custom_endpoints;
      if (customEndpoints && Array.isArray(customEndpoints)) {
        customEndpoints.forEach((ep) => {
          if (ep.isActive === false && ep.url) {
            // URL 정규화 (trailing slash 제거)
            const normalizedUrl = ep.url.trim().replace(/\/+$/, '');
            inactiveUrls.add(normalizedUrl);
          }
        });
      }
    }

    // DB에서 마지막 저장된 Ollama 상태 조회
    const ollamamodelServersResult = await query(
      'SELECT * FROM model_server ORDER BY endpoint ASC'
    );
    const ollamamodelServersRaw = ollamamodelServersResult.rows;

    // 비활성화된 서버 필터링 및 중복 제거: id 기준 유니크
    // metadata에서 host, port, url 등을 추출하여 인스턴스 객체 구성
    const uniqMap = new Map();
    for (const inst of ollamamodelServersRaw) {
      // metadata에서 정보 추출 (metadata는 JSONB 필드)
      let instanceData = { ...inst };
      
      // metadata가 있으면 파싱하여 host, port, url 등 추출
      if (inst.metadata && typeof inst.metadata === 'object') {
        instanceData = {
          ...instanceData,
          ...inst.metadata,
          // metadata의 필드들을 최상위로 복사
          host: inst.metadata.host || inst.metadata.hostname || null,
          port: inst.metadata.port || null,
          url: inst.metadata.url || inst.endpoint || null,
          id: inst.metadata.id || inst.id,
        };
      } else if (typeof inst.metadata === 'string') {
        try {
          const parsed = JSON.parse(inst.metadata);
          instanceData = {
            ...instanceData,
            ...parsed,
            host: parsed.host || parsed.hostname || null,
            port: parsed.port || null,
            url: parsed.url || inst.endpoint || null,
            id: parsed.id || inst.id,
          };
        } catch (e) {
          console.warn(
            '[instances] metadata JSON 파싱 실패:',
            e?.message || e
          );
          // 파싱 실패 시 endpoint에서 URL 파싱 시도
          try {
            const url = new URL(inst.endpoint);
            instanceData.host = url.hostname;
            instanceData.port = url.port || null;
            instanceData.url = inst.endpoint;
          } catch (e2) {
            console.warn(
              '[instances] endpoint URL 파싱 실패:',
              e2?.message || e2
            );
          }
        }
      } else {
        // metadata가 없으면 endpoint에서 URL 파싱
        try {
          const url = new URL(inst.endpoint);
          instanceData.host = url.hostname;
          instanceData.port = url.port || null;
          instanceData.url = inst.endpoint;
        } catch (e) {
          console.warn(
            '[instances] endpoint URL 파싱 실패:',
            e?.message || e
          );
        }
      }
      
      // 비활성화된 서버 제외
      const urlToCheck = instanceData.url || inst.endpoint;
      if (urlToCheck) {
        const normalizedUrl = urlToCheck.trim().replace(/\/+$/, '');
        if (inactiveUrls.has(normalizedUrl)) {
          continue;
        }
      }
      
      const instanceId = instanceData.id || inst.id;
      if (!uniqMap.has(instanceId)) {
        uniqMap.set(instanceId, instanceData);
      }
    }
    const ollamamodelServers = Array.from(uniqMap.values());

    // 각 인스턴스별 최근 로그 개수도 함께 조회 (직접 로그 + Proxy 로그)
    const modelServersWithLogCount = await Promise.all(
      ollamamodelServers.map(async (instance) => {
        const hostPort = `${instance.host || ''}${
          instance.port ? `:${instance.port}` : ''
        }`;
        const proxyTypes = [
          'ollama_proxy',
          'ollama_proxy_chat',
          'openai_proxy',
        ];

        // 직접 로그 (instance_id로 조회)
        const directLogResult = await query(
          `SELECT COUNT(*) as count FROM model_logs 
           WHERE instance_id = $1 AND timestamp >= $2`,
          [instance.id, new Date(Date.now() - 24 * 60 * 60 * 1000)]
        );
        const directLogCount = parseInt(directLogResult.rows[0]?.count || 0);

        // Proxy 로그 (metadata에서 type과 endpoint 확인)
        // metadata JSONB에서 type과 endpoint를 확인해야 함
        // proxyTypes 배열을 OR 조건으로 변환
        const proxyTypeConditions = proxyTypes.map((_, i) => `metadata->>'type' = $${i + 2}`).join(' OR ');
        const endpointParamIndex = proxyTypes.length + 2;
        const messageParamIndex = proxyTypes.length + 3;
        const proxyLogResult = await query(
          `SELECT COUNT(*) as count FROM model_logs 
           WHERE timestamp >= $1 
           AND (${proxyTypeConditions})
           AND (metadata->>'endpoint' LIKE $${endpointParamIndex} OR message LIKE $${messageParamIndex})`,
          [
            new Date(Date.now() - 24 * 60 * 60 * 1000),
            ...proxyTypes,
            `%${hostPort}%`,
            `%${hostPort}%`
          ]
        );
        const proxyLogCount = parseInt(proxyLogResult.rows[0]?.count || 0);

        return {
          ...instance,
          logCount24h: directLogCount + proxyLogCount, // 총 로그 수
          proxyLogCount24h: proxyLogCount, // Proxy 로그 수만 따로
          isActive: instance.status === 'healthy',
        };
      })
    );

    // 실시간 상태 확인도 함께 제공 (선택사항)
    const realTimeCheck = await checkAllModelServerInstances();

    // 강제 새로고침 요청 시 실시간 상태를 저장
    if (shouldRefresh && Array.isArray(realTimeCheck)) {
      try {
        await saveendpointStatus(realTimeCheck);
      } catch (e) {
        console.warn('실시간 상태 저장 실패 (무시):', e.message);
      }
    }

    return NextResponse.json({
      modelServers: modelServersWithLogCount,
      totalActive: modelServersWithLogCount.filter((i) => i.isActive).length,
      totalModelServers: modelServersWithLogCount.length,
      realTimeStatus: Array.isArray(realTimeCheck) 
        ? realTimeCheck.map((i) => ({
            id: i.id,
            url: i.url, // URL 추가
            host: i.host, // host 추가
            port: i.port, // port 추가
            status: i.status,
            responseTime: i.responseTime,
            modelCount: i.modelCount,
          }))
        : [],
    });
  } catch (error) {
    console.error('Ollama 인스턴스 목록 조회 실패:', error);
    return NextResponse.json(
      { 
        error: 'Ollama 인스턴스 목록을 조회하는데 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
