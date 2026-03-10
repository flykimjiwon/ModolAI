'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

export default function SSOLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
  });

  // 필터
  const [filters, setFilters] = useState({
    employeeNo: '',
    loginSuccess: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // 상세 보기
  const [expandedLog, setExpandedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (filters.employeeNo) params.append('employeeNo', filters.employeeNo);
      if (filters.loginSuccess) params.append('loginSuccess', filters.loginSuccess);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const res = await fetch(`/api/admin/sso-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('로그 조회 실패');

      const data = await res.json();
      setLogs(data.data.logs);
      setPagination((prev) => ({ ...prev, ...data.data.pagination }));
      setStats(data.data.stats);
    } catch (error) {
      console.error('SSO 로그 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (log) => {
    if (log.login_success) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          성공
        </span>
      );
    }
    if (log.sso_login_deny_yn === 'Y') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
          <AlertTriangle className="h-3 w-3" />
          거부
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="h-3 w-3" />
        실패
      </span>
    );
  };

  const getDeviceIcon = (deviceType) => {
    if (deviceType === 'Mobile' || deviceType === 'Tablet') {
      return <Smartphone className="h-4 w-4 text-gray-400" />;
    }
    return <Monitor className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            SSO 로그인 로그
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            모든 SSO 로그인 시도 기록을 확인합니다.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.total}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              전체 (7일)
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-green-600">
              {stats.success_count}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">성공</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-red-600">
              {stats.fail_count}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">실패</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-orange-600">
              {stats.deny_count}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              로그인 거부
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-purple-600">
              {stats.client_error_count}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              클라이언트 오류
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <Filter className="h-4 w-4" />
          필터
          {showFilters ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showFilters && (
          <form onSubmit={handleSearch} className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                사번
              </label>
              <input
                type="text"
                value={filters.employeeNo}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, employeeNo: e.target.value }))
                }
                className="input-primary text-sm"
                placeholder="사번 검색"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                결과
              </label>
              <select
                value={filters.loginSuccess}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, loginSuccess: e.target.value }))
                }
                className="input-primary text-sm"
              >
                <option value="">전체</option>
                <option value="true">성공</option>
                <option value="false">실패</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="input-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="input-primary text-sm"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary flex items-center gap-2">
                <Search className="h-4 w-4" />
                검색
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 로그 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  시간
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  사번
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  부서
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  결과
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  브라우저
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  오류
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    로그가 없습니다.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-gray-100">
                        {log.employee_no || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {log.sso_employee_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {log.sso_department_name || '-'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(log)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(log.device_type)}
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {log.browser_name} {log.browser_version}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {log.error_type ? (
                          <span className="text-red-600 dark:text-red-400">
                            {log.error_type}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            setExpandedLog(expandedLog === log.id ? null : log.id)
                          }
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          {expandedLog === log.id ? '닫기' : '보기'}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 bg-gray-50 dark:bg-gray-900">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                SSO Result Code
                              </div>
                              <div className="text-gray-900 dark:text-gray-100">
                                {log.sso_result_code || '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Auth Result
                              </div>
                              <div className="text-gray-900 dark:text-gray-100">
                                {log.sso_auth_result || '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Login Deny
                              </div>
                              <div className={log.sso_login_deny_yn === 'Y' ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}>
                                {log.sso_login_deny_yn || 'N'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                JWT 발급
                              </div>
                              <div className="text-gray-900 dark:text-gray-100">
                                {log.jwt_issued ? '예' : '아니오'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Client IP
                              </div>
                              <div className="text-gray-900 dark:text-gray-100 font-mono">
                                {log.client_ip || '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                OS
                              </div>
                              <div className="text-gray-900 dark:text-gray-100">
                                {log.os_name} {log.os_version}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                Transaction ID
                              </div>
                              <div className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                                {log.sso_transaction_id || '-'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                회사
                              </div>
                              <div className="text-gray-900 dark:text-gray-100">
                                {log.sso_company_name || '-'} ({log.sso_company_code || '-'})
                              </div>
                            </div>
                            {log.error_message && (
                              <div className="col-span-2 md:col-span-4">
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  오류 메시지
                                </div>
                                <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                                  {log.error_message}
                                  {log.error_detail && (
                                    <div className="text-xs mt-1 text-red-500">
                                      상세: {log.error_detail}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {log.sso_auth_result_message && (
                              <div className="col-span-2 md:col-span-4">
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  SSO Auth Result Message
                                </div>
                                <div className="text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                  {log.sso_auth_result_message}
                                </div>
                              </div>
                            )}
                            {log.client_error_type && (
                              <div className="col-span-2 md:col-span-4">
                                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  클라이언트 오류
                                </div>
                                <div className="text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                                  [{log.client_error_type}] {log.client_error_message}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              총 {pagination.totalCount}개 중 {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page <= 1}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
