'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Bot, ShieldX, Loader2, Presentation } from '@/components/icons';
import { TokenManager } from '@/lib/tokenManager';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import AgentSidebar from '@/components/chat/AgentSidebar';
import ChatLayout from '@/components/chat/ChatLayout';
import AgentSelector from '@/components/AgentSelector';
import PPTMaker from '@/components/PPTMaker';
import ChartMaker from '@/components/ChartMaker';
import VirtualMeeting from '@/components/VirtualMeeting';

// Agent information
const AGENT_INFO = {
  '1': {
    name: 'Virtual Meeting',
    description: 'Simulate multi-persona meetings with AI-driven discussions and summaries',
    icon: Bot,
    color: 'text-foreground',
    bgColor: 'bg-muted',
  },
  '7': {
    name: 'PPT Maker',
    description: 'Enter a topic and format, and AI generates a presentation',
    icon: Presentation,
    color: 'text-foreground',
    bgColor: 'bg-muted',
  },
  '10': {
    name: 'Chart Maker',
    description: 'Select chart type, color theme, and enter data to generate charts with AI',
    icon: Bot,
    color: 'text-foreground',
    bgColor: 'bg-muted',
  },
};

export default function AgentPage() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.id;
  const agent = AGENT_INFO[agentId];

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [authChecked, setAuthChecked] = useState(false);
  const [profileEditEnabled, setProfileEditEnabled] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [activeAgentMenu, setActiveAgentMenu] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
        router.replace(loginUrl);
        return;
      }
      try {
        const payload = decodeJWTPayload(token);
        setUserEmail(payload.email || '');
        setUserRole(payload.role || 'user');
        setAuthChecked(true);
      } catch (error) {
        console.error('Token parsing failed:', error);
        const loginUrl = await TokenManager.getLoginUrl(window.location.pathname);
        router.replace(loginUrl);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setProfileEditEnabled(data.profileEditEnabled ?? false);
        setBoardEnabled(data.boardEnabled ?? true);
      })
      .catch(() => {});
  }, []);

  // Agent access permission check
  useEffect(() => {
    const checkPermission = async () => {
      if (!authChecked || !agentId) return;

      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch(`/api/agents/check-permission?agentId=${agentId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHasPermission(data.allowed);
        }
      } catch (error) {
        console.error('Permission check failed:', error);
        // Default to allowed on API error
        setHasPermission(true);
      } finally {
        setPermissionChecked(true);
      }
    };

    checkPermission();
  }, [authChecked, agentId]);

  useEffect(() => {
    if (agentId === '7') {
      setActiveAgentMenu('ppt-compose');
    } else if (agentId === '10') {
      setActiveAgentMenu('chart-compose');
    } else if (agentId === '1') {
      setActiveAgentMenu('meeting-setup');
    } else {
      setActiveAgentMenu('');
    }
  }, [agentId]);

  const handleLogout = async () => {
    await TokenManager.logout();
  };

  if (!authChecked || !permissionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Access denied
  if (!hasPermission) {
    return (
      <ChatLayout sidebarOpen={sidebarOpen}>
        <AgentSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          agentId={agentId}
          agentName={agent?.name || 'Access Denied'}
          agentDescription=''
          userEmail={userEmail}
          userRole={userRole}
          handleLogout={handleLogout}
          loading={false}
          profileEditEnabled={profileEditEnabled}
          boardEnabled={boardEnabled}
          activeAgentMenu={activeAgentMenu}
          onAgentMenuSelect={agentId === '7' ? setActiveAgentMenu : null}
        />
        <AgentSelector />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <ShieldX className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Access denied
            </h2>
            <p className="text-muted-foreground mb-6">
              You do not have permission to access this agent ({agent?.name || agentId}).
              <br />
              Contact your administrator.
            </p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              Back to Chat
            </button>
          </div>
        </div>
      </ChatLayout>
    );
  }

  // Agent not found
  if (!agent) {
    return (
      <ChatLayout sidebarOpen={sidebarOpen}>
        <AgentSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          agentId={agentId}
          agentName='Unknown'
          agentDescription=''
          userEmail={userEmail}
          userRole={userRole}
          handleLogout={handleLogout}
          loading={false}
          profileEditEnabled={profileEditEnabled}
          boardEnabled={boardEnabled}
          activeAgentMenu={activeAgentMenu}
          onAgentMenuSelect={agentId === '7' ? setActiveAgentMenu : null}
        />
        <AgentSelector />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Agent not found
            </h2>
            <p className="text-muted-foreground mb-4">
              Requested agent ID: {agentId}
            </p>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
            >
              Back to Chat
            </button>
          </div>
        </div>
      </ChatLayout>
    );
  }

  const AgentIcon = agent.icon;

  return (
    <ChatLayout sidebarOpen={sidebarOpen}>
      <AgentSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        agentId={agentId}
        agentName={agent.name}
        agentDescription={agent.description}
        agentColor={agent.color}
        userEmail={userEmail}
        userRole={userRole}
        handleLogout={handleLogout}
        loading={false}
        profileEditEnabled={profileEditEnabled}
        boardEnabled={boardEnabled}
        activeAgentMenu={activeAgentMenu}
        onAgentMenuSelect={agentId === '7' ? setActiveAgentMenu : null}
      />
      <AgentSelector />

      {/* Agent main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Agent header */}
        <div className={`p-6 ${agent.bgColor} border-b border-border`}>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-background shadow-sm">
              <AgentIcon className={`h-8 w-8 ${agent.color}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {agent.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>
            </div>
          </div>
        </div>

        {agentId === '7' && (
          <PPTMaker
            sidebarMenu={activeAgentMenu}
            onRequestSidebarMenuChange={setActiveAgentMenu}
          />
        )}
        {agentId === '10' && (
          <ChartMaker
            sidebarMenu={activeAgentMenu}
            onRequestSidebarMenuChange={setActiveAgentMenu}
          />
        )}
        {agentId === '1' && (
          <VirtualMeeting
            sidebarMenu={activeAgentMenu}
            onRequestSidebarMenuChange={setActiveAgentMenu}
          />
        )}
      </div>
    </ChatLayout>
  );
}
