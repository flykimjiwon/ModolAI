'use client';

import { useEffect } from 'react';

const BRANDING_EVENT_NAME = 'techai-site-branding-updated';
const DEFAULT_SITE_TITLE = 'TechAI';
const DEFAULT_SITE_DESCRIPTION = '신한은행 Tech그룹 AI';

function applySiteBranding(payload = {}) {
  const siteTitle =
    typeof payload.siteTitle === 'string' && payload.siteTitle.trim()
      ? payload.siteTitle
      : DEFAULT_SITE_TITLE;
  const siteDescription =
    typeof payload.siteDescription === 'string' && payload.siteDescription.trim()
      ? payload.siteDescription
      : DEFAULT_SITE_DESCRIPTION;
  const faviconUrl =
    typeof payload.faviconUrl === 'string' && payload.faviconUrl.trim()
      ? payload.faviconUrl
      : '/favicon.ico';

  document.title = siteTitle;

  let metaDescription = document.querySelector('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    document.head.appendChild(metaDescription);
  }
  metaDescription.content = siteDescription;

  let favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  favicon.href = faviconUrl;
}

export default function SiteSettings() {
  useEffect(() => {
    const fetchSiteSettings = async () => {
      try {
        const response = await fetch('/api/public/settings', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });
        if (response.ok) {
          const data = await response.json();
          applySiteBranding(data);
        }
      } catch (error) {
        console.error('사이트 설정 로드 실패:', error);
      }
    };

    const handleBrandingUpdated = (event) => {
      applySiteBranding(event?.detail || {});
    };

    fetchSiteSettings();

    window.addEventListener(BRANDING_EVENT_NAME, handleBrandingUpdated);

    return () => {
      window.removeEventListener(BRANDING_EVENT_NAME, handleBrandingUpdated);
    };
  }, []);

  return null;
}
