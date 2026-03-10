import { NextResponse } from 'next/server';
import {
  getModelOptions,
  getDefaultModel,
  getEnvironment,
} from '@/lib/modelServers';
import { query } from '@/lib/postgres';
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

export async function GET(request) {
  try {
    // 새 테이블 구조에서 조회 시도
    let categories = await getModelsFromTables();

    // 새 테이블에 데이터가 없으면 기존 model_config에서 조회
    if (!categories) {
      const modelConfigResult = await query(
        'SELECT * FROM model_config WHERE config_type = $1 LIMIT 1',
        ['models']
      );
      
      const modelConfig = modelConfigResult.rows[0] || null;
      
      if (modelConfig && modelConfig.config && modelConfig.config.categories) {
        categories = modelConfig.config.categories;
        // 기존 데이터를 새 테이블로 마이그레이션
        await saveModelsToTables(categories);
      }
    }

    if (categories) {
      console.log('[/api/models] DB에서 모델 설정 로드 완료');

      const normalizedCategories = normalizeCategories(categories);
      if (normalizedCategories && !categories.models) {
        await saveModelsToTables(normalizedCategories);
        categories = normalizedCategories;
      } else if (normalizedCategories) {
        categories = normalizedCategories;
      }

      // 관리자가 아닌 경우 adminOnly 모델 필터링
      const userRole = request.headers.get('X-User-Role') || 'user';
      const isAdmin = userRole === 'admin';
      console.log(
        '[/api/models] 사용자 역할:',
        userRole,
        '관리자 여부:',
        isAdmin
      );

      // 필터링을 위한 복사본 생성
      const filteredCategories = { ...categories };
      Object.keys(filteredCategories).forEach((categoryKey) => {
        if (filteredCategories[categoryKey].models) {
          let filtered = filteredCategories[categoryKey].models.filter(
            (model) => model.visible !== false
          );
          if (!isAdmin) {
            // 일반 사용자는 adminOnly가 false인 모델만 볼 수 있음
            filtered = filtered.filter((model) => !model.adminOnly);
          }
          filteredCategories[categoryKey] = {
            ...filteredCategories[categoryKey],
            models: filtered,
          };
        }
      });

      // 모든 모델에서 기본 모델 찾기
      const allModels = Object.values(filteredCategories).flatMap(
        (category) => category.models || []
      );

      const defaultModel =
        allModels.find((m) => m.isDefault)?.id ||
        allModels[0]?.id ||
        'gemma3:1b';

      return NextResponse.json({
        modelConfig: { categories: filteredCategories }, // 필터링된 categories 구조 반환
        defaultModel,
        environment: getEnvironment(),
        success: true,
        source: 'database',
      });
    } else {
      console.log('[/api/models] DB 설정 없음, 기본 설정 사용');

      // 관리자 설정이 없으면 기본 ollama.js 구조를 categories 형태로 변환
      const ollamaModels = getModelOptions();
      const defaultModel = getDefaultModel();

      // ollama 모델들을 categories 구조로 변환
      const categories = {
        models: {
          label: '모델목록',
          models: ollamaModels,
        },
      };

      // 모델이 없으면 기본값 추가
      if (categories.models.models.length === 0) {
        categories.models.models.push({
          id: 'gemma3:1b',
          label: 'Gemma 3 1B',
          tooltip: '개발용 모델',
          isDefault: true,
        });
      }

      const normalizedFallback = normalizeCategories(categories);

      return NextResponse.json({
        modelConfig: { categories: normalizedFallback || categories },
        defaultModel,
        environment: getEnvironment(),
        success: true,
        source: 'ollama',
      });
    }
  } catch (error) {
    console.error('[/api/models] 모델 옵션 조회 실패:', error);

    // 오류 시 하드코딩된 기본 설정 반환
    const fallbackCategories = {
      models: {
        label: '모델목록',
        models: [
          {
            id: 'gemma3:1b',
            label: 'Gemma 3 1B',
            tooltip: '기본 모델',
            isDefault: true,
          },
        ],
      },
    };

    return NextResponse.json({
      modelConfig: { categories: fallbackCategories },
      defaultModel: 'gemma3:1b',
      environment: getEnvironment(),
      success: true,
      source: 'fallback',
    });
  }
}
