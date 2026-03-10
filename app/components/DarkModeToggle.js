'use client';

import { Moon, Sun } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function DarkModeToggle() {
  const { isDark, toggle, mounted } = useDarkMode();

  // 클라이언트 렌더링 전에는 아무것도 표시하지 않음 (hydration mismatch 방지)
  if (!mounted) {
    return (
      <button className='p-2 rounded-lg text-gray-400'>
        <div className='h-5 w-5' />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className='p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? (
        <Sun className='h-5 w-5 text-yellow-500' />
      ) : (
        <Moon className='h-5 w-5 text-gray-600' />
      )}
    </button>
  );
}
