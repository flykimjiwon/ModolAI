import { X } from 'lucide-react';

export default function UserDetailModal({ user, onClose }) {
    if (!user) return null;

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    };

    const InfoGroup = ({ title, children }) => (
        <div className='mb-6'>
            <h4 className='text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700'>
                {title}
            </h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4'>
                {children}
            </div>
        </div>
    );

    const InfoItem = ({ label, value, fullWidth = false, className = '' }) => (
        <div className={`${fullWidth ? 'col-span-1 md:col-span-2' : ''} ${className}`}>
            <dt className='text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'>
                {label}
            </dt>
            <dd className='text-sm text-gray-900 dark:text-white break-all'>
                {value || '-'}
            </dd>
        </div>
    );

    return (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            {/* 배경 오버레이 */}
            <div
                className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
                onClick={onClose}
            ></div>

            {/* 모달 내용 */}
            <div className='relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col'>
                {/* 헤더 */}
                <div className='flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700'>
                    <div className='flex items-center gap-3'>
                        <h3 className='text-lg font-bold text-gray-900 dark:text-white'>
                            사용자 상세 정보
                        </h3>
                        <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${user.authType === 'sso'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                }`}
                        >
                            {user.authType === 'sso' ? 'SSO 계정' : '일반 계정'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className='text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors'
                    >
                        <X className='h-5 w-5' />
                    </button>
                </div>

                {/* 본문 (스크롤 가능) */}
                <div className='flex-1 overflow-y-auto p-6'>
                    {/* 기본 정보 */}
                    <InfoGroup title='기본 프로필'>
                        <InfoItem
                            label='이름'
                            value={
                                user.authType === 'sso' && user.employeeNo
                                    ? `${user.name} (${user.employeeNo})`
                                    : user.name
                            }
                        />
                        <InfoItem label='이메일 (회사)' value={user.email} />
                        <InfoItem label='역할' value={user.role === 'admin' ? '관리자' : '일반 사용자'} />
                        <InfoItem label='계정 유형' value={user.authType === 'sso' ? 'SSO' : '일반'} />
                    </InfoGroup>

                    {/* 조직 정보 */}
                    <InfoGroup title='조직 정보'>
                        <InfoItem label='회사명' value={user.companyName} />
                        <InfoItem label='회사 코드' value={user.companyCode} />
                        <InfoItem label='그룹사 ID' value={user.companyId} />
                        <InfoItem label='부서명' value={user.department} />
                        <InfoItem label='부서 ID' value={user.departmentId} />
                        <InfoItem label='부서점 번호' value={user.departmentNo} />
                        <InfoItem label='부서 경로' value={user.departmentLocation} fullWidth />
                    </InfoGroup>

                    {/* 사원 정보 */}
                    <InfoGroup title='사원 정보'>
                        <InfoItem label='사번' value={user.employeeNo} />
                        <InfoItem label='사원 ID' value={user.employeeId} />
                        <InfoItem label='SSO 사용자 ID' value={user.ssoUserId} />
                        <InfoItem label='직급' value={user.employeePositionName} />
                        <InfoItem
                            label='직원 유형'
                            value={
                                user.employeeClass === 'NORMAL' ? '정직원' :
                                user.employeeClass === 'EXECUTIVE' ? '임원' :
                                user.employeeClass === 'OUTSOURCE_TEMP' ? '외주임시' :
                                user.employeeClass === 'OUTSOURCE_RESIDENT' ? '외주상주' :
                                user.employeeClass
                            }
                        />
                        <InfoItem label='보안 등급' value={user.employeeSecurityLevel} />
                        <InfoItem label='언어 설정' value={user.lang} />
                    </InfoGroup>

                    {/* 시스템 정보 */}
                    <InfoGroup title='시스템 정보'>
                        <InfoItem label='가입일시' value={formatDate(user.createdAt)} />
                        <InfoItem label='정보 수정일시' value={formatDate(user.updatedAt)} />
                        <InfoItem label='마지막 로그인' value={formatDate(user.lastLoginAt)} />
                        <InfoItem label='마지막 활동' value={formatDate(user.lastActiveAt)} />
                        <InfoItem label='로그인 차단 여부' value={user.loginDenyYn === 'Y' ? '차단됨' : '정상'} />
                        <InfoItem label='마지막 SSO 응답' value={formatDate(user.ssoResponseDatetime)} />
                        <InfoItem label='인증 이벤트 ID' value={user.authEventId} />
                        <InfoItem label='시스템 ID (UUID)' value={user.id} fullWidth className='font-mono text-xs' />
                    </InfoGroup>
                </div>

                {/* 푸터 */}
                <div className='p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end'>
                    <button
                        onClick={onClose}
                        className='px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
