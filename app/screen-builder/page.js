'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Trash2,
  Edit3,
  Copy,
  Eye,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  CheckCircle2,
} from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';
import dynamic from 'next/dynamic';
const SiteMenuSelector = dynamic(() => import('@/components/SiteMenuSelector'), { ssr: false });

// Layout icon inline (not in ModolAI icons)
function LayoutIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  );
}

// 상태 배지
function StatusBadge({ status, t }) {
  const cfg = {
    published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  const labelKey = {
    published: 'screen_builder.status_published',
    draft: 'screen_builder.status_draft',
    archived: 'screen_builder.status_archived',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg[status] || cfg.draft}`}>
      {t(labelKey[status] || 'screen_builder.status_draft')}
    </span>
  );
}

// 화면 카드
function ScreenCard({ screen, onEdit, onDelete, t }) {
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`"${screen.name}" ${t('screen_builder.confirm_delete')}`)) return;
    setDeleting(true);
    await onDelete(screen.id);
    setDeleting(false);
  };

  const handleCopyLink = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/s/${screen.share_id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updatedAt = screen.updated_at
    ? new Date(screen.updated_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '-';

  return (
    <div
      className="group relative bg-background rounded-xl border border-border hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all cursor-pointer p-5"
      onClick={() => onEdit(screen.id)}
    >
      {/* 상단: 아이콘 + 이름 + 상태 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
            <LayoutIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground line-clamp-1">
              {screen.name || t('screen_builder.no_name')}
            </h3>
            <div className="mt-1">
              <StatusBadge status={screen.status} t={t} />
            </div>
          </div>
        </div>
      </div>

      {/* 설명 */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 min-h-[2rem]">
        {screen.description || t('screen_builder.no_description')}
      </p>

      {/* 하단: 메타 + 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {updatedAt}
          </span>
          {screen.view_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {screen.view_count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 공유 링크 복사 (게시된 화면만) */}
          {screen.share_id && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded-md hover:bg-purple-50 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400 transition-colors"
              title={t('screen_builder.copy_share_link')}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          )}

          {/* 편집 버튼 */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(screen.id);
            }}
            className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
            title={t('screen_builder.edit')}
          >
            <Edit3 className="w-4 h-4" />
          </button>

          {/* 삭제 버튼 */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 disabled:opacity-50 transition-colors"
            title={t('screen_builder.delete')}
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

// 화면 목록 페이지
export default function ScreenBuilderListPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [screens, setScreens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // 인증 헤더 생성
  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchScreens = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/screens', {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(t('screen_builder.load_failed'));
      const data = await res.json();
      setScreens(data.screens || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, t]);

  useEffect(() => {
    fetchScreens();
  }, [fetchScreens]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: t('screen_builder.new_screen'), description: '' }),
      });
      if (!res.ok) throw new Error(t('screen_builder.create_failed'));
      const data = await res.json();
      const newId = data.screen?.id;
      if (newId) router.push(`/screen-builder/${newId}`);
      else fetchScreens();
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/screens/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(t('screen_builder.delete_failed'));
      setScreens((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEdit = (id) => {
    router.push(`/screen-builder/${id}`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <SiteMenuSelector />
      <div className="max-w-6xl mx-auto p-6">
        {/* 개발중 안내 배너 */}
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{t('screen_builder.wip_notice')}</span>
        </div>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 shadow-md">
              <LayoutIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {t('screen_builder.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('screen_builder.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-lg shadow-sm transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t('screen_builder.create_new')}
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            <button
              type="button"
              onClick={fetchScreens}
              className="ml-auto text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
            >
              {t('screen_builder.retry')}
            </button>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {/* 빈 상태 */}
        {!loading && !error && screens.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 rounded-2xl bg-muted mb-4">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">
              {t('screen_builder.empty_title')}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {t('screen_builder.empty_description')}
            </p>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />{t('screen_builder.create_new')}
            </button>
          </div>
        )}

        {/* 화면 그리드 */}
        {!loading && screens.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {screens.map((sc) => (
              <ScreenCard
                key={sc.id}
                screen={sc}
                onEdit={handleEdit}
                onDelete={handleDelete}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
