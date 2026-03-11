'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import ko from '@/lib/i18n/ko.json';
import en from '@/lib/i18n/en.json';

const translations = { ko, en };
const SUPPORTED_LANGS = ['ko', 'en'];
const DEFAULT_LANG = 'ko';
const STORAGE_KEY = 'modolai-lang';

const LanguageContext = createContext(null);

/**
 * Resolve a dot-notation key (e.g. "common.confirm") from a nested object.
 */
function resolve(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGS.includes(stored)) {
        setLangState(stored);
      } else {
        // Detect browser language
        const browserLang = navigator.language?.slice(0, 2);
        if (SUPPORTED_LANGS.includes(browserLang)) {
          setLangState(browserLang);
        }
      }
    } catch {
      // localStorage not available
    }
    setMounted(true);
  }, []);

  // Sync html lang attribute
  useEffect(() => {
    if (mounted) {
      document.documentElement.lang = lang;
    }
  }, [lang, mounted]);

  const setLang = useCallback((newLang) => {
    if (!SUPPORTED_LANGS.includes(newLang)) return;
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // localStorage not available
    }
  }, []);

  /**
   * Translate a key with optional interpolation.
   * Usage: t('common.confirm') → "확인"
   *        t('sidebar.room_delete_message', { roomName: 'Test' }) → '"Test" 방을 삭제하시겠습니까?'
   */
  const t = useCallback(
    (key, params) => {
      const dict = translations[lang] || translations[DEFAULT_LANG];
      let value = resolve(dict, key);

      // Fallback to default language if key not found
      if (value === undefined) {
        value = resolve(translations[DEFAULT_LANG], key);
      }

      // If still not found, return the key itself
      if (value === undefined) {
        return key;
      }

      // Interpolation: replace {param} with values
      if (params && typeof value === 'string') {
        return value.replace(/\{(\w+)\}/g, (_, k) =>
          params[k] !== undefined ? String(params[k]) : `{${k}}`
        );
      }

      return value;
    },
    [lang]
  );

  const contextValue = useMemo(
    () => ({ lang, setLang, t, mounted, supportedLangs: SUPPORTED_LANGS }),
    [lang, setLang, t, mounted]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
