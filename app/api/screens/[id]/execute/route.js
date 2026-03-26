import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyTokenWithResult } from '@/lib/auth';

// POST: 화면 엔드포인트 실행
export async function POST(request, { params }) {
  const { id } = await params;

  // 공개 화면이면 인증 없이도 실행 가능
  const screenResult = await query(
    `SELECT id, definition, access_type FROM screens WHERE id = $1`,
    [id]
  );

  if (screenResult.rows.length === 0) {
    return NextResponse.json({ error: '화면을 찾을 수 없습니다.' }, { status: 404 });
  }

  const screen = screenResult.rows[0];

  // 비공개 화면은 인증 필요
  if (screen.access_type !== 'public') {
    const auth = await verifyTokenWithResult(request);
    if (!auth.valid) {
      return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    }
  }

  const { endpointId, inputValues } = await request.json();

  const definition = screen.definition;
  const endpoint = (definition.endpoints || []).find((ep) => ep.id === endpointId);

  if (!endpoint) {
    return NextResponse.json({ error: '엔드포인트를 찾을 수 없습니다.' }, { status: 404 });
  }

  try {
    let result;

    if (endpoint.type === 'workflow') {
      // 워크플로우 실행
      const wfResult = await query(
        `SELECT id, definition FROM workflows WHERE id = $1`,
        [endpoint.workflowId]
      );
      if (wfResult.rows.length === 0) {
        return NextResponse.json({ error: '워크플로우를 찾을 수 없습니다.' }, { status: 404 });
      }

      // inputMapping에 따라 입력값 매핑
      const mappedInput = {};
      for (const [key, varName] of Object.entries(endpoint.inputMapping || {})) {
        mappedInput[key] = inputValues[varName];
      }

      // 워크플로우 실행 API 내부 호출 (동기 방식)
      const execRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/workflows/${endpoint.workflowId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: mappedInput }),
        }
      );

      if (!execRes.ok) {
        const errData = await execRes.json().catch(() => ({}));
        return NextResponse.json({ error: errData.error || '워크플로우 실행 실패' }, { status: 500 });
      }

      const execData = await execRes.json();
      result = execData.outputs || execData;
    } else if (endpoint.type === 'custom') {
      // 커스텀 URL 호출
      const mappedInput = {};
      for (const [key, varName] of Object.entries(endpoint.inputMapping || {})) {
        mappedInput[key] = inputValues[varName];
      }

      const headers = { 'Content-Type': 'application/json' };
      if (endpoint.apiKey) headers['Authorization'] = `Bearer ${endpoint.apiKey}`;

      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(mappedInput),
      });

      result = await res.json();
    } else {
      return NextResponse.json({ error: '알 수 없는 엔드포인트 타입입니다.' }, { status: 400 });
    }

    // outputMapping에 따라 결과 매핑
    const mappedOutput = {};
    for (const [varName, key] of Object.entries(endpoint.outputMapping || {})) {
      // 중첩 경로 지원 (예: "data.result")
      const keys = key.split('.');
      let val = result;
      for (const k of keys) {
        val = val?.[k];
      }
      mappedOutput[varName] = val;
    }

    return NextResponse.json({ outputs: mappedOutput });
  } catch (err) {
    console.error('[screens/execute] 오류:', err);
    return NextResponse.json({ error: '실행 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
