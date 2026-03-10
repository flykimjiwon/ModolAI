'use client';

import { useState, useEffect, useCallback } from 'react';
import { TokenManager } from '@/lib/tokenManager';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Copy,
  GripVertical,
  Edit,
  RefreshCw,
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 툴팁 컴포넌트
const Tooltip = ({ text, children }) => (
  <div className='relative group'>
    {children}
    <div className='absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-card text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10'>
      {text}
      <div className='absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800'></div>
    </div>
  </div>
);

// 드래그 가능한 모델 아이템을 위한 컴포넌트
function SortableModelItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className='flex items-center gap-1'>
      <div
        {...attributes}
        {...listeners}
        className='cursor-grab p-4 text-muted-foreground hover:text-foreground touch-none'
      >
        <GripVertical size={18} />
      </div>
      <div className='flex-grow'>{children}</div>
    </div>
  );
}

const normalizeLabel = (label = '') => label.trim().toLowerCase();

// model_name을 기반으로 라벨 자동 생성
const generateLabelFromModelId = (modelId = '') => {
  if (!modelId) return '';

  // 콜론(:)을 기준으로 분리
  const parts = modelId.split(':');
  const name = parts[0] || '';
  const size = parts[1] || '';

  // 이름 부분을 대문자로 변환 (단어 단위로)
  const formattedName = name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-');

  // 크기 부분을 대문자로 변환
  const formattedSize = size
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // 조합
  if (formattedSize) {
    return `${formattedName} ${formattedSize}`;
  }
  return formattedName;
};

const buildLabelRoundRobinMap = (categories = {}) => {
  const labelGroups = {};

  Object.entries(categories).forEach(([categoryKey, category]) => {
    if (!category?.models || !Array.isArray(category.models)) return;

    category.models.forEach((model, modelIndex) => {
      if (!model?.label) return;
      const normalized = normalizeLabel(model.label);
      if (!normalized) return;

      if (!labelGroups[normalized]) {
        labelGroups[normalized] = {
          label: model.label.trim(),
          members: [],
        };
      }

      labelGroups[normalized].members.push({
        id: model.id,
        label: model.label,
        endpoint: model.endpoint,
        categoryKey,
        modelIndex,
      });
    });
  });

  return Object.entries(labelGroups).reduce((acc, [key, group]) => {
    const endpointSet = new Set();
    const endpoints = [];

    group.members.forEach((member) => {
      if (member.endpoint && !endpointSet.has(member.endpoint)) {
        endpointSet.add(member.endpoint);
        endpoints.push({ url: member.endpoint });
      }
    });

    acc[key] = {
      ...group,
      endpoints,
      endpointCount: endpoints.length,
      count: group.members.length,
      isRoundRobin: group.members.length > 1,
    };

    return acc;
  }, {});
};

