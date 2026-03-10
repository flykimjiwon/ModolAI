import { query, transaction } from '@/lib/postgres';
import { isValidUUID } from '@/lib/utils';

/**
 * 새 테이블 구조에서 모델 설정을 categories 형태로 조회
 */
export async function getModelsFromTables() {
  try {
    // 먼저 테이블 존재 여부 확인
    const tablesCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('model_categories', 'models', 'model_info')
    `);

    const existingTables = tablesCheck.rows.map((row) => row.table_name);

    // model_categories 또는 model_info 테이블이 없으면 null 반환
    if (
      !existingTables.includes('model_categories') &&
      !existingTables.includes('model_info')
    ) {
      console.log(
        '[modelTables] model_categories 또는 model_info 테이블이 존재하지 않습니다.'
      );
      return null;
    }

    // models 테이블이 없으면 null 반환
    if (!existingTables.includes('models')) {
      console.log('[modelTables] models 테이블이 존재하지 않습니다.');
      return null;
    }

    // 컬럼 존재 여부 확인
    const columnCheckResult = await query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'models' AND column_name IN ('endpoint', 'multi_turn_limit', 'multi_turn_unlimited', 'visible', 'pii_filter_request', 'pii_filter_response', 'pii_request_mxt_vrf', 'pii_request_mask_opt', 'pii_response_mxt_vrf', 'pii_response_mask_opt')`
    );
    const columnNames = new Set(
      columnCheckResult.rows.map((row) => row.column_name)
    );
    const hasEndpointColumn = columnNames.has('endpoint');
    const hasMultiturnColumns =
      columnNames.has('multi_turn_limit') &&
      columnNames.has('multi_turn_unlimited');
    const hasVisibleColumn = columnNames.has('visible');
    const hasPiiColumns =
      columnNames.has('pii_filter_request') &&
      columnNames.has('pii_filter_response');
    const hasPiiOptionColumns =
      columnNames.has('pii_request_mxt_vrf') &&
      columnNames.has('pii_request_mask_opt') &&
      columnNames.has('pii_response_mxt_vrf') &&
      columnNames.has('pii_response_mask_opt');

    // 카테고리 조회 (display_order 순서대로)
    // model_info와 model_categories 모두 확인 (하위 호환성)
    let categoriesResult;
    try {
      if (existingTables.includes('model_info')) {
        categoriesResult = await query(
          `SELECT id, category_key, label, display_order 
           FROM model_info 
           ORDER BY display_order ASC`
        );
      } else {
        categoriesResult = await query(
          `SELECT id, category_key, label, display_order 
           FROM model_categories 
           ORDER BY display_order ASC`
        );
      }
    } catch (error) {
      // 테이블이 존재하지만 조회 실패한 경우
      console.error('[modelTables] 카테고리 조회 실패:', error.message);
      return null;
    }

    if (categoriesResult.rows.length === 0) {
      return null;
    }

    const categories = {};

    // 각 카테고리에 대해 모델 조회
    for (const category of categoriesResult.rows) {
      // endpoint 컬럼이 있으면 포함, 없으면 제외
      const selectFields = [
        'id, model_name, label, tooltip, is_default, admin_only, system_prompt',
        hasEndpointColumn ? 'endpoint, api_config, api_key' : null,
        hasMultiturnColumns ? 'multi_turn_limit, multi_turn_unlimited' : null,
        hasVisibleColumn ? 'visible' : null,
        hasPiiColumns ? 'pii_filter_request, pii_filter_response' : null,
        hasPiiOptionColumns
          ? 'pii_request_mxt_vrf, pii_request_mask_opt, pii_response_mxt_vrf, pii_response_mask_opt'
          : null,
        'display_order',
      ]
        .filter(Boolean)
        .join(', ');

      try {
        const modelsResult = await query(
          `SELECT ${selectFields}
           FROM models 
           WHERE category_id = $1 
           ORDER BY display_order ASC`,
          [category.id]
        );

        categories[category.category_key] = {
          label: category.label,
          models: modelsResult.rows.map((model) => ({
            id: model.label || model.model_name || model.id, // label 우선, 없으면 model_name 사용
            dbId: model.id, // 저장 시 UUID 유지용
            modelName: model.model_name || model.id, // 원본 모델명 유지
            label: model.label || model.model_name || model.id, // label 필수, 없으면 model_name 사용
            tooltip: model.tooltip,
            isDefault: model.is_default,
            adminOnly: model.admin_only,
            visible: hasVisibleColumn ? (model.visible !== false) : true, // 기본값 true
            systemPrompt: model.system_prompt || [],
            endpoint: hasEndpointColumn ? model.endpoint || '' : '',
            apiConfig: hasEndpointColumn ? model.api_config || null : null,
            apiKey: hasEndpointColumn ? model.api_key || null : null,
            multiturnLimit: hasMultiturnColumns
              ? model.multi_turn_limit ?? null
              : null,
            multiturnUnlimited: hasMultiturnColumns
              ? !!model.multi_turn_unlimited
              : false,
            piiFilterRequest: hasPiiColumns ? !!model.pii_filter_request : false,
            piiFilterResponse: hasPiiColumns ? !!model.pii_filter_response : false,
            piiRequestMxtVrf: hasPiiOptionColumns
              ? model.pii_request_mxt_vrf !== false
              : true,
            piiRequestMaskOpt: hasPiiOptionColumns
              ? model.pii_request_mask_opt !== false
              : true,
            piiResponseMxtVrf: hasPiiOptionColumns
              ? model.pii_response_mxt_vrf !== false
              : true,
            piiResponseMaskOpt: hasPiiOptionColumns
              ? model.pii_response_mask_opt !== false
              : true,
          })),
        };
      } catch (error) {
        // 특정 카테고리의 모델 조회 실패 시 로깅하고 계속 진행
        console.warn(
          `[modelTables] 카테고리 ${category.category_key}의 모델 조회 실패:`,
          error.message
        );
        categories[category.category_key] = {
          label: category.label,
          models: [],
        };
      }
    }

    return categories;
  } catch (error) {
    console.error('[modelTables] 모델 조회 실패:', error);
    // 에러 상세 정보 로깅
    if (error.message) {
      console.error('[modelTables] 에러 상세:', error.message);
      console.error('[modelTables] 에러 코드:', error.code);
    }
    return null;
  }
}

