import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { parseModelName, getModelServerEndpointsByName } from '@/lib/modelServers';

/**
 * 모델 이름에서 서버 정보를 파싱하고 라운드로빈 상태 확인
 */
export async function GET(request) {
  // 관리자 권한 확인 (일반 사용자도 사용 가능하도록 변경 가능)
  const authResult = verifyAdmin(request);
  if (!authResult.success) {
    // 관리자가 아니어도 조회는 허용 (선택사항)
    // return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const modelName = searchParams.get('modelName');

    if (!modelName) {
      return NextResponse.json(
        { error: 'modelName parameter is required' },
        { status: 400 }
      );
    }

    // 모델 이름에서 서버 정보 파싱
    const { serverName, modelName: actualModelName } = parseModelName(modelName);

    if (!serverName) {
      // 서버 이름이 없으면 라운드로빈 없음
      return NextResponse.json({
        hasServerName: false,
        isRoundRobin: false,
        serverCount: 0,
        serverName: null,
        actualModelName: modelName,
      });
    }

    // 같은 이름의 서버 개수 확인
    const endpoints = await getModelServerEndpointsByName(serverName);
    const serverCount = endpoints.length;
    const isRoundRobin = serverCount > 1;

    return NextResponse.json({
      hasServerName: true,
      isRoundRobin,
      serverCount,
      serverName,
      actualModelName,
      endpoints: endpoints.map(e => ({
        url: e.endpoint,
        provider: e.provider,
      })),
    });
  } catch (error) {
    console.error('[Check Round Robin] 오류:', error);
    return NextResponse.json(
      { error: 'Failed to check round robin status', details: error.message },
      { status: 500 }
    );
  }
}

