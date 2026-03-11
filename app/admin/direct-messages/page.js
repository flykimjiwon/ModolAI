'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Search,
  Mail,
  MailOpen,
  Trash2,
  Eye,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  XCircle,
  Clock,
  User,
  Plus,
} from '@/components/icons';
import { useAlert } from '@/contexts/AlertContext';
import SendMessageModal from './components/SendMessageModal';

export default function DirectMessagesPage() {
  const { alert, confirm } = useAlert();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [isReadFilter, setIsReadFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // 쪽지 목록 조회
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        recipient: recipientFilter,
        isRead: isReadFilter,
      });

      const response = await fetch(`/api/admin/direct-messages?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '쪽지 목록 조회 실패');
      }
      setMessages(data.messages);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (error) {
      console.error('쪽지 목록 조회 실패:', error);
      alert('쪽지 목록을 불러오는데 실패했습니다.', 'error', '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, recipientFilter, isReadFilter, alert]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, recipientFilter, isReadFilter]);

  // 쪽지 삭제
  const deleteMessage = async (messageId) => {
    const confirmed = await confirm(
      '이 쪽지를 정말 삭제하시겠습니까?',
      '쪽지 삭제 확인'
    );
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/direct-messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('쪽지 삭제 실패');
      }

      fetchMessages();
      alert('쪽지가 삭제되었습니다.', 'success', '삭제 완료');
    } catch (error) {
      console.error('쪽지 삭제 실패:', error);
      alert('쪽지 삭제에 실패했습니다.', 'error', '삭제 실패');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Seoul',
    });
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  // 활성 필터 개수 계산
  const getActiveFiltersCount = () => {
    let count = 0;
    if (searchTerm) count++;
    if (recipientFilter) count++;
    if (isReadFilter) count++;
    return count;
  };

  // 모든 필터 초기화
  const clearAllFilters = () => {
    setSearchTerm('');
    setRecipientFilter('');
    setIsReadFilter('');
  };

  const handleSendSuccess = (message) => {
    alert(message, 'success', '발송 완료');
    fetchMessages();
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="bg-muted rounded-lg p-6 border border-border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="bg-primary p-2 rounded-lg">
                <Mail className="h-7 w-7 text-white" />
              </div>
              쪽지 관리
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              사용자에게 쪽지를 보내고 발송 내역을 관리합니다
            </p>

            {/* 통계 요약 */}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg shadow-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  총 발송:
                </span>
                <span className="text-lg font-bold text-foreground">
                  {totalCount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 액션 버튼 그룹 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchMessages()}
              disabled={loading}
              className="inline-flex items-center px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-white text-sm font-medium rounded-lg transition-all shadow-sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              새로고침
            </button>
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-all shadow-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              새 쪽지 보내기
            </button>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        {/* 필터 헤더 */}
        <div className="bg-muted px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-foreground" />
              <h3 className="text-lg font-semibold text-foreground">
                필터 및 검색
              </h3>
              {getActiveFiltersCount() > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {getActiveFiltersCount()}개 활성
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {getActiveFiltersCount() > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-colors"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  모두 초기화
                </button>
              )}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent rounded-lg transition-colors"
              >
                {showFilters ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    숨기기
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    펼치기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 필터 콘텐츠 */}
        {showFilters && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 검색 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <Search className="inline h-4 w-4 mr-1" />
                  제목/내용 검색
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <input
                    type="text"
                    placeholder="검색어를 입력하세요..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all"
                  />
                </div>
              </div>

              {/* 수신자 검색 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  수신자 검색
                </label>
                <input
                  type="text"
                  placeholder="이름 또는 이메일..."
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all"
                />
              </div>

              {/* 읽음 상태 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  <MailOpen className="inline h-4 w-4 mr-1" />
                  읽음 상태
                </label>
                <select
                  value={isReadFilter}
                  onChange={(e) => setIsReadFilter(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-card text-foreground transition-all"
                >
                  <option value="">전체</option>
                  <option value="true">읽음</option>
                  <option value="false">안 읽음</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 쪽지 목록 */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">
              데이터를 불러오는 중...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              보낸 쪽지가 없습니다
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              새 쪽지를 보내보세요.
            </p>
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              새 쪽지 보내기
            </button>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="bg-muted px-6 py-4 border-b-2 border-border">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold text-foreground uppercase tracking-wider">
                <div className="col-span-2 flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  수신자
                </div>
                <div className="col-span-3 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  제목
                </div>
                <div className="col-span-3">내용</div>
                <div className="col-span-1 flex items-center gap-1">
                  <MailOpen className="h-3.5 w-3.5" />
                  상태
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  발송일시
                </div>
                <div className="col-span-1 text-center">작업</div>
              </div>
            </div>

            {/* 쪽지 목록 */}
            <div className="max-h-[70vh] overflow-y-auto">
              <div className="divide-y divide-border">
                {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`px-6 py-4 transition-all duration-150 ${
                      index % 2 === 0
                        ? 'bg-card'
                        : 'bg-muted/50'
                    } hover:bg-accent hover:shadow-sm`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* 수신자 */}
                      <div className="col-span-2">
                        <div className="text-sm">
                          <p className="font-semibold text-foreground truncate">
                            {message.recipient?.name || '이름 없음'}
                          </p>
                          <p className="text-muted-foreground text-xs truncate">
                            {message.recipient?.email}
                          </p>
                          {message.recipient?.department && (
                            <p className="text-muted-foreground text-xs truncate">
                              {message.recipient.department}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 제목 */}
                      <div className="col-span-3">
                        <p className="text-sm font-medium text-foreground truncate">
                          {message.title}
                        </p>
                      </div>

                      {/* 내용 */}
                      <div className="col-span-3">
                        <p className="text-sm text-muted-foreground truncate">
                          {truncateText(message.content, 60)}
                        </p>
                      </div>

                      {/* 상태 */}
                      <div className="col-span-1">
                        {message.deletedByRecipient ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                            삭제됨
                          </span>
                        ) : message.isRead ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <MailOpen className="h-3 w-3 mr-1" />
                            읽음
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            <Mail className="h-3 w-3 mr-1" />
                            안읽음
                          </span>
                        )}
                      </div>

                      {/* 발송일시 */}
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(message.createdAt)}
                        </p>
                        {message.readAt && (
                          <p className="text-xs text-primary mt-1">
                            읽음: {formatDate(message.readAt)}
                          </p>
                        )}
                      </div>

                      {/* 작업 */}
                      <div className="col-span-1">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedMessage(message)}
                            className="p-2 text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-all"
                            title="상세 보기"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="p-2 text-destructive hover:text-destructive bg-destructive/10 hover:bg-destructive/20 rounded-lg transition-all"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="bg-card border border-border rounded-lg shadow-sm p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {((currentPage - 1) * 20 + 1).toLocaleString()}
              </span>
              {' - '}
              <span className="font-medium text-foreground">
                {Math.min(currentPage * 20, totalCount).toLocaleString()}
              </span>
              {' / '}
              <span className="font-medium text-foreground">
                {totalCount.toLocaleString()}
              </span>
              {' 개 쪽지'}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ««
              </button>
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ‹ 이전
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pageButtons = [];
                  const maxVisible = 5;
                  let startPage = Math.max(
                    1,
                    currentPage - Math.floor(maxVisible / 2)
                  );
                  let endPage = Math.min(
                    totalPages,
                    startPage + maxVisible - 1
                  );

                  if (endPage - startPage + 1 < maxVisible) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pageButtons.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                          currentPage === i
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'text-foreground bg-card border border-border hover:bg-accent'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pageButtons;
                })()}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                다음 ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                »»
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쪽지 상세 보기 모달 */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedMessage(null)}
          />
          <div className="relative bg-card rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                쪽지 상세
              </h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                 <label className="text-sm font-medium text-muted-foreground">
                  수신자
                </label>
                 <p className="text-foreground">
                  {selectedMessage.recipient?.name} (
                  {selectedMessage.recipient?.email})
                </p>
              </div>
              <div>
                 <label className="text-sm font-medium text-muted-foreground">
                  제목
                </label>
                 <p className="text-foreground font-medium">
                  {selectedMessage.title}
                </p>
              </div>
              <div>
                 <label className="text-sm font-medium text-muted-foreground">
                  내용
                </label>
                 <div className="mt-1 p-4 bg-muted rounded-lg">
                   <p className="text-foreground whitespace-pre-wrap">
                    {selectedMessage.content}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-sm font-medium text-muted-foreground">
                    발송일시
                  </label>
                   <p className="text-foreground text-sm">
                    {formatDate(selectedMessage.createdAt)}
                  </p>
                </div>
                <div>
                   <label className="text-sm font-medium text-muted-foreground">
                    읽음 상태
                  </label>
                   <p className="text-foreground text-sm">
                    {selectedMessage.isRead
                      ? `읽음 (${formatDate(selectedMessage.readAt)})`
                      : '안 읽음'}
                  </p>
                </div>
              </div>
            </div>
             <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedMessage(null)}
                 className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쪽지 보내기 모달 */}
      <SendMessageModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSuccess={handleSendSuccess}
      />
    </div>
  );
}
