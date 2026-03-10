'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ScrollButtons({ show, containerRef }) {
  const scrollToTop = () => {
    const container = containerRef?.current;
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    const container = containerRef?.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
      return;
    }
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-28 right-5 z-50 flex flex-col space-y-2">
      <Button
        variant="outline"
        size="icon"
        onClick={scrollToTop}
        className="rounded-full shadow-lg size-12"
        aria-label="맨 위로 스크롤"
      >
        <ChevronUp className="size-6" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={scrollToBottom}
        className="rounded-full shadow-lg size-12"
        aria-label="맨 아래로 스크롤"
      >
        <ChevronDown className="size-6" />
      </Button>
    </div>
  );
}

export default ScrollButtons;
