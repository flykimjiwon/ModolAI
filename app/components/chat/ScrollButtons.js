'use client';

import { ArrowUpCircle, ArrowDownCircle } from 'lucide-react';

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
      <button
        onClick={scrollToTop}
        className="p-3 bg-gray-200 text-gray-800 rounded-full shadow-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all"
        aria-label="맨 위로 스크롤"
      >
        <ArrowUpCircle className="h-6 w-6" />
      </button>
      <button
        onClick={scrollToBottom}
        className="p-3 bg-gray-200 text-gray-800 rounded-full shadow-lg hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-all"
        aria-label="맨 아래로 스크롤"
      >
        <ArrowDownCircle className="h-6 w-6" />
      </button>
    </div>
  );
}

export default ScrollButtons;