/**
 * 외래 키 제약 조건을 확인하고 수정 (트랜잭션 외부에서 호출)
 */
async function fixForeignKeyConstraints() {
  try {
    // models 테이블 존재 여부 확인
    const modelsTableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'models'
      )
    `);

    if (!modelsTableCheck.rows[0].exists) {
      return; // 테이블이 없으면 제약 조건 수정 불필요
    }

    // 외래 키 제약 조건 확인
    const fkCheck = await query(`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'models'
        AND kcu.column_name = 'category_id'
    `);

    // 잘못된 외래 키 제약 조건이 있으면 삭제하고 재생성
    if (fkCheck.rows.length > 0) {
      const fk = fkCheck.rows[0];
      if (fk.foreign_table_name !== 'model_categories') {
        console.warn(
          `[modelTables] 잘못된 외래 키 제약 조건 발견: ${fk.constraint_name}, 참조 테이블: ${fk.foreign_table_name}`
        );
        // 잘못된 제약 조건 삭제 (별도 트랜잭션으로 처리)
        await query(
          `ALTER TABLE models DROP CONSTRAINT IF EXISTS ${fk.constraint_name}`
        );
        // 올바른 외래 키 제약 조건 추가
        await query(`
          ALTER TABLE models 
          ADD CONSTRAINT models_category_id_fkey 
          FOREIGN KEY (category_id) 
          REFERENCES model_categories(id) 
          ON DELETE CASCADE
        `);
        console.log('[modelTables] 외래 키 제약 조건 수정 완료');
      }
    } else {
      // 외래 키 제약 조건이 없으면 추가
      await query(`
        ALTER TABLE models 
        ADD CONSTRAINT models_category_id_fkey 
        FOREIGN KEY (category_id) 
        REFERENCES model_categories(id) 
        ON DELETE CASCADE
      `);
    }
  } catch (error) {
    // 제약 조건 확인/수정 실패 시 경고만 출력하고 계속 진행
    console.warn(
      '[modelTables] 외래 키 제약 조건 확인 실패 (무시):',
      error.message
    );
  }
}

/**
 * 필요한 테이블이 존재하는지 확인하고 없으면 생성
 */
async function ensureTablesExist(client) {
  // UUID 확장 활성화 (필요한 경우)
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } catch (error) {
    // 확장이 이미 존재하거나 권한이 없는 경우 무시
    if (!error.message.includes('already exists')) {
      console.warn(
        '[modelTables] UUID 확장 활성화 실패 (무시):',
        error.message
      );
    }
  }

  // model_categories 테이블 확인 및 생성
  const categoriesTableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'model_categories'
    )
  `);

  if (!categoriesTableCheck.rows[0].exists) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS model_categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_key VARCHAR(50) UNIQUE NOT NULL,
        label VARCHAR(255) NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // models 테이블 확인 및 생성
  const modelsTableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'models'
    )
  `);

  if (!modelsTableCheck.rows[0].exists) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS models (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        category_id UUID REFERENCES model_categories(id) ON DELETE CASCADE,
        model_name VARCHAR(255) NOT NULL,
        label VARCHAR(255) NOT NULL,
        tooltip TEXT,
        is_default BOOLEAN DEFAULT false,
        admin_only BOOLEAN DEFAULT false,
        system_prompt TEXT[],
        endpoint VARCHAR(500),
        multi_turn_limit INTEGER,
        multi_turn_unlimited BOOLEAN DEFAULT false,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  // models 테이블에 endpoint 컬럼이 없으면 추가
  const endpointColumnCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'models' AND column_name = 'endpoint'
    )
  `);

  if (!endpointColumnCheck.rows[0].exists) {
    await client.query(`
      ALTER TABLE models ADD COLUMN endpoint VARCHAR(500)
    `);
  }

  // models 테이블에 multi_turn_limit 컬럼이 없으면 추가
  const multiTurnLimitCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'models' AND column_name = 'multi_turn_limit'
    )
  `);

  if (!multiTurnLimitCheck.rows[0].exists) {
    await client.query(`
      ALTER TABLE models ADD COLUMN multi_turn_limit INTEGER
    `);
  }

  // models 테이블에 multi_turn_unlimited 컬럼이 없으면 추가
  const multiTurnUnlimitedCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'models' AND column_name = 'multi_turn_unlimited'
    )
  `);

  if (!multiTurnUnlimitedCheck.rows[0].exists) {
    await client.query(`
      ALTER TABLE models ADD COLUMN multi_turn_unlimited BOOLEAN DEFAULT false
    `);
  }
}

