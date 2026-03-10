'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bot,
  Users,
  Building2,
  User,
  Shield,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  RefreshCw,
  Search,
  Save,
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';

const DEFAULT_AGENT_SETTINGS = {
  selectedModelId: '',
  defaultSlideCount: 8,
  defaultTheme: 'light',
  defaultTone: 'business',
  allowUserModelOverride: false,
};

// 권한 타입 라벨
const PERMISSION_TYPE_LABELS = {
  all: '전체',
  role: '역할별',
  department: '부서별',
  user: '개별 사용자',
};

// 역할 라벨
const ROLE_LABELS = {
  admin: '관리자',
  user: '일반 사용자',
};

const STATIC_AGENTS = [
  {
    id: '1',
    name: 'AI 가상회의',
    description:
      '인원수, 페르소나, 주제, 대화 개수를 설정하면 AI가 토론 결과를 제공합니다',
  },
  {
    id: '2',
    name: '코드 컨버터',
    description: 'A언어에서 B언어로 코드를 변환해 드립니다',
  },
  {
    id: '3',
    name: 'Text to SQL',
    description: '엑셀 업로드 후 자연어로 질문하면 데이터를 조회해 드립니다',
  },
  {
    id: '4',
    name: '텍스트 재작성 도구',
    description:
      '목적(메일, 쪽지, 보고서)과 톤(정중한, 공손한)에 맞게 텍스트를 재작성해 드립니다',
  },
  {
    id: '5',
    name: '에러 해결 도우미',
    description: '코드와 에러 메시지를 입력하면 원인 파악을 도와드립니다',
  },
  {
    id: '6',
    name: 'Solgit 프로젝트 리뷰어',
    description: 'Solgit 프로젝트를 지정하면 코드 파일들에 대한 LLM 리뷰를 제공합니다',
  },
  {
    id: '7',
    name: 'PPT 에이전트',
    description: '주제와 포맷을 입력하면 AI가 프레젠테이션을 생성해 드립니다',
  },
];

