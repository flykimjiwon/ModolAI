'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Building,
  Users,
  Calendar,
  X,
  HelpCircle,
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import UserDetailModal from './components/UserDetailModal';

export default function UsersPage() {
  const { alert, confirm } = useAlert();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [departments, setDepartments] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // 상세 조회 모달 상태
  const [selectedDetailUser, setSelectedDetailUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    department: '',
    cell: '',
  });

  const DEFAULT_DEPTS = ['디지털서비스개발부', '글로벌서비스개발부', '금융서비스개발부', '정보서비스개발부', 'Tech혁신Unit', '기타부서'];

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/admin/departments', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : { departments: [] })
      .then(({ departments: rows = [] }) => {
        const seen = new Map();
        rows.forEach(({ department, auth_type }) => {
          seen.set(`${department}|${auth_type}`, auth_type === 'sso' ? `${department}(SSO)` : `${department}(일반)`);
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

  // 사용자 목록 조회
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const [deptName, authType] = deptFilter ? deptFilter.split('|') : ['', ''];
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        search: searchTerm,
        department: deptName,
        role: selectedRole,
      });
      if (authType) params.set('authType', authType);

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('사용자 데이터 조회 실패');
      }

      const data = await response.json();
      setUsers(data.users);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error('사용자 조회 실패:', error);
      alert('사용자 데이터를 불러오는데 실패했습니다.', 'error', '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    searchTerm,
    deptFilter,
    selectedRole,
    alert,
  ]);

  // 사용자 역할 변경
  const updateUserRole = async (userId, newRole) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '역할 변경 실패');
      }

      // 사용자 목록 새로고침
      fetchUsers();
      alert(
        result.message || `사용자 역할이 ${newRole}으로 변경되었습니다.`,
        'success',
        '변경 완료'
      );
    } catch (error) {
      console.error('역할 변경 실패:', error);
      alert(error.message || '역할 변경에 실패했습니다.', 'error', '변경 실패');
    }
  };

  // 사용자 정보 수정 모달 열기
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      department: user.department || '',
      cell: user.employeePositionName || '프로',
    });
    setShowEditModal(true);
  };

  // 사용자 정보 수정
  const updateUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/users/${editingUser._id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_profile',
          name: editForm.name,
          department: editForm.department,
          cell: editForm.cell,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '사용자 정보 수정 실패');
      }

      fetchUsers();
      setShowEditModal(false);
      setEditingUser(null);
      alert(
        result.message || '사용자 정보가 수정되었습니다.',
        'success',
        '수정 완료'
      );
    } catch (error) {
      console.error('사용자 정보 수정 실패:', error);
      alert(
        error.message || '사용자 정보 수정에 실패했습니다.',
        'error',
        '수정 실패'
      );
    }
  };

  // 사용자 삭제
  const deleteUser = async (userId, userEmail) => {
    const confirmed = await confirm(
      `${userEmail} 사용자를 정말 삭제하시겠습니까?`,
      '사용자 삭제 확인'
    );
    if (!confirmed) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '사용자 삭제 실패');
      }

      fetchUsers();
      alert(
        result.message || '사용자가 삭제되었습니다.',
        'success',
        '삭제 완료'
      );
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
      alert(
        error.message || '사용자 삭제에 실패했습니다.',
        'error',
        '삭제 실패'
      );
    }
  };

  // 검색, 필터, 페이지 크기 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, deptFilter, selectedRole, pageSize]);

  // 데이터 로드
  useEffect(() => {
    fetchUsers();
  }, [
    currentPage,
    searchTerm,
    deptFilter,
    selectedRole,
    pageSize,
    fetchUsers,
  ]);

  // 모달이 열렸을 때 배경 스크롤 방지
  useEffect(() => {
    if (showEditModal || showDetailModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showEditModal, showDetailModal]);

  // 더블 클릭 시 상세 정보 모달 열기
  const handleDoubleClick = (user) => {
    setSelectedDetailUser(user);
    setShowDetailModal(true);
  };

  // 상세 모달 닫기
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedDetailUser(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul',
    };
    return date
      .toLocaleString('ko-KR', options)
      .replace(/\s*오전\s*|\s*오후\s*/g, ' ')
      .trim();
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'>
          관리자
        </span>
      );
    }
    return (
      <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'>
        일반
      </span>
    );
  };

  return (
    <div className='space-y-6 w-full max-w-[90vw] mx-auto'>
      {/* 페이지 헤더 */}
      <div className='border-b border-gray-200 dark:border-gray-700 pb-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <Users className='h-6 w-6' />
              사용자 관리
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-1'>
              시스템 사용자를 조회하고 관리합니다.
            </p>
          </div>
          <div className='text-right'>
            <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
              {totalCount.toLocaleString()}명
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              총 회원수
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className='bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col sm:flex-row gap-4'>
            {/* 검색 */}
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
              <input
                type='text'
                placeholder='이름, 이메일로 검색...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
              />
            </div>

            {/* 부서 필터 */}
            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
            >
              <option value=''>모든 부서</option>
              {departments.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>

            {/* 역할 필터 */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
            >
              <option value=''>모든 역할</option>
              <option value='user'>일반사용자</option>
              <option value='admin'>관리자</option>
            </select>

            {/* 페이지당 항목 수 */}
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value))}
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-w-[120px]'
            >
              <option value={10}>10명씩 보기</option>
              <option value={20}>20명씩 보기</option>
              <option value={50}>50명씩 보기</option>
            </select>
          </div>

          {/* 현재 표시 정보 */}
          <div className='flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3'>
            <div>
              전체 {totalCount.toLocaleString()}명 중{' '}
              {((currentPage - 1) * pageSize + 1).toLocaleString()}~
              {Math.min(currentPage * pageSize, totalCount).toLocaleString()}명
              표시
            </div>
            <div>{totalPages > 0 && `${currentPage}/${totalPages} 페이지`}</div>
          </div>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden overflow-x-auto'>
        {loading ? (
          <div className='flex items-center justify-center h-32'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          </div>
        ) : users.length === 0 ? (
          <div className='text-center py-12'>
            <Users className='mx-auto h-12 w-12 text-gray-400' />
            <h3 className='mt-2 text-sm font-medium text-gray-900 dark:text-white'>
              사용자가 없습니다
            </h3>
            <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
              검색 조건을 변경해보세요.
            </p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className='bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600'>
              <div className='grid grid-cols-18 gap-4 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider min-w-[1200px]'>
                <div className='col-span-4'>사용자 정보</div>
                <div className='col-span-2'>부서</div>
                <div className='col-span-2'>직급</div>
                <div className='col-span-1'>역할</div>
                <div className='col-span-2'>로그인타입</div>
                <div className='col-span-2'>가입일</div>
                <div className='col-span-3 flex items-center gap-1'>
                  <span>마지막 접속 / 활동</span>
                  <div className='relative group'>
                    <HelpCircle className='w-3 h-3 text-gray-400 cursor-help' />
                    <div className='pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 rounded-lg bg-gray-900 text-white text-[11px] px-3 py-2 opacity-0 group-hover:opacity-100 z-20 shadow-lg leading-relaxed'>
                      <p className='font-semibold mb-1 text-gray-200'>기록 방식</p>
                      <p className='mb-1'>
                        <span className='text-blue-300 font-medium'>활동</span>
                        {' '}— 채팅 메시지 전송 시 기록
                        <br />
                        <span className='text-gray-400'>동일 사용자 10분 이내 중복 미기록</span>
                      </p>
                      <p>
                        <span className='text-green-300 font-medium'>로그인</span>
                        {' '}— 로그인 성공 시마다 기록
                      </p>
                      <p className='mt-1 text-gray-400 border-t border-gray-700 pt-1'>
                        표시 우선순위: 활동 {'>'} 로그인
                      </p>
                    </div>
                  </div>
                </div>
                <div className='col-span-2'>작업</div>
              </div>
            </div>

            {/* 사용자 목록 */}
            <div className='divide-y divide-gray-200 dark:divide-gray-600'>
              {users.map((user) => (
                <div
                  key={user._id}
                  className='px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150'
                  onDoubleClick={() => handleDoubleClick(user)}
                  title='더블 클릭하여 상세 정보 보기'
                >
                  <div className='grid grid-cols-18 gap-4 items-center min-w-[1200px]'>
                    {/* 사용자 정보 */}
                    <div className='col-span-4'>
                      <div className='flex items-center'>
                        <div className='h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0'>
                          <span className='text-sm font-medium text-blue-600 dark:text-blue-200'>
                            {user.name?.charAt(0) ||
                              user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className='ml-3 min-w-0 flex-1'>
                          <div className='text-sm font-medium text-gray-900 dark:text-white'>
                            {user.name || '이름 없음'}
                            {user.authType === 'sso' && user.employeeNo && (
                              <span className='text-gray-500 dark:text-gray-400 font-normal ml-1'>
                                ({user.employeeNo})
                              </span>
                            )}
                          </div>
                          <div className='text-sm text-gray-500 dark:text-gray-400 flex items-center'>
                            <Mail className='h-3 w-3 mr-1 flex-shrink-0' />
                            <span className='truncate'>{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 부서 */}
                    <div className='col-span-2'>
                      <div className='flex items-center text-sm text-gray-900 dark:text-white'>
                        <Building className='h-4 w-4 mr-1 text-gray-400 flex-shrink-0' />
                        <span className='truncate'>{user.department || '미설정'}</span>
                      </div>
                    </div>

                    {/* 직급 */}
                    <div className='col-span-2'>
                      <span className='text-sm text-gray-900 dark:text-white truncate block'>
                        {user.employeePositionName || '-'}
                      </span>
                    </div>

                    {/* 역할 */}
                    <div className='col-span-1'>{getRoleBadge(user.role)}</div>

                    {/* 로그인 타입 (배지) */}
                    <div className='col-span-2'>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.authType === 'sso'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                      >
                        {user.authType === 'sso' ? 'SSO' : '일반'}
                      </span>
                    </div>

                    {/* 가입일 */}
                    <div className='col-span-2'>
                      <div className='relative group inline-flex items-center text-sm text-gray-500 dark:text-gray-400'>
                        <span>{formatDate(user.createdAt)}</span>
                        <span className='pointer-events-none absolute left-0 top-full mt-1 rounded bg-gray-900 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap'>
                          {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* 마지막 접속 / 활동 */}
                    <div className='col-span-3'>
                      <div className='inline-flex flex-col text-sm text-gray-500 dark:text-gray-400 gap-0.5'>
                        {user.lastActiveAt ? (
                          <span>
                            <span className='text-[10px] text-blue-400 dark:text-blue-400 mr-1'>활동</span>
                            {formatDate(user.lastActiveAt)}
                          </span>
                        ) : (
                          <span className='text-gray-400 dark:text-gray-500 text-xs'>활동 기록 없음</span>
                        )}
                        {user.lastLoginAt ? (
                          <span>
                            <span className='text-[10px] text-green-400 dark:text-green-400 mr-1'>로그인</span>
                            {formatDate(user.lastLoginAt)}
                          </span>
                        ) : (
                          <span className='text-gray-400 dark:text-gray-500 text-xs'>로그인 기록 없음</span>
                        )}
                      </div>
                    </div>

                    {/* 작업 버튼 */}
                    <div className='col-span-2'>
                      <div className='flex items-center space-x-2'>
                        {/* 사용자 정보 수정 */}
                        <button
                          onClick={() => openEditModal(user)}
                          className='p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition-colors'
                          title='사용자 정보 수정'
                        >
                          <Edit2 className='h-4 w-4' />
                        </button>

                        {/* 역할 변경 */}
                        {user.role === 'admin' ? (
                          <button
                            onClick={() => updateUserRole(user._id, 'user')}
                            className='p-2 text-orange-600 hover:text-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900 rounded-lg transition-colors'
                            title='관리자 권한 해제'
                          >
                            <UserX className='h-4 w-4' />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateUserRole(user._id, 'admin')}
                            className='p-2 text-green-600 hover:text-green-800 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors'
                            title='관리자 권한 부여'
                          >
                            <UserCheck className='h-4 w-4' />
                          </button>
                        )}

                        {/* 사용자 삭제 */}
                        <button
                          onClick={() => deleteUser(user._id, user.email)}
                          className='p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors'
                          title='사용자 삭제'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center space-x-2'>
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className='px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
          >
            이전
          </button>

          <span className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className='px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
          >
            다음
          </button>
        </div>
      )}

      {/* 사용자 정보 수정 모달 */}
      {showEditModal && editingUser && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          {/* 배경 오버레이 */}
          <div
            className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
            onClick={() => setShowEditModal(false)}
          ></div>

          {/* 모달 내용 */}
          <div className='relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-full md:max-w-lg lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl max-h-[90vh] overflow-y-auto p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
                사용자 정보 수정
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className='text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='space-y-4'>
              {/* 이메일 (읽기 전용) */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  이메일
                </label>
                <input
                  type='email'
                  value={editingUser.email}
                  readOnly
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                />
              </div>

              {/* 이름 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  이름
                </label>
                <input
                  type='text'
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                  placeholder='이름을 입력하세요'
                />
              </div>

              {/* 부서 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  부서
                </label>
                <input
                  type='text'
                  value={editForm.department}
                  onChange={(e) =>
                    setEditForm({ ...editForm, department: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                  placeholder='부서를 입력하세요'
                />
              </div>

              {/* 직급 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  직급
                </label>
                <input
                  type='text'
                  value={editForm.cell}
                  onChange={(e) =>
                    setEditForm({ ...editForm, cell: e.target.value })
                  }
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                  placeholder='예: 프로, 팀장'
                />
              </div>
            </div>

            <div className='mt-6 flex justify-end space-x-3'>
              <button
                onClick={() => setShowEditModal(false)}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
              >
                취소
              </button>
              <button
                onClick={updateUser}
                className='px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2026-02-04 추가: 상세 조회 모달 */}
      {showDetailModal && selectedDetailUser && (
        <UserDetailModal
          user={selectedDetailUser}
          onClose={closeDetailModal}
        />
      )}
    </div>
  );
}
