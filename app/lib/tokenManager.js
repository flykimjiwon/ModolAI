import { decodeJWTPayload } from '@/lib/jwtUtils';

/**
 * 토큰 관리 유틸리티 (개선된 버전 2026-02-27)
 *
 * 변경 사항:
 * - JWT 만료 체크를 로컬 디코딩으로 처리 (서버 왕복 제거)
 * - Access token 만료 15분 전 silent refresh 자동 실행
 * - 401 응답 시 refresh 시도 후 재시도, 실패 시 로그아웃
 * - Refresh token은 httpOnly cookie로 관리 (TokenManager에서 직접 접근 불가)
 */

export class TokenManager {
  static instance = null;
  static refreshTimer = null;
  static originalFetch = null;
  static isInterceptorActive = false;
  static isRefreshing = false;
  static pendingQueue = [];

  constructor() {
    if (TokenManager.instance) {
      return TokenManager.instance;
    }
    TokenManager.instance = this;
    this.listeners = [];
  }

  // ─────────────────────────────────────────────
  // JWT 로컬 디코딩 (서버 요청 없이 만료 확인)
  // ─────────────────────────────────────────────

  /**
   * localStorage의 access token을 로컬에서 디코딩해 만료 여부 확인
   * 서버 왕복 없이 즉시 처리
   */
  static decodeLocalToken(token = null) {
    const authToken = token || localStorage.getItem('token');
    if (!authToken) return null;

    try {
      return decodeJWTPayload(authToken);
    } catch {
      return null;
    }
  }

  /**
   * 토큰 만료까지 남은 초 반환. 만료됐으면 0 이하.
   */
  static getTokenExpiresIn(token = null) {
    const payload = TokenManager.decodeLocalToken(token);
    if (!payload?.exp) return -1;
    return payload.exp - Math.floor(Date.now() / 1000);
  }

  // ─────────────────────────────────────────────
  // Silent Refresh
  // ─────────────────────────────────────────────

