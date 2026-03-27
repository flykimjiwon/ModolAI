'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Lock, ExternalLink } from '@/components/icons';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/hooks/useTranslation';
const ScreenRenderer = dynamic(() => import('@/components/screen-builder/ScreenRenderer'), { ssr: false });

// 비밀번호 입력 폼
function PasswordForm({ screenName, shareId, onSuccess }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/screens/share/${shareId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('screen_builder.wrong_password'));
      }
      const data = await res.json();
      onSuccess(data.screen);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-muted rounded-full">
            <Lock className="w-7 h-7 text-muted-foreground" />
          </div>
        </div>
        <h2 className="text-lg font-bold text-foreground text-center mb-1">
          {screenName || t('screen_builder.password_protected')}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {t('screen_builder.password_required')}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('screen_builder.enter_password')}
            required
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-semibold text-sm rounded-lg transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('screen_builder.confirm')}
          </button>
        </form>
      </div>
    </div>
  );
}

// 403 화면
function ForbiddenPage({ t }) {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-6xl font-black text-muted mb-4">403</div>
        <h2 className="text-xl font-bold text-foreground mb-2">{t('screen_builder.forbidden_title')}</h2>
        <p className="text-sm text-muted-foreground">{t('screen_builder.forbidden_description')}</p>
      </div>
    </div>
  );
}

// 공유 페이지 메인
export default function SharePage() {
  const { shareId } = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const [screen, setScreen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);
  const [requireAuth, setRequireAuth] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [passwordScreenMeta, setPasswordScreenMeta] = useState(null);

  useEffect(() => {
    const fetchScreen = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/screens/share/${shareId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();

        if (res.status === 401) {
          if (data.requireAuth) {
            setRequireAuth(true);
          }
          return;
        }

        if (res.status === 403) {
          setForbidden(true);
          return;
        }

        if (!res.ok) {
          setError(data.error || t('screen_builder.load_failed'));
          return;
        }

        if (data.requirePassword) {
          setRequirePassword(true);
          setPasswordScreenMeta(data.screen);
          return;
        }

        setScreen(data.screen);
      } catch {
        setError(t('screen_builder.load_error'));
      } finally {
        setLoading(false);
      }
    };
    fetchScreen();
  }, [shareId, t]);

  // 로그인 리다이렉트
  useEffect(() => {
    if (requireAuth) {
      router.push(`/login?redirect=/s/${shareId}`);
    }
  }, [requireAuth, shareId, router]);

  if (loading && !requirePassword) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (forbidden) return <ForbiddenPage t={t} />;

  if (requirePassword) {
    return (
      <PasswordForm
        screenName={passwordScreenMeta?.name}
        shareId={shareId}
        onSuccess={(sc) => { setScreen(sc); setRequirePassword(false); setLoading(false); }}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!screen) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* 미니멀 헤더 */}
      <header className="bg-background border-b border-border px-6 py-3 flex items-center justify-between">
        <h1 className="text-base font-bold text-foreground truncate">
          {screen.name}
        </h1>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          {t('screen_builder.made_with_modolai')}
          <ExternalLink className="w-3 h-3" />
        </a>
      </header>

      {/* 화면 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <ScreenRenderer
          definition={screen.definition}
          screenId={screen.id}
          isPreview={false}
        />
      </main>
    </div>
  );
}