export default function ModelsPage() {
  const { alert, confirm } = useAlert();
  const [modelConfig, setModelConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState(null); // 현재 저장 중인 섹션 추적
  const [savingCategory, setSavingCategory] = useState(null); // 현재 저장 중인 카테고리 추적
  const [errorLogs, setErrorLogs] = useState([]);
  const [errorLogsTotal, setErrorLogsTotal] = useState(0);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);
  const [errorLogsSource, setErrorLogsSource] = useState('all');
  const [errorLogsLevel, setErrorLogsLevel] = useState('all');
  const [editingModel, setEditingModel] = useState(null);
  const [showAddForm, setShowAddForm] = useState({
    category: null,
    show: false,
  });
  const [editingCategory, setEditingCategory] = useState(null);

  const [newModel, setNewModel] = useState({
    id: '',
    label: '',
    tooltip: '',
    isDefault: false,
    adminOnly: false,
    visible: true,
    modelType: 'direct',
    systemPrompt: [],
    endpoint: '',
    apiConfig: null,
    apiKey: '',
    multiturnLimit: '',
    multiturnUnlimited: true,
    piiFilterRequest: false,
    piiFilterResponse: false,
    piiRequestMxtVrf: true,
    piiRequestMaskOpt: true,
    piiResponseMxtVrf: true,
    piiResponseMaskOpt: true,
  });
  const [editForm, setEditForm] = useState({
    id: '',
    label: '',
    tooltip: '',
    isDefault: false,
    adminOnly: false,
    visible: true,
    modelType: 'direct',
    systemPrompt: [],
    endpoint: '',
    apiConfig: null,
    apiKey: '',
    multiturnLimit: '',
    multiturnUnlimited: true,
    piiFilterRequest: false,
    piiFilterResponse: false,
    piiRequestMxtVrf: true,
    piiRequestMaskOpt: true,
    piiResponseMxtVrf: true,
    piiResponseMaskOpt: true,
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [availableBaseModels, setAvailableBaseModels] = useState({});
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState('');
  const [manualPresetBaseUrl, setManualPresetBaseUrl] = useState(
    'https://api.openai.com'
  );
  const [manualPresetApiBase, setManualPresetApiBase] = useState(
    'https://api.openai.com'
  );
  const [savingPresetSettings, setSavingPresetSettings] = useState(false);
  const [roundRobinInfo, setRoundRobinInfo] = useState(null);
  const [checkingRoundRobin, setCheckingRoundRobin] = useState(false);
  const [newModelRoundRobinInfo, setNewModelRoundRobinInfo] = useState(null);
  const [checkingNewModelRoundRobin, setCheckingNewModelRoundRobin] =
    useState(false);
  const [labelRoundRobinInfo, setLabelRoundRobinInfo] = useState(null);
  const [newModelLabelRoundRobinInfo, setNewModelLabelRoundRobinInfo] =
    useState(null);
  const [modelRoundRobinMap, setModelRoundRobinMap] = useState({}); // { modelId: { isRoundRobin, serverCount, serverName, endpoints } }
  const [modelLabelRoundRobinMap, setModelLabelRoundRobinMap] = useState({}); // { normalizedLabel: { count, members, endpoints } }

  const normalizeBase = (value) =>
    typeof value === 'string' && value.trim()
      ? value.trim().replace(/\/+$/, '')
      : 'https://api.openai.com';

  const buildManualPreset = (type) => {
    const baseUrl = normalizeBase(manualPresetBaseUrl);
    const apiBase = normalizeBase(manualPresetApiBase);
    if (type === 'openai-compatible') {
      return JSON.stringify(
        {
          method: 'POST',
          url: `${apiBase}/v1/chat/completions`,
          headers: {
            Authorization: 'Bearer {{OPENAI_API_KEY}}',
            'Content-Type': 'application/json',
          },
          body: {
            model: 'gpt-4',
            messages: '{{messages}}',
            stream: true,
          },
          stream: true,
          responseMapping: {
            path: 'choices[0].message.content',
          },
        },
        null,
        2
      );
    }
    if (type === 'responses') {
      return JSON.stringify(
        {
          url: `${baseUrl}/v1/responses`,
          body: {
            input: '{{message}}',
            model: 'gpt-4',
            stream: true,
          },
          method: 'POST',
          stream: true,
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer {{OPENAI_API_KEY}}',
          },
          responseMapping: {
            path: 'output[0].content[0].text',
          },
        },
        null,
        2
      );
    }
    return '';
  };

  const normalizeMultiturnSettings = (model) => {
    const unlimited = !!model.multiturnUnlimited;
    let limitValue = model.multiturnLimit;
    if (unlimited) {
      return { multiturnLimit: null, multiturnUnlimited: true };
    }
    if (limitValue === '' || limitValue === null || limitValue === undefined) {
      return { multiturnLimit: null, multiturnUnlimited: true };
    }
    const parsed = Number.parseInt(limitValue, 10);
    return {
      multiturnLimit: Number.isNaN(parsed) ? null : parsed,
      multiturnUnlimited: false,
    };
  };

  const normalizeApiConfig = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.warn('API 설정 문자열 변환 실패:', error);
      return String(value);
    }
  };

  const normalizeJsonString = (value) => {
    if (!value) return value;
    const trimmed = value.trim();
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch (error) {
      try {
        let fixed = trimmed
          .replace(/[“”]/g, '"')
          .replace(/[‘’]/g, "'")
          .replace(/,(\s*[}\]])/g, '$1');
        if (fixed.includes("'")) {
          fixed = fixed.replace(/'([^']*)'/g, (_, inner) => {
            const escaped = inner.replace(/\\'/g, "'");
            return `"${escaped.replace(/"/g, '\\"')}"`;
          });
        }
        return JSON.stringify(JSON.parse(fixed), null, 2);
      } catch (innerError) {
        return value;
      }
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    if (modelConfig?.categories) {
      setModelLabelRoundRobinMap(
        buildLabelRoundRobinMap(modelConfig.categories)
      );
    } else {
      setModelLabelRoundRobinMap({});
    }
  }, [modelConfig]);

  // 수정 폼의 모델명에 대한 라운드로빈 상태 확인
  useEffect(() => {
    if (!editForm.id) {
      setRoundRobinInfo(null);
      return;
    }

    const checkRoundRobin = async () => {
      setCheckingRoundRobin(true);
      try {
        const response = await fetch(
          `/api/admin/check-round-robin?modelName=${encodeURIComponent(
            editForm.id
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
  }, [editForm.id]);

  // 추가 폼의 모델명에 대한 라운드로빈 상태 확인
  useEffect(() => {
    if (!newModel.id) {
      setNewModelRoundRobinInfo(null);
      return;
    }

    const checkRoundRobin = async () => {
      setCheckingNewModelRoundRobin(true);
      try {
        const response = await fetch(
          `/api/admin/check-round-robin?modelName=${encodeURIComponent(
            newModel.id
          )}`
        );
        if (response.ok) {
          const data = await response.json();
          setNewModelRoundRobinInfo(data);
        }
      } catch (error) {
        console.error('라운드로빈 상태 확인 실패:', error);
      } finally {
        setCheckingNewModelRoundRobin(false);
      }
    };

    checkRoundRobin();
  }, [newModel.id]);

  // 수정 폼의 표시 이름에 대한 라운드로빈 상태 확인
  useEffect(() => {
    if (!editForm.label || !modelConfig) {
      setLabelRoundRobinInfo(null);
      return;
    }

    const normalizedLabel = normalizeLabel(editForm.label);
    if (!normalizedLabel) {
      setLabelRoundRobinInfo(null);
      return;
    }

    const sameLabelModels = [];
    Object.entries(modelConfig.categories).forEach(
      ([categoryKey, category]) => {
        if (!category?.models || !Array.isArray(category.models)) return;

        category.models.forEach((model, index) => {
          if (
            model.label &&
            normalizeLabel(model.label) === normalizedLabel &&
            (!editingModel ||
              categoryKey !== editingModel.category ||
              index !== editingModel.index)
          ) {
            sameLabelModels.push({
              id: model.id,
              endpoint: model.endpoint,
              categoryKey,
              modelIndex: index,
            });
          }
        });
      }
    );

    if (sameLabelModels.length > 0) {
      const endpointSet = new Set();
      const endpoints = [];
      const addEndpoint = (url) => {
        if (url && !endpointSet.has(url)) {
          endpointSet.add(url);
          endpoints.push({ url });
        }
      };

      sameLabelModels.forEach((m) => addEndpoint(m.endpoint));
      addEndpoint(editForm.endpoint);

      setLabelRoundRobinInfo({
        isRoundRobin: true,
        count: sameLabelModels.length + 1,
        models: sameLabelModels,
        endpoints,
        endpointCount: endpoints.length,
      });
    } else {
      setLabelRoundRobinInfo(null);
    }
  }, [editForm.label, editForm.endpoint, modelConfig, editingModel]);

  // 추가 폼의 표시 이름에 대한 라운드로빈 상태 확인
  useEffect(() => {
    if (!newModel.label || !modelConfig) {
      setNewModelLabelRoundRobinInfo(null);
      return;
    }

    const normalizedNewLabel = normalizeLabel(newModel.label);
    if (!normalizedNewLabel) {
      setNewModelLabelRoundRobinInfo(null);
      return;
    }

    // 모든 카테고리에서 동일한 표시 이름을 가진 모델 찾기
    const allModels = [];
    Object.values(modelConfig.categories).forEach((category) => {
      if (category.models && Array.isArray(category.models)) {
        allModels.push(...category.models);
      }
    });

    const sameLabelModels = allModels.filter(
      (m) => m.label && normalizeLabel(m.label) === normalizedNewLabel
    );

    if (sameLabelModels.length > 0) {
      // 동일한 표시 이름을 가진 모든 모델 (현재 추가 중인 모델 포함)
      const allSameLabelModels = [
        ...sameLabelModels,
        { id: newModel.id, endpoint: newModel.endpoint },
      ];

      // endpoint 정보 수집 (중복 제거)
      const endpointSet = new Set();
      const endpoints = [];
      allSameLabelModels.forEach((m) => {
        if (m.endpoint && !endpointSet.has(m.endpoint)) {
          endpointSet.add(m.endpoint);
          endpoints.push({ url: m.endpoint });
        }
      });

      setNewModelLabelRoundRobinInfo({
        isRoundRobin: true,
        count: sameLabelModels.length + 1, // 현재 추가 중인 모델 포함
        models: sameLabelModels,
        endpoints: endpoints,
        endpointCount: endpoints.length,
      });
    } else {
      setNewModelLabelRoundRobinInfo(null);
    }
  }, [newModel.label, newModel.id, newModel.endpoint, modelConfig]);

  // 새 모델이 라운드로빈 그룹에 속하는 경우 첫 번째 모델의 시스템 프롬프트 자동 설정
  useEffect(() => {
    if (!newModel.label || !modelConfig) return;

    const normalizedLabel = normalizeLabel(newModel.label);
    const group = normalizedLabel
      ? modelLabelRoundRobinMap[normalizedLabel]
      : null;

    if (group?.isRoundRobin && group.members.length > 0) {
      // 첫 번째 모델 찾기 (정렬된 순서)
      const sortedMembers = [...group.members].sort((a, b) => {
        if (a.categoryKey !== b.categoryKey) {
          return a.categoryKey.localeCompare(b.categoryKey);
        }
        return a.modelIndex - b.modelIndex;
      });

      const firstMember = sortedMembers[0];
      const firstModel =
        modelConfig.categories[firstMember.categoryKey]?.models[
          firstMember.modelIndex
        ];

      if (firstModel?.systemPrompt && firstModel.systemPrompt.length > 0) {
        // 첫 번째 모델의 시스템 프롬프트가 있고, 현재 새 모델의 시스템 프롬프트가 비어있거나 다르면 동기화
        const currentPrompt = newModel.systemPrompt || [];
        const firstPrompt = firstModel.systemPrompt || [];

        if (
          currentPrompt.length === 0 ||
          JSON.stringify(currentPrompt) !== JSON.stringify(firstPrompt)
        ) {
          setNewModel((prev) => ({
            ...prev,
            systemPrompt: [...firstPrompt, ...currentPrompt],
          }));
        }
      }
    }
  }, [
    newModel.id,
    newModel.label,
    newModel.systemPrompt,
    modelConfig,
    modelLabelRoundRobinMap,
  ]);

  const fetchEndpointsFromSettings = useCallback(async () => {
    try {
      const res = await TokenManager.safeFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setManualPresetBaseUrl(
          data.manualPresetBaseUrl || 'https://api.openai.com'
        );
        setManualPresetApiBase(
          data.manualPresetApiBase || 'https://api.openai.com'
        );
        const list = Array.isArray(data.customEndpoints)
          ? data.customEndpoints
              // 비활성화된 모델서버 필터링 (isActive가 false인 경우 제외)
              .filter((e) => e.isActive !== false)
              .map((e) => ({
                name: e.name || '',
                url: e.url,
                provider:
                  e.provider === 'openai-compatible'
                    ? 'openai-compatible'
                    : e.provider === 'gemini'
                    ? 'gemini'
                    : 'ollama',
              }))
          : (data.ollamaEndpoints || '')
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean)
              .map((entry) => {
                const m = entry.match(/^(.*?)\s*[|=｜＝]\s*(https?:\/\/.+)$/i);
                if (m) {
                  return {
                    name: m[1].trim(),
                    url: m[2].trim(),
                    provider: 'ollama',
                  };
                }
                return { name: '', url: entry, provider: 'ollama' };
              });
        setEndpoints(list);
        if (list.length > 0) {
          // 현재 선택된 endpoint가 비활성화되어 제거된 경우, 첫 번째 활성화된 endpoint로 변경
          const currentEndpointExists = list.some(
            (e) => e.url === selectedEndpoint
          );
          if (!currentEndpointExists) {
            setSelectedEndpoint(list[0].url);
          }
        } else {
          // 활성화된 endpoint가 없으면 선택 해제
          setSelectedEndpoint('');
        }
      }
    } catch (e) {
      console.warn('모델서버 목록 조회 실패(무시):', e.message);
    }
  }, [selectedEndpoint]);

  const saveManualPresetSettings = async () => {
    try {
      setSavingPresetSettings(true);
      const res = await TokenManager.safeFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualPresetBaseUrl,
          manualPresetApiBase,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || '설정 저장에 실패했습니다.');
      }
      alert('프리셋 URL 설정이 저장되었습니다.', 'success', '저장 완료');
    } catch (error) {
      alert(
        error.message || '프리셋 URL 설정 저장에 실패했습니다.',
        'error',
        '저장 실패'
      );
    } finally {
      setSavingPresetSettings(false);
    }
  };

  const fetchModelConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await TokenManager.safeFetch('/api/admin/models');

      // response 객체 유효성 검사
      if (!response) {
        const errorMsg = '응답 객체를 받지 못했습니다.';
        console.error('모델 설정 조회 실패:', {
          error: errorMsg,
          responseType: typeof response,
          responseValue: response,
        });
        throw new Error(errorMsg);
      }

      if (response.status === 401) {
        alert('인증이 만료되었습니다.', 'warning', '인증 오류');
        return;
      }

      if (!response.ok) {
        // 응답 상태 정보를 미리 저장 (response.text() 호출 전)
        // response 객체의 속성에 직접 접근하여 값이 확실히 설정되도록 함
        const status = response.status;
        const statusText = response.statusText;

        // 에러 응답 본문 읽기
        let errorMessage = '모델 설정을 불러오는데 실패했습니다.';
        let responseText = '';

        try {
          responseText = await response.text();
          if (responseText && responseText.trim()) {
            try {
              const errorData = JSON.parse(responseText);
              errorMessage =
                errorData.error || errorData.details || errorMessage;
            } catch (parseError) {
              // JSON 파싱 실패 시 텍스트 그대로 사용
              errorMessage = responseText.substring(0, 200) || errorMessage;
            }
          }
        } catch (textError) {
          // 응답 본문 읽기 실패 시 기본 메시지 사용
          console.warn('응답 본문 읽기 실패:', textError);
        }

        // 상세한 에러 정보 로깅 (모든 값이 확실히 설정되도록)
        // 각 값이 null이거나 undefined인 경우 명시적인 기본값 사용
        const errorInfo = {
          status: status ?? 'unknown',
          statusText: statusText ?? 'unknown',
          errorMessage: errorMessage || '에러 메시지를 가져올 수 없습니다.',
          url: '/api/admin/models',
          responseTextLength: responseText ? responseText.length : 0,
        };

        // 디버깅을 위한 상세 로그 (객체를 직접 출력하여 모든 속성 확인)
        console.error('모델 설정 조회 실패:', {
          status: String(errorInfo.status),
          statusText: String(errorInfo.statusText),
          errorMessage: String(errorInfo.errorMessage),
          url: String(errorInfo.url),
          responseTextLength: Number(errorInfo.responseTextLength),
        });
        throw new Error(errorMessage);
      }
      const data = await response.json();
      setModelConfig(data.modelConfig);

      // 모든 모델의 라운드로빈 정보 확인
      if (data.modelConfig && data.modelConfig.categories) {
        const allModels = [];
        Object.values(data.modelConfig.categories).forEach((category) => {
          if (category.models && Array.isArray(category.models)) {
            allModels.push(...category.models);
          }
        });

        // 모델명 기반 라운드로빈 확인
        const roundRobinPromises = allModels.map(async (model) => {
          try {
            const rrResponse = await fetch(
              `/api/admin/check-round-robin?modelName=${encodeURIComponent(
                model.id
              )}`
            );
            if (rrResponse.ok) {
              const rrData = await rrResponse.json();
              return { modelId: model.id, data: rrData };
            }
          } catch (error) {
            console.error(`모델 ${model.id} 라운드로빈 확인 실패:`, error);
          }
          return { modelId: model.id, data: null };
        });

        const roundRobinResults = await Promise.all(roundRobinPromises);
        const roundRobinMap = {};
        roundRobinResults.forEach(({ modelId, data }) => {
          if (data) {
            roundRobinMap[modelId] = data;
          }
        });
        setModelRoundRobinMap(roundRobinMap);
      }
    } catch (error) {
      console.error('모델 설정 로드 실패:', error);
      alert(error.message, 'error', '로드 실패');
    } finally {
      setLoading(false);
    }
  }, [alert]);

  // LLM 모델 목록 가져오기
  const fetchAvailableModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      const ep = selectedEndpoint;

      // endpoint가 없거나 빈 문자열이면 요청하지 않음
      if (!ep || !ep.trim()) {
        console.warn('endpoint가 선택되지 않았습니다.');
        setAvailableModels([]);
        return;
      }

      if (ep === 'manual') {
        setAvailableModels([]);
        return;
      }

      // endpoint가 유효하지 않으면 요청하지 않음
      if (!ep.startsWith('http://') && !ep.startsWith('https://')) {
        console.warn('유효하지 않은 endpoint:', ep);
        setAvailableModels([]);
        return;
      }

      // URL 정규화 함수 (trailing slash 제거, 소문자 변환)
      const normalizeUrl = (url) => {
        try {
          const urlObj = new URL(url.trim());
          return `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${
            urlObj.port ? `:${urlObj.port}` : ''
          }${urlObj.pathname.replace(/\/+$/, '')}`;
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          return url.trim().toLowerCase().replace(/\/+$/, '');
        }
      };

      const normalizedEp = normalizeUrl(ep);
      const endpointConfig = endpoints.find(
        (e) => normalizeUrl(e.url) === normalizedEp
      );
      const provider =
        endpointConfig?.provider === 'openai-compatible'
          ? 'openai-compatible'
          : endpointConfig?.provider === 'gemini'
          ? 'gemini'
          : 'ollama';

      // Ollama가 아닌 경우 모델 목록 조회하지 않음
      if (provider !== 'ollama' && provider !== 'model-server') {
        console.log(`${provider} provider는 모델 목록 조회를 하지 않습니다.`);
        setAvailableModels([]);
        return;
      }

      const url = `/api/model-servers/models?endpoint=${encodeURIComponent(
        ep
      )}&provider=${provider}`;
      const response = await TokenManager.safeFetch(url);

      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
      } else {
        // 에러 응답 본문 읽기
        let errorMessage = '모델 목록 조회 실패';
        let errorType = null;
        let errorDetails = null;

        try {
          // 응답 본문을 텍스트로 먼저 읽기
          const responseText = await response.text();

          if (responseText) {
            try {
              // JSON 파싱 시도
              const errorData = JSON.parse(responseText);
              errorMessage =
                errorData.error || errorData.message || errorMessage;
              errorType = errorData.errorType;
              errorDetails = errorData.details;
            } catch (parseError) {
              // JSON 파싱 실패 시 텍스트를 그대로 사용 (최대 200자)
              errorMessage = responseText.substring(0, 200) || errorMessage;
            }
          }
        } catch (readError) {
          // 응답 본문 읽기 실패 시 기본 메시지 사용
          console.warn('에러 응답 본문 읽기 실패:', readError);
        }

        console.error('모델 목록 조회 실패:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage,
          errorType,
          errorDetails,
        });

        setAvailableModels([]);

        // 400 또는 500 에러인 경우 사용자에게 알림 표시
        if (response.status === 400 || response.status === 500) {
          const alertType = response.status === 400 ? 'warning' : 'error';
          // 에러 타입에 따라 더 구체적인 메시지 제공
          let displayMessage = errorMessage;
          if (errorType === 'connection') {
            displayMessage =
              errorMessage ||
              '모델 서버에 연결할 수 없습니다. 모델 서버 주소와 포트를 확인하세요.';
          } else if (errorType === 'timeout') {
            displayMessage =
              errorMessage ||
              '모델 서버 연결 타임아웃입니다. 모델 서버가 실행 중인지 확인하세요.';
          } else if (errorType === 'http_error') {
            displayMessage =
              errorMessage || '모델 서버에서 오류가 발생했습니다.';
          }

          alert(
            displayMessage ||
              '모델서버 설정이 올바르지 않습니다. 설정 페이지에서 확인해주세요.',
            alertType,
            '모델 목록 조회 실패'
          );
        }
      }
    } catch (error) {
      console.error('모델 목록 조회 실패:', error);
      setAvailableModels([]);
      alert('모델 목록을 불러오는 중 오류가 발생했습니다.', 'error', '오류');
    } finally {
      setModelsLoading(false);
    }
  }, [selectedEndpoint, endpoints, alert]);

  const fetchErrorLogs = async (override = {}) => {
    try {
      setErrorLogsLoading(true);
      const token = localStorage.getItem('token');
      const source = override.source ?? errorLogsSource;
      const level = override.level ?? errorLogsLevel;
      const params = new URLSearchParams();
      if (source && source !== 'all') params.set('source', source);
      if (level && level !== 'all') params.set('level', level);
      params.set('limit', '50');
      const response = await fetch(
        `/api/admin/error-logs?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) return;
      const data = await response.json();
      setErrorLogs(data.logs || []);
      setErrorLogsTotal(data.total || 0);
    } catch (error) {
      console.warn('오류 로그 조회 실패:', error);
    } finally {
      setErrorLogsLoading(false);
    }
  };

  const formatLogTime = (value) => {
    try {
      return new Date(value).toLocaleString('ko-KR');
    } catch (error) {
      return value || '-';
    }
  };

  // 모델서버 변경 시 모델 목록 재조회
  useEffect(() => {
    // selectedEndpoint가 있고 유효한 URL인 경우에만 조회
    if (
      selectedEndpoint &&
      selectedEndpoint.trim() &&
      selectedEndpoint !== 'manual' &&
      (selectedEndpoint.startsWith('http://') ||
        selectedEndpoint.startsWith('https://'))
    ) {
      fetchAvailableModels();
    } else {
      // endpoint가 없거나 유효하지 않으면 빈 배열로 설정
      setAvailableModels([]);
    }
  }, [selectedEndpoint, fetchAvailableModels]);

  // 초기 데이터 로드
  useEffect(() => {
    fetchModelConfig();
    fetchEndpointsFromSettings();
    fetchErrorLogs();
  }, [
    fetchModelConfig,
    fetchEndpointsFromSettings,
  ]);

  useEffect(() => {
    fetchErrorLogs();
  }, [errorLogsSource, errorLogsLevel]);

  // 모델서버 목록 로드 후 기본값 자동 설정
  useEffect(() => {
    if (endpoints.length > 0) {
      setNewModel((m) =>
        m.endpoint ? m : { ...m, endpoint: endpoints[0].url }
      );
      if (editingModel) {
        setEditForm((f) =>
          f.endpoint ? f : { ...f, endpoint: endpoints[0].url }
        );
      }
    }
  }, [endpoints, editingModel, editForm.endpoint]);

  // 모델 추가 폼이 펼쳐질 때 기본값만 설정 (모델 목록은 셀렉트박스 클릭 시 로드)
  useEffect(() => {
    if (showAddForm.show && showAddForm.category && endpoints.length > 0) {
      // 첫 번째 엔드포인트를 기본값으로 설정
      const defaultEndpoint = endpoints[0].url;

      // newModel의 endpoint가 없으면 기본값으로 설정
      setNewModel((m) => {
        if (!m.endpoint) {
          return { ...m, endpoint: defaultEndpoint };
        }
        return m;
      });

      // selectedEndpoint만 설정 (모델 목록은 자동으로 로드하지 않음)
      if (!selectedEndpoint) {
        setSelectedEndpoint(defaultEndpoint);
      }
    }
  }, [showAddForm.show, showAddForm.category, endpoints, selectedEndpoint]);

  // 모델명 셀렉트박스 클릭 시 모델 목록 로드 (추가 폼용)
  const handleModelSelectFocus = () => {
    if (
      newModel.endpoint &&
      (!selectedEndpoint || selectedEndpoint !== newModel.endpoint)
    ) {
      setSelectedEndpoint(newModel.endpoint);
      // selectedEndpoint 변경 시 자동으로 fetchAvailableModels가 호출됨
    } else if (selectedEndpoint && availableModels.length === 0) {
      // 모델 목록이 없으면 로드
      fetchAvailableModels();
    }
  };

  // 모델명 셀렉트박스 클릭 시 모델 목록 로드 (편집 폼용)
  const handleEditModelSelectFocus = () => {
    if (
      editForm.endpoint === 'manual' ||
      editForm.endpoint &&
      (!selectedEndpoint || selectedEndpoint !== editForm.endpoint)
    ) {
      setSelectedEndpoint(editForm.endpoint);
      // selectedEndpoint 변경 시 자동으로 fetchAvailableModels가 호출됨
    } else if (selectedEndpoint && availableModels.length === 0) {
      // 모델 목록이 없으면 로드
      fetchAvailableModels();
    }
  };

  // LLM 모델 카테고리 저장
  const saveLLMModels = async () => {
    try {
      setSavingSection('llm');
      const response = await TokenManager.safeFetch('/api/admin/models', {
        method: 'PUT',
        body: JSON.stringify({ categories: modelConfig.categories }),
      });

      if (!response.ok) {
        let errorMessage = '모델 설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        console.error('모델 설정 저장 실패:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(
        data.message || 'LLM 모델 설정이 저장되었습니다.',
        'success',
        '저장 완료'
      );
    } catch (error) {
      console.error('모델 설정 저장 실패:', error);
      alert(
        error.message || '모델 설정 저장 중 오류가 발생했습니다.',
        'error',
        '저장 실패'
      );
    } finally {
      setSavingSection(null);
    }
  };

  // 특정 카테고리 모델 순서 저장
  const saveCategoryOrder = async (categoryKey) => {
    try {
      setSavingCategory(categoryKey);
      const response = await TokenManager.safeFetch('/api/admin/models', {
        method: 'PUT',
        body: JSON.stringify({ categories: modelConfig.categories }),
      });

      if (!response.ok) {
        let errorMessage = '모델 순서 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        console.error('모델 순서 저장 실패:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(
        `${modelConfig.categories[categoryKey].label} 모델 순서가 저장되었습니다.`,
        'success',
        '저장 완료'
      );
    } catch (error) {
      console.error('모델 순서 저장 실패:', error);
      alert(
        error.message || '모델 순서 저장 중 오류가 발생했습니다.',
        'error',
        '저장 실패'
      );
    } finally {
      setSavingCategory(null);
    }
  };

  const saveModelConfig = async () => {
    try {
      setSaving(true);
      const response = await TokenManager.safeFetch('/api/admin/models', {
        method: 'PUT',
        body: JSON.stringify({ categories: modelConfig.categories }),
      });

      if (!response.ok) {
        // 에러 응답 본문 읽기
        let errorMessage = '모델 설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        console.error('모델 설정 저장 실패:', response.status, errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      alert(
        data.message || '전체 모델 설정이 저장되었습니다.',
        'success',
        '저장 완료'
      );
    } catch (error) {
      console.error('모델 설정 저장 실패:', error);
      alert(
        error.message || '모델 설정 저장 중 오류가 발생했습니다.',
        'error',
        '저장 실패'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryLabelChange = (categoryKey, newLabel) => {
    setModelConfig((config) => ({
      ...config,
      categories: {
        ...config.categories,
        [categoryKey]: { ...config.categories[categoryKey], label: newLabel },
      },
    }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCategoryKey = active.data.current.sortable.containerId;
    const overCategoryKey = over.data.current.sortable.containerId;

    if (activeCategoryKey !== overCategoryKey) return;

    setModelConfig((config) => {
      const newConfig = { ...config };
      const items = newConfig.categories[activeCategoryKey].models;
      const oldIndex = active.data.current.sortable.index;
      const newIndex = over.data.current.sortable.index;
      newConfig.categories[activeCategoryKey].models = arrayMove(
        items,
        oldIndex,
        newIndex
      );
      return newConfig;
    });
  };

  const addModel = (category) => {
    if (!newModel.id) {
      alert('모델명을 입력해주세요.', 'warning', '입력 오류');
      return;
    }

    // 라벨이 비어있으면 model_name을 기반으로 자동 생성
    const label =
      newModel.label?.trim() || generateLabelFromModelId(newModel.id);
    if (!label) {
      alert('모델명을 입력해주세요.', 'warning', '입력 오류');
      return;
    }
    if (!newModel.endpoint) {
      alert('모델서버를 선택해주세요.', 'warning', '선택 오류');
      return;
    }
    const updatedConfig = { ...modelConfig };
    if (newModel.isDefault) {
      updatedConfig.categories[category].models.forEach((model) => {
        model.isDefault = false;
      });
    }

    // 시스템 프롬프트 결정
    let systemPrompt = newModel.systemPrompt || [];

    // 라운드로빈 그룹 확인
    const normalizedLabel = normalizeLabel(label);
    const group = normalizedLabel
      ? modelLabelRoundRobinMap[normalizedLabel]
      : null;

    if (group?.isRoundRobin && group.members.length > 0) {
      // 라운드로빈 그룹에 속하는 경우 첫 번째 모델의 시스템 프롬프트 사용
      const sortedMembers = [...group.members].sort((a, b) => {
        if (a.categoryKey !== b.categoryKey) {
          return a.categoryKey.localeCompare(b.categoryKey);
        }
        return a.modelIndex - b.modelIndex;
      });

      const firstMember = sortedMembers[0];
      const firstModel =
        updatedConfig.categories[firstMember.categoryKey]?.models[
          firstMember.modelIndex
        ];

      if (firstModel?.systemPrompt && firstModel.systemPrompt.length > 0) {
        systemPrompt = [...firstModel.systemPrompt];
      }
    }

    const newModelIndex = updatedConfig.categories[category].models.length;
    // 새 모델 추가 시 dbId는 포함하지 않음 (데이터베이스에서 자동 생성)
    const multiturnSettings = normalizeMultiturnSettings(newModel);
    const modelToAdd = {
      ...newModel,
      id: newModel.id.trim(),
      modelName: newModel.modelName || newModel.id.trim(), // modelName 명시적 저장
      label: label.trim(),
      tooltip: newModel.tooltip.trim(),
      systemPrompt: systemPrompt,
      endpoint: newModel.endpoint || '',
      apiConfig: newModel.apiConfig || null, // API 설정 저장
      apiKey: newModel.apiKey || null, // API 키 저장
      ...multiturnSettings,
    };
    // dbId가 있으면 제거 (새 모델이므로)
    delete modelToAdd.dbId;
    updatedConfig.categories[category].models.push(modelToAdd);

    // 새로 추가된 모델이 라운드로빈 그룹의 첫 번째 모델인 경우, 같은 라벨을 가진 다른 모델들에도 시스템 프롬프트 동기화
    if (group?.isRoundRobin && systemPrompt.length > 0) {
      // 모든 멤버에 동일한 시스템 프롬프트 적용
      group.members.forEach((member) => {
        if (
          updatedConfig.categories[member.categoryKey]?.models[
            member.modelIndex
          ]
        ) {
          updatedConfig.categories[member.categoryKey].models[
            member.modelIndex
          ] = {
            ...updatedConfig.categories[member.categoryKey].models[
              member.modelIndex
            ],
            systemPrompt: [...systemPrompt],
          };
        }
      });
    }

    setModelConfig(updatedConfig);
    setShowAddForm({ category: null, show: false });
    setNewModel({
      id: '',
      label: '',
      tooltip: '',
      isDefault: false,
      adminOnly: false,
      visible: true,
      systemPrompt: [],
      endpoint: endpoints[0]?.url ? endpoints[0].url : '',
      apiConfig: null,
      apiKey: '',
      multiturnLimit: '',
      multiturnUnlimited: true,
      piiFilterRequest: false,
      piiFilterResponse: false,
      piiRequestMxtVrf: true,
      piiRequestMaskOpt: true,
      piiResponseMxtVrf: true,
      piiResponseMaskOpt: true,
    });

    // 모델 추가 후 자동 저장
    setTimeout(async () => {
      try {
        setSavingSection('llm');
        const response = await TokenManager.safeFetch('/api/admin/models', {
          method: 'PUT',
          body: JSON.stringify({ categories: updatedConfig.categories }),
        });

        if (!response.ok) {
          let errorMessage = '모델 설정 저장에 실패했습니다.';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
          console.error('모델 설정 저장 실패:', response.status, errorMessage);
          alert(errorMessage, 'error', '저장 실패');
        } else {
          const data = await response.json();
          alert(
            data.message || '모델이 추가되고 저장되었습니다.',
            'success',
            '저장 완료'
          );
        }
      } catch (error) {
        console.error('모델 설정 저장 실패:', error);
        alert(
          error.message || '모델 설정 저장 중 오류가 발생했습니다.',
          'error',
          '저장 실패'
        );
      } finally {
        setSavingSection(null);
      }
    }, 100);
  };

  const startEditing = (category, modelIndex) => {
    const model = modelConfig.categories[category].models[modelIndex];

    setEditForm({
      ...model,
      dbId: model.dbId || undefined, // 데이터베이스 ID 유지
      id: model.id || '',
      label: model.label || '',
      tooltip: model.tooltip || '',
      adminOnly: model.adminOnly || false,
      visible: model.visible !== false,
      systemPrompt: model.systemPrompt || [],
      endpoint: model.endpoint || (endpoints[0]?.url ? endpoints[0].url : ''),
      apiConfig: normalizeApiConfig(model.apiConfig), // API 설정 로드
      apiKey: model.apiKey || '', // 저장된 키 표시
      multiturnLimit:
        model.multiturnLimit !== undefined && model.multiturnLimit !== null
          ? model.multiturnLimit
          : '',
      multiturnUnlimited:
        model.multiturnUnlimited === true ||
        model.multiturnLimit === undefined ||
        model.multiturnLimit === null ||
        model.multiturnLimit === '',
      piiFilterRequest: model.piiFilterRequest === true,
      piiFilterResponse: model.piiFilterResponse === true,
      piiRequestMxtVrf: model.piiRequestMxtVrf !== false,
      piiRequestMaskOpt: model.piiRequestMaskOpt !== false,
      piiResponseMxtVrf: model.piiResponseMxtVrf !== false,
      piiResponseMaskOpt: model.piiResponseMaskOpt !== false,
    });
    setEditingModel({ category, index: modelIndex });
  };

  const saveEdit = async () => {
    if (!editForm.id) {
      alert('모델명을 입력해주세요.', 'warning', '입력 오류');
      return;
    }

    // 라벨이 비어있으면 model_name을 기반으로 자동 생성
    const label =
      editForm.label?.trim() || generateLabelFromModelId(editForm.id);
    if (!label) {
      alert('모델명을 입력해주세요.', 'warning', '입력 오류');
      return;
    }
    if (!editForm.endpoint) {
      alert('모델서버를 선택해주세요.', 'warning', '선택 오류');
      return;
    }
    const updatedConfig = { ...modelConfig };
    const { category, index } = editingModel;

    // label 변경 감지 및 settings 확인
    const originalModel = updatedConfig.categories[category].models[index];
    const originalLabel = originalModel.label;
    const isLabelChanged = originalLabel !== label;

    if (isLabelChanged) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const settings = await response.json();
          const roomNameModel = settings.roomNameGenerationModel;
          const imageModel = settings.imageAnalysisModel;

          if (roomNameModel === originalLabel || imageModel === originalLabel) {
            const usageInfo = [];
            if (roomNameModel === originalLabel) usageInfo.push('대화방명 생성');
            if (imageModel === originalLabel) usageInfo.push('이미지 분석');

            const confirmChange = await confirm(
              `이 모델의 라벨은 현재 "${usageInfo.join(', ')}"에 사용 중입니다.\n\n라벨을 변경하면 해당 기능에서 이 모델을 찾지 못할 수 있습니다.\n\n그래도 변경하시겠습니까?`,
              '라벨 변경 경고'
            );
            if (!confirmChange) return;
          }
        }
      } catch (error) {
        console.error('설정 확인 중 오류:', error);
      }
    }
    if (editForm.isDefault) {
      updatedConfig.categories[category].models.forEach((model, idx) => {
        if (idx !== index) model.isDefault = false;
      });
    }

    // 현재 모델의 시스템 프롬프트
    const systemPrompt = editForm.systemPrompt || [];

    // 라운드로빈 그룹 확인
    const normalizedLabel = normalizeLabel(label);
    const group = normalizedLabel
      ? modelLabelRoundRobinMap[normalizedLabel]
      : null;

    // 현재 모델이 라운드로빈 그룹의 첫 번째 모델인지 확인
    const firstModelInfo = getFirstModelInRoundRobinGroup(
      label,
      category,
      index
    );
    const isFirstInRoundRobin = firstModelInfo === null && group?.isRoundRobin;

    // 첫 번째 모델이면 같은 라벨을 가진 모든 모델에 시스템 프롬프트 공유
    if (isFirstInRoundRobin && group?.members) {
      // 같은 라벨을 가진 모든 모델 찾기
      const allMembers = [
        { categoryKey: category, modelIndex: index },
        ...group.members,
      ];

      // 모든 멤버에 동일한 시스템 프롬프트 적용
      allMembers.forEach((member) => {
        if (
          updatedConfig.categories[member.categoryKey]?.models[
            member.modelIndex
          ]
        ) {
          updatedConfig.categories[member.categoryKey].models[
            member.modelIndex
          ] = {
            ...updatedConfig.categories[member.categoryKey].models[
              member.modelIndex
            ],
            systemPrompt: [...systemPrompt], // 복사본 사용
          };
        }
      });
    }

    const multiturnSettings = normalizeMultiturnSettings(editForm);

    // 기존 모델 수정 시 dbId 유지 (originalModel은 위에서 이미 선언됨)
    updatedConfig.categories[category].models[index] = {
      ...editForm,
      dbId: originalModel.dbId || editForm.dbId, // 기존 dbId 유지
      id: editForm.id.trim(),
      modelName: editForm.modelName || editForm.id.trim(), // modelName 명시적 저장
      label: label.trim(),
      tooltip: editForm.tooltip.trim(),
      systemPrompt: systemPrompt,
      endpoint: editForm.endpoint || '',
      apiConfig: editForm.apiConfig || null, // API 설정 저장
      apiKey: editForm.apiKey || originalModel.apiKey || null, // API 키 저장 (비어있으면 기존값 유지)
      ...multiturnSettings,
    };
    setModelConfig(updatedConfig);
    setEditingModel(null);
    setEditForm({
      id: '',
      label: '',
      tooltip: '',
      isDefault: false,
      adminOnly: false,
      systemPrompt: [],
      endpoint: '',
      apiConfig: null,
      apiKey: '',
      multiturnLimit: '',
      multiturnUnlimited: true,
      piiFilterRequest: false,
      piiFilterResponse: false,
      piiRequestMxtVrf: true,
      piiRequestMaskOpt: true,
      piiResponseMxtVrf: true,
      piiResponseMaskOpt: true,
    });

    // 모델 편집 후 자동 저장
    setTimeout(async () => {
      try {
        setSavingSection('llm');
        const response = await TokenManager.safeFetch('/api/admin/models', {
          method: 'PUT',
          body: JSON.stringify({ categories: updatedConfig.categories }),
        });

        if (!response.ok) {
          let errorMessage = '모델 설정 저장에 실패했습니다.';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
          console.error('모델 설정 저장 실패:', response.status, errorMessage);
          alert(errorMessage, 'error', '저장 실패');
        } else {
          const data = await response.json();
          alert(
            data.message || '모델이 수정되고 저장되었습니다.',
            'success',
            '저장 완료'
          );
        }
      } catch (error) {
        console.error('모델 설정 저장 실패:', error);
        alert(
          error.message || '모델 설정 저장 중 오류가 발생했습니다.',
          'error',
          '저장 실패'
        );
      } finally {
        setSavingSection(null);
      }
    }, 100);
  };

  const deleteModel = async (category, modelIndex) => {
    const modelToDelete = modelConfig.categories[category].models[modelIndex];
    const modelLabel = modelToDelete.label;

    // 설정에서 사용 중인지 확인
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const settings = await response.json();
        const roomNameModel = settings.roomNameGenerationModel;
        const imageModel = settings.imageAnalysisModel;

        // 대화방명 생성 모델로 사용 중인지 확인 (label로 비교)
        if (roomNameModel === modelLabel) {
          alert(
            `이 모델은 대화방명 생성에 사용 중입니다.\n\n먼저 "설정" 페이지에서 다른 모델을 선택한 후 삭제해주세요.`,
            'error',
            '삭제 불가'
          );
          return;
        }

        // 이미지 분석 모델로 사용 중인지 확인 (label로 비교)
        if (imageModel === modelLabel) {
          alert(
            `이 모델은 이미지 분석에 사용 중입니다.\n\n먼저 "설정" 페이지에서 다른 모델을 선택한 후 삭제해주세요.`,
            'error',
            '삭제 불가'
          );
          return;
        }
      }
    } catch (error) {
      console.error('설정 확인 중 오류:', error);
      // 설정 확인 실패 시에도 삭제 진행 여부 확인
      const confirmDelete = await confirm(
        '설정 확인에 실패했습니다. 그래도 삭제하시겠습니까?',
        '경고'
      );
      if (!confirmDelete) return;
    }

    const confirmDelete = await confirm(
      '정말 이 모델을 삭제하시겠습니까?',
      '모델 삭제 확인'
    );
    if (!confirmDelete) return;

    const updatedConfig = { ...modelConfig };
    const deletedModel = updatedConfig.categories[category].models.splice(
      modelIndex,
      1
    )[0];
    if (
      deletedModel.isDefault &&
      updatedConfig.categories[category].models.length > 0
    ) {
      updatedConfig.categories[category].models[0].isDefault = true;
    }
    setModelConfig(updatedConfig);

    // 모델 삭제 후 자동 저장
    setTimeout(async () => {
      try {
        setSavingSection('llm');
        const response = await TokenManager.safeFetch('/api/admin/models', {
          method: 'PUT',
          body: JSON.stringify({ categories: updatedConfig.categories }),
        });

        if (!response.ok) {
          let errorMessage = '모델 설정 저장에 실패했습니다.';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
          console.error('모델 설정 저장 실패:', response.status, errorMessage);
          alert(errorMessage, 'error', '저장 실패');
        } else {
          const data = await response.json();
          alert(
            data.message || '모델이 삭제되고 저장되었습니다.',
            'success',
            '저장 완료'
          );
        }
      } catch (error) {
        console.error('모델 설정 저장 실패:', error);
        alert(
          error.message || '모델 설정 저장 중 오류가 발생했습니다.',
          'error',
          '저장 실패'
        );
      } finally {
        setSavingSection(null);
      }
    }, 100);
  };

  const copyModel = (category, modelIndex) => {
    const source = modelConfig.categories[category].models[modelIndex];
    if (!source) return;

    const baseModelName = source.modelName || source.id || '';
    const baseLabel = source.label || baseModelName || '모델';
    const uniqueSuffix =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().slice(0, 8)
        : Date.now().toString(36);
    const newId = `${baseModelName || source.id}-copy-${uniqueSuffix}`;

    const copiedModel = {
      ...source,
      dbId: undefined, // 새 모델이므로 dbId 제거
      id: newId, // UI에서 사용할 고유 ID
      modelName: baseModelName, // 올라마 모델명은 정확히 유지 (예: "gemma3:4b")
      label: `${baseLabel} (복사)`, // label만 변경하여 구분
      isDefault: false,
    };

    const updatedConfig = { ...modelConfig };
    updatedConfig.categories[category].models.splice(
      modelIndex + 1,
      0,
      copiedModel
    );
    setModelConfig(updatedConfig);

    setTimeout(async () => {
      try {
        setSavingSection('llm');
        const response = await TokenManager.safeFetch('/api/admin/models', {
          method: 'PUT',
          body: JSON.stringify({ categories: updatedConfig.categories }),
        });

        if (!response.ok) {
          let errorMessage = '모델 설정 저장에 실패했습니다.';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
          console.error('모델 설정 저장 실패:', response.status, errorMessage);
          alert(errorMessage, 'error', '저장 실패');
        } else {
          const data = await response.json();
          alert(
            data.message || '모델이 복사되어 저장되었습니다.',
            'success',
            '저장 완료'
          );
        }
      } catch (error) {
        console.error('모델 설정 저장 실패:', error);
        alert(
          error.message || '모델 설정 저장 중 오류가 발생했습니다.',
          'error',
          '저장 실패'
        );
      } finally {
        setSavingSection(null);
      }
    }, 100);
  };

  const setDefaultModel = (category, modelIndex) => {
    const updatedConfig = { ...modelConfig };
    updatedConfig.categories[category].models.forEach((model, index) => {
      model.isDefault = index === modelIndex;
    });
    setModelConfig(updatedConfig);
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'vectorized':
        return '벡터화 완료';
      case 'vectorizing':
        return '벡터화 중';
      case 'processing':
        return '처리 중';
      case 'uploaded':
        return '업로드됨';
      case 'error':
        return '오류';
      default:
        return '알 수 없음';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'vectorized':
        return 'bg-primary/10 text-primary';
      case 'vectorizing':
      case 'processing':
        return 'bg-muted text-muted-foreground';
      case 'error':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted dark:bg-foreground text-foreground';
    }
  };

  const getLabelInfoForModel = (model, categoryKey, modelIndex) => {
    if (!model?.label) return null;
    const normalized = normalizeLabel(model.label);
    const group = normalized ? modelLabelRoundRobinMap[normalized] : null;

    if (!group?.isRoundRobin) {
      return null;
    }

    const otherMembers = group.members.filter(
      (member) =>
        member.categoryKey !== categoryKey || member.modelIndex !== modelIndex
    );

    if (otherMembers.length === 0) {
      return null;
    }

    return {
      ...group,
      models: otherMembers,
    };
  };

  // 라운드로빈 그룹 내에서 첫 번째 모델 찾기
  const getFirstModelInRoundRobinGroup = (label, categoryKey, modelIndex) => {
    if (!label || !modelConfig) return null;
    const normalized = normalizeLabel(label);
    const group = normalized ? modelLabelRoundRobinMap[normalized] : null;

    if (!group?.isRoundRobin) {
      return null;
    }

    // 모든 멤버를 정렬하여 첫 번째 모델 찾기
    const allMembers = [{ categoryKey, modelIndex }, ...group.members].sort(
      (a, b) => {
        // 카테고리 키로 먼저 정렬
        if (a.categoryKey !== b.categoryKey) {
          return a.categoryKey.localeCompare(b.categoryKey);
        }
        // 같은 카테고리면 인덱스로 정렬
        return a.modelIndex - b.modelIndex;
      }
    );

    const firstMember = allMembers[0];
    if (
      firstMember.categoryKey === categoryKey &&
      firstMember.modelIndex === modelIndex
    ) {
      return null; // 현재 모델이 첫 번째 모델임
    }

    // 첫 번째 모델의 정보 가져오기
    const firstModel =
      modelConfig.categories[firstMember.categoryKey]?.models[
        firstMember.modelIndex
      ];
    return firstModel ? { ...firstMember, model: firstModel } : null;
  };

  if (loading)
    return (
      <div className='flex items-center justify-center min-h-96'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  if (!modelConfig)
    return (
      <div className='text-center text-muted-foreground'>
        모델 설정을 불러올 수 없습니다.
      </div>
    );

  return (
    <div className='space-y-6'>
      {/* 페이지 헤더 */}
      <div>
        <h1 className='text-2xl font-bold text-foreground'>
          모델 관리
        </h1>
        <p className='text-muted-foreground mt-1'>
          AI 모델 설정을 관리합니다. 각 섹션별로 개별 저장할 수 있습니다.
        </p>
      </div>

      {/* 프리셋 URL 전역 설정 */}
      <div className='card p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div>
            <h2 className='text-xl font-semibold text-foreground'>
              수동 프리셋 URL 설정
            </h2>
            <p className='text-sm text-muted-foreground mt-1'>
              수동 추가 프리셋(OpenAI Compatible/Responses)에 적용됩니다.
            </p>
          </div>
          <button
            type='button'
            onClick={saveManualPresetSettings}
            disabled={savingPresetSettings}
            className='btn-primary flex items-center gap-2 text-sm px-3 py-1.5'
          >
            {savingPresetSettings ? '저장 중...' : '저장'}
          </button>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              baseUrl (responses)
            </label>
            <input
              type='text'
              value={manualPresetBaseUrl}
              onChange={(e) => setManualPresetBaseUrl(e.target.value)}
              placeholder='https://api.openai.com'
              className='input-primary w-full'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              apiBase (compatible)
            </label>
            <input
              type='text'
              value={manualPresetApiBase}
              onChange={(e) => setManualPresetApiBase(e.target.value)}
              placeholder='https://api.openai.com'
              className='input-primary w-full'
            />
          </div>
        </div>
      </div>

      {/* LLM 모델 섹션 */}
      <div className='space-y-4'>
        <div className='card p-6'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h2 className='text-xl font-semibold text-foreground'>
                LLM 모델 설정
              </h2>
              <p className='text-sm text-muted-foreground mt-1'>
                드래그하여 순서를 변경할 수 있습니다. 각 카테고리별로 순서 저장
                버튼을 클릭하세요.
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={fetchAvailableModels}
                disabled={modelsLoading}
                className='px-3 py-2 text-sm font-medium rounded-lg bg-card border border-border text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5'
              >
                <RefreshCw
                  className={`h-4 w-4 ${modelsLoading ? 'animate-spin' : ''}`}
                />
                {modelsLoading ? '로드 중...' : '새로고침'}
              </button>
            </div>
          </div>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {Object.entries(modelConfig.categories).map(
              ([categoryKey, category]) => (
                <div
                  key={categoryKey}
                  className='card p-6 border-2 border-border'
                >
                  <div className='flex items-center justify-between mb-5'>
                    {editingCategory === categoryKey ? (
                      <input
                        type='text'
                        value={category.label}
                        onChange={(e) =>
                          handleCategoryLabelChange(categoryKey, e.target.value)
                        }
                        onBlur={() => setEditingCategory(null)}
                        onKeyDown={(e) =>
                          e.key === 'Enter' && setEditingCategory(null)
                        }
                        className='input-primary text-lg font-semibold'
                        autoFocus
                      />
                    ) : (
                      <h3 className='text-lg font-semibold text-foreground flex items-center gap-2'>
                        {category.label}
                        <button
                          onClick={() => setEditingCategory(categoryKey)}
                          className='p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors'
                          title='카테고리명 수정'
                        >
                          <Edit size={14} />
                        </button>
                      </h3>
                    )}
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => saveCategoryOrder(categoryKey)}
                        disabled={savingCategory === categoryKey}
                        className='px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5'
                        title='모델 순서 저장'
                      >
                        <Save className='h-3.5 w-3.5' />
                        {savingCategory === categoryKey
                          ? '저장 중...'
                          : '순서 저장'}
                      </button>
                      <button
                        onClick={() =>
                          setShowAddForm({ category: categoryKey, show: true })
                        }
                        className='px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors flex items-center gap-1.5'
                      >
                        <Plus className='h-3.5 w-3.5' />
                        모델 추가
                      </button>
                    </div>
                  </div>

                  <SortableContext
                    items={category.models.map(
                      (_, idx) => `${categoryKey}-${idx}`
                    )}
                    strategy={verticalListSortingStrategy}
                    id={categoryKey}
                  >
                    <div className='space-y-3'>
                      {category.models.map((model, modelIndex) => {
                        const labelInfoForModel = getLabelInfoForModel(
                          model,
                          categoryKey,
                          modelIndex
                        );
                        const isLabelRoundRobin = Boolean(labelInfoForModel);

                        return (
                          <SortableModelItem
                            key={`${categoryKey}-${model.id}-${modelIndex}`}
                            id={`${categoryKey}-${modelIndex}`}
                          >
                            <div
                              className={`p-4 rounded-lg border ${
                                isLabelRoundRobin
                                  ? 'bg-muted border-border dark:border-border'
                                  : 'bg-muted border-border'
                              }`}
                            >
                              {editingModel?.category === categoryKey &&
                              editingModel?.index === modelIndex ? (
                                <div className='space-y-3'>
                                  <div>
                                    <label className='block text-xs font-medium text-foreground mb-1'>
                                      모델서버
                                    </label>
                                    <select
                                      className='input-primary text-sm'
                                      value={editForm.endpoint || ''}
                                      onChange={(e) => {
                                        const ep = e.target.value;
                                        setEditForm({
                                          ...editForm,
                                          endpoint: ep,
                                          // 수동 추가로 변경 시 기본 템플릿 설정
                                          apiConfig: ep === 'manual'
                                            ? buildManualPreset('openai-compatible')
                                            : editForm.apiConfig
                                        });
                                        if (ep === 'manual') {
                                          setAvailableModels([]);
                                        }
                                        setSelectedEndpoint(ep);
                                      }}
                                      required
                                    >
                                      <option value="manual">[수동 추가] Custom API</option>
                                      {endpoints.map((ep) => {
                                        const providerBadge =
                                          ep.provider === 'openai-compatible' ? '[OpenAI]' :
                                          ep.provider === 'gemini' ? '[Gemini]' :
                                          ep.provider === 'ollama' || ep.provider === 'model-server' ? '[Ollama]' :
                                          `[${ep.provider || 'Ollama'}]`;
                                        const label = ep.name
                                          ? `${providerBadge} ${ep.name} (${ep.url})`
                                          : `${providerBadge} ${ep.url}`;
                                        return (
                                          <option key={ep.url} value={ep.url}>
                                            {label}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  {editForm.endpoint &&
                                    editForm.endpoint !== 'manual' &&
                                    availableModels.length > 0 && (
                                      <div className='flex items-start gap-2 p-2 rounded-md bg-muted border border-border mt-2'>
                                        <span className='text-xs text-foreground'>
                                          {(() => {
                                            const ep = endpoints.find(
                                                (e) =>
                                                  e.url === editForm.endpoint
                                              );
                                              return ep?.name
                                                ? `${ep.name} (${ep.url})`
                                                : editForm.endpoint;
                                            })()}{' '}
                                            {availableModels.length}개 모델
                                            로드됨
                                          </span>
                                        </div>
                                      )}

                                    {/* 수동 추가 시 API 설정 */}
                                      {editForm.endpoint === 'manual' && (
                                        <div className='mt-3 p-4 bg-muted rounded-lg border border-border'>
                                          <div className='mb-4'>
                                            <p className='text-xs font-medium text-foreground mb-2'>
                                              프리셋 적용
                                            </p>
                                            <div className='flex flex-wrap gap-2'>
                                              <button
                                                type='button'
                                                onClick={() =>
                                                  setEditForm({
                                                    ...editForm,
                                                    apiConfig: buildManualPreset('openai-compatible'),
                                                  })
                                                }
                                                className='px-2 py-1 text-xs rounded bg-card border border-border hover:bg-accent'
                                              >
                                                OpenAI Compatible
                                              </button>
                                              <button
                                                type='button'
                                                onClick={() =>
                                                  setEditForm({
                                                    ...editForm,
                                                    apiConfig: buildManualPreset('responses'),
                                                  })
                                                }
                                                className='px-2 py-1 text-xs rounded bg-card border border-border hover:bg-accent'
                                              >
                                                Responses
                                              </button>
                                            </div>
                                          </div>
                                          {/* API 키 입력 */}
                                          <div className='mb-4'>
                                            <label className='block text-sm font-medium text-foreground mb-2'>
                                              🔑 API 키
                                          </label>
                                          <input
                                            type='text'
                                            value={editForm.apiKey || ''}
                                            onChange={(e) => {
                                              setEditForm({
                                                ...editForm,
                                                apiKey: e.target.value
                                              });
                                            }}
                                            placeholder='API 키를 입력하세요'
                                            className='w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-transparent'
                                          />
                                          <p className='text-xs text-muted-foreground mt-1'>
                                            API 호출 시 사용할 키입니다. 템플릿의 {'{{OPENAI_API_KEY}}'} 변수로 대체됩니다.
                                          </p>
                                        </div>

                                        <label className='block text-sm font-medium text-foreground mb-2'>
                                          🔧 API 요청 설정 (JSON)
                                        </label>
                                        <p className='text-xs text-muted-foreground mb-2'>
                                          백엔드에서 실행할 API 요청을 JSON 형태로 작성하세요. 변수: {'{{OPENAI_API_KEY}}'}, {'{{messages}}'}, {'{{message}}'}
                                        </p>
                                        <textarea
                                          value={editForm.apiConfig || ''}
                                          onChange={(e) => {
                                            setEditForm({
                                              ...editForm,
                                              apiConfig: e.target.value
                                            });
                                          }}
                                          onBlur={(e) => {
                                            const normalized = normalizeJsonString(e.target.value);
                                            if (normalized !== e.target.value) {
                                              setEditForm({
                                                ...editForm,
                                                apiConfig: normalized,
                                              });
                                            }
                                          }}
                                          className='w-full h-64 px-3 py-2 text-xs font-mono bg-card border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-transparent'
                                          placeholder={`{
  "method": "POST",
  "url": "https://api.openai.com/v1/chat/completions",
  "headers": {
    "Authorization": "Bearer {{OPENAI_API_KEY}}",
    "Content-Type": "application/json"
  },
  "body": {
    "model": "gpt-4",
    "messages": "{{messages}}",
    "stream": true
  },
  "stream": true,
  "responseMapping": {
    "path": "choices[0].message.content"
  }
}`}
                                        />
                                        <div className='mt-2 text-xs space-y-2'>
                                          <div className='p-3 bg-destructive/10 border border-destructive/20 rounded'>
                                            <p className='font-semibold text-destructive mb-2'>⚠️ 수정이 필요한 필드:</p>
                                            <ul className='list-disc ml-5 text-destructive space-y-1'>
                                              <li><code className='bg-destructive/10/40 px-1 rounded'>&quot;url&quot;</code> - API 엔드포인트 주소</li>
                                              <li><code className='bg-destructive/10/40 px-1 rounded'>&quot;model&quot;</code> - 모델명 (gpt-4, claude-3 등)</li>
                                              <li><code className='bg-destructive/10/40 px-1 rounded'>&quot;responseMapping.path&quot;</code> - 응답 경로</li>
                                            </ul>
                                          </div>
                                          <div className='text-muted-foreground'>
                                            <p><strong>사용 가능한 변수:</strong></p>
                                            <ul className='list-disc ml-5 mt-1'>
                                              <li><code className='bg-muted px-1 rounded'>{'{{OPENAI_API_KEY}}'}</code> - 환경변수에서 API 키 가져오기</li>
                                              <li><code className='bg-muted px-1 rounded'>{'{{messages}}'}</code> - 전체 대화 내역 (배열)</li>
                                              <li><code className='bg-muted px-1 rounded'>{'{{message}}'}</code> - 사용자의 최신 메시지 (문자열)</li>
                                            </ul>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className='grid grid-cols-2 gap-3'>
                                    <div>
                                      <label className='block text-xs font-medium text-foreground mb-1'>
                                        모델명
                                      </label>
                                      <div className='relative'>
                                        {(() => {
                                          const effectiveEndpoint =
                                            editForm.endpoint || selectedEndpoint;
                                          // 수동 추가인지 먼저 확인
                                          const isManual =
                                            effectiveEndpoint === 'manual';

                                          // 선택된 엔드포인트의 provider 확인
                                          const normalizeUrl = (url) => {
                                            try {
                                              const urlObj = new URL(url.trim());
                                              return `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${
                                                urlObj.port ? `:${urlObj.port}` : ''
                                              }${urlObj.pathname.replace(/\/+$/, '')}`;
                                            } catch (error) {
                                              console.warn('[Catch] 에러 발생:', error.message);
                                              return url.trim().toLowerCase().replace(/\/+$/, '');
                                            }
                                          };
                                          const normalizedEp = effectiveEndpoint
                                            ? normalizeUrl(effectiveEndpoint)
                                            : '';
                                          const endpointConfig = endpoints.find(
                                            (e) => normalizeUrl(e.url) === normalizedEp
                                          );
                                          const provider = endpointConfig?.provider || 'ollama';
                                          const isOllama = provider === 'ollama' || provider === 'model-server';

                                          // 수동 추가이거나 Ollama가 아닌 경우 input으로 표시
                                          if (isManual || !isOllama) {
                                            return (
                                              <>
                                                <input
                                                  type='text'
                                                  value={editForm.modelName || editForm.id || ''}
                                                  onChange={(e) => {
                                                    const modelName = e.target.value;
                                                    // 라벨이 비어있으면 모델명과 동일하게 설정
                                                    const autoLabel = !editForm.label?.trim()
                                                      ? modelName
                                                      : editForm.label;
                                                    setEditForm({
                                                      ...editForm,
                                                      id: modelName,
                                                      modelName: modelName,
                                                      label: autoLabel,
                                                    });
                                                  }}
                                                  placeholder={
                                                    isManual
                                                      ? 'my-custom-model (API 설정에 사용할 식별자)'
                                                      : provider === 'openai-compatible'
                                                      ? 'gpt-4, gpt-3.5-turbo 등'
                                                      : provider === 'gemini'
                                                      ? 'gemini-pro, gemini-1.5-flash 등'
                                                      : '모델명 입력'
                                                  }
                                                  className='input-primary text-sm'
                                                />
                                                {/* 라운드로빈 상태 태그 */}
                                                {editForm.id && (
                                                  <div className='absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1'>
                                                    {checkingRoundRobin ? (
                                                      <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-primary'></div>
                                                    ) : roundRobinInfo?.isRoundRobin ? (
                                                      <span className='px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium'>
                                                        RR {roundRobinInfo.serverCount}
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                )}
                                                <p className='text-xs text-muted-foreground mt-1'>
                                                  {isManual
                                                    ? '커스텀 API 모델의 식별자를 입력하세요'
                                                    : provider === 'openai-compatible'
                                                    ? 'OpenAI Compatible API 모델명을 직접 입력하세요'
                                                    : provider === 'gemini'
                                                    ? 'Google Gemini 모델명을 직접 입력하세요'
                                                    : '모델명을 직접 입력하세요'}
                                                </p>
                                              </>
                                            );
                                          }

                                          // Ollama인 경우 기존 select 유지
                                          return (
                                            <>
                                              <select
                                                value={
                                                  editForm.modelName || editForm.id
                                                }
                                                onFocus={handleEditModelSelectFocus}
                                                onMouseDown={
                                                  handleEditModelSelectFocus
                                                }
                                                onChange={(e) => {
                                                  const selectedModelName =
                                                    e.target.value;
                                                  // 라벨이 비어있으면 모델명과 동일하게 설정
                                                  const autoLabel =
                                                    !editForm.label?.trim()
                                                      ? selectedModelName
                                                      : editForm.label;
                                                  setEditForm({
                                                    ...editForm,
                                                    id: selectedModelName,
                                                    modelName: selectedModelName,
                                                    label: autoLabel,
                                                  });
                                                }}
                                                className='input-primary text-sm'
                                                disabled={modelsLoading}
                                              >
                                                <option value=''>
                                                  {modelsLoading
                                                    ? '모델 목록 조회중...'
                                                    : 'LLM 모델 선택'}
                                                </option>
                                                {/* 기존에 설정된 모델명이 있으면 표시 (모델 목록에 없어도) */}
                                                {(editForm.modelName ||
                                                  editForm.id) &&
                                                  !availableModels.find(
                                                    (m) =>
                                                      m.name === editForm.modelName ||
                                                      m.id === editForm.modelName ||
                                                      m.name === editForm.id ||
                                                      m.id === editForm.id
                                                  ) && (
                                                    <option
                                                      key={editForm.id}
                                                      value={
                                                        editForm.modelName ||
                                                        editForm.id
                                                      }
                                                    >
                                                      {editForm.label ||
                                                        editForm.modelName ||
                                                        editForm.id}
                                                    </option>
                                                  )}
                                                {!modelsLoading &&
                                                  availableModels.map((model) => (
                                                    <option
                                                      key={model.id}
                                                      value={model.name || model.id}
                                                    >
                                                      {model.name || model.id}{' '}
                                                      {model.sizeFormatted
                                                        ? `(${model.sizeFormatted})`
                                                        : ''}
                                                    </option>
                                                  ))}
                                              </select>
                                              {modelsLoading && (
                                                <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
                                                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-primary'></div>
                                                </div>
                                              )}
                                              {/* 라운드로빈 상태 태그 */}
                                              {editForm.id && (
                                                <div className='absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-1'>
                                                  {checkingRoundRobin ? (
                                                    <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-primary'></div>
                                                  ) : roundRobinInfo?.isRoundRobin ? (
                                                    <span className='px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium'>
                                                      RR {roundRobinInfo.serverCount}
                                                    </span>
                                                  ) : null}
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div>
                                      <label className='block text-xs font-medium text-foreground mb-1 flex items-center gap-2'>
                                        <span>라벨</span>
                                        {labelRoundRobinInfo && (
                                          <span className='px-1.5 py-0.5 bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground text-[10px] rounded font-medium'>
                                            라운드로빈{' '}
                                            {labelRoundRobinInfo.count}개
                                          </span>
                                        )}
                                      </label>
                                      <input
                                        type='text'
                                        value={editForm.label || ''}
                                        onChange={(e) =>
                                          setEditForm({
                                            ...editForm,
                                            label: e.target.value,
                                          })
                                        }
                                        onFocus={(e) => {
                                          // 라벨이 비어있고 id가 있으면 id로 초기 설정
                                          if (
                                            !editForm.label?.trim() &&
                                            editForm.id
                                          ) {
                                            setEditForm({
                                              ...editForm,
                                              label: editForm.id,
                                            });
                                            // 커서를 끝으로 이동
                                            setTimeout(() => {
                                              e.target.setSelectionRange(
                                                e.target.value.length,
                                                e.target.value.length
                                              );
                                            }, 0);
                                          }
                                        }}
                                        className={`input-primary text-sm ${
                                          labelRoundRobinInfo
                                            ? 'border-border dark:border-border'
                                            : ''
                                        }`}
                                        placeholder={
                                          editForm.id || 'GPT-OSS 20B'
                                        }
                                      />
                                      {labelRoundRobinInfo && (
                                        <div className='mt-2 p-2 rounded bg-muted border border-border dark:border-border'>
                                          <div className='text-xs text-muted-foreground'>
                                            <span className='font-medium'>
                                              동일 라벨 모델:
                                            </span>{' '}
                                            <span className='font-mono'>
                                              {editForm.id}
                                            </span>
                                            {labelRoundRobinInfo.models.length >
                                              0 && (
                                              <>
                                                {', '}
                                                {labelRoundRobinInfo.models.map(
                                                  (m, idx) => (
                                                    <span key={idx}>
                                                      <span className='font-mono'>
                                                        {m.id}
                                                      </span>
                                                      {idx <
                                                        labelRoundRobinInfo
                                                          .models.length -
                                                          1 && <span>, </span>}
                                                    </span>
                                                  )
                                                )}
                                              </>
                                            )}
                                            {labelRoundRobinInfo.endpointCount >
                                              1 && (
                                              <span className='ml-2 text-muted-foreground dark:text-muted-foreground'>
                                                (
                                                {
                                                  labelRoundRobinInfo.endpointCount
                                                }
                                                개 서버)
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div>
                                    <label className='block text-xs font-medium text-foreground mb-1'>
                                      툴팁 설명
                                    </label>
                                    <textarea
                                      value={editForm.tooltip || ''}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          tooltip: e.target.value,
                                        })
                                      }
                                      className='input-primary text-sm resize-none'
                                      rows='2'
                                      placeholder='모델에 대한 설명을 입력하세요'
                                    />
                                  </div>
                                  <div>
                                    <label className='block text-xs font-medium text-foreground mb-1'>
                                      멀티턴 제한
                                    </label>
                                    <div className='flex items-center gap-3'>
                                      <input
                                        type='number'
                                        min='1'
                                        value={editForm.multiturnLimit ?? ''}
                                        onChange={(e) =>
                                          setEditForm({
                                            ...editForm,
                                            multiturnLimit: e.target.value,
                                          })
                                        }
                                        className='w-24 px-2 py-1 text-sm border border-border rounded-md bg-background text-foreground'
                                        disabled={editForm.multiturnUnlimited || loading}
                                      />
                                      <label className='inline-flex items-center gap-2 text-xs text-muted-foreground'>
                                        <input
                                          type='checkbox'
                                          checked={!!editForm.multiturnUnlimited}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              multiturnUnlimited:
                                                e.target.checked,
                                              multiturnLimit: e.target.checked
                                                ? ''
                                                : editForm.multiturnLimit,
                                            })
                                          }
                                          className='h-4 w-4'
                                          disabled={loading}
                                        />
                                        제한 없음
                                      </label>
                                    </div>
                                    <p className='text-xs text-muted-foreground mt-1'>
                                      모델별 멀티턴 기억 개수입니다.
                                    </p>
                                  </div>
                                  <div>
                                    {(() => {
                                      const firstModelInfo =
                                        getFirstModelInRoundRobinGroup(
                                          editForm.label,
                                          editingModel?.category,
                                          editingModel?.index
                                        );
                                      const isNotFirstInRoundRobin =
                                        firstModelInfo !== null;
                                      const sharedSystemPrompt =
                                        isNotFirstInRoundRobin
                                          ? firstModelInfo.model
                                              ?.systemPrompt || []
                                          : editForm.systemPrompt || [];

                                      return (
                                        <>
                                          <label className='block text-xs font-medium text-foreground mb-1'>
                                            시스템 프롬프트
                                            <span className='text-xs text-muted-foreground'>
                                              (줄바꿈으로 구분)
                                            </span>
                                            {isNotFirstInRoundRobin && (
                                              <span className='ml-2 px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded font-medium'>
                                                공유됨
                                              </span>
                                            )}
                                          </label>
                                          {isNotFirstInRoundRobin ? (
                                            <div className='space-y-2'>
                                              <textarea
                                                value={
                                                  (
                                                    sharedSystemPrompt || []
                                                  ).join('\n') || ''
                                                }
                                                disabled
                                                className='input-primary text-sm resize-none bg-muted opacity-75 cursor-not-allowed'
                                                rows='6'
                                                placeholder='당신은 Tech그룹를 위한 AI 어시스턴트입니다.&#10;가능한 경우 모든 답변을 한국어로 설명해 주세요.'
                                              />
                                              <div className='p-2 rounded bg-muted border border-border'>
                                                <p className='text-xs text-muted-foreground'>
                                                  <span className='font-medium'>
                                                    라운드로빈 모델:
                                                  </span>{' '}
                                                  시스템 프롬프트는 첫 번째
                                                  모델(
                                                  <span className='font-mono'>
                                                    {firstModelInfo.model?.id}
                                                  </span>
                                                  )과 공유됩니다. 시스템
                                                  프롬프트를 수정하려면 첫 번째
                                                  모델을 편집해주세요.
                                                </p>
                                              </div>
                                            </div>
                                          ) : (
                                            <textarea
                                              value={
                                                (
                                                  editForm.systemPrompt || []
                                                ).join('\n') || ''
                                              }
                                              onChange={(e) =>
                                                setEditForm({
                                                  ...editForm,
                                                  systemPrompt: e.target.value
                                                    .split('\n')
                                                    .filter(
                                                      (line) =>
                                                        line !== null &&
                                                        line !== undefined
                                                    ),
                                                })
                                              }
                                              className='input-primary text-sm resize-none'
                                              rows='6'
                                              placeholder='당신은 Tech그룹를 위한 AI 어시스턴트입니다.&#10;가능한 경우 모든 답변을 한국어로 설명해 주세요.'
                                            />
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  <div className='flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border'>
                                    <div className='flex items-center gap-4 flex-wrap'>
                                      <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                          type='checkbox'
                                          checked={editForm.isDefault}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              isDefault: e.target.checked,
                                            })
                                          }
                                          className='w-4 h-4 text-primary bg-muted border-border rounded focus:ring-ring'
                                        />
                                        <span className='text-sm text-foreground'>
                                          기본 모델
                                        </span>
                                      </label>
                                      <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                          type='checkbox'
                                          checked={editForm.adminOnly}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              adminOnly: e.target.checked,
                                            })
                                          }
                                          className='w-4 h-4 text-destructive bg-muted border-border rounded focus:ring-ring'
                                        />
                                        <span className='text-sm text-foreground'>
                                          관리자 전용
                                        </span>
                                      </label>
                                      <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                          type='checkbox'
                                          checked={editForm.visible}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              visible: e.target.checked,
                                            })
                                          }
                                          className='w-4 h-4 text-muted-foreground bg-muted border-border rounded focus:ring-ring'
                                        />
                                        <span className='text-sm text-foreground'>
                                          메인 화면 표시
                                        </span>
                                      </label>
                                      <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                          type='checkbox'
                                          checked={!!editForm.piiFilterRequest}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              piiFilterRequest: e.target.checked,
                                            })
                                          }
                                          className='w-4 h-4 text-muted-foreground bg-muted border-border rounded focus:ring-ring'
                                        />
                                        <span className='text-sm text-foreground'>
                                          요청 PII 필터
                                        </span>
                                      </label>
                                      {/* [출력 PII 임시 비활성화]
                                      <label className='flex items-center gap-2 cursor-pointer'>
                                        <input
                                          type='checkbox'
                                          checked={!!editForm.piiFilterResponse}
                                          onChange={(e) =>
                                            setEditForm({
                                              ...editForm,
                                              piiFilterResponse: e.target.checked,
                                            })
                                          }
                                          className='w-4 h-4 text-muted-foreground bg-muted border-border rounded focus:ring-ring'
                                        />
                                        <span className='text-sm text-foreground'>
                                          응답 PII 필터
                                        </span>
                                      </label>
                                      */}
                                    </div>
                                    <div className='flex gap-2'>
                                      <button
                                        onClick={saveEdit}
                                        className='px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors flex items-center gap-1'
                                      >
                                        <Save className='h-3.5 w-3.5' /> 저장
                                      </button>
                                      <button
                                        onClick={() => setEditingModel(null)}
                                        className='px-3 py-1.5 text-xs font-medium rounded-lg bg-muted hover:bg-accent dark:bg-muted dark:hover:bg-accent text-foreground transition-colors flex items-center gap-1'
                                      >
                                        <X className='h-3.5 w-3.5' /> 취소
                                      </button>
                                    </div>
                                    {(editForm.piiFilterRequest /* || editForm.piiFilterResponse [출력 PII 임시 비활성화] */) && (
                                      <div className='w-full text-xs text-muted-foreground space-y-1'>
                                        {editForm.piiFilterRequest && (
                                          <div className='flex items-center gap-2 flex-wrap'>
                                            <span className='font-medium'>요청 옵션</span>
                                            <button
                                              type='button'
                                              onClick={() =>
                                                setEditForm((prev) => ({
                                                  ...prev,
                                                  piiRequestMxtVrf:
                                                    !prev.piiRequestMxtVrf,
                                                }))
                                              }
                                              className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                                editForm.piiRequestMxtVrf
                                                  ? 'bg-muted dark:bg-muted border-border dark:border-border text-foreground dark:text-foreground'
                                                  : 'bg-muted border-border text-muted-foreground'
                                              }`}
                                            >
                                              mxt_vrf {editForm.piiRequestMxtVrf ? 'ON' : 'OFF'}
                                            </button>
                                            <button
                                              type='button'
                                              onClick={() =>
                                                setEditForm((prev) => ({
                                                  ...prev,
                                                  piiRequestMaskOpt:
                                                    !prev.piiRequestMaskOpt,
                                                }))
                                              }
                                              className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                                editForm.piiRequestMaskOpt
                                                  ? 'bg-muted dark:bg-muted border-border dark:border-border text-foreground dark:text-foreground'
                                                  : 'bg-muted border-border text-muted-foreground'
                                              }`}
                                            >
                                              mask_opt {editForm.piiRequestMaskOpt ? 'ON' : 'OFF'}
                                            </button>
                                          </div>
                                        )}
                                        {/* [출력 PII 임시 비활성화]
                                        {editForm.piiFilterResponse && (
                                          <div className='flex items-center gap-2 flex-wrap'>
                                            <span className='font-medium'>응답 옵션</span>
                                            <button
                                              type='button'
                                              onClick={() =>
                                                setEditForm((prev) => ({
                                                  ...prev,
                                                  piiResponseMxtVrf:
                                                    !prev.piiResponseMxtVrf,
                                                }))
                                              }
                                              className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                                editForm.piiResponseMxtVrf
                                                  ? 'bg-muted dark:bg-muted border-border dark:border-border text-foreground dark:text-foreground'
                                                  : 'bg-muted border-border text-muted-foreground'
                                              }`}
                                            >
                                              mxt_vrf {editForm.piiResponseMxtVrf ? 'ON' : 'OFF'}
                                            </button>
                                            <button
                                              type='button'
                                              onClick={() =>
                                                setEditForm((prev) => ({
                                                  ...prev,
                                                  piiResponseMaskOpt:
                                                    !prev.piiResponseMaskOpt,
                                                }))
                                              }
                                              className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                                editForm.piiResponseMaskOpt
                                                  ? 'bg-muted dark:bg-muted border-border dark:border-border text-foreground dark:text-foreground'
                                                  : 'bg-muted border-border text-muted-foreground'
                                              }`}
                                            >
                                              mask_opt {editForm.piiResponseMaskOpt ? 'ON' : 'OFF'}
                                            </button>
                                          </div>
                                        )}
                                        */}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className='flex items-start justify-between w-full'>
                                  <div className='flex-1 space-y-2'>
                                    {/* 헤더: 라운드로빈 배지 + 모델 이름 */}
                                    <div className='flex items-start justify-between gap-2'>
                                      <div className='flex items-center gap-2 flex-wrap'>
                                        {isLabelRoundRobin && (
                                          <span className='px-2 py-0.5 bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground text-[10px] rounded font-medium'>
                                            라운드로빈 {labelInfoForModel.count}
                                            개
                                          </span>
                                        )}
                                        <h3 className='font-semibold text-sm text-foreground'>
                                          {model.label}
                                        </h3>
                                        {model.isDefault && (
                                          <span className='px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded font-medium'>
                                            기본
                                          </span>
                                        )}
                                        {model.adminOnly === true && (
                                          <span className='px-1.5 py-0.5 bg-destructive/10 text-destructive text-[10px] rounded font-medium'>
                                            관리자 전용
                                          </span>
                                        )}
                                        {model.visible === false && (
                                          <span className='px-1.5 py-0.5 bg-muted text-foreground text-[10px] rounded font-medium'>
                                            숨김
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* 기본 정보: Name, ID, Endpoint */}
                                    <div className='space-y-1'>
                                      <div className='flex items-center gap-2 flex-wrap'>
                                        {model.name && (
                                          <span className='text-xs text-muted-foreground'>
                                            <span className='font-medium'>
                                              모델명:
                                            </span>{' '}
                                            <span className='font-mono text-foreground'>
                                              {model.name}
                                            </span>
                                          </span>
                                        )}
                                        <span className='text-xs text-muted-foreground'>
                                          <span className='font-medium'>
                                            기본 ID:
                                          </span>{' '}
                                          <span className='font-mono text-foreground'>
                                            {model.id}
                                          </span>
                                        </span>
                                        {modelRoundRobinMap[model.id]
                                          ?.isRoundRobin && (
                                          <span className='px-1.5 py-0.5 bg-muted dark:bg-muted text-foreground dark:text-foreground text-[10px] rounded font-medium'>
                                            서버 RR{' '}
                                            {
                                              modelRoundRobinMap[model.id]
                                                .serverCount
                                            }
                                          </span>
                                        )}
                                      </div>
                                      {model.endpoint && (
                                        <div className='text-xs text-muted-foreground'>
                                          <span className='font-medium'>
                                            Endpoint:
                                          </span>{' '}
                                          <span className='font-mono text-muted-foreground break-all'>
                                            {model.endpoint}
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* 툴팁 설명 */}
                                    {model.tooltip && (
                                      <p className='text-xs text-muted-foreground leading-relaxed'>
                                        {model.tooltip}
                                      </p>
                                    )}

                                    {/* 라운드로빈 상세 정보 */}
                                    {labelInfoForModel && (
                                      <div className='pt-2 border-t border-border dark:border-border'>
                                        <div className='text-xs'>
                                          <div className='flex items-center gap-1.5 mb-1'>
                                            <span className='font-medium text-muted-foreground dark:text-muted-foreground'>
                                              동일 라벨 모델:
                                            </span>
                                            <span className='text-muted-foreground dark:text-muted-foreground'>
                                              {labelInfoForModel.endpointCount}
                                              개 서버
                                            </span>
                                          </div>
                                          <div className='flex flex-wrap items-center gap-1.5'>
                                            <span className='px-1.5 py-0.5 bg-muted dark:bg-muted rounded font-mono text-[10px] text-muted-foreground dark:text-muted-foreground'>
                                              {model.id}
                                            </span>
                                            {labelInfoForModel.models.map(
                                              (m, idx) => (
                                                <span
                                                  key={idx}
                                                  className='px-1.5 py-0.5 bg-muted dark:bg-muted rounded font-mono text-[10px] text-muted-foreground dark:text-muted-foreground'
                                                >
                                                  {m.id}
                                                </span>
                                              )
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* 서버 라운드로빈 정보 */}
                                    {modelRoundRobinMap[model.id]
                                      ?.isRoundRobin &&
                                      !labelInfoForModel && (
                                        <div className='pt-2 border-t border-border'>
                                          <div className='text-xs text-muted-foreground'>
                                            <span className='font-medium'>
                                              서버 라운드로빈:
                                            </span>{' '}
                                            <span className='font-mono'>
                                              {
                                                modelRoundRobinMap[model.id]
                                                  .serverName
                                              }
                                            </span>
                                            <span className='ml-1 text-muted-foreground'>
                                              (
                                              {
                                                modelRoundRobinMap[model.id]
                                                  .serverCount
                                              }
                                              개)
                                            </span>
                                          </div>
                                        </div>
                                      )}

                                    {/* 시스템 프롬프트 미리보기 */}
                                    {model.systemPrompt &&
                                      model.systemPrompt.length > 0 && (
                                        <div className='pt-2 border-t border-border'>
                                          <div className='flex items-center gap-1.5 mb-1'>
                                            <span className='px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded font-medium'>
                                              시스템 프롬프트
                                            </span>
                                            <span className='text-xs text-muted-foreground'>
                                              {model.systemPrompt.length}줄
                                            </span>
                                          </div>
                                          <p className='text-xs text-muted-foreground line-clamp-2 leading-relaxed'>
                                            {model.systemPrompt
                                              .slice(0, 2)
                                              .join(' ')
                                              .substring(0, 100)}
                                            {(model.systemPrompt.join(' ')
                                              .length > 100 ||
                                              model.systemPrompt.length > 2) &&
                                              '...'}
                                          </p>
                                        </div>
                                      )}
                                  </div>
                                  <div className='flex gap-1.5 ml-3'>
                                    {!model.isDefault && (
                                      <button
                                        onClick={() =>
                                          setDefaultModel(
                                            categoryKey,
                                            modelIndex
                                          )
                                        }
                                        className='px-2 py-1 text-xs font-medium rounded-md text-primary hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors'
                                        title='기본 모델로 설정'
                                      >
                                        기본설정
                                      </button>
                                    )}
                                    <button
                                      onClick={() =>
                                        startEditing(categoryKey, modelIndex)
                                      }
                                      className='p-1.5 rounded-md text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-accent transition-colors'
                                      title='편집'
                                    >
                                      <Edit2 className='h-3.5 w-3.5' />
                                    </button>
                                    <button
                                      onClick={() =>
                                        copyModel(categoryKey, modelIndex)
                                      }
                                      className='p-1.5 rounded-md text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-accent transition-colors'
                                      title='설정 복사'
                                    >
                                      <Copy className='h-3.5 w-3.5' />
                                    </button>
                                    <button
                                      onClick={() =>
                                        deleteModel(categoryKey, modelIndex)
                                      }
                                      className='p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 dark:hover:bg-destructive/10 transition-colors'
                                      title='삭제'
                                    >
                                      <Trash2 className='h-3.5 w-3.5' />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </SortableModelItem>
                        );
                      })}
                      {category.models.length === 0 && (
                        <div className='text-center py-10 text-muted-foreground'>
                          <div className='text-4xl mb-2'>📦</div>
                          <p className='text-sm font-medium'>
                            등록된 모델이 없습니다.
                          </p>
                          <p className='text-xs mt-1'>
                            위의 &quot;모델 추가&quot; 버튼을 클릭하여 모델을
                            등록하세요.
                          </p>
                        </div>
                      )}
                    </div>
                  </SortableContext>

                  {showAddForm.show && showAddForm.category === categoryKey && (
                    <div className='mt-4 p-5 bg-primary/10 rounded-lg border border-primary/20'>
                      <div className='flex items-center gap-2 mb-4'>
                        <Plus className='h-4 w-4 text-primary' />
                        <h4 className='font-semibold text-foreground text-sm'>
                          새 모델 추가
                        </h4>
                      </div>
                      <div className='space-y-3'>
                        {/* 라벨 먼저 입력 */}
                        <div>
                          <label className='block text-xs font-medium text-foreground mb-1 flex items-center gap-2'>
                            <span>라벨 *</span>
                            {newModelLabelRoundRobinInfo && (
                              <span className='px-1.5 py-0.5 bg-muted dark:bg-muted text-muted-foreground dark:text-muted-foreground text-[10px] rounded font-medium'>
                                라운드로빈 {newModelLabelRoundRobinInfo.count}개
                              </span>
                            )}
                          </label>
                          <input
                            type='text'
                            value={newModel.label || ''}
                            onChange={(e) => {
                              const label = e.target.value;
                              setNewModel({ ...newModel, label });

                              // 라벨이 변경되면 해당 라벨을 가진 기존 모델 찾기
                              if (label.trim() && modelConfig) {
                                let foundModel = null;
                                Object.values(modelConfig.categories).forEach(
                                  (category) => {
                                    if (category.models) {
                                      const existing = category.models.find(
                                        (m) => m.label?.trim() === label.trim()
                                      );
                                      if (existing) {
                                        foundModel = existing;
                                      }
                                    }
                                  }
                                );

                                // 기존 모델이 있으면 설정 자동 채우기
                                if (foundModel) {
                                  setNewModel({
                                    ...newModel,
                                    label,
                                    id: foundModel.id || newModel.id,
                                    endpoint:
                                      foundModel.endpoint || newModel.endpoint,
                                  });
                                  if (foundModel.endpoint) {
                                    setSelectedEndpoint(foundModel.endpoint);
                                  }
                                }
                              }
                            }}
                            onFocus={(e) => {
                              // 라벨이 비어있고 id가 있으면 id로 초기 설정
                              if (!newModel.label?.trim() && newModel.id) {
                                setNewModel({
                                  ...newModel,
                                  label: newModel.id,
                                });
                                // 커서를 끝으로 이동
                                setTimeout(() => {
                                  e.target.setSelectionRange(
                                    e.target.value.length,
                                    e.target.value.length
                                  );
                                }, 0);
                              }
                            }}
                            className='input-primary text-sm'
                            placeholder={newModel.id || 'GPT-OSS 20B'}
                          />
                          {/* 기존 라벨 목록 표시 (자동완성) */}
                          {modelConfig && newModel.label && (
                            <div className='mt-2 flex flex-wrap gap-2'>
                              {(() => {
                                const existingLabels = new Set();
                                Object.values(modelConfig.categories).forEach(
                                  (category) => {
                                    if (category.models) {
                                      category.models.forEach((m) => {
                                        if (m.label && m.label.trim()) {
                                          existingLabels.add(m.label.trim());
                                        }
                                      });
                                    }
                                  }
                                );
                                return Array.from(existingLabels)
                                  .filter((label) =>
                                    label
                                      .toLowerCase()
                                      .includes(
                                        newModel.label?.toLowerCase() || ''
                                      )
                                  )
                                  .slice(0, 5)
                                  .map((label) => (
                                    <button
                                      key={label}
                                      type='button'
                                      onClick={() => {
                                        // 해당 라벨을 가진 모델 찾기
                                        let foundModel = null;
                                        Object.values(
                                          modelConfig.categories
                                        ).forEach((category) => {
                                          if (category.models) {
                                            const existing =
                                              category.models.find(
                                                (m) => m.label?.trim() === label
                                              );
                                            if (existing) {
                                              foundModel = existing;
                                            }
                                          }
                                        });

                                        setNewModel({
                                          ...newModel,
                                          label,
                                          id: foundModel?.id || newModel.id,
                                          endpoint:
                                            foundModel?.endpoint ||
                                            newModel.endpoint,
                                        });
                                        if (foundModel?.endpoint) {
                                          setSelectedEndpoint(
                                            foundModel.endpoint
                                          );
                                        }
                                      }}
                                      className='flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-xs transition-all duration-200 hover:bg-accent'
                                    >
                                      {label}
                                    </button>
                                  ));
                              })()}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className='block text-xs font-medium text-foreground mb-1'>
                            모델서버
                          </label>
                          <select
                            className='input-primary text-sm'
                            value={newModel.endpoint || ''}
                            onChange={(e) => {
                              const ep = e.target.value;
                              setNewModel({
                                ...newModel,
                                endpoint: ep,
                                // 수동 추가로 변경 시 기본 템플릿 설정
                                apiConfig: ep === 'manual'
                                  ? buildManualPreset('openai-compatible')
                                  : newModel.apiConfig
                              });
                              if (ep === 'manual') {
                                setAvailableModels([]);
                              }
                              setSelectedEndpoint(ep);
                            }}
                            required
                          >
                            <option value="manual">[수동 추가] Custom API</option>
                            {endpoints.map((ep) => {
                              const providerBadge =
                                ep.provider === 'openai-compatible' ? '[OpenAI]' :
                                ep.provider === 'gemini' ? '[Gemini]' :
                                ep.provider === 'ollama' || ep.provider === 'model-server' ? '[Ollama]' :
                                `[${ep.provider || 'Ollama'}]`;
                              const label = ep.name
                                ? `${providerBadge} ${ep.name} (${ep.url})`
                                : `${providerBadge} ${ep.url}`;
                              return (
                                <option key={ep.url} value={ep.url}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                          {newModel.endpoint &&
                            newModel.endpoint !== 'manual' &&
                            availableModels.length > 0 && (
                            <div className='flex items-start gap-2 p-2 rounded-md bg-muted border border-border mt-2'>
                              <span className='text-xs text-foreground'>
                                {(() => {
                                  const ep = endpoints.find(
                                    (e) => e.url === newModel.endpoint
                                  );
                                  return ep?.name
                                    ? `${ep.name} (${ep.url})`
                                    : newModel.endpoint;
                                })()}{' '}
                                {availableModels.length}개 모델 로드됨
                              </span>
                            </div>
                          )}

                          {/* 수동 추가 시 API 설정 */}
                          {newModel.endpoint === 'manual' && (
                            <div className='mt-3 p-4 bg-muted rounded-lg border border-border'>
                              <div className='mb-4'>
                                <p className='text-xs font-medium text-foreground mb-2'>
                                  프리셋 적용
                                </p>
                                <div className='flex flex-wrap gap-2'>
                                  <button
                                    type='button'
                                    onClick={() =>
                                    setNewModel({
                                        ...newModel,
                                        apiConfig: buildManualPreset('openai-compatible'),
                                      })
                                    }
                                    className='px-2 py-1 text-xs rounded bg-card border border-border hover:bg-accent'
                                  >
                                    OpenAI Compatible
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setNewModel({
                                        ...newModel,
                                        apiConfig: buildManualPreset('responses'),
                                      })
                                    }
                                    className='px-2 py-1 text-xs rounded bg-card border border-border hover:bg-accent'
                                  >
                                    Responses
                                  </button>
                                </div>
                              </div>
                              {/* API 키 입력 */}
                              <div className='mb-4'>
                                <label className='block text-sm font-medium text-foreground mb-2'>
                                  🔑 API 키
                                </label>
                                <input
                                  type='text'
                                  value={newModel.apiKey || ''}
                                  onChange={(e) => {
                                    setNewModel({
                                      ...newModel,
                                      apiKey: e.target.value
                                    });
                                  }}
                                  placeholder='API 키를 입력하세요'
                                  className='w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-transparent'
                                />
                                <p className='text-xs text-muted-foreground mt-1'>
                                  API 호출 시 사용할 키입니다. 템플릿의 {'{{OPENAI_API_KEY}}'} 변수로 대체됩니다.
                                </p>
                              </div>

                              <label className='block text-sm font-medium text-foreground mb-2'>
                                🔧 API 요청 설정 (JSON)
                              </label>
                              <p className='text-xs text-muted-foreground mb-2'>
                                백엔드에서 실행할 API 요청을 JSON 형태로 작성하세요. 변수: {'{{OPENAI_API_KEY}}'}, {'{{messages}}'}, {'{{message}}'}
                              </p>
                              <textarea
                                value={newModel.apiConfig || ''}
                                onChange={(e) => {
                                  setNewModel({
                                    ...newModel,
                                    apiConfig: e.target.value
                                  });
                                }}
                                onBlur={(e) => {
                                  const normalized = normalizeJsonString(e.target.value);
                                  if (normalized !== e.target.value) {
                                    setNewModel({
                                      ...newModel,
                                      apiConfig: normalized,
                                    });
                                  }
                                }}
                                className='w-full h-64 px-3 py-2 text-xs font-mono bg-card border border-border rounded-md focus:ring-2 focus:ring-ring focus:border-transparent'
                                placeholder={`{
  "method": "POST",
  "url": "https://api.openai.com/v1/chat/completions",
  "headers": {
    "Authorization": "Bearer {{OPENAI_API_KEY}}",
    "Content-Type": "application/json"
  },
  "body": {
    "model": "gpt-4",
    "messages": "{{messages}}",
    "stream": true
  },
  "stream": true,
  "responseMapping": {
    "path": "choices[0].message.content"
  }
}`}
                              />
                              <div className='mt-2 text-xs space-y-2'>
                                <div className='p-3 bg-destructive/10 border border-destructive/20 rounded'>
                                  <p className='font-semibold text-destructive mb-2'>⚠️ 수정이 필요한 필드:</p>
                                  <ul className='list-disc ml-5 text-destructive space-y-1'>
                                    <li><code className='bg-destructive/10/40 px-1 rounded'>&quot;url&quot;</code> - API 엔드포인트 주소</li>
                                    <li><code className='bg-destructive/10/40 px-1 rounded'>&quot;model&quot;</code> - 모델명 (gpt-4, claude-3 등)</li>
                                    <li><code className='bg-destructive/10/40 px-1 rounded'>&quot;responseMapping.path&quot;</code> - 응답 경로</li>
                                  </ul>
                                </div>
                                <div className='text-muted-foreground'>
                                  <p><strong>사용 가능한 변수:</strong></p>
                                  <ul className='list-disc ml-5 mt-1'>
                                    <li><code className='bg-muted px-1 rounded'>{'{{OPENAI_API_KEY}}'}</code> - 환경변수에서 API 키 가져오기</li>
                                    <li><code className='bg-muted px-1 rounded'>{'{{messages}}'}</code> - 전체 대화 내역 (배열)</li>
                                    <li><code className='bg-muted px-1 rounded'>{'{{message}}'}</code> - 사용자의 최신 메시지 (문자열)</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className='grid grid-cols-2 gap-3'>
                          <div>
                            <label className='block text-xs font-medium text-foreground mb-1'>
                              모델명 *
                            </label>
                            <div className='relative'>
                              {(() => {
                                const effectiveEndpoint =
                                  newModel.endpoint || selectedEndpoint;
                                // 수동 추가인지 먼저 확인
                                const isManual = effectiveEndpoint === 'manual';

                                // 선택된 엔드포인트의 provider 확인
                                const normalizeUrl = (url) => {
                                  try {
                                    const urlObj = new URL(url.trim());
                                    return `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${
                                      urlObj.port ? `:${urlObj.port}` : ''
                                    }${urlObj.pathname.replace(/\/+$/, '')}`;
                                  } catch (error) {
                                    console.warn('[Catch] 에러 발생:', error.message);
                                    return url.trim().toLowerCase().replace(/\/+$/, '');
                                  }
                                };
                                const normalizedEp = effectiveEndpoint
                                  ? normalizeUrl(effectiveEndpoint)
                                  : '';
                                const endpointConfig = endpoints.find(
                                  (e) => normalizeUrl(e.url) === normalizedEp
                                );
                                const provider = endpointConfig?.provider || 'ollama';
                                const isOllama = provider === 'ollama' || provider === 'model-server';

                                // 수동 추가이거나 Ollama가 아닌 경우 input으로 표시
                                if (isManual || !isOllama) {
                                  return (
                                    <>
                                      <input
                                        type='text'
                                        value={newModel.modelName || newModel.id || ''}
                                        onChange={(e) => {
                                          const modelName = e.target.value;
                                          // 라벨이 비어있으면 모델명과 동일하게 설정
                                          const autoLabel = !newModel.label?.trim()
                                            ? modelName
                                            : newModel.label;
                                          setNewModel({
                                            ...newModel,
                                            id: modelName,
                                            modelName: modelName,
                                            label: autoLabel,
                                          });
                                        }}
                                        placeholder={
                                          isManual
                                            ? 'my-custom-model (API 설정에 사용할 식별자)'
                                            : provider === 'openai-compatible'
                                            ? 'gpt-4, gpt-3.5-turbo 등'
                                            : provider === 'gemini'
                                            ? 'gemini-pro, gemini-1.5-flash 등'
                                            : '모델명 입력'
                                        }
                                        className='input-primary text-sm'
                                      />
                                      {/* 라운드로빈 상태 태그 */}
                                      {newModel.id && (
                                        <div className='absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1'>
                                          {checkingNewModelRoundRobin ? (
                                            <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-primary'></div>
                                          ) : newModelRoundRobinInfo?.isRoundRobin ? (
                                            <span className='px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium'>
                                              RR {newModelRoundRobinInfo.serverCount}
                                            </span>
                                          ) : null}
                                        </div>
                                      )}
                                      <p className='text-xs text-muted-foreground mt-1'>
                                        {isManual
                                          ? '커스텀 API 모델의 식별자를 입력하세요'
                                          : provider === 'openai-compatible'
                                          ? 'OpenAI Compatible API 모델명을 직접 입력하세요'
                                          : provider === 'gemini'
                                          ? 'Google Gemini 모델명을 직접 입력하세요'
                                          : '모델명을 직접 입력하세요'}
                                      </p>
                                    </>
                                  );
                                }

                                // Ollama인 경우 기존 select 유지
                                return (
                                  <>
                                    <select
                                      value={newModel.modelName || newModel.id}
                                      onFocus={handleModelSelectFocus}
                                      onMouseDown={handleModelSelectFocus}
                                      onChange={(e) => {
                                        const selectedModelName = e.target.value;
                                        // 라벨이 비어있으면 모델명과 동일하게 설정
                                        const autoLabel = !newModel.label?.trim()
                                          ? selectedModelName
                                          : newModel.label;
                                        setNewModel({
                                          ...newModel,
                                          id: selectedModelName,
                                          modelName: selectedModelName,
                                          label: autoLabel,
                                        });
                                      }}
                                      className='input-primary text-sm'
                                      disabled={modelsLoading}
                                    >
                                      <option value=''>
                                        {modelsLoading
                                          ? '모델 목록 조회중...'
                                          : 'LLM 모델 선택'}
                                      </option>
                                      {/* 기존에 설정된 모델명이 있으면 표시 (모델 목록에 없어도) */}
                                      {(newModel.modelName || newModel.id) &&
                                        !availableModels.find(
                                          (m) =>
                                            m.name === newModel.modelName ||
                                            m.id === newModel.modelName ||
                                            m.name === newModel.id ||
                                            m.id === newModel.id
                                        ) && (
                                          <option
                                            key={newModel.id}
                                            value={newModel.modelName || newModel.id}
                                          >
                                            {newModel.label ||
                                              newModel.modelName ||
                                              newModel.id}
                                          </option>
                                        )}
                                      {!modelsLoading &&
                                        availableModels.map((model) => (
                                          <option
                                            key={model.id}
                                            value={model.name || model.id}
                                          >
                                            {model.name || model.id}{' '}
                                            {model.sizeFormatted
                                              ? `(${model.sizeFormatted})`
                                              : ''}
                                          </option>
                                        ))}
                                    </select>
                                    {modelsLoading && (
                                      <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
                                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-primary'></div>
                                      </div>
                                    )}
                                    {/* 라운드로빈 상태 태그 */}
                                    {newModel.id && (
                                      <div className='absolute right-10 top-1/2 transform -translate-y-1/2 flex items-center gap-1'>
                                        {checkingNewModelRoundRobin ? (
                                          <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-primary'></div>
                                        ) : newModelRoundRobinInfo?.isRoundRobin ? (
                                          <span className='px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded font-medium'>
                                            RR {newModelRoundRobinInfo.serverCount}
                                          </span>
                                        ) : null}
                                      </div>
                                    )}
                                    {availableModels.length > 0 && (
                                      <p className='text-xs text-primary mt-1'>
                                        {availableModels.length}개 LLM 모델 사용 가능
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        {newModelLabelRoundRobinInfo && (
                          <div className='mt-2 p-2 rounded bg-muted border border-border dark:border-border'>
                            <div className='text-xs text-muted-foreground'>
                              <span className='font-medium'>
                                동일 라벨 모델:
                              </span>{' '}
                              <span className='font-mono'>{newModel.id}</span>
                              {newModelLabelRoundRobinInfo.models.length >
                                0 && (
                                <>
                                  {', '}
                                  {newModelLabelRoundRobinInfo.models.map(
                                    (m, idx) => (
                                      <span key={idx}>
                                        <span className='font-mono'>
                                          {m.id}
                                        </span>
                                        {idx <
                                          newModelLabelRoundRobinInfo.models
                                            .length -
                                            1 && <span>, </span>}
                                      </span>
                                    )
                                  )}
                                </>
                              )}
                              {newModelLabelRoundRobinInfo.endpointCount >
                                1 && (
                                <span className='ml-2 text-muted-foreground dark:text-muted-foreground'>
                                  ({newModelLabelRoundRobinInfo.endpointCount}개
                                  서버)
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        <div>
                          <label className='block text-xs font-medium text-foreground mb-1'>
                            툴팁 설명
                          </label>
                          <textarea
                            value={newModel.tooltip || ''}
                            onChange={(e) =>
                              setNewModel({
                                ...newModel,
                                tooltip: e.target.value,
                              })
                            }
                            className='input-primary text-sm resize-none'
                            rows='2'
                            placeholder='모델에 대한 설명을 입력하세요'
                          />
                        </div>
                        <div>
                          <label className='block text-xs font-medium text-foreground mb-1'>
                            멀티턴 제한
                          </label>
                          <div className='flex items-center gap-3'>
                            <input
                              type='number'
                              min='1'
                              value={newModel.multiturnLimit ?? ''}
                              onChange={(e) =>
                                setNewModel({
                                  ...newModel,
                                  multiturnLimit: e.target.value,
                                })
                              }
                              className='w-24 px-2 py-1 text-sm border border-border rounded-md bg-background text-foreground'
                              disabled={newModel.multiturnUnlimited || loading}
                            />
                            <label className='inline-flex items-center gap-2 text-xs text-muted-foreground'>
                              <input
                                type='checkbox'
                                checked={!!newModel.multiturnUnlimited}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    multiturnUnlimited: e.target.checked,
                                    multiturnLimit: e.target.checked
                                      ? ''
                                      : newModel.multiturnLimit,
                                  })
                                }
                                className='h-4 w-4'
                                disabled={loading}
                              />
                              제한 없음
                            </label>
                          </div>
                          <p className='text-xs text-muted-foreground mt-1'>
                            모델별 멀티턴 기억 개수입니다.
                          </p>
                        </div>
                        <div>
                          {(() => {
                            // 라운드로빈 그룹의 첫 번째 모델 찾기
                            let firstModelInfo = null;
                            if (newModel.label && modelConfig) {
                              const normalizedLabel = normalizeLabel(
                                newModel.label
                              );
                              const group = normalizedLabel
                                ? modelLabelRoundRobinMap[normalizedLabel]
                                : null;

                              if (
                                group?.isRoundRobin &&
                                group.members.length > 0
                              ) {
                                // 첫 번째 모델 찾기 (정렬된 순서)
                                const sortedMembers = [...group.members].sort(
                                  (a, b) => {
                                    if (a.categoryKey !== b.categoryKey) {
                                      return a.categoryKey.localeCompare(
                                        b.categoryKey
                                      );
                                    }
                                    return a.modelIndex - b.modelIndex;
                                  }
                                );

                                const firstMember = sortedMembers[0];
                                const firstModel =
                                  modelConfig.categories[
                                    firstMember.categoryKey
                                  ]?.models[firstMember.modelIndex];
                                if (firstModel) {
                                  firstModelInfo = {
                                    ...firstMember,
                                    model: firstModel,
                                  };
                                }
                              }
                            }

                            const isNotFirstInRoundRobin =
                              firstModelInfo !== null;
                            const sharedSystemPrompt = isNotFirstInRoundRobin
                              ? firstModelInfo.model?.systemPrompt || []
                              : newModel.systemPrompt || [];

                            return (
                              <>
                                <label className='block text-xs font-medium text-foreground mb-1'>
                                  시스템 프롬프트
                                  <span className='text-xs text-muted-foreground'>
                                    (줄바꿈으로 구분)
                                  </span>
                                  {isNotFirstInRoundRobin && (
                                    <span className='ml-2 px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded font-medium'>
                                      공유됨
                                    </span>
                                  )}
                                </label>
                                {isNotFirstInRoundRobin ? (
                                  <div className='space-y-2'>
                                    <textarea
                                      value={
                                        (sharedSystemPrompt || []).join('\n') ||
                                        ''
                                      }
                                      disabled
                                      className='input-primary text-sm resize-none bg-muted opacity-75 cursor-not-allowed'
                                      rows='6'
                                      placeholder='당신은 Tech그룹를 위한 AI 어시스턴트입니다.&#10;가능한 경우 모든 답변을 한국어로 설명해 주세요.'
                                    />
                                    <div className='p-2 rounded bg-muted border border-border'>
                                      <p className='text-xs text-muted-foreground'>
                                        <span className='font-medium'>
                                          라운드로빈 모델:
                                        </span>{' '}
                                        시스템 프롬프트는 첫 번째 모델(
                                        <span className='font-mono'>
                                          {firstModelInfo.model?.id}
                                        </span>
                                        )과 공유됩니다. 시스템 프롬프트를
                                        수정하려면 첫 번째 모델을 편집해주세요.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <textarea
                                    value={
                                      (newModel.systemPrompt || []).join(
                                        '\n'
                                      ) || ''
                                    }
                                    onChange={(e) =>
                                      setNewModel({
                                        ...newModel,
                                        systemPrompt: e.target.value
                                          .split('\n')
                                          .filter(
                                            (line) =>
                                              line !== null &&
                                              line !== undefined
                                          ),
                                      })
                                    }
                                    className='input-primary text-sm resize-none'
                                    rows='6'
                                    placeholder='당신은 Tech그룹를 위한 AI 어시스턴트입니다.&#10;가능한 경우 모든 답변을 한국어로 설명해 주세요.'
                                  />
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className='flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-primary/20 dark:border-border'>
                          <div className='flex items-center gap-4 flex-wrap'>
                            <label className='flex items-center gap-2 cursor-pointer'>
                              <input
                                type='checkbox'
                                checked={newModel.isDefault}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    isDefault: e.target.checked,
                                  })
                                }
                                className='w-4 h-4 text-primary bg-muted border-border rounded focus:ring-ring'
                              />
                              <span className='text-sm text-foreground'>
                                기본 모델
                              </span>
                            </label>
                            <label className='flex items-center gap-2 cursor-pointer'>
                              <input
                                type='checkbox'
                                checked={newModel.adminOnly}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    adminOnly: e.target.checked,
                                  })
                                }
                                className='w-4 h-4 text-destructive bg-muted border-border rounded focus:ring-ring'
                              />
                              <span className='text-sm text-foreground'>
                                관리자 전용
                              </span>
                            </label>
                            <label className='flex items-center gap-2 cursor-pointer'>
                              <input
                                type='checkbox'
                                checked={newModel.visible}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    visible: e.target.checked,
                                  })
                                }
                                className='w-4 h-4 text-muted-foreground bg-muted border-border rounded focus:ring-ring'
                              />
                              <span className='text-sm text-foreground'>
                                메인 화면 표시
                              </span>
                            </label>
                            <label className='flex items-center gap-2 cursor-pointer'>
                              <input
                                type='checkbox'
                                checked={!!newModel.piiFilterRequest}
                                onChange={(e) =>
                                  setNewModel({
                                    ...newModel,
                                    piiFilterRequest: e.target.checked,
                                  })
                                }
                                className='w-4 h-4 text-muted-foreground bg-muted border-border rounded focus:ring-ring'
                              />
                              <span className='text-sm text-foreground'>
                                요청 PII 필터
                              </span>
                            </label>
                             {/* [출력 PII 임시 비활성화]
                             <label className='flex items-center gap-2 cursor-pointer'>
                               <input
                                 type='checkbox'
                                 checked={!!newModel.piiFilterResponse}
                                 onChange={(e) =>
                                   setNewModel({
                                     ...newModel,
                                     piiFilterResponse: e.target.checked,
                                   })
                                 }
                                 className='w-4 h-4 text-muted-foreground bg-muted border-border rounded focus:ring-ring'
                               />
                               <span className='text-sm text-foreground'>
                                 응답 PII 필터
                               </span>
                             </label>
                             */}
                          </div>
                          <div className='flex gap-2'>
                            <button
                              onClick={() => addModel(categoryKey)}
                              className='px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors flex items-center gap-1'
                            >
                              <Plus className='h-3.5 w-3.5' /> 추가
                            </button>
                            <button
                              onClick={() => {
                                setShowAddForm({ category: null, show: false });
                                setNewModel({
                                  id: '',
                                  label: '',
                                  tooltip: '',
                                  isDefault: false,
                                  adminOnly: false,
                                  visible: true,
                                  systemPrompt: [],
                                  endpoint: '',
                                  piiFilterRequest: false,
                                  piiFilterResponse: false,
                                  piiRequestMxtVrf: true,
                                  piiRequestMaskOpt: true,
                                  piiResponseMxtVrf: true,
                                  piiResponseMaskOpt: true,
                                });
                              }}
                              className='px-3 py-1.5 text-xs font-medium rounded-lg bg-muted hover:bg-accent dark:bg-muted dark:hover:bg-accent text-foreground transition-colors flex items-center gap-1'
                            >
                              <X className='h-3.5 w-3.5' /> 취소
                            </button>
                          </div>
                          {(newModel.piiFilterRequest /* || newModel.piiFilterResponse [출력 PII 임시 비활성화] */) && (
                            <div className='w-full text-xs text-muted-foreground space-y-1'>
                              {newModel.piiFilterRequest && (
                                <div className='flex items-center gap-2 flex-wrap'>
                                  <span className='font-medium'>요청 옵션</span>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setNewModel((prev) => ({
                                        ...prev,
                                        piiRequestMxtVrf: !prev.piiRequestMxtVrf,
                                      }))
                                    }
                                    className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                      newModel.piiRequestMxtVrf
                                        ? 'bg-primary/10 border-primary/30 dark:border-border text-primary dark:text-primary'
                                        : 'bg-muted border-border text-muted-foreground'
                                    }`}
                                  >
                                    mxt_vrf {newModel.piiRequestMxtVrf ? 'ON' : 'OFF'}
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setNewModel((prev) => ({
                                        ...prev,
                                        piiRequestMaskOpt: !prev.piiRequestMaskOpt,
                                      }))
                                    }
                                    className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                      newModel.piiRequestMaskOpt
                                        ? 'bg-primary/10 border-primary/30 dark:border-border text-primary dark:text-primary'
                                        : 'bg-muted border-border text-muted-foreground'
                                    }`}
                                  >
                                    mask_opt {newModel.piiRequestMaskOpt ? 'ON' : 'OFF'}
                                  </button>
                                </div>
                              )}
                              {/* [출력 PII 임시 비활성화]
                              {newModel.piiFilterResponse && (
                                <div className='flex items-center gap-2 flex-wrap'>
                                  <span className='font-medium'>응답 옵션</span>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setNewModel((prev) => ({
                                        ...prev,
                                        piiResponseMxtVrf:
                                          !prev.piiResponseMxtVrf,
                                      }))
                                    }
                                    className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                      newModel.piiResponseMxtVrf
                                        ? 'bg-primary/10 border-primary/30 dark:border-border text-primary dark:text-primary'
                                        : 'bg-muted border-border text-muted-foreground'
                                    }`}
                                  >
                                    mxt_vrf {newModel.piiResponseMxtVrf ? 'ON' : 'OFF'}
                                  </button>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setNewModel((prev) => ({
                                        ...prev,
                                        piiResponseMaskOpt:
                                          !prev.piiResponseMaskOpt,
                                      }))
                                    }
                                    className={`font-mono px-2 py-0.5 rounded border transition-colors ${
                                      newModel.piiResponseMaskOpt
                                        ? 'bg-primary/10 border-primary/30 dark:border-border text-primary dark:text-primary'
                                        : 'bg-muted border-border text-muted-foreground'
                                    }`}
                                  >
                                    mask_opt {newModel.piiResponseMaskOpt ? 'ON' : 'OFF'}
                                  </button>
                                </div>
                              )}
                              */}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </DndContext>
        </div>
      </div>

      {/* 사용법 안내 */}
      <div className='bg-primary/10 border border-primary/20 rounded-lg p-5'>
        <div className='flex items-start gap-3'>
          <div className='flex-shrink-0 text-2xl'>💡</div>
          <div className='flex-1'>
            <h3 className='text-sm font-semibold text-foreground mb-3'>
              사용법 안내
            </h3>
            <ul className='text-sm text-primary space-y-2'>
              <li className='flex items-start gap-2'>
                <span className='text-primary flex-shrink-0'>
                  •
                </span>
                <span>
                  <strong>LLM 모델:</strong> 일반적인 AI 대화에 사용되는
                  모델입니다. 드래그하여 순서를 변경할 수 있습니다.
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-primary flex-shrink-0'>
                  •
                </span>
                <span>
                  <strong>표시 이름 라운드로빈:</strong> 동일한 표시 이름을 가진
                  여러 모델을 등록하면 요청이 자동으로 분산됩니다. 부하 분산과
                  고가용성을 위해 사용하세요.
                </span>
              </li>
              <li className='flex items-start gap-2'>
                <span className='text-primary flex-shrink-0'>
                  •
                </span>
                <span>
                  각 카테고리당 하나의 기본 모델을 설정할 수 있으며, 설정 변경
                  후 반드시 저장 버튼을 클릭하세요.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 오류 로그 */}
      <div className='card p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <RefreshCw className='h-5 w-5 text-muted-foreground' />
            <h2 className='text-lg font-semibold text-foreground'>
              오류 로그
            </h2>
          </div>
          <button
            onClick={() => fetchErrorLogs()}
            disabled={errorLogsLoading}
            className='btn-secondary flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                errorLogsLoading ? 'animate-spin' : ''
              }`}
            />
            {errorLogsLoading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>

        <div className='flex flex-wrap items-center gap-2 text-sm mb-3'>
          <span className='text-muted-foreground'>소스</span>
          {['all', 'server', 'api', 'client'].map((source) => (
            <button
              key={source}
              onClick={() => setErrorLogsSource(source)}
              className={`px-3 py-1 rounded-md border text-xs font-medium ${
                errorLogsSource === source
                  ? 'bg-primary text-white border-primary'
                  : 'bg-card text-foreground border-border'
              }`}
            >
              {source === 'all'
                ? '전체'
                : source === 'server'
                ? '서버'
                : source === 'api'
                ? 'API'
                : '클라이언트'}
            </button>
          ))}
          <span className='ml-2 text-muted-foreground'>레벨</span>
          {['all', 'error', 'warn'].map((level) => (
            <button
              key={level}
              onClick={() => setErrorLogsLevel(level)}
              className={`px-3 py-1 rounded-md border text-xs font-medium ${
                errorLogsLevel === level
                  ? 'bg-foreground text-white border-foreground dark:bg-muted dark:text-foreground dark:border-border'
                  : 'bg-card text-foreground border-border'
              }`}
            >
              {level === 'all' ? '전체' : level.toUpperCase()}
            </button>
          ))}
          <span className='ml-auto text-xs text-muted-foreground'>
            총 {errorLogsTotal}건
          </span>
        </div>

        <div className='border border-border rounded-lg overflow-hidden'>
          {errorLogs.length === 0 ? (
            <div className='p-4 text-sm text-muted-foreground'>
              표시할 로그가 없습니다.
            </div>
          ) : (
            <div className='divide-y divide-border'>
              {errorLogs.map((log) => (
                <div key={log.id} className='p-4 text-sm'>
                  <div className='flex flex-wrap items-center gap-2 mb-1 text-xs text-muted-foreground'>
                    <span>{formatLogTime(log.created_at)}</span>
                    <span>•</span>
                    <span>{log.source}</span>
                    <span>•</span>
                    <span className='uppercase'>{log.level}</span>
                    {log.request_path && (
                      <>
                        <span>•</span>
                        <span>{log.request_path}</span>
                      </>
                    )}
                  </div>
                  <div className='text-foreground break-words'>
                    {log.message}
                  </div>
                  {log.stack && (
                    <pre className='mt-2 text-xs text-muted-foreground whitespace-pre-wrap'>
                      {log.stack}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
