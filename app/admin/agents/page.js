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
  Eye,
  EyeOff,
} from '@/components/icons';
import { useAlert } from '@/contexts/AlertContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

const DEFAULT_AGENT_SETTINGS = {
  selectedModelId: '',
  defaultSlideCount: 8,
  defaultTheme: 'light',
  defaultTone: 'business',
  allowUserModelOverride: false,
};

const PERMISSION_TYPE_LABELS = {
  all: 'All',
  role: 'By Role',
  department: 'By Group',
  user: 'Individual User',
};

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'User',
};

const STATIC_AGENTS = [
  {
    id: '7',
    name: 'PPT Maker',
    description: 'Enter a topic and format, and AI generates a presentation',
  },
];

export default function AgentsManagePage() {
  const { alert, confirm } = useAlert();
  const { isReadOnly } = useAdminAuth();
  const [agents, setAgents] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_AGENT_SETTINGS);

  const [agentVisibility, setAgentVisibility] = useState({});

  const toggleAgentVisibility = async (agentId, currentVisibility) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId,
          isVisible: !currentVisibility,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update visibility');
      }

      setAgentVisibility((prev) => ({
        ...prev,
        [agentId]: !currentVisibility,
      }));
      alert(`Agent ${!currentVisibility ? 'shown' : 'hidden'}`, 'success', 'Success');
    } catch (error) {
      alert(error.message, 'error', 'Error');
    }
  };

  const [newPermission, setNewPermission] = useState({
    permissionType: 'role',
    permissionValue: '',
    isAllowed: true,
  });
  const [userSearch, setUserSearch] = useState('');

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
        throw new Error('Failed to load data');
      }
      if (!settingsResponse.ok) {
        throw new Error('Failed to load agent settings');
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

      try {
        const visResponse = await fetch('/api/agents/list', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (visResponse.ok) {
          const visData = await visResponse.json();
          setAgentVisibility(visData.visibilityMap || {});
        }
      } catch (e) {
        console.warn('Failed to load agent visibility:', e.message);
      }
      setModelOptions(Array.isArray(settingsData.modelOptions) ? settingsData.modelOptions : []);

      if (mergedAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(mergedAgents[0]);
        setSettingsForm({
          ...DEFAULT_AGENT_SETTINGS,
          ...(mergedAgents[0].settings || {}),
        });
      } else if (selectedAgent) {
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
      alert(error.message, 'error', 'Error');
    } finally {
      setLoading(false);
    }
  }, [alert, selectedAgent]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedAgent) return;
    setSettingsForm({
      ...DEFAULT_AGENT_SETTINGS,
      ...(selectedAgent.settings || {}),
    });
  }, [selectedAgent]);

  const handleAddPermission = async () => {
    if (!selectedAgent) return;

    if (newPermission.permissionType !== 'all' && !newPermission.permissionValue) {
      alert('Please select a permission target', 'warning', 'Warning');
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
        throw new Error(error.error || 'Failed to add permission');
      }

      alert('Permission added', 'success', 'Success');
      setShowAddModal(false);
      setNewPermission({ permissionType: 'role', permissionValue: '', isAllowed: true });
      setUserSearch('');
      fetchData();
    } catch (error) {
      alert(error.message, 'error', 'Error');
    }
  };

  const handleDeletePermission = async (permissionId) => {
    const confirmed = await confirm(
      'Delete this permission setting?',
      'Delete Permission',
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
        throw new Error('Failed to delete permission');
      }

      alert('Permission deleted', 'success', 'Success');
      fetchData();
    } catch (error) {
      alert(error.message, 'error', 'Error');
    }
  };

  const getPermissionValueLabel = (permission) => {
    if (permission.permission_type === 'all') {
      return 'All Users';
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
        throw new Error(data.error || 'Failed to save agent settings.');
      }

      alert(data.message || 'Agent settings saved.', 'success', 'Success');
      fetchData();
    } catch (error) {
      alert(error.message, 'error', 'Error');
    } finally {
      setSettingsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Agent Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure access permissions per agent
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg shadow">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">
              Agents
            </h2>
          </div>
          <div className="p-2">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedAgent?.id === agent.id
                    ? 'bg-accent border border-primary/20'
                    : 'hover:bg-accent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bot className={`h-5 w-5 ${
                    selectedAgent?.id === agent.id
                      ? 'text-primary dark:text-primary'
                      : 'text-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${
                      selectedAgent?.id === agent.id
                        ? 'text-foreground'
                        : 'text-foreground'
                    }`}>
                      {agent.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {agent.description}
                    </p>
                  </div>
                  {!isReadOnly ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentVis = agentVisibility[agent.id] !== false;
                      toggleAgentVisibility(agent.id, currentVis);
                    }}
                    className='p-1 rounded hover:bg-accent transition-colors'
                    title={agentVisibility[agent.id] !== false ? 'Hide from users' : 'Show to users'}
                  >
                    {agentVisibility[agent.id] !== false ? (
                      <Eye className='h-4 w-4 text-primary' />
                    ) : (
                      <EyeOff className='h-4 w-4 text-muted-foreground' />
                    )}
                  </button>
                  ) : (
                    agentVisibility[agent.id] !== false ? (
                      <Eye className='h-4 w-4 text-muted-foreground' />
                    ) : (
                      <EyeOff className='h-4 w-4 text-muted-foreground' />
                    )
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    (agent.permissions?.length ?? 0) === 0
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {(agent.permissions?.length ?? 0) === 0 ? 'Open' : `${agent.permissions?.length ?? 0} rule(s)`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-card rounded-lg shadow">
          {selectedAgent ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {selectedAgent.name} Permissions
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedAgent.description}
                  </p>
                </div>
                {!isReadOnly && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Permission
                </button>
                )}
              </div>

              <div className="p-4">
                {(selectedAgent.permissions?.length ?? 0) === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No restrictions</p>
                    <p className="text-sm">All users can access this agent</p>
                    <p className="text-xs mt-2 text-muted-foreground">
                      Adding a permission will restrict access to matching users only
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedAgent.permissions.map((permission) => (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {permission.permission_type === 'all' && <Users className="h-5 w-5 text-muted-foreground" />}
                          {permission.permission_type === 'role' && <Shield className="h-5 w-5 text-primary" />}
                          {permission.permission_type === 'department' && <Building2 className="h-5 w-5 text-primary" />}
                          {permission.permission_type === 'user' && <User className="h-5 w-5 text-muted-foreground" />}
                          <div>
                            <p className="font-medium text-foreground">
                              {getPermissionValueLabel(permission)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {PERMISSION_TYPE_LABELS[permission.permission_type]}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${
                            permission.is_allowed
                              ? 'bg-primary/10 text-primary'
                              : 'bg-destructive/10 text-destructive'
                          }`}>
                            {permission.is_allowed ? (
                              <><Check className="h-4 w-4" /> Allow</>
                            ) : (
                              <><X className="h-4 w-4" /> Block</>
                            )}
                          </span>
                          {!isReadOnly && (
                          <button
                            onClick={() => handleDeletePermission(permission.id)}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {selectedAgent.name} Settings
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage default behavior and model policies per agent
                    </p>
                  </div>
                  {!isReadOnly && (
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 disabled:opacity-60"
                  >
                    {settingsSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save Settings
                  </button>
                  )}
                </div>

                {selectedAgent.id === '7' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Default Model (from /admin/models)
                      </label>
                      <select
                        value={settingsForm.selectedModelId || ''}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            selectedModelId: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      >
                        <option value="">None (use default model)</option>
                        {settingsForm.selectedModelId &&
                        !modelOptions.some((model) => model.id === settingsForm.selectedModelId) ? (
                          <option value={settingsForm.selectedModelId}>
                            Current saved model (disabled/deleted)
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
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Default Slide Count
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
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Default Theme
                      </label>
                      <select
                        value={settingsForm.defaultTheme}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            defaultTheme: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Default Tone
                      </label>
                      <select
                        value={settingsForm.defaultTone}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            defaultTone: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      >
                        <option value="business">Business</option>
                        <option value="casual">Casual</option>
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
                        className="h-4 w-4 rounded border-border text-primary"
                      />
                      <label
                        htmlFor="allow-user-model-override"
                        className="text-sm text-foreground"
                      >
                        Allow user to select model
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                    No additional settings for this agent. (PPT Maker supports model/default configuration)
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Select an agent</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && selectedAgent && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setShowAddModal(false)}
            />
            <div className="relative bg-card rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Add Permission for {selectedAgent.name}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Permission Type
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
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  >
                    <option value="role">By Role</option>
                    <option value="department">By Group</option>
                    <option value="user">Individual User</option>
                    <option value="all">All</option>
                  </select>
                </div>

                {newPermission.permissionType === 'role' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Role
                    </label>
                    <select
                      value={newPermission.permissionValue}
                      onChange={(e) => setNewPermission({ ...newPermission, permissionValue: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    >
                      <option value="">Select</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                )}

                {newPermission.permissionType === 'department' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select Group
                    </label>
                    <select
                      value={newPermission.permissionValue}
                      onChange={(e) => setNewPermission({ ...newPermission, permissionValue: e.target.value })}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                    >
                      <option value="">Select</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newPermission.permissionType === 'user' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Select User
                    </label>
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by name, email, or group..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-background text-foreground"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                      {filteredUsers.slice(0, 50).map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setNewPermission({ ...newPermission, permissionValue: user.id })}
                          className={`w-full text-left px-3 py-2 hover:bg-accent ${
                            newPermission.permissionValue === user.id
                              ? 'bg-primary/10'
                              : ''
                          }`}
                        >
                          <p className="font-medium text-foreground text-sm">
                            {user.name || '(No name)'}
                            {user.role === 'admin' && (
                              <span className="ml-1 text-xs text-destructive">(Admin)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {user.email} {user.department && `| ${user.department}`}
                          </p>
                        </button>
                      ))}
                      {filteredUsers.length > 50 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground text-center">
                          Type a search term to find more...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Access
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isAllowed"
                        checked={newPermission.isAllowed === true}
                        onChange={() => setNewPermission({ ...newPermission, isAllowed: true })}
                        className="text-primary"
                      />
                      <span className="text-primary font-medium">Allow</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="isAllowed"
                        checked={newPermission.isAllowed === false}
                        onChange={() => setNewPermission({ ...newPermission, isAllowed: false })}
                        className="text-primary"
                      />
                      <span className="text-destructive font-medium">Block</span>
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
                  className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPermission}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
