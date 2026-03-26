'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Play,
  Trash2,
  Edit3,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
} from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';
import SiteMenuSelector from '@/components/SiteMenuSelector';

// Status badge component
function StatusBadge({ status }) {
  const { t } = useTranslation();
  const cfg = {
    published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  const label = status === 'published' ? t('workflow.status_published') : t('workflow.status_draft');
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg[status] || cfg.draft}`}
    >
      {label}
    </span>
  );
}

// Workflow card
function WorkflowCard({ workflow, onEdit, onDelete, onRun }) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`"${workflow.name}" ${t('workflow.confirm_delete')}`)) return;
    setDeleting(true);
    await onDelete(workflow.id);
    setDeleting(false);
  };

  const updatedAt = workflow.updated_at
    ? new Date(workflow.updated_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

  return (
    <div
      className="group relative bg-background rounded-xl border border-border hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer p-5"
      onClick={() => onEdit(workflow.id)}
    >
      {/* Top: icon + name + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground line-clamp-1">
              {workflow.name || t('workflow.unnamed')}
            </h3>
            <div className="mt-1">
              <StatusBadge status={workflow.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 min-h-[2rem]">
        {workflow.description || t('workflow.no_description')}
      </p>

      {/* Bottom: updated date + buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{updatedAt}</span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Test run button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRun(workflow.id);
            }}
            className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
            title={t('workflow.run_test')}
          >
            <Play className="w-4 h-4" />
          </button>

          {/* Edit button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(workflow.id);
            }}
            className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
            title={t('workflow.edit')}
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 disabled:opacity-50 transition-colors"
            title={t('workflow.delete')}
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Workflow list page
export default function WorkflowListPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/workflows', {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(t('workflow.error_load_list'));
      const data = await res.json();
      setWorkflows(data.workflows || data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, t]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          name: t('workflow.new_workflow_name'),
          description: '',
          status: 'draft',
          nodes: [],
          edges: [],
        }),
      });
      if (!res.ok) throw new Error(t('workflow.error_create'));
      const data = await res.json();
      const newId = data.id || data.workflow?.id;
      if (newId) router.push(`/workflow/${newId}`);
      else fetchWorkflows();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(t('workflow.error_delete'));
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (id) => {
    router.push(`/workflow/${id}`);
  };

  const handleRun = (id) => {
    router.push(`/workflow/${id}?test=1`);
  };

  return (
    <div className="min-h-screen bg-muted">
      <SiteMenuSelector />
      <div className="max-w-6xl mx-auto p-6">
        {/* Dev banner */}
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t('workflow.dev_banner')}</span>
        </div>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('workflow.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('workflow.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold text-sm rounded-lg shadow-sm transition-colors"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {t('workflow.new_workflow')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={fetchWorkflows}
              className="ml-auto text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              {t('workflow.retry')}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && workflows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 rounded-2xl bg-muted mb-4">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              {t('workflow.empty_title')}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('workflow.empty_description')}
            </p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />{t('workflow.create_first')}
            </button>
          </div>
        )}

        {/* Workflow grid */}
        {!loading && workflows.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRun={handleRun}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
