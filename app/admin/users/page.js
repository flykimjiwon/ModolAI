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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

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
        seen.set(
          `${department}|${auth_type}`,
          auth_type === 'sso'
            ? `${department.replaceAll('부서', '그룹')}(SSO)`
            : `${department.replaceAll('부서', '그룹')}(일반)`
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
      setDepartments(
        DEFAULT_DEPTS.map((d) => ({
          value: `${d}|local`,
          label: `${d.replaceAll('부서', '그룹')}(일반)`,
        }))
      );
      });
  }, []);

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

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      department: user.department || '',
      cell: user.employeePositionName || '프로',
    });
    setShowEditModal(true);
  };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, deptFilter, selectedRole, pageSize]);

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

  const handleDoubleClick = (user) => {
    setSelectedDetailUser(user);
    setShowDetailModal(true);
  };

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
      return <Badge variant='destructive'>관리자</Badge>;
    }
    return <Badge variant='secondary'>일반</Badge>;
  };

  return (
    <div className='space-y-6 w-full max-w-[90vw] mx-auto'>
      <div className='border-b border-border pb-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-foreground flex items-center gap-2'>
              <Users className='h-6 w-6' />
              사용자 관리
            </h1>
            <p className='text-muted-foreground mt-1'>
              시스템 사용자를 조회하고 관리합니다.
            </p>
          </div>
          <div className='text-right'>
            <div className='text-2xl font-bold text-primary'>
              {totalCount.toLocaleString()}명
            </div>
            <div className='text-sm text-muted-foreground'>
              총 회원수
            </div>
          </div>
        </div>
      </div>

      <div className='bg-card p-4 rounded-lg border border-border'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col sm:flex-row gap-4'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
              <Input
                type='text'
                placeholder='이름, 이메일로 검색...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>

            <select
              value={deptFilter}
              onChange={(e) => { setDeptFilter(e.target.value); setCurrentPage(1); }}
              className='px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground'
            >
                      <option value=''>모든 그룹</option>
              {departments.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>

            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className='px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground'
            >
              <option value=''>모든 역할</option>
              <option value='user'>일반사용자</option>
              <option value='admin'>관리자</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value))}
              className='px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground min-w-[120px]'
            >
              <option value={10}>10명씩 보기</option>
              <option value={20}>20명씩 보기</option>
              <option value={50}>50명씩 보기</option>
            </select>
          </div>

          <div className='flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3'>
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

      <div className='bg-card rounded-lg border border-border overflow-hidden overflow-x-auto'>
        {loading ? (
          <div className='flex items-center justify-center h-32'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
          </div>
        ) : users.length === 0 ? (
          <div className='text-center py-12'>
            <Users className='mx-auto h-12 w-12 text-muted-foreground' />
            <h3 className='mt-2 text-sm font-medium text-foreground'>
              사용자가 없습니다
            </h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              검색 조건을 변경해보세요.
            </p>
          </div>
        ) : (
          <>
            <div className='bg-muted px-6 py-3 border-b border-border'>
              <div className='grid grid-cols-18 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[1200px]'>
                <div className='col-span-4'>사용자 정보</div>
                    <div className='col-span-2'>그룹</div>
                <div className='col-span-2'>직급</div>
                <div className='col-span-1'>역할</div>
                <div className='col-span-2'>로그인타입</div>
                <div className='col-span-2'>가입일</div>
                <div className='col-span-3 flex items-center gap-1'>
                  <span>마지막 접속 / 활동</span>
                  <div className='relative group'>
                    <HelpCircle className='w-3 h-3 text-muted-foreground cursor-help' />
                    <div className='pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 w-64 rounded-lg bg-slate-900 text-white text-[11px] px-3 py-2 opacity-0 group-hover:opacity-100 z-20 shadow-lg leading-relaxed'>
                      <p className='font-semibold mb-1 text-slate-200'>기록 방식</p>
                      <p className='mb-1'>
                        <span className='text-sky-300 font-medium'>활동</span>
                        {' '}— 채팅 메시지 전송 시 기록
                        <br />
                        <span className='text-slate-400'>동일 사용자 10분 이내 중복 미기록</span>
                      </p>
                      <p>
                            <span className='text-primary font-medium'>로그인</span>
                        {' '}— 로그인 성공 시마다 기록
                      </p>
                      <p className='mt-1 text-slate-400 border-t border-slate-700 pt-1'>
                        표시 우선순위: 활동 {'>'} 로그인
                      </p>
                    </div>
                  </div>
                </div>
                <div className='col-span-2'>작업</div>
              </div>
            </div>

            <div className='divide-y divide-border'>
              {users.map((user) => (
                <div
                  key={user._id}
                  className='px-6 py-4 hover:bg-accent cursor-pointer transition-colors duration-150'
                  onDoubleClick={() => handleDoubleClick(user)}
                  title='더블 클릭하여 상세 정보 보기'
                >
                  <div className='grid grid-cols-18 gap-4 items-center min-w-[1200px]'>
                    <div className='col-span-4'>
                      <div className='flex items-center'>
                        <div className='h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0'>
                          <span className='text-sm font-medium text-primary'>
                            {user.name?.charAt(0) ||
                              user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className='ml-3 min-w-0 flex-1'>
                          <div className='text-sm font-medium text-foreground'>
                            {user.name || '이름 없음'}
                            {user.authType === 'sso' && user.employeeNo && (
                              <span className='text-muted-foreground font-normal ml-1'>
                                ({user.employeeNo})
                              </span>
                            )}
                          </div>
                          <div className='text-sm text-muted-foreground flex items-center'>
                            <Mail className='h-3 w-3 mr-1 flex-shrink-0' />
                            <span className='truncate'>{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className='col-span-2'>
                      <div className='flex items-center text-sm text-foreground'>
                        <Building className='h-4 w-4 mr-1 text-muted-foreground flex-shrink-0' />
                            <span className='truncate'>
                              {user.department?.replaceAll('부서', '그룹') || '미설정'}
                            </span>
                      </div>
                    </div>

                    <div className='col-span-2'>
                      <span className='text-sm text-foreground truncate block'>
                        {user.employeePositionName || '-'}
                      </span>
                    </div>

                    <div className='col-span-1'>{getRoleBadge(user.role)}</div>

                    <div className='col-span-2'>
                      <Badge variant={user.authType === 'sso' ? 'default' : 'secondary'}>
                        {user.authType === 'sso' ? 'SSO' : '일반'}
                      </Badge>
                    </div>

                    <div className='col-span-2'>
                      <div className='relative group inline-flex items-center text-sm text-muted-foreground'>
                        <span>{formatDate(user.createdAt)}</span>
                        <span className='pointer-events-none absolute left-0 top-full mt-1 rounded bg-slate-900 text-white text-[11px] px-2 py-1 opacity-0 group-hover:opacity-100 whitespace-nowrap'>
                          {formatDate(user.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className='col-span-3'>
                      <div className='inline-flex flex-col text-sm text-muted-foreground gap-0.5'>
                        {user.lastActiveAt ? (
                          <span>
                            <span className='text-[10px] text-sky-500 mr-1'>활동</span>
                            {formatDate(user.lastActiveAt)}
                          </span>
                        ) : (
                          <span className='text-muted-foreground text-xs'>활동 기록 없음</span>
                        )}
                        {user.lastLoginAt ? (
                          <span>
                            <span className='text-[10px] text-primary mr-1'>로그인</span>
                            {formatDate(user.lastLoginAt)}
                          </span>
                        ) : (
                          <span className='text-muted-foreground text-xs'>로그인 기록 없음</span>
                        )}
                      </div>
                    </div>

                    <div className='col-span-2'>
                      <div className='flex items-center space-x-2'>
                        <Button
                          variant='ghost'
                          size='icon-sm'
                          onClick={() => openEditModal(user)}
                          className='text-primary hover:text-primary hover:bg-primary/10'
                          title='사용자 정보 수정'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>

                        {user.role === 'admin' ? (
                          <Button
                            variant='ghost'
                            size='icon-sm'
                            onClick={() => updateUserRole(user._id, 'user')}
                            className='text-muted-foreground hover:text-foreground hover:bg-accent'
                            title='관리자 권한 해제'
                          >
                            <UserX className='h-4 w-4' />
                          </Button>
                        ) : (
                          <Button
                            variant='ghost'
                            size='icon-sm'
                            onClick={() => updateUserRole(user._id, 'admin')}
                            className='text-primary hover:text-primary hover:bg-primary/10'
                            title='관리자 권한 부여'
                          >
                            <UserCheck className='h-4 w-4' />
                          </Button>
                        )}

                        <Button
                          variant='ghost'
                          size='icon-sm'
                          onClick={() => deleteUser(user._id, user.email)}
                          className='text-destructive hover:text-destructive hover:bg-destructive/10'
                          title='사용자 삭제'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className='flex items-center justify-center space-x-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            이전
          </Button>

          <span className='px-4 py-2 text-sm font-medium text-foreground'>
            {currentPage} / {totalPages}
          </span>

          <Button
            variant='outline'
            size='sm'
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
          >
            다음
          </Button>
        </div>
      )}

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className='sm:max-w-lg lg:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>사용자 정보 수정</DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <div>
              <Label className='mb-1'>이메일</Label>
              <Input
                type='email'
                value={editingUser?.email || ''}
                readOnly
                className='cursor-not-allowed opacity-60'
              />
            </div>

            <div>
              <Label className='mb-1'>이름</Label>
              <Input
                type='text'
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder='이름을 입력하세요'
              />
            </div>

            <div>
                      <Label className='mb-1'>그룹</Label>
              <Input
                type='text'
                value={editForm.department}
                onChange={(e) =>
                  setEditForm({ ...editForm, department: e.target.value })
                }
                            placeholder='그룹을 입력하세요'
              />
            </div>

            <div>
              <Label className='mb-1'>직급</Label>
              <Input
                type='text'
                value={editForm.cell}
                onChange={(e) =>
                  setEditForm({ ...editForm, cell: e.target.value })
                }
                placeholder='예: 프로, 팀장'
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setShowEditModal(false)}
            >
              취소
            </Button>
            <Button onClick={updateUser}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showDetailModal && selectedDetailUser && (
        <UserDetailModal
          user={selectedDetailUser}
          onClose={closeDetailModal}
        />
      )}
    </div>
  );
}
