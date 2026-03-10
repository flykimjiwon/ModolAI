import { useState, useEffect } from 'react';

export default function TypingAnimation({ baseText = "답변을 준비중입니다" }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center w-full text-foreground">
      <div className="mr-2 w-4 h-4 bg-primary rounded-full animate-pulse"></div>
      <span>{baseText}{dots}</span>
    </div>
  );
}