/**
 * 새 테이블 구조에 모델 설정 저장
 */
export async function saveModelsToTables(categories) {
  // 트랜잭션 시작 전에 외래 키 제약 조건 수정 (별도 트랜잭션으로 처리)
  await fixForeignKeyConstraints();

  return await transaction(async (client) => {
    // 트랜잭션 내에서 테이블 존재 여부 확인 및 생성
    await ensureTablesExist(client);

    // 컬럼 존재 여부 확인
    const columnCheckResult = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'models' AND column_name IN ('endpoint', 'multi_turn_limit', 'multi_turn_unlimited', 'visible', 'pii_filter_request', 'pii_filter_response', 'pii_request_mxt_vrf', 'pii_request_mask_opt', 'pii_response_mxt_vrf', 'pii_response_mask_opt')`
    );
    const columnNames = new Set(
      columnCheckResult.rows.map((row) => row.column_name)
    );
    const hasEndpointColumn = columnNames.has('endpoint');
    const hasMultiturnColumns =
      columnNames.has('multi_turn_limit') &&
      columnNames.has('multi_turn_unlimited');
    const hasVisibleColumn = columnNames.has('visible');
    const hasPiiColumns =
      columnNames.has('pii_filter_request') &&
      columnNames.has('pii_filter_response');
    const hasPiiOptionColumns =
      columnNames.has('pii_request_mxt_vrf') &&
      columnNames.has('pii_request_mask_opt') &&
      columnNames.has('pii_response_mxt_vrf') &&
      columnNames.has('pii_response_mask_opt');

    // 전달받은 카테고리 키 목록
    const providedCategoryKeys = Object.keys(categories);

    // 전달받은 모델의 dbId 목록 (나중에 삭제되지 않은 모델 확인용)
    const providedModelDbIds = new Set();

    // 카테고리별로 처리 (전체 삭제 대신 UPSERT 방식 사용)
    let categoryOrder = 0;
    for (const [categoryKey, categoryData] of Object.entries(categories)) {
      // 카테고리 삽입/업데이트 (테이블은 이미 존재함이 보장됨)
      // 트랜잭션 에러 방지를 위해 INSERT 전에 존재 여부 확인
      let categoryResult;

      // 먼저 기존 카테고리 확인
      const existingCategory = await client.query(
        `SELECT id FROM model_categories WHERE category_key = $1`,
        [categoryKey]
      );

      if (existingCategory.rows.length > 0) {
        // 기존 카테고리가 있으면 업데이트
        categoryResult = await client.query(
          `UPDATE model_categories 
           SET label = $1, display_order = $2, updated_at = $3
           WHERE category_key = $4
           RETURNING id`,
          [
            categoryData.label || categoryKey,
            categoryOrder++,
            new Date(),
            categoryKey,
          ]
        );
      } else {
        // 기존 카테고리가 없으면 삽입
        categoryResult = await client.query(
          `INSERT INTO model_categories (category_key, label, display_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            categoryKey,
            categoryData.label || categoryKey,
            categoryOrder++,
            new Date(),
            new Date(),
          ]
        );
      }

      const categoryId = categoryResult.rows[0].id;

      // 해당 카테고리의 기존 모델들 조회 (나중에 삭제되지 않은 모델 확인용)
      const existingModelsInCategory = await client.query(
        `SELECT id FROM models WHERE category_id = $1`,
        [categoryId]
      );
      const existingModelIdsInCategory = new Set(
        existingModelsInCategory.rows.map((row) => row.id)
      );

      // 모델 삽입/업데이트 (id 기반으로 처리)
      if (categoryData.models && Array.isArray(categoryData.models)) {
        let modelOrder = 0;
        for (const model of categoryData.models) {
          try {
            const actualModelName = model.modelName || model.id;
            const visibleValue = model.visible !== false;
            let persistedModelId = null;
            let effectiveDbId =
              model.dbId || (isValidUUID(model.id) ? model.id : null);
            if (!effectiveDbId && actualModelName && model.label) {
              // model_name과 label 조합으로 기존 모델 찾기 (같은 모델명, 다른 라벨은 별도 모델)
              const existingByName = await client.query(
                `SELECT id FROM models WHERE model_name = $1 AND label = $2 LIMIT 1`,
                [actualModelName, model.label]
              );
              if (existingByName.rows.length > 0) {
                effectiveDbId = existingByName.rows[0].id;
              }
            }
            // id(dbId) 기반으로 처리: dbId가 있으면 업데이트, 없으면 신규 등록
            if (effectiveDbId) {
              // dbId가 있으면 id 기반으로 업데이트
              const existingModelResult = await client.query(
                `SELECT id FROM models WHERE id = $1`,
                [effectiveDbId]
              );

              if (existingModelResult.rows.length > 0) {
                // 기존 모델이 있으면 id 기반으로 업데이트
                const modelId = existingModelResult.rows[0].id;
                providedModelDbIds.add(modelId);
                persistedModelId = modelId;

                // 업데이트 쿼리 (id 기반)
                // modelName 우선, 없으면 id 사용
                // actualModelName는 상단에서 계산
                 if (hasEndpointColumn) {
                  if (hasMultiturnColumns) {
                    if (hasVisibleColumn) {
                      if (hasPiiColumns) {
                        await client.query(
                          `UPDATE models SET
                            category_id = $1,
                            model_name = $2,
                            label = $3,
                            tooltip = $4,
                            is_default = $5,
                            admin_only = $6,
                            system_prompt = $7,
                            endpoint = $8,
                            api_config = $9,
                            api_key = $10,
                            multi_turn_limit = $11,
                            multi_turn_unlimited = $12,
                            visible = $13,
                            pii_filter_request = $14,
                            pii_filter_response = $15,
                            display_order = $16,
                            updated_at = $17
                           WHERE id = $18`,
                          [
                            categoryId,
                            actualModelName,
                            model.label,
                            model.tooltip || null,
                            model.isDefault || false,
                            model.adminOnly || false,
                            model.systemPrompt || [],
                            model.endpoint || null,
                            model.apiConfig || null,
                            model.apiKey || null,
                            model.multiturnLimit ?? null,
                            model.multiturnUnlimited || false,
                            visibleValue,
                            model.piiFilterRequest || false,
                            model.piiFilterResponse || false,
                            modelOrder++,
                            new Date(),
                            modelId,
                          ]
                        );
                      } else {
                        await client.query(
                          `UPDATE models SET
                            category_id = $1,
                            model_name = $2,
                            label = $3,
                            tooltip = $4,
                            is_default = $5,
                            admin_only = $6,
                            system_prompt = $7,
                            endpoint = $8,
                            api_config = $9,
                            api_key = $10,
                            multi_turn_limit = $11,
                            multi_turn_unlimited = $12,
                            visible = $13,
                            display_order = $14,
                            updated_at = $15
                           WHERE id = $16`,
                          [
                            categoryId,
                            actualModelName,
                            model.label,
                            model.tooltip || null,
                            model.isDefault || false,
                            model.adminOnly || false,
                            model.systemPrompt || [],
                            model.endpoint || null,
                            model.apiConfig || null,
                            model.apiKey || null,
                            model.multiturnLimit ?? null,
                            model.multiturnUnlimited || false,
                            visibleValue,
                            modelOrder++,
                            new Date(),
                            modelId,
                          ]
                        );
                      }
                    } else {
                      await client.query(
                        `UPDATE models SET
                          category_id = $1,
                          model_name = $2,
                          label = $3,
                          tooltip = $4,
                          is_default = $5,
                          admin_only = $6,
                          system_prompt = $7,
                          endpoint = $8,
                          api_config = $9,
                          api_key = $10,
                          multi_turn_limit = $11,
                          multi_turn_unlimited = $12,
                          display_order = $13,
                          updated_at = $14
                         WHERE id = $15`,
                        [
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          model.multiturnLimit ?? null,
                          model.multiturnUnlimited || false,
                          modelOrder++,
                          new Date(),
                          modelId,
                        ]
                      );
                    }
                  } else {
                    if (hasVisibleColumn) {
                      await client.query(
                        `UPDATE models SET
                          category_id = $1,
                          model_name = $2,
                          label = $3,
                          tooltip = $4,
                          is_default = $5,
                          admin_only = $6,
                          system_prompt = $7,
                          endpoint = $8,
                          api_config = $9,
                          api_key = $10,
                          visible = $11,
                          display_order = $12,
                          updated_at = $13
                         WHERE id = $14`,
                        [
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          visibleValue,
                          modelOrder++,
                          new Date(),
                          modelId,
                        ]
                      );
                    } else {
                      await client.query(
                        `UPDATE models SET
                          category_id = $1,
                          model_name = $2,
                          label = $3,
                          tooltip = $4,
                          is_default = $5,
                          admin_only = $6,
                          system_prompt = $7,
                          endpoint = $8,
                          api_config = $9,
                          api_key = $10,
                          display_order = $11,
                          updated_at = $12
                         WHERE id = $13`,
                        [
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          modelOrder++,
                          new Date(),
                          modelId,
                        ]
                      );
                    }
                  }
                } else if (hasMultiturnColumns) {
                  if (hasVisibleColumn) {
                    await client.query(
                      `UPDATE models SET
                        category_id = $1,
                        model_name = $2,
                        label = $3,
                        tooltip = $4,
                        is_default = $5,
                        admin_only = $6,
                        system_prompt = $7,
                        multi_turn_limit = $8,
                        multi_turn_unlimited = $9,
                        visible = $10,
                        display_order = $11,
                        updated_at = $12
                       WHERE id = $13`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.multiturnLimit ?? null,
                        model.multiturnUnlimited || false,
                        visibleValue,
                        modelOrder++,
                        new Date(),
                        modelId,
                      ]
                    );
                  } else {
                    await client.query(
                      `UPDATE models SET
                        category_id = $1,
                        model_name = $2,
                        label = $3,
                        tooltip = $4,
                        is_default = $5,
                        admin_only = $6,
                        system_prompt = $7,
                        multi_turn_limit = $8,
                        multi_turn_unlimited = $9,
                        display_order = $10,
                        updated_at = $11
                       WHERE id = $12`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.multiturnLimit ?? null,
                        model.multiturnUnlimited || false,
                        modelOrder++,
                        new Date(),
                        modelId,
                      ]
                    );
                  }
                } else {
                  if (hasVisibleColumn) {
                    await client.query(
                      `UPDATE models SET
                        category_id = $1,
                        model_name = $2,
                        label = $3,
                        tooltip = $4,
                        is_default = $5,
                        admin_only = $6,
                        system_prompt = $7,
                        visible = $8,
                        display_order = $9,
                        updated_at = $10
                       WHERE id = $11`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        visibleValue,
                        modelOrder++,
                        new Date(),
                        modelId,
                      ]
                    );
                  } else {
                    await client.query(
                      `UPDATE models SET
                        category_id = $1,
                        model_name = $2,
                        label = $3,
                        tooltip = $4,
                        is_default = $5,
                        admin_only = $6,
                        system_prompt = $7,
                        display_order = $8,
                        updated_at = $9
                       WHERE id = $10`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        modelOrder++,
                        new Date(),
                        modelId,
                      ]
                    );
                  }
                }
              } else {
                // dbId가 있지만 해당 id의 레코드가 없으면 신규 등록 (id 지정)
                // modelName 우선, 없으면 id 사용
                // actualModelName는 상단에서 계산
                let insertResult;
                if (hasEndpointColumn) {
                  if (hasMultiturnColumns) {
                    if (hasVisibleColumn) {
                      insertResult = await client.query(
                        `INSERT INTO models (
                          id, category_id, model_name, label, tooltip, is_default, admin_only,
                          system_prompt, endpoint, api_config, api_key, multi_turn_limit, multi_turn_unlimited,
                          visible, display_order, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                        RETURNING id`,
                        [
                          effectiveDbId,
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          model.multiturnLimit ?? null,
                          model.multiturnUnlimited || false,
                          visibleValue,
                          modelOrder++,
                          new Date(),
                          new Date(),
                        ]
                      );
                    } else {
                      insertResult = await client.query(
                        `INSERT INTO models (
                          id, category_id, model_name, label, tooltip, is_default, admin_only,
                          system_prompt, endpoint, api_config, api_key, multi_turn_limit, multi_turn_unlimited,
                          display_order, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        RETURNING id`,
                        [
                          effectiveDbId,
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          model.multiturnLimit ?? null,
                          model.multiturnUnlimited || false,
                          modelOrder++,
                          new Date(),
                          new Date(),
                        ]
                      );
                    }
                  } else {
                    if (hasVisibleColumn) {
                      insertResult = await client.query(
                        `INSERT INTO models (
                          id, category_id, model_name, label, tooltip, is_default, admin_only,
                          system_prompt, endpoint, api_config, api_key, visible,
                          display_order, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                        RETURNING id`,
                        [
                          effectiveDbId,
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          visibleValue,
                          modelOrder++,
                          new Date(),
                          new Date(),
                        ]
                      );
                    } else {
                      insertResult = await client.query(
                        `INSERT INTO models (
                          id, category_id, model_name, label, tooltip, is_default, admin_only,
                          system_prompt, endpoint, api_config, api_key, display_order, created_at, updated_at
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                        RETURNING id`,
                        [
                          effectiveDbId,
                          categoryId,
                          actualModelName,
                          model.label,
                          model.tooltip || null,
                          model.isDefault || false,
                          model.adminOnly || false,
                          model.systemPrompt || [],
                          model.endpoint || null,
                          model.apiConfig || null,
                          model.apiKey || null,
                          modelOrder++,
                          new Date(),
                          new Date(),
                        ]
                      );
                    }
                  }
                } else if (hasMultiturnColumns) {
                  if (hasVisibleColumn) {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        id, category_id, model_name, label, tooltip, is_default, admin_only, 
                        system_prompt, multi_turn_limit, multi_turn_unlimited, visible,
                        display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                      RETURNING id`,
                      [
                        effectiveDbId,
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.multiturnLimit ?? null,
                        model.multiturnUnlimited || false,
                        visibleValue,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  } else {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        id, category_id, model_name, label, tooltip, is_default, admin_only, 
                        system_prompt, multi_turn_limit, multi_turn_unlimited, display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                      RETURNING id`,
                      [
                        effectiveDbId,
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.multiturnLimit ?? null,
                        model.multiturnUnlimited || false,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  }
                } else {
                  if (hasVisibleColumn) {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        id, category_id, model_name, label, tooltip, is_default, admin_only, 
                        system_prompt, visible, display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                      RETURNING id`,
                      [
                        effectiveDbId,
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        visibleValue,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  } else {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        id, category_id, model_name, label, tooltip, is_default, admin_only, 
                        system_prompt, display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                      RETURNING id`,
                      [
                        effectiveDbId,
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  }
                }
                // 새로 삽입된 모델의 dbId 기록
                if (insertResult.rows.length > 0) {
                  providedModelDbIds.add(insertResult.rows[0].id);
                  persistedModelId = insertResult.rows[0].id;
                }

                if (persistedModelId && hasPiiColumns) {
                  await client.query(
                    `UPDATE models
                     SET pii_filter_request = $1,
                         pii_filter_response = $2
                     WHERE id = $3`,
                    [
                      model.piiFilterRequest || false,
                      model.piiFilterResponse || false,
                      persistedModelId,
                    ]
                  );
                }

                if (persistedModelId && hasPiiOptionColumns) {
                  await client.query(
                    `UPDATE models
                     SET pii_request_mxt_vrf = $1,
                         pii_request_mask_opt = $2,
                         pii_response_mxt_vrf = $3,
                         pii_response_mask_opt = $4
                     WHERE id = $5`,
                    [
                      model.piiRequestMxtVrf !== false,
                      model.piiRequestMaskOpt !== false,
                      model.piiResponseMxtVrf !== false,
                      model.piiResponseMaskOpt !== false,
                      persistedModelId,
                    ]
                  );
                }
              }
            } else {
              // dbId가 없으면 신규 등록 (id는 자동 생성)
              // modelName 우선, 없으면 id 사용
              // actualModelName는 상단에서 계산
              let insertResult;
              if (hasEndpointColumn) {
                if (hasMultiturnColumns) {
                  if (hasVisibleColumn) {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        category_id, model_name, label, tooltip, is_default, admin_only,
                        system_prompt, endpoint, api_config, api_key, multi_turn_limit, multi_turn_unlimited,
                        visible, display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                      RETURNING id`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.endpoint || null,
                        model.apiConfig || null,
                        model.apiKey || null,
                        model.multiturnLimit ?? null,
                        model.multiturnUnlimited || false,
                        visibleValue,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  } else {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        category_id, model_name, label, tooltip, is_default, admin_only,
                        system_prompt, endpoint, api_config, api_key, multi_turn_limit, multi_turn_unlimited,
                        display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                      RETURNING id`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.endpoint || null,
                        model.apiConfig || null,
                        model.apiKey || null,
                        model.multiturnLimit ?? null,
                        model.multiturnUnlimited || false,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  }
                } else {
                  if (hasVisibleColumn) {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        category_id, model_name, label, tooltip, is_default, admin_only,
                        system_prompt, endpoint, api_config, api_key, visible,
                        display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                      RETURNING id`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.endpoint || null,
                        model.apiConfig || null,
                        model.apiKey || null,
                        visibleValue,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  } else {
                    insertResult = await client.query(
                      `INSERT INTO models (
                        category_id, model_name, label, tooltip, is_default, admin_only,
                        system_prompt, endpoint, api_config, api_key, display_order, created_at, updated_at
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                      RETURNING id`,
                      [
                        categoryId,
                        actualModelName,
                        model.label,
                        model.tooltip || null,
                        model.isDefault || false,
                        model.adminOnly || false,
                        model.systemPrompt || [],
                        model.endpoint || null,
                        model.apiConfig || null,
                        model.apiKey || null,
                        modelOrder++,
                        new Date(),
                        new Date(),
                      ]
                    );
                  }
                }
              } else if (hasMultiturnColumns) {
                if (hasVisibleColumn) {
                  insertResult = await client.query(
                    `INSERT INTO models (
                      category_id, model_name, label, tooltip, is_default, admin_only, 
                      system_prompt, multi_turn_limit, multi_turn_unlimited, visible,
                      display_order, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    RETURNING id`,
                    [
                      categoryId,
                      actualModelName,
                      model.label,
                      model.tooltip || null,
                      model.isDefault || false,
                      model.adminOnly || false,
                      model.systemPrompt || [],
                      model.multiturnLimit ?? null,
                      model.multiturnUnlimited || false,
                      visibleValue,
                      modelOrder++,
                      new Date(),
                      new Date(),
                    ]
                  );
                } else {
                  insertResult = await client.query(
                    `INSERT INTO models (
                      category_id, model_name, label, tooltip, is_default, admin_only, 
                      system_prompt, multi_turn_limit, multi_turn_unlimited,
                      display_order, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING id`,
                    [
                      categoryId,
                      actualModelName,
                      model.label,
                      model.tooltip || null,
                      model.isDefault || false,
                      model.adminOnly || false,
                      model.systemPrompt || [],
                      model.multiturnLimit ?? null,
                      model.multiturnUnlimited || false,
                      modelOrder++,
                      new Date(),
                      new Date(),
                    ]
                  );
                }
              } else {
                if (hasVisibleColumn) {
                  insertResult = await client.query(
                    `INSERT INTO models (
                      category_id, model_name, label, tooltip, is_default, admin_only, 
                      system_prompt, visible, display_order, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    RETURNING id`,
                    [
                      categoryId,
                      actualModelName,
                      model.label,
                      model.tooltip || null,
                      model.isDefault || false,
                      model.adminOnly || false,
                      model.systemPrompt || [],
                      visibleValue,
                      modelOrder++,
                      new Date(),
                      new Date(),
                    ]
                  );
                } else {
                  insertResult = await client.query(
                    `INSERT INTO models (
                      category_id, model_name, label, tooltip, is_default, admin_only, 
                      system_prompt, display_order, created_at, updated_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id`,
                    [
                      categoryId,
                      actualModelName,
                      model.label,
                      model.tooltip || null,
                      model.isDefault || false,
                      model.adminOnly || false,
                      model.systemPrompt || [],
                      modelOrder++,
                      new Date(),
                      new Date(),
                    ]
                  );
                }
              }
              // 새로 삽입된 모델의 dbId 기록
              if (insertResult.rows.length > 0) {
                const insertedId = insertResult.rows[0].id;
                providedModelDbIds.add(insertedId);
                persistedModelId = insertedId;
              }

              if (persistedModelId && hasPiiColumns) {
                await client.query(
                  `UPDATE models
                   SET pii_filter_request = $1,
                       pii_filter_response = $2
                   WHERE id = $3`,
                  [
                    model.piiFilterRequest || false,
                    model.piiFilterResponse || false,
                    persistedModelId,
                  ]
                );
              }

              if (persistedModelId && hasPiiOptionColumns) {
                await client.query(
                  `UPDATE models
                   SET pii_request_mxt_vrf = $1,
                       pii_request_mask_opt = $2,
                       pii_response_mxt_vrf = $3,
                       pii_response_mask_opt = $4
                   WHERE id = $5`,
                  [
                    model.piiRequestMxtVrf !== false,
                    model.piiRequestMaskOpt !== false,
                    model.piiResponseMxtVrf !== false,
                    model.piiResponseMaskOpt !== false,
                    persistedModelId,
                  ]
                );
              }
            }
          } catch (error) {
            // 트랜잭션 내에서 에러가 발생하면 트랜잭션이 중단(aborted) 상태가 됩니다.
            // catch 블록에서 추가 쿼리를 실행하려고 하면 "current transaction is aborted" 에러가 발생합니다.
            // 따라서 에러를 즉시 throw하여 트랜잭션을 롤백해야 합니다.

            // 외래 키 제약 조건 위반 시 상세 에러 로깅
            if (error.code === '23503') {
              console.error(
                `[modelTables] 외래 키 제약 조건 위반: category_id=${categoryId}가 model_categories 테이블에 존재하지 않습니다.`
              );
              console.error(
                `[modelTables] 카테고리 키: ${categoryKey}, 모델 ID: ${model.id}`
              );
              // 트랜잭션이 이미 중단된 상태이므로 추가 쿼리 실행 불가
              // 에러를 즉시 throw하여 트랜잭션 롤백
              throw new Error(
                `카테고리 ID ${categoryId}가 존재하지 않습니다. 카테고리 삽입이 실패했을 수 있습니다. 원본 에러: ${error.message}`
              );
            }

            // 기타 에러도 즉시 throw
            throw error;
          }
        }

        // 해당 카테고리에서 전달받지 않은 모델 삭제 (전달받은 모델만 유지)
        // 전달받은 모델의 dbId와 기존 모델의 id를 비교하여 삭제
        const modelsToDelete = Array.from(existingModelIdsInCategory).filter(
          (id) => !providedModelDbIds.has(id)
        );

        if (modelsToDelete.length > 0) {
          console.log(
            `[modelTables] 카테고리 ${categoryKey}에서 ${modelsToDelete.length}개의 모델 삭제`
          );
          await client.query(`DELETE FROM models WHERE id = ANY($1::uuid[])`, [
            modelsToDelete,
          ]);
        }
      }
    }

    return { success: true };
  });
}
