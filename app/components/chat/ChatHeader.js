'use client';

import { useState, useEffect, memo } from 'react';

const BRANDING_EVENT_NAME = 'modolai-site-branding-updated';
const DEFAULT_SITE_DESCRIPTION = 'ModolAI';

const DynamicSiteTitle = memo(function DynamicSiteTitle() {
  const [siteDescription, setSiteDescription] = useState(DEFAULT_SITE_DESCRIPTION);

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
          setSiteDescription(data.siteDescription || DEFAULT_SITE_DESCRIPTION);
        }
        } catch (error) {
          console.error('Failed to load site settings:', error);
        }
      };

    const handleBrandingUpdated = (event) => {
      setSiteDescription(
        event?.detail?.siteDescription || DEFAULT_SITE_DESCRIPTION
      );
    };

    fetchSiteSettings();

    window.addEventListener(BRANDING_EVENT_NAME, handleBrandingUpdated);

    return () => {
      window.removeEventListener(BRANDING_EVENT_NAME, handleBrandingUpdated);
    };
  }, []);

  return (
    <h1
      id='chat-header-title'
      data-testid='chat-header-title'
      className='text-xl font-bold text-foreground'
    >
      {siteDescription}
    </h1>
  );
});

function ChatHeader() {
  return (
    <header
      id='chat-header'
      data-testid='chat-header'
      className='w-full border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10'
    >
      <div className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3'>
        <div className='w-10' />
        <DynamicSiteTitle />
        <div className='w-10' />
      </div>
    </header>
  );
}

export default ChatHeader;
