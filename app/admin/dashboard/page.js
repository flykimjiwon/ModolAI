'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  MessageSquare,
  Activity,
  TrendingUp,
  Clock,
  Cpu,
  Database,
  Coins,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    todayMessages: 0,
    activeUsers: 0,
    tokenUsage: {
      promptTokens: 0,
      responseTokens: 0,
      totalTokens: 0,
    },
    usersChange: 0,
    messagesChange: 0,
    activeUsersChange: 0,
    topModels: [],
    recentActivity: [],
    periodStart: null,
    periodEnd: null,
  });
  const [systemStatus, setSystemStatus] = useState({
    database: {
      status: 'checking',
      message: 'Checking...',
      responseTime: null,
    },
    apiServer: {
      status: 'checking',
      message: 'Checking...',
      responseTime: null,
    },
    modelServers: {
      status: 'checking',
      message: 'Checking...',
      responseTime: null,
    },
    modelServerEndpoints: [],
  });
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRangeMode, setDateRangeMode] = useState('7days');

  useEffect(() => {
    if (dateRangeMode !== 'custom') {
      fetchDashboardData();
    }
    fetchSystemStatus();
  }, [dateRangeMode]);

  const fetchDashboardData = async () => {
    try {
      const params = new URLSearchParams();

      if (dateRangeMode === 'custom') {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
      } else if (dateRangeMode === '1day') {
        const end = new Date();
        const start = new Date(end.getTime() - 1 * 24 * 60 * 60 * 1000);
        params.append('startDate', start.toISOString().split('T')[0]);
        params.append('endDate', end.toISOString().split('T')[0]);
      } else if (dateRangeMode === '7days') {
        const end = new Date();
        const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.append('startDate', start.toISOString().split('T')[0]);
        params.append('endDate', end.toISOString().split('T')[0]);
      }

      const response = await fetch(`/api/admin/dashboard?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/admin/system-status', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data.status);
      }
    } catch (error) {
      console.error('시스템 상태 조회 실패:', error);
      setSystemStatus({
        database: {
          status: 'error',
          message: 'Check Failed',
          responseTime: null,
        },
        apiServer: {
          status: 'operational',
          message: 'Operational',
          responseTime: 0,
        },
        modelServers: {
          status: 'error',
          message: 'Check Failed',
          responseTime: null,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className='space-y-6'>
        <div className='animate-pulse'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className='pt-5'>
                  <div className='flex items-center'>
                    <div className='flex-shrink-0'>
                      <div className='h-8 w-8 bg-muted rounded'></div>
                    </div>
                    <div className='ml-5 w-0 flex-1'>
                      <div className='h-4 bg-muted rounded w-3/4 mb-2'></div>
                      <div className='h-6 bg-muted rounded w-1/2'></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatPeriod = () => {
    if (!stats.periodStart || !stats.periodEnd) return '';
    const start = new Date(stats.periodStart);
    const end = new Date(stats.periodEnd);
    const formatDate = (d) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    return `${formatDate(start)} ~ ${formatDate(end)}`;
  };

  const formatTokenCount = (count) => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  const statCards = [
    {
      name: '신규 가입자',
      description: formatPeriod(),
      stat: stats.totalUsers,
      tooltip: '선택한 기간 내 가입한 사용자 수입니다.',
      icon: Users,
      color: 'text-primary',
    },
    {
      name: '메시지 수',
      description: formatPeriod(),
      stat: stats.totalMessages,
      tooltip:
        '선택한 기간 내 실제 LLM 호출 횟수입니다. 에이전트/플랜 모드의 다중 호출도 모두 합산합니다. (PII 감지 호출 제외)',
      icon: MessageSquare,
      color: 'text-primary',
    },
    {
      name: '오늘 메시지',
      description: '당일 메시지',
      stat: stats.todayMessages,
      tooltip:
        '오늘 발생한 실제 LLM 호출 횟수입니다. 에이전트/플랜 모드의 다중 호출도 모두 합산합니다. (PII 감지 호출 제외)',
      icon: Activity,
      color: 'text-muted-foreground',
    },
    {
      name: '활성 사용자',
      description: formatPeriod(),
      stat: stats.activeUsers,
      tooltip:
        '선택한 기간 내 메시지/외부 API 로그에 등장한 사용자 수(중복 제거)입니다.',
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      name: '총 토큰 사용량',
      description: `입력 ${formatTokenCount(stats.tokenUsage?.promptTokens || 0)} / 출력 ${formatTokenCount(stats.tokenUsage?.responseTokens || 0)}`,
      stat: stats.tokenUsage?.totalTokens || 0,
      tooltip:
        '선택한 기간 내 웹 채팅과 외부 API에서 사용된 총 토큰 수입니다. (입력 토큰 + 출력 토큰)',
      icon: Coins,
      color: 'text-muted-foreground',
    },
  ];

  const getStatusColor = (status) => {
    if (status === 'operational') return 'bg-primary';
    if (status === 'warning') return 'bg-muted-foreground';
    if (status === 'checking') return 'bg-primary animate-pulse';
    return 'bg-destructive';
  };

  return (
    <div className='space-y-6'>
      <div>
        <div className='md:flex md:items-center md:justify-between'>
          <div className='min-w-0 flex-1'>
            <h2 className='text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl'>
              관리자 대시보드
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              시스템 현황과 사용자 활동을 모니터링하세요
            </p>
          </div>
          <div className='mt-4 flex md:ml-4 md:mt-0'>
            <Button onClick={fetchDashboardData}>
              <Activity className='h-4 w-4' />
              새로고침
            </Button>
          </div>
        </div>

        <Card className='mt-4 py-4'>
          <CardContent>
            <div className='flex flex-wrap items-center gap-4'>
              <div className='flex items-center gap-2'>
                <Clock className='h-4 w-4 text-muted-foreground' />
                <span className='text-sm font-medium text-foreground'>
                  비교 기간:
                </span>
              </div>

              <Select value={dateRangeMode} onValueChange={setDateRangeMode}>
                <SelectTrigger className='min-w-[140px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='1day'>오늘</SelectItem>
                  <SelectItem value='7days'>최근 7일</SelectItem>
                  <SelectItem value='custom'>기간 지정</SelectItem>
                </SelectContent>
              </Select>

              {dateRangeMode === 'custom' && (
                <>
                  <Input
                    type='date'
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className='min-w-[140px] w-auto'
                    placeholder='시작 날짜'
                  />
                  <span className='text-sm text-muted-foreground'>~</span>
                  <Input
                    type='date'
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => e.currentTarget.showPicker?.()}
                    className='min-w-[140px] w-auto'
                    placeholder='종료 날짜'
                  />
                  <Button
                    onClick={fetchDashboardData}
                    size='sm'
                  >
                    조회
                  </Button>
                </>
              )}

              <div className='ml-auto text-xs text-muted-foreground'>
                * 선택한 기간의 통계를 표시합니다
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5'>
        {statCards.map((item) => (
          <Card
            key={item.name}
            className='hover:shadow-lg transition-shadow duration-200'
          >
            <CardContent className='pt-5'>
              <div className='flex items-center'>
                <div className='flex-shrink-0'>
                  <item.icon className={`h-8 w-8 ${item.color}`} />
                </div>
                <div className='ml-5 w-0 flex-1'>
                  <dl>
                    <dt className='text-sm font-medium text-muted-foreground'>
                      <span className='relative inline-flex items-center group'>
                        <span className='cursor-help'>{item.name}</span>
                        <span className='pointer-events-none absolute left-0 bottom-full z-10 mb-2 w-64 rounded-md bg-slate-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100'>
                          {item.tooltip}
                        </span>
                      </span>
                    </dt>
                    <dd className='mt-1'>
                      <div className='text-2xl font-semibold text-foreground'>
                        {item.stat.toLocaleString()}
                      </div>
                      <div className='text-xs text-muted-foreground mt-1'>
                        {item.description}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center mb-4'>
              <Cpu className='h-5 w-5 text-muted-foreground mr-2' />
              <h3 className='text-lg font-medium text-foreground'>
                인기 모델
              </h3>
            </div>
            <div className='space-y-3'>
              {stats.topModels?.slice(0, 5).map((model, index) => (
                <div
                  key={model._id || model.model || `model-${index}`}
                  className='flex items-center justify-between'
                >
                  <div className='flex items-center'>
                    <div className='flex-shrink-0'>
                      <div className='h-2 w-2 bg-primary rounded-full'></div>
                    </div>
                    <div className='ml-3'>
                      <p className='text-sm font-medium text-foreground'>
                        {model.label || model.model_name || '<삭제된 모델>'}
                      </p>
                      {model.server_name && (
                        <p className='text-xs text-muted-foreground'>
                          {model.server_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {model.count}회 사용
                  </div>
                </div>
              ))}
              {(!stats.topModels || stats.topModels.length === 0) && (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  데이터가 없습니다
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='pt-6'>
            <div className='flex items-center mb-4'>
              <Clock className='h-5 w-5 text-muted-foreground mr-2' />
              <h3 className='text-lg font-medium text-foreground'>
                최근 활동
              </h3>
            </div>
            <div className='space-y-3'>
              {stats.recentActivity?.slice(0, 5).map((activity, index) => (
                <div key={index} className='flex items-center space-x-3'>
                  <div className='flex-shrink-0'>
                                  <div className='h-2 w-2 bg-primary rounded-full'></div>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm text-foreground truncate'>
                      {activity.email}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {activity.modelLabel || activity.model} 모델 사용
                    </p>
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {new Date(activity.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}
                  </div>
                </div>
              ))}
              {(!stats.recentActivity || stats.recentActivity.length === 0) && (
                <p className='text-sm text-muted-foreground text-center py-4'>
                  활동 데이터가 없습니다
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-center mb-4'>
            <Database className='h-5 w-5 text-muted-foreground mr-2' />
            <h3 className='text-lg font-medium text-foreground'>
              시스템 상태
            </h3>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
            <div className='text-center'>
              <div className='flex items-center justify-center'>
                <div
                  className={`h-3 w-3 rounded-full mr-2 ${getStatusColor(systemStatus.database.status)}`}
                ></div>
                <span className='text-sm text-foreground'>
                  데이터베이스
                </span>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>
                {systemStatus.database.message}
                {systemStatus.database.responseTime && (
                  <span className='block'>
                    ({systemStatus.database.responseTime}ms)
                  </span>
                )}
              </p>
            </div>

            <div className='text-center'>
              <div className='flex items-center justify-center'>
                <div
                  className={`h-3 w-3 rounded-full mr-2 ${getStatusColor(systemStatus.apiServer.status)}`}
                ></div>
                <span className='text-sm text-foreground'>
                  API 서버
                </span>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>
                {systemStatus.apiServer.message}
              </p>
            </div>

            <div className='text-center'>
              <div className='flex items-center justify-center'>
                <div
                  className={`h-3 w-3 rounded-full mr-2 ${getStatusColor(systemStatus.modelServers.status)}`}
                ></div>
                <span className='text-sm text-foreground'>
                  모델 서버
                </span>
              </div>
              <p className='text-xs text-muted-foreground mt-1'>
                {systemStatus.modelServers.message}
                {systemStatus.modelServers.responseTime && (
                  <span className='block'>
                    ({systemStatus.modelServers.responseTime}ms)
                  </span>
                )}
              </p>

              {Array.isArray(systemStatus.modelServerEndpoints) &&
                systemStatus.modelServerEndpoints.length > 0 && (
                  <div className='mt-4 space-y-2 text-left'>
                    {systemStatus.modelServerEndpoints.map((ep) => (
                      <div
                        key={ep.endpoint}
                        className='flex items-start gap-2 p-2 rounded-md bg-muted border border-border'
                      >
                        <div
                          className={`mt-1 h-2.5 w-2.5 rounded-full ${getStatusColor(ep.status)}`}
                        ></div>
                        <div className='min-w-0'>
                          <div className='text-xs font-medium text-foreground truncate'>
                            {ep.endpoint}
                          </div>
                          <div className='text-[11px] text-muted-foreground'>
                            {ep.message}
                            {typeof ep.responseTime === 'number' && (
                              <span className='ml-1'>
                                ({ep.responseTime}ms)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
