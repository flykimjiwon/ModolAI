'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Bot, MessageSquare, Settings, Users, Code, Database, FileEdit, AlertTriangle, GitBranch, ShieldX, Loader2, Presentation } from 'lucide-react';
import { TokenManager } from '@/lib/tokenManager';
import { decodeJWTPayload } from '@/lib/jwtUtils';
import AgentSidebar from '@/components/chat/AgentSidebar';
import ChatLayout from '@/components/chat/ChatLayout';
import AgentSelector from '@/components/AgentSelector';
import PPTMaker from '@/components/PPTMaker';

// 에이전트 정보 (나중에 DB나 설정에서 가져올 수 있음)
const AGENT_INFO = {
  '1': {
    name: 'AI 가상회의',
    description: '인원수, 페르소나, 주제, 대화 개수를 설정하면 AI가 토론 결과를 제공합니다',
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  '2': {
    name: '코드 컨버터',
    description: 'A언어에서 B언어로 코드를 변환해 드립니다',
    icon: Code,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  '3': {
    name: 'Text to SQL',
    description: '엑셀 업로드 후 자연어로 질문하면 데이터를 조회해 드립니다',
    icon: Database,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  '4': {
    name: '텍스트 재작성 도구',
    description: '목적(메일, 쪽지, 보고서)과 톤(정중한, 공손한)에 맞게 텍스트를 재작성해 드립니다',
    icon: FileEdit,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  '5': {
    name: '에러 해결 도우미',
    description: '코드와 에러 메시지를 입력하면 원인 파악을 도와드립니다',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  '6': {
    name: 'Solgit 프로젝트 리뷰어',
    description: 'Solgit 프로젝트를 지정하면 코드 파일들에 대한 LLM 리뷰를 제공합니다',
    icon: GitBranch,
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-100 dark:bg-teal-900/30',
  },
  '7': {
    name: 'PPT 에이전트',
    description: '주제와 포맷을 입력하면 AI가 프레젠테이션을 생성해 드립니다',
    icon: Presentation,
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
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
        console.error('토큰 파싱 실패:', error);
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

  // 에이전트 접근 권한 체크
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
        console.error('권한 체크 실패:', error);
        // 권한 체크 실패 시 기본적으로 허용 (API 오류 시)
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
      return;
    }
    setActiveAgentMenu('');
  }, [agentId]);

  const handleLogout = async () => {
    await TokenManager.logout();
  };

  if (!authChecked || !permissionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 접근 권한이 없는 경우
  if (!hasPermission) {
    return (
      <ChatLayout sidebarOpen={sidebarOpen}>
        <AgentSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          agentId={agentId}
          agentName={agent?.name || '접근 불가'}
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
            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
              <ShieldX className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              접근 권한이 없습니다
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              이 에이전트({agent?.name || agentId})에 대한 접근 권한이 없습니다.
              <br />
              관리자에게 문의하세요.
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              채팅으로 돌아가기
            </button>
          </div>
        </div>
      </ChatLayout>
    );
  }

  // 에이전트를 찾을 수 없는 경우
  if (!agent) {
    return (
      <ChatLayout sidebarOpen={sidebarOpen}>
        <AgentSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          agentId={agentId}
          agentName='알 수 없음'
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              에이전트를 찾을 수 없습니다
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              요청하신 에이전트 ID: {agentId}
            </p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              채팅으로 돌아가기
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

      {/* 에이전트 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 에이전트 헤더 */}
        <div className={`p-6 ${agent.bgColor} border-b border-gray-200 dark:border-gray-700`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm`}>
              <AgentIcon className={`h-8 w-8 ${agent.color}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {agent.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {agent.description}
              </p>
            </div>
          </div>
        </div>

        {agentId === '7' ? (
          <PPTMaker
            sidebarMenu={activeAgentMenu}
            onRequestSidebarMenuChange={setActiveAgentMenu}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className={`mx-auto w-20 h-20 rounded-full ${agent.bgColor} flex items-center justify-center mb-6`}>
                <AgentIcon className={`h-10 w-10 ${agent.color}`} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                {agent.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {agent.description}
              </p>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">개발 중</span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  이 에이전트는 현재 개발 중입니다. 곧 사용하실 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </ChatLayout>
  );
}
