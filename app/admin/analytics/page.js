'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Filter } from 'lucide-react';
import {
  UserStatsChart,
  ModelStatsChart,
  DepartmentStatsChart,
  DailyActivityChart,
  TokenUsageChart,
  DepartmentTokenUsageChart,
} from '@/components/admin/AnalyticsCharts';

const PERIODS = [
  { value: '7days', label: '최근 7일' },
  { value: '30days', label: '최근 30일' },
  { value: '3months', label: '최근 3개월' },
  { value: '1year', label: '최근 1년' },
  { value: 'custom', label: '기간 지정' },
];

const DEFAULT_DEPTS = [
  '디지털서비스개발부',
  'Tech혁신Unit',
  '글로벌서비스개발부',
  '금융서비스개발부',
  '정보서비스개발부',
  '기타부서',
];

const INITIAL_DATA = {
  userStats: [],
  modelStats: [],
  departmentStats: [],
  dailyActivity: [],
  monthlyTrends: [],
  tokenUsage: [],
  departmentTokenUsage: [],
};

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const LoadingSkeleton = () => (
  <div className='space-y-6'>
    <div className='animate-pulse'>
      <div className='h-8 bg-muted rounded w-1/4 mb-4'></div>
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className='h-64 bg-muted rounded' />
        ))}
      </div>
    </div>
  </div>
);

export default function Analytics() {
  const [data, setData] = useState(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [deptFilter, setDeptFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    fetch('/api/admin/departments', { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : { departments: [] }))
      .then(({ departments: rows = [] }) => {
        const seen = new Map();
        rows.forEach(({ department, auth_type }) => {
          seen.set(
            `${department}|${auth_type}`,
            auth_type === 'sso' ? `${department}(SSO)` : `${department}(일반)`
          );
        });
        DEFAULT_DEPTS.forEach((dept) => {
          if (!seen.has(`${dept}|local`)) seen.set(`${dept}|local`, `${dept}(일반)`);
        });
        setDepartments(
          Array.from(seen.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
        );
      })
      .catch(() => {
        setDepartments(DEFAULT_DEPTS.map((d) => ({ value: `${d}|local`, label: `${d}(일반)` })));
      });
  }, []);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptName, authType] = deptFilter !== 'all' ? deptFilter.split('|') : ['all', ''];
      const queryParams = new URLSearchParams({
        period: selectedPeriod,
        department: deptName,
      });
      if (authType) queryParams.set('authType', authType);
      if (selectedPeriod === 'custom') {
        if (customStartDate) queryParams.append('startDate', customStartDate);
        if (customEndDate) queryParams.append('endDate', customEndDate);
      }
      const response = await fetch(`/api/admin/analytics?${queryParams}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('분석 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, deptFilter, customStartDate, customEndDate]);

  useEffect(() => {
    if (selectedPeriod !== 'custom') {
      fetchAnalyticsData();
    }
  }, [selectedPeriod, deptFilter, fetchAnalyticsData]);

  const handleExportData = useCallback(async () => {
    try {
      const [deptName, authType] = deptFilter !== 'all' ? deptFilter.split('|') : ['all', ''];
      const queryParams = new URLSearchParams({
        period: selectedPeriod,
        department: deptName,
      });
      if (authType) queryParams.set('authType', authType);
      if (selectedPeriod === 'custom') {
        if (customStartDate) queryParams.append('startDate', customStartDate);
        if (customEndDate) queryParams.append('endDate', customEndDate);
      }
      const response = await fetch(
        `/api/admin/analytics/export?${queryParams}`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const filename = `analytics-${selectedPeriod}-${Date.now()}.csv`;
      downloadFile(blob, filename);
    } catch (error) {
      console.error('데이터 내보내기 실패:', error);
    }
  }, [selectedPeriod, deptFilter, customStartDate, customEndDate]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className='space-y-6'>
      <div>
        <div className='md:flex md:items-center md:justify-between'>
          <div className='min-w-0 flex-1'>
            <h2 className='text-2xl font-bold leading-7 text-foreground sm:truncate sm:text-3xl'>
              통계 분석
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              사용자 활동과 시스템 사용량을 분석합니다
            </p>
          </div>
          <div className='mt-4 flex gap-2 md:ml-4 md:mt-0'>
            <button
              onClick={handleExportData}
              className='btn-secondary flex items-center gap-2'
            >
              <Download className='h-4 w-4' />
              내보내기
            </button>
          </div>
        </div>
      </div>

      <div className='bg-card shadow rounded-lg p-6'>
        <div className='space-y-4'>
          <div className='flex items-center gap-4 flex-wrap'>
            <div className='flex items-center gap-2'>
              <Filter className='h-4 w-4 text-muted-foreground' />
              <span className='text-sm font-medium text-foreground'>
                필터:
              </span>
            </div>

            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className='input-primary w-auto min-w-[120px]'
            >
              {PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className='input-primary w-auto min-w-[160px]'
            >
              <option value='all'>전체 부서</option>
              {departments.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>

          {selectedPeriod === 'custom' && (
            <div className='flex items-center gap-3 flex-wrap pl-6'>
              <span className='text-sm text-muted-foreground'>
                기간:
              </span>
              <input
                type='date'
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className='input-primary w-auto min-w-[140px]'
                placeholder='시작 날짜'
              />
              <span className='text-sm text-muted-foreground'>~</span>
              <input
                type='date'
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                onClick={(e) => e.currentTarget.showPicker?.()}
                className='input-primary w-auto min-w-[140px]'
                placeholder='종료 날짜'
              />
              <button
                onClick={fetchAnalyticsData}
                className='btn-primary text-sm px-4 py-2'
              >
                조회
              </button>
            </div>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <UserStatsChart
          data={data.userStats}
          title='사용자별 사용량'
          tooltip='메시지 수는 실제 LLM 호출 횟수 기준입니다. 에이전트/플랜 모드의 다중 호출도 모두 집계합니다. (PII 감지 호출 제외)'
        />
        <ModelStatsChart data={data.modelStats} title='모델별 사용량' />
        <DepartmentStatsChart
          data={data.departmentStats}
          title='부서별 사용량'
          tooltip='메시지 수는 실제 LLM 호출 횟수 기준입니다. 에이전트/플랜 모드의 다중 호출도 모두 집계합니다. (PII 감지 호출 제외)'
        />
        <DailyActivityChart
          data={data.dailyActivity}
          title='일별 활동량'
          tooltip='메시지 수는 실제 LLM 호출 횟수 기준입니다. 에이전트/플랜 모드의 다중 호출도 모두 집계합니다. (PII 감지 호출 제외)'
        />
        <TokenUsageChart data={data.tokenUsage} title='개인별 토큰 사용량' />
        <DepartmentTokenUsageChart
          data={data.departmentTokenUsage}
          title='부서별 토큰 사용량'
        />
      </div>
    </div>
  );
}
