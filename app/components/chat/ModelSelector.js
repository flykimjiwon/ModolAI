'use client';
import { useState, memo, useEffect } from 'react';
import { Zap, ChevronDown, Loader2 } from 'lucide-react';

// 라운드로빈 여부 확인 (같은 label + 서로 다른 endpoint)
function isRoundRobinGroup(models) {
  if (models.length <= 1) return false;

  const uniqueEndpoints = new Set(
    models.filter((m) => m.endpoint).map((m) => m.endpoint)
  );

  return uniqueEndpoints.size > 1;
}

// label별로 모델 그룹화
function groupModelsByLabel(models) {
  const grouped = new Map();

  models.forEach((model) => {
    const displayLabel = model.label || model.id;
    if (!displayLabel) return;

    const labelKey = displayLabel.trim().toLowerCase();
    if (!grouped.has(labelKey)) {
      grouped.set(labelKey, []);
    }
    grouped.get(labelKey).push({
      ...model,
      label: displayLabel,
    });
  });

  return grouped;
}

// 중복 모델 제거 (label + endpoint가 모두 같은 경우)
function removeDuplicateModels(models) {
  const uniqueModels = [];
  const seenKeys = new Set();

  models.forEach((model) => {
    const key = `${model.label || model.id}|${model.endpoint || ''}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueModels.push(model);
    }
  });

  return uniqueModels;
}

// 모델 설정 병합 (라운드로빈 모델은 1개로 통합, 일반 모델은 각각 표시)
function mergeModelConfig(modelConfig) {
  if (!modelConfig) return null;

  return Object.entries(modelConfig).reduce((acc, [categoryKey, category]) => {
    const categoryModels = [];
    const modelsByLabel = groupModelsByLabel(category.models);

    modelsByLabel.forEach((models) => {
      const uniqueModels = removeDuplicateModels(models);
      const isRoundRobin = isRoundRobinGroup(uniqueModels);

      if (isRoundRobin) {
        // 라운드로빈 모델: isDefault 우선하여 첫 번째만 추가
        const sortedModels = [...uniqueModels].sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return 0;
        });
        categoryModels.push(sortedModels[0]);
      } else {
        // 일반 모델: 중복 제거된 모델들을 모두 개별 표시
        categoryModels.push(...uniqueModels);
      }
    });

    acc[categoryKey] = {
      ...category,
      models: categoryModels,
    };
    return acc;
  }, {});
}

const ModelSelector = memo(function ModelSelector({
  selectedModel,
  setSelectedModel,
  modelConfig,
  disabled,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [roundRobinInfo, setRoundRobinInfo] = useState(null);
  const [checkingRoundRobin, setCheckingRoundRobin] = useState(false);

  // 모든 모델 수집 (id가 이미 UUID로 고유함)
  const allModels = modelConfig
    ? Object.values(modelConfig).flatMap((cat) =>
        cat.models.map((model) => {
          const label = model.label || model.modelName || model.id;
          return {
            ...model,
            label,
          };
        })
      )
    : [];

  // 라운드로빈 모델은 1개로 통합, 일반 모델은 각각 표시
  const mergedModelConfig = mergeModelConfig(modelConfig);

  // 선택된 모델 정보 찾기 (id로 찾기)
  const selectedModelInfo = allModels.find(
    (model) => model.id === selectedModel
  );

  // 라운드로빈 상태 확인
  useEffect(() => {
    if (!selectedModel || !selectedModelInfo) {
      setRoundRobinInfo(null);
      setCheckingRoundRobin(false);
      return;
    }

    const checkRoundRobin = async () => {
      setCheckingRoundRobin(true);
      try {
        // id는 UUID이므로 modelName을 사용하여 라운드로빈 확인
        const modelNameToCheck = selectedModelInfo.modelName || selectedModelInfo.id;

        const response = await fetch(
          `/api/admin/check-round-robin?modelName=${encodeURIComponent(
            modelNameToCheck
          )}`
        );
        if (response.ok) {
          const data = await response.json();
          setRoundRobinInfo(data);
        }
      } catch (error) {
        console.error('라운드로빈 상태 확인 실패:', error);
      } finally {
        setCheckingRoundRobin(false);
      }
    };

    checkRoundRobin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

  const handleModelSelect = (modelId) => {
    if (!modelId) return;

    const targetModel = allModels.find((m) => m.id === modelId);
    if (targetModel) {
      setSelectedModel(targetModel.id);
    }

    setIsOpen(false);
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  };

  const handleDropdownClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!hasInteracted) {
        setHasInteracted(true);
      }
    }
  };

  return (
    <div className='relative'>
      {/* 드롭다운 버튼 */}
      <button
        id='model-selector-button'
        data-testid='model-selector-button'
        onClick={handleDropdownClick}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-xs transition-all duration-200 ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-gray-300 dark:hover:bg-gray-600'
        }`}
      >
        <Zap size={14} className='text-blue-500' />
        <span className='hidden sm:inline text-gray-900 dark:text-gray-100'>
          {selectedModelInfo?.label || '모델 선택'}
        </span>
        {/* 라운드로빈 상태 태그 */}
        {roundRobinInfo?.isRoundRobin && (
          <span className='px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded font-medium'>
            RR {roundRobinInfo.serverCount}
          </span>
        )}
        {checkingRoundRobin && (
          <Loader2 size={12} className='animate-spin text-gray-400' />
        )}
        <ChevronDown
          size={14}
          className={`text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && !disabled && (
        <div
          id='model-selector-dropdown'
          data-testid='model-selector-dropdown'
          className='absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-64 z-100'
        >
          {mergedModelConfig &&
            Object.entries(mergedModelConfig).map(([categoryKey, category]) => (
              <div
                key={categoryKey}
                data-testid={`model-selector-category-${categoryKey}`}
                className='p-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0'
              >
                <div className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2'>
                  {category.label}
                </div>
                {category.models.map((model, index) => {
                  const isSelected = selectedModel === model.id;

                  // 같은 label을 가진 모든 모델 찾기
                  const sameLabelModels = allModels.filter(
                    (m) =>
                      m.label &&
                      m.label.trim().toLowerCase() ===
                        model.label?.trim().toLowerCase()
                  );

                  const isRoundRobin = isRoundRobinGroup(sameLabelModels);
                  const hasDefaultModel = sameLabelModels.some(
                    (m) => m.isDefault
                  );

                  return (
                    <div
                      key={`${categoryKey}-${model.id}-${index}`}
                      className='relative'
                      onMouseEnter={() =>
                        setShowTooltip(`${categoryKey}-${model.id}`)
                      }
                      onMouseLeave={() => setShowTooltip(null)}
                    >
                      <button
                        id={`model-option-${model.id}`}
                        data-testid={`model-option-${model.id}`}
                        onClick={() => handleModelSelect(model.id)}
                        className={`w-full text-left px-2 py-2 rounded text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <div className='flex items-center justify-between'>
                          <span>{model.label || model.modelName || model.id}</span>
                          <div className='flex items-center gap-1.5'>
                            {isRoundRobin && (
                              <span className='px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded font-medium'>
                                RR
                              </span>
                            )}
                            {hasDefaultModel && (
                              <span className='px-1.5 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded'>
                                기본
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* 툴팁 */}
                      {showTooltip === `${categoryKey}-${model.id}` &&
                        model.tooltip && (
                          <div className='absolute left-full top-0 ml-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded px-2 py-1 whitespace-nowrap z-60 max-w-xs'>
                            {model.tooltip}
                            <div className='absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-100'></div>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      )}

      {/* 배경 클릭 시 닫기 */}
      {isOpen && (
        <div className='fixed inset-0 z-90' onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
});

export default ModelSelector;
