'use client';

import { Moon, Sun } from '@/components/icons';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Button } from '@/components/ui/button';

export default function DarkModeToggle() {
  const { isDark, toggle, mounted } = useDarkMode();

  // 클라이언트 렌더링 전에는 아무것도 표시하지 않음 (hydration mismatch 방지)
  if (!mounted) {
    return (
      <Button variant='ghost' size='icon' className='text-muted-foreground' disabled>
        <div className='h-5 w-5' />
      </Button>
    );
  }

  return (
    <Button
      variant='ghost'
      size='icon'
      onClick={toggle}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? (
        <Sun className='h-5 w-5 text-amber-500' />
      ) : (
        <Moon className='h-5 w-5 text-muted-foreground' />
      )}
    </Button>
  );
}