  /**
   * /api/auth/refresh 호출로 새 access token 발급
   * httpOnly cookie의 refresh token을 자동으로 전송
   * @returns {boolean} 성공 여부
   */
  static async silentRefresh() {
    if (TokenManager.isRefreshing) {
      // 이미 refresh 중이면 완료될 때까지 대기
      return new Promise((resolve) => {
        TokenManager.pendingQueue.push(resolve);
      });
    }

    TokenManager.isRefreshing = true;

    try {
      const response = await (TokenManager.originalFetch || fetch)('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',   // httpOnly cookie 자동 전송
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          localStorage.setItem('token', data.token);
          // 대기 중인 요청들 성공 처리
          TokenManager.pendingQueue.forEach((resolve) => resolve(true));
          TokenManager.pendingQueue = [];

          // 새 토큰 기준으로 refresh 타이머 재스케줄
          TokenManager.scheduleRefresh();
          return true;
        }
      }

      // refresh 실패 (token expired/revoked)
      TokenManager.pendingQueue.forEach((resolve) => resolve(false));
      TokenManager.pendingQueue = [];
      return false;

    } catch (err) {
      console.error('[TokenManager] silent refresh 오류:', err);
      TokenManager.pendingQueue.forEach((resolve) => resolve(false));
      TokenManager.pendingQueue = [];
      return false;
    } finally {
      TokenManager.isRefreshing = false;
    }
  }

  // ─────────────────────────────────────────────
  // 타이머 기반 자동 갱신
  // ─────────────────────────────────────────────

  /**
   * 토큰 만료 15분 전에 silent refresh 예약
   */
  static scheduleRefresh() {
    if (TokenManager.refreshTimer) {
      clearTimeout(TokenManager.refreshTimer);
      TokenManager.refreshTimer = null;
    }

    const expiresIn = TokenManager.getTokenExpiresIn();

    if (expiresIn <= 0) {
      console.log('[TokenManager] 토큰 만료됨 — 즉시 로그아웃');
      TokenManager.logout();
      return;
    }

    // 만료 15분(900초) 전에 refresh 실행. 남은 시간이 15분 미만이면 즉시.
    const REFRESH_BEFORE_EXPIRY = 15 * 60; // 15분 (초)
    const delay = Math.max(0, (expiresIn - REFRESH_BEFORE_EXPIRY) * 1000);

    console.log(
      `[TokenManager] 토큰 refresh 예약: ${Math.floor(delay / 1000 / 60)}분 후 (만료까지 ${Math.floor(expiresIn / 60)}분)`
    );

    TokenManager.refreshTimer = setTimeout(async () => {
      const success = await TokenManager.silentRefresh();
      if (!success) {
        console.log('[TokenManager] silent refresh 실패 — 로그아웃');
        TokenManager.logout();
      }
    }, delay);
  }

  // ─────────────────────────────────────────────
  // 초기화 & 로그아웃
  // ─────────────────────────────────────────────

  /**
   * 페이지 로드 시 초기화
   */
  static async initializeTokenValidation() {
    const expiresIn = TokenManager.getTokenExpiresIn();

    if (expiresIn <= 0) {
      // 이미 만료 — refresh 시도
      const refreshed = await TokenManager.silentRefresh();
      if (!refreshed) {
        TokenManager.logout();
        return false;
      }
    } else {
      // 유효 — refresh 타이머 예약
      TokenManager.scheduleRefresh();
    }

    // 글로벌 fetch 인터셉터 활성화
    TokenManager.enableGlobalFetchInterceptor();
    return true;
  }

  /**
   * loginType 설정에 따른 로그인 URL 반환
   */
  static async getLoginUrl(redirectPath = null) {
    try {
      const response = await fetch('/api/public/settings');
      if (response.ok) {
        const data = await response.json();
        const baseUrl = data.loginType === 'sso' ? '/sso' : '/login';
        return TokenManager._appendRedirect(baseUrl, redirectPath);
      }
    } catch (error) {
      console.error('loginType 설정 조회 실패:', error);
    }
    return TokenManager._appendRedirect('/login', redirectPath);
  }

  static _appendRedirect(baseUrl, redirectPath) {
    if (
      redirectPath &&
      redirectPath.startsWith('/') &&
      !redirectPath.startsWith('//') &&
      redirectPath !== baseUrl &&
      redirectPath !== '/login' &&
      redirectPath !== '/sso'
    ) {
      return `${baseUrl}?redirect=${encodeURIComponent(redirectPath)}`;
    }
    return baseUrl;
  }

  /**
   * 로그아웃 — refresh token revoke + 로컬 정리
   */
  static async logout() {
    // 타이머 정리
    if (TokenManager.refreshTimer) {
      clearTimeout(TokenManager.refreshTimer);
      TokenManager.refreshTimer = null;
    }
    TokenManager.disableGlobalFetchInterceptor();

    // 서버에 refresh token revoke 요청 (cookie 포함)
    try {
      await (TokenManager.originalFetch || fetch)('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // 네트워크 오류 시 무시
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    const loginUrl = await TokenManager.getLoginUrl();
    window.location.href = loginUrl;
  }

  // ─────────────────────────────────────────────
  // 글로벌 fetch 인터셉터 (401 자동 refresh 재시도)
  // ─────────────────────────────────────────────

  static enableGlobalFetchInterceptor() {
    if (typeof window === 'undefined' || TokenManager.isInterceptorActive) {
      return;
    }

    TokenManager.originalFetch = window.fetch.bind(window);
    TokenManager.isInterceptorActive = true;

    window.fetch = async function (input, init = {}) {
      try {
        const response = await TokenManager.originalFetch(input, init);

        // 인증 관련 엔드포인트는 인터셉터 제외
        const url = input.toString();
        const isAuthEndpoint =
          url.includes('/api/auth/login') ||
          url.includes('/api/auth/register') ||
          url.includes('/api/auth/validate') ||
          url.includes('/api/auth/refresh') ||
          url.includes('/api/auth/logout');

        if (response.status === 401 && !isAuthEndpoint) {
          console.log('[TokenManager] 401 감지 — silent refresh 시도:', url);
          const refreshed = await TokenManager.silentRefresh();

          if (refreshed) {
            // 새 토큰으로 원래 요청 재시도
            const newToken = localStorage.getItem('token');
            const retryInit = {
              ...init,
              headers: {
                ...(init.headers || {}),
                Authorization: `Bearer ${newToken}`,
              },
            };
            return TokenManager.originalFetch(input, retryInit);
          } else {
            console.log('[TokenManager] refresh 실패 — 로그아웃');
            setTimeout(() => TokenManager.logout(), 100);
          }
        }

        return response;
      } catch (error) {
        throw error;
      }
    };

    console.log('[TokenManager] 글로벌 fetch 인터셉터 활성화');
  }

  static disableGlobalFetchInterceptor() {
    if (typeof window === 'undefined' || !TokenManager.isInterceptorActive) {
      return;
    }
    if (TokenManager.originalFetch) {
      window.fetch = TokenManager.originalFetch;
      TokenManager.originalFetch = null;
    }
    TokenManager.isInterceptorActive = false;
    console.log('[TokenManager] 글로벌 fetch 인터셉터 비활성화');
  }

  // ─────────────────────────────────────────────
  // 하위 호환 (기존 코드에서 호출하는 경우 대비)
  // ─────────────────────────────────────────────

  /** @deprecated silentRefresh + scheduleRefresh로 대체됨 */
  static async validateToken(token = null) {
    const expiresIn = TokenManager.getTokenExpiresIn(token);
    if (expiresIn <= 0) {
      return { valid: false, reason: 'expired' };
    }
    const payload = TokenManager.decodeLocalToken(token);
    return {
      valid: true,
      user: { id: payload.sub, email: payload.email, name: payload.name, role: payload.role },
      tokenInfo: { exp: payload.exp, expiresIn },
    };
  }

  /** @deprecated scheduleRefresh로 대체됨 */
  static startPeriodicValidation() {
    TokenManager.scheduleRefresh();
  }

  /** @deprecated clearTimeout(refreshTimer)로 대체됨 */
  static stopPeriodicValidation() {
    if (TokenManager.refreshTimer) {
      clearTimeout(TokenManager.refreshTimer);
      TokenManager.refreshTimer = null;
    }
  }

  /**
   * 안전한 API 요청 래퍼 (기존 코드 호환)
   */
  static async safeFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
      TokenManager.logout();
      throw new Error('토큰이 없습니다.');
    }

    const headers = {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };
    if (headers['Content-Type'] === undefined) {
      delete headers['Content-Type'];
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      // 글로벌 인터셉터가 처리하지만, safeFetch도 명시적으로 처리
      throw new Error('인증이 만료되었습니다.');
    }
    return response;
  }
}

export const tokenManager = new TokenManager();
