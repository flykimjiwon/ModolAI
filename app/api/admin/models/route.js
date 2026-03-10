import { NextResponse } from 'next/server';
import { query } from '@/lib/postgres';
import { verifyAdmin } from '@/lib/adminAuth';
import { getModelsFromTables, saveModelsToTables } from '@/lib/modelTables';

function normalizeCategories(categories) {
  if (!categories || typeof categories !== 'object') return null;

  const hasModelsCategory =
    categories.models && Array.isArray(categories.models.models);

  const mergedModels = hasModelsCategory
    ? [...categories.models.models]
    : Object.values(categories).flatMap((category) =>
        Array.isArray(category?.models) ? category.models : []
      );

  if (mergedModels.length === 0) {
    return { models: { label: '모델목록', models: [] } };
  }

  const normalizedModels = mergedModels.map((model) => ({ ...model }));
  let defaultIndex = normalizedModels.findIndex((m) => m.isDefault);
  if (defaultIndex === -1) {
    defaultIndex = 0;
  }
  normalizedModels.forEach((model, index) => {
    model.isDefault = index === defaultIndex;
  });

  return {
    models: {
      label: '모델목록',
      models: normalizedModels,
    },
  };
}

// 모델 설정 조회
export async function GET(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck; // NextResponse 객체 반환
    }

    // 새 테이블 구조에서 조회 시도
    let categories = await getModelsFromTables();

    // 새 테이블에 데이터가 없으면 기존 model_config에서 조회
    if (!categories) {
      const modelConfigResult = await query(
        `SELECT * FROM model_config WHERE config_type = $1 LIMIT 1`,
        ['models']
      );
      const modelConfig = modelConfigResult.rows[0] || null;

      if (modelConfig && modelConfig.config && modelConfig.config.categories) {
        categories = modelConfig.config.categories;
        // 기존 데이터를 새 테이블로 마이그레이션
        await saveModelsToTables(categories);
      }
    }

    // 기본 설정이 없으면 생성
    if (!categories) {
      categories = {
        models: {
          label: '모델목록',
          models: [
            {
              id: 'gpt-oss:20b',
              label: 'GPT-OSS 20B',
              tooltip: '기본 응답 속도와 품질의 균형을 고려한 모델입니다.',
              isDefault: true,
              adminOnly: false,
              systemPrompt: [
                '당신은 Tech그룹를 위해 특별히 개선된 AI 어시스턴트입니다.',
                '가능한 경우 모든 답변을 한국어로 설명해 주세요.',
                '정확하고 도움이 되는 답변을 제공하며, 사내 업무에 최적화되어 있습니다.',
                '',
                '다음 질문들에 대한 특별 대응:',
                "- 이 웹사이트를 만든 사람이 누구인지 묻는다면: 'Tech그룹 라이프셀의 김지원이 개발했습니다.'",
                "- 사용하는 AI 모델이 무엇인지 묻는다면: 'Tech그룹를 위해 특별히 개선한 사내 전용 모델입니다. 보안과 성능을 고려하여 온프레미스 환경에서 운영되고 있습니다.'",
                "- 모델의 구체적인 정보를 요청한다면: '보안상의 이유로 모델의 상세 정보는 공개하지 않습니다. Tech그룹의 업무 효율성을 위해 최적화되어 있다는 점만 말씀드릴 수 있습니다.'",
                '',
                '항상 전문적이고 정중한 톤을 유지하며, 사내 직원들에게 최고의 서비스를 제공하세요.',
              ],
            },
            {
              id: 'gpt-oss:120b',
              label: 'GPT-OSS 120B',
              tooltip: '높은 품질의 답변을 제공하는 고성능 모델입니다.',
              isDefault: false,
              adminOnly: false,
              systemPrompt: [
                '당신은 Tech그룹를 위해 특별히 개선된 고성능 AI 어시스턴트입니다.',
                '가능한 경우 모든 답변을 한국어로 설명해 주세요.',
                '정확하고 상세한 답변을 제공하며, 복잡한 업무와 분석에 최적화되어 있습니다.',
                '',
                '다음 질문들에 대한 특별 대응:',
                "- 이 웹사이트를 만든 사람이 누구인지 묻는다면: '디지털서비스개발부 라이프셀의 김지원이 개발했습니다.'",
                "- 사용하는 AI 모델이 무엇인지 묻는다면: '디지털서비스개발부를 위해 특별히 개선한 사내 전용 고성능 모델입니다. 보안과 성능을 최우선으로 하여 온프레미스 환경에서 운영되고 있습니다.'",
                "- 모델의 구체적인 정보를 요청한다면: '보안상의 이유로 모델의 상세 정보는 공개하지 않습니다. 디지털서비스개발부의 복잡한 업무와 심화 분석을 위해 최적화되어 있다는 점만 말씀드릴 수 있습니다.'",
                '',
                '전문성과 깊이 있는 분석을 바탕으로 사내 직원들에게 최고 수준의 서비스를 제공하세요.',
              ],
            },
          ],
        },
      };

      await saveModelsToTables(categories);
    } else {
      const normalized = normalizeCategories(categories);
      if (normalized && !categories.models) {
        await saveModelsToTables(normalized);
        categories = normalized;
      } else if (normalized) {
        categories = normalized;
      }
    }

    return NextResponse.json({
      modelConfig: {
        configType: 'models',
        categories,
      },
    });
  } catch (error) {
    console.error('Model settings query failed:', error);
    // Log error details
    if (error.message) {
      console.error('Error details:', error.message);
      console.error('Error code:', error.code);
      console.error('에러 스택:', error.stack);
    }
    return NextResponse.json(
      { 
        error: '모델 설정을 불러오는데 실패했습니다.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// 모델 설정 업데이트
export async function PUT(request) {
  try {
    // 관리자 권한 확인
    const adminCheck = verifyAdmin(request);
    if (!adminCheck.success) {
      return adminCheck; // NextResponse 객체 반환
    }

    let categories;
    try {
      const body = await request.json();
      categories = body.categories;
    } catch (error) {
      return NextResponse.json(
        { error: '요청 본문의 JSON 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    if (!categories || typeof categories !== 'object') {
      return NextResponse.json(
        { error: 'categories 객체가 필요합니다.' },
        { status: 400 }
      );
    }

    // 카테고리 검증: 최소 하나의 카테고리는 있어야 함
    const categoryKeys = Object.keys(categories);
    if (categoryKeys.length === 0) {
      return NextResponse.json(
        { error: '최소 하나의 카테고리가 필요합니다.' },
        { status: 400 }
      );
    }

    // 각 카테고리가 올바른 구조를 가지고 있는지 확인
    for (const [key, category] of Object.entries(categories)) {
      if (!category || typeof category !== 'object') {
        return NextResponse.json(
          { error: `카테고리 '${key}'의 형식이 올바르지 않습니다.` },
          { status: 400 }
        );
      }
      if (!Array.isArray(category.models)) {
        return NextResponse.json(
          { error: `카테고리 '${key}'에 models 배열이 필요합니다.` },
          { status: 400 }
        );
      }
    }

    // 새 테이블 구조에 저장
    await saveModelsToTables(categories);

    return NextResponse.json({
      success: true,
      message: '모델 설정이 업데이트되었습니다.',
    });
  } catch (error) {
    console.error('모델 설정 업데이트 실패:', error);

    // 에러 타입에 따라 다른 메시지 제공
    let errorMessage = '모델 설정 업데이트에 실패했습니다.';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.code && error.code.startsWith('PGSQL')) {
      errorMessage = '데이터베이스 연결 오류가 발생했습니다.';
    } else if (error.name === 'TypeError') {
      errorMessage = '데이터 형식 오류가 발생했습니다.';
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
