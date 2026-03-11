'use client';

import DarkModeToggle from '@/components/DarkModeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function GlobalControls() {
  return (
    <div className='fixed top-3 right-3 z-50 flex items-center gap-0.5'>
      <LanguageSwitcher />
      <DarkModeToggle />
    </div>
  );
}
