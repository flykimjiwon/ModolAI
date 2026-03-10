'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Bot } from 'lucide-react';

const AGENTS = [
  { id: 'chat', name: '채팅', path: '/' },
  { id: 'agent1', name: 'AI 가상회의', path: '/agent/1' },
  { id: 'agent2', name: '코드 컨버터', path: '/agent/2' },
  { id: 'agent3', name: 'Text to SQL', path: '/agent/3' },
  { id: 'agent4', name: '텍스트 재작성', path: '/agent/4' },
  { id: 'agent5', name: '에러 해결 도우미', path: '/agent/5' },
  { id: 'agent6', name: 'Solgit 리뷰어', path: '/agent/6' },
  { id: 'agent7', name: 'PPT 에이전트', path: '/agent/7' },
];

export default function AgentSelector() {
  const router = useRouter();
  const pathname = usePathname();

  // 현재 경로에 따라 선택된 에이전트 결정
  const getCurrentAgent = () => {
    if (pathname === '/' || pathname === '/chat') return 'chat';
    const match = pathname.match(/^\/agent\/(\d+)/);
    if (match) return `agent${match[1]}`;
    return 'chat';
  };

  const currentAgent = getCurrentAgent();

  const handleChange = (e) => {
    const selectedId = e.target.value;
    const agent = AGENTS.find((a) => a.id === selectedId);
    if (agent) {
      router.push(agent.path);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <Bot className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      <select
        value={currentAgent}
        onChange={handleChange}
        className="px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
      >
        {AGENTS.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
        모드 선택
      </span>
    </div>
  );
}
