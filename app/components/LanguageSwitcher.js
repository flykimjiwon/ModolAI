'use client';

import { Globe } from '@/components/icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

const LANGUAGE_LABELS = {
  ko: '한국어',
  en: 'English',
};

export default function LanguageSwitcher() {
  const { lang, setLang, mounted } = useLanguage();

  if (!mounted) {
    return (
      <Button variant='ghost' size='icon-sm' className='text-muted-foreground' disabled>
        <Globe className='h-4 w-4' />
      </Button>
    );
  }

  const nextLang = lang === 'ko' ? 'en' : 'ko';

  return (
    <Button
      variant='ghost'
      size='icon-sm'
      onClick={() => setLang(nextLang)}
      title={LANGUAGE_LABELS[nextLang]}
      aria-label={`Switch to ${LANGUAGE_LABELS[nextLang]}`}
    >
      <Globe className='h-4 w-4 text-muted-foreground' />
    </Button>
  );
}
