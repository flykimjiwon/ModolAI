import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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
            <h4 className='text-sm font-semibold text-foreground mb-3 pb-2 border-b border-border'>
                {title}
            </h4>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4'>
                {children}
            </div>
        </div>
    );

    const InfoItem = ({ label, value, fullWidth = false, className = '' }) => (
        <div className={`${fullWidth ? 'col-span-1 md:col-span-2' : ''} ${className}`}>
            <dt className='text-xs font-medium text-muted-foreground mb-1'>
                {label}
            </dt>
            <dd className='text-sm text-foreground break-all'>
                {value || '-'}
            </dd>
        </div>
    );

    return (
        <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0'>
                {/* 헤더 */}
                <DialogHeader className='p-4 border-b border-border'>
                    <DialogTitle className='flex items-center gap-3'>
                        사용자 상세 정보
                        <Badge variant={user.authType === 'sso' ? 'default' : 'secondary'}>
                            {user.authType === 'sso' ? 'SSO 계정' : '일반 계정'}
                        </Badge>
                    </DialogTitle>
                </DialogHeader>

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
              <InfoItem label='그룹명' value={user.department} />
              <InfoItem label='그룹 ID' value={user.departmentId} />
              <InfoItem label='그룹 점 번호' value={user.departmentNo} />
              <InfoItem label='그룹 경로' value={user.departmentLocation} fullWidth />
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
                <DialogFooter className='p-4 border-t border-border bg-muted/50'>
                    <Button onClick={onClose}>
                        확인
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
