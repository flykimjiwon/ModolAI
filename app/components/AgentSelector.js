'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Bot } from 'lucide-react';

const AGENTS = [
  { id: 'chat', name: 'Chat', path: '/' },
  { id: 'agent7', name: 'PPT Maker', path: '/agent/7' },
];

export default function AgentSelector() {
  const router = useRouter();
  const pathname = usePathname();

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
    <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
      <Bot className="h-4 w-4 text-muted-foreground" />
      <select
        value={currentAgent}
        onChange={handleChange}
        className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-transparent cursor-pointer"
      >
        {AGENTS.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground ml-2">
        Mode
      </span>
    </div>
  );
}