export default function AgentsManagePage() {
  const { alert, confirm } = useAlert();
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_AGENT_SETTINGS);

  // 권한 추가 폼 상태
  const [newPermission, setNewPermission] = useState({
    permissionType: 'role',
    permissionValue: '',
    isAllowed: true,
  });
  const [userSearch, setUserSearch] = useState('');

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [agentsResponse, settingsResponse] = await Promise.all([
        fetch('/api/admin/agents', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch('/api/admin/agents/settings', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      if (!agentsResponse.ok) {
        throw new Error('데이터를 불러오는데 실패했습니다');
      }
      if (!settingsResponse.ok) {
        throw new Error('에이전트 설정 데이터를 불러오는데 실패했습니다');
      }

      const data = await agentsResponse.json();
      const settingsData = await settingsResponse.json();
      const settingsByAgent = settingsData?.settingsByAgent || {};

      const apiAgents = Array.isArray(data.agents) ? data.agents : [];
      const apiAgentMap = new Map(apiAgents.map((agent) => [agent.id, agent]));
      const mergedAgents = STATIC_AGENTS.map((agent) => {
        const apiAgent = apiAgentMap.get(agent.id);
        const savedSettings = settingsByAgent[agent.id] || DEFAULT_AGENT_SETTINGS;
        if (apiAgent) {
          return {
            ...agent,
            ...apiAgent,
            settings: {
              ...DEFAULT_AGENT_SETTINGS,
              ...savedSettings,
            },
            permissions: Array.isArray(apiAgent.permissions)
              ? apiAgent.permissions
              : [],
          };
        }
        return {
          ...agent,
          settings: {
            ...DEFAULT_AGENT_SETTINGS,
            ...savedSettings,
          },
          permissions: [],
        };
      });
      setAgents(mergedAgents);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setDepartments(Array.isArray(data.departments) ? data.departments : []);
      setModelOptions(Array.isArray(settingsData.modelOptions) ? settingsData.modelOptions : []);

      // 첫 번째 에이전트 선택
      if (mergedAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(mergedAgents[0]);
        setSettingsForm({
          ...DEFAULT_AGENT_SETTINGS,
          ...(mergedAgents[0].settings || {}),
        });
      } else if (selectedAgent) {
        // 선택된 에이전트 업데이트
        const updated = mergedAgents.find((a) => a.id === selectedAgent.id);
        if (updated) {
          setSelectedAgent(updated);
          setSettingsForm({
            ...DEFAULT_AGENT_SETTINGS,
            ...(updated.settings || {}),
          });
        }
      }
    } catch (error) {
      alert(error.message, 'error', '오류');
    } finally {
      setLoading(false);
    }
  }, [alert, selectedAgent]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    setSettingsForm({
      ...DEFAULT_AGENT_SETTINGS,
      ...(selectedAgent.settings || {}),
    });
  }, [selectedAgent]);

  // 권한 추가
  const handleAddPermission = async () => {
    if (!selectedAgent) return;

    if (newPermission.permissionType !== 'all' && !newPermission.permissionValue) {
      alert('권한 대상을 선택해주세요', 'warning', '경고');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          ...newPermission,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '권한 추가에 실패했습니다');
      }

      alert('권한이 추가되었습니다', 'success', '성공');
      setShowAddModal(false);
      setNewPermission({ permissionType: 'role', permissionValue: '', isAllowed: true });
      setUserSearch('');
      fetchData();
    } catch (error) {
      alert(error.message, 'error', '오류');
    }
  };

  // 권한 삭제
  const handleDeletePermission = async (permissionId) => {
    const confirmed = await confirm(
      '이 권한 설정을 삭제하시겠습니까?',
      '권한 삭제',
      'warning'
    );

    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/agents?id=${permissionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('권한 삭제에 실패했습니다');
      }

      alert('권한이 삭제되었습니다', 'success', '성공');
      fetchData();
    } catch (error) {
      alert(error.message, 'error', '오류');
    }
  };

  // 권한 값 표시
  const getPermissionValueLabel = (permission) => {
    if (permission.permission_type === 'all') {
      return '전체 사용자';
    }
    if (permission.permission_type === 'role') {
      return ROLE_LABELS[permission.permission_value] || permission.permission_value;
    }
    if (permission.permission_type === 'department') {
      return permission.permission_value;
    }
    if (permission.permission_type === 'user') {
      const user = users.find(u => u.id === permission.permission_value);
      return user ? `${user.name || user.email} (${user.email})` : permission.permission_value;
    }
    return permission.permission_value;
  };

  // 필터링된 사용자 목록
  const filteredUsers = (users || []).filter(user => {
    const searchLower = userSearch.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      (user.name && user.name.toLowerCase().includes(searchLower)) ||
      (user.department && user.department.toLowerCase().includes(searchLower))
    );
  });

  const handleSaveSettings = async () => {
    if (!selectedAgent) return;

    try {
      setSettingsSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/agents/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          settings: settingsForm,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '에이전트 설정 저장에 실패했습니다.');
      }

      alert(data.message || '에이전트 설정이 저장되었습니다.', 'success', '성공');
      fetchData();
    } catch (error) {
      alert(error.message, 'error', '오류');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            에이전트 관리
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            에이전트별 접근 권한을 설정합니다
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 에이전트 목록 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              에이전트 목록
            </h2>
          </div>
          <div className="p-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedAgent?.id === agent.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bot className={`h-5 w-5 ${
                    selectedAgent?.id === agent.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${
                      selectedAgent?.id === agent.id
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {agent.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {agent.description}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    (agent.permissions?.length ?? 0) === 0
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {(agent.permissions?.length ?? 0) === 0 ? '전체 허용' : `${agent.permissions?.length ?? 0}개 규칙`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 권한 설정 */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow">
          {selectedAgent ? (
            <>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedAgent.name} 권한 설정
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedAgent.description}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  권한 추가
                </button>
              </div>

              <div className="p-4">
                {(selectedAgent.permissions?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">권한 제한 없음</p>
                    <p className="text-sm">모든 사용자가 이 에이전트에 접근할 수 있습니다</p>
                    <p className="text-xs mt-2 text-gray-400">
                      권한을 추가하면 해당 조건에 맞는 사용자만 접근 가능합니다
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedAgent.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {permission.permission_type === 'all' && <Users className="h-5 w-5 text-purple-500" />}
                          {permission.permission_type === 'role' && <Shield className="h-5 w-5 text-blue-500" />}
                          {permission.permission_type === 'department' && <Building2 className="h-5 w-5 text-green-500" />}
                          {permission.permission_type === 'user' && <User className="h-5 w-5 text-orange-500" />}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {getPermissionValueLabel(permission)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {PERMISSION_TYPE_LABELS[permission.permission_type]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${
                            permission.is_allowed
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {permission.is_allowed ? (
                              <><Check className="h-4 w-4" /> 허용</>
                            ) : (
                              <><X className="h-4 w-4" /> 차단</>
                            )}
                          </span>
                          <button
                            onClick={() => handleDeletePermission(permission.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {selectedAgent.name} 설정
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      에이전트별 기본 동작과 모델 사용 정책을 관리합니다
                    </p>
                  </div>
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="btn-primary flex items-center gap-2 disabled:opacity-60"
                  >
                    {settingsSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    설정 저장
                  </button>
                </div>

                {selectedAgent.id === '7' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        기본 모델 (/admin/models 등록 모델)
                      </label>
                      <select
                        value={settingsForm.selectedModelId || ''}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            selectedModelId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">선택 안 함 (기본 모델 사용)</option>
                        {settingsForm.selectedModelId &&
                        !modelOptions.some((model) => model.id === settingsForm.selectedModelId) ? (
                          <option value={settingsForm.selectedModelId}>
                            현재 저장 모델 (비활성/삭제됨)
                          </option>
                        ) : null}
                        {modelOptions.map((model) => (
                          <option key={model.id} value={model.id}>
                            [{model.categoryLabel}] {model.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        기본 슬라이드 수
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={settingsForm.defaultSlideCount}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            defaultSlideCount: Number(e.target.value || 1),
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        기본 테마
                      </label>
                      <select
                        value={settingsForm.defaultTheme}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            defaultTheme: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="light">라이트</option>
                        <option value="dark">다크</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        기본 톤
                      </label>
                      <select
                        value={settingsForm.defaultTone}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            defaultTone: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="business">비즈니스</option>
                        <option value="casual">캐주얼</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="allow-user-model-override"
                        type="checkbox"
                        checked={settingsForm.allowUserModelOverride === true}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            allowUserModelOverride: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <label
                        htmlFor="allow-user-model-override"
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        사용자 모델 직접 선택 허용
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    현재 선택한 에이전트는 추가 설정 항목이 없습니다. (PPT 메이커는 모델/기본값 설정 가능)
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>에이전트를 선택하세요</p>
            </div>
          )}
        </div>
      </div>

      {/* 권한 추가 모달 */}
      {showAddModal && selectedAgent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowAddModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedAgent.name} 권한 추가
              </h3>

              <div className="space-y-4">
                {/* 권한 타입 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    권한 타입
                  </label>
                  <select
                    value={newPermission.permissionType}
                    onChange={(e) => {
                      setNewPermission({
                        ...newPermission,
                        permissionType: e.target.value,
                        permissionValue: '',
                      });
                      setUserSearch('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="role">역할별</option>
                    <option value="department">부서별</option>
                    <option value="user">개별 사용자</option>
                    <option value="all">전체</option>
                  </select>
                </div>

                {/* 권한 대상 */}
                {newPermission.permissionType === 'role' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      역할 선택
                    </label>
                    <select
                      value={newPermission.permissionValue}
                      onChange={(e) => setNewPermission({ ...newPermission, permissionValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">선택하세요</option>
                      <option value="admin">관리자</option>
                      <option value="user">일반 사용자</option>
                    </select>
                  </div>
                )}

                {newPermission.permissionType === 'department' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      부서 선택
                    </label>
                    <select
                      value={newPermission.permissionValue}
                      onChange={(e) => setNewPermission({ ...newPermission, permissionValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">선택하세요</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newPermission.permissionType === 'user' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      사용자 선택
                    </label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="이름, 이메일, 부서로 검색..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                      {filteredUsers.slice(0, 50).map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setNewPermission({ ...newPermission, permissionValue: user.id })}
                          className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            newPermission.permissionValue === user.id
                              ? 'bg-blue-50 dark:bg-blue-900/30'
                              : ''
                          }`}
                        >
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {user.name || '(이름 없음)'}
                            {user.role === 'admin' && (
                              <span className="ml-1 text-xs text-red-600">(관리자)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user.email} {user.department && `| ${user.department}`}
                          </p>
                        </button>
                      ))}
                      {filteredUsers.length > 50 && (
                        <p className="px-3 py-2 text-xs text-gray-500 text-center">
                          검색어를 입력하여 더 찾아보세요...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 허용/차단 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    접근 권한
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isAllowed"
                        checked={newPermission.isAllowed === true}
                        onChange={() => setNewPermission({ ...newPermission, isAllowed: true })}
                        className="text-blue-600"
                      />
                      <span className="text-green-600 dark:text-green-400 font-medium">허용</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isAllowed"
                        checked={newPermission.isAllowed === false}
                        onChange={() => setNewPermission({ ...newPermission, isAllowed: false })}
                        className="text-blue-600"
                      />
                      <span className="text-red-600 dark:text-red-400 font-medium">차단</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewPermission({ permissionType: 'role', permissionValue: '', isAllowed: true });
                    setUserSearch('');
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  onClick={handleAddPermission}
                  className="btn-primary"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
