'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';
import MarkdownPreview from "@uiw/react-markdown-preview";
import { useAlert } from '@/contexts/AlertContext';
import { decodeJWTPayload } from '@/lib/jwtUtils';

// 마크다운 에디터를 동적으로 로드 (SSR 방지)
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

export default function NoticeWritePage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPopup, setIsPopup] = useState(false);
  const [isPopupLogin, setIsPopupLogin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [popupWidth, setPopupWidth] = useState(512);
  const [popupHeight, setPopupHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [userRole, setUserRole] = useState('');
  const router = useRouter();
  const { alert } = useAlert();

  // 권한 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    try {
      const payload = decodeJWTPayload(token);
      if (payload.role !== 'admin') {
        alert('관리자 권한이 필요합니다.', 'warning', '권한 오류');
        router.push('/notice');
        return;
      }
      setUserRole(payload.role);
    } catch (error) {
      console.error('토큰 파싱 실패:', error);
      localStorage.removeItem('token');
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
    }
  }, [router, alert]);

  // 이미지 업로드 핸들러
  const handleImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 파일 크기 체크 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB를 초과할 수 없습니다.', 'warning', '파일 크기 제한');
        return;
      }

      try {
        const formData = new FormData();
        formData.append('image', file);

        const token = localStorage.getItem('token');
        const response = await fetch('/api/upload/image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.status === 401) {
          alert('로그인이 필요합니다.', 'warning', '인증 필요');
          return;
        }

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || '이미지 업로드 실패');
        }

        const result = await response.json();
        
        // 마크다운에 이미지 추가
        const imageMarkdown = `![${file.name}](${result.url})`;
        const newContent = content + '\n\n' + imageMarkdown;
        setContent(newContent);
        
        alert('이미지가 업로드되었습니다.', 'success', '업로드 완료');
      } catch (error) {
        console.error('이미지 업로드 실패:', error);
        alert(error.message || '이미지 업로드에 실패했습니다.', 'error', '업로드 실패');
      }
    };
    input.click();
  };

  // 공지사항 저장
  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.', 'warning', '입력 오류');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/notice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          isPopup,
          isPopupLogin,
          isActive,
          popupWidth: popupWidth ? parseInt(popupWidth, 10) : null,
          popupHeight: popupHeight ? parseInt(popupHeight, 10) : null
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '공지사항 저장 실패');
      }

      alert('공지사항이 저장되었습니다.', 'success', '저장 완료');
      router.push('/notice');
    } catch (error) {
      console.error('공지사항 저장 실패:', error);
      alert(error.message || '공지사항 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setLoading(false);
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/notice')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="목록으로"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              공지사항 작성
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Eye className="h-4 w-4" />
              {previewMode ? '편집' : '미리보기'}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* 작성 폼 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* 제목 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="공지사항 제목을 입력하세요"
            />
          </div>

          {/* 옵션 */}
          <div className="flex items-center gap-6 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPopup}
                onChange={(e) => setIsPopup(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">메인화면 팝업으로 표시</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPopupLogin}
                onChange={(e) => setIsPopupLogin(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">로그인화면 팝업으로 표시</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">활성화</span>
            </label>
          </div>

          {/* 팝업 사이즈 설정 */}
          {(isPopup || isPopupLogin) && (
            <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">팝업 사이즈:</span>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">너비</label>
                <input
                  type="number"
                  value={popupWidth}
                  onChange={(e) => setPopupWidth(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white"
                  placeholder="512"
                  min="300"
                  max="1200"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">px</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">높이</label>
                <input
                  type="number"
                  value={popupHeight}
                  onChange={(e) => setPopupHeight(e.target.value)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-600 dark:text-white"
                  placeholder="자동"
                  min="200"
                  max="900"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">px (비우면 자동)</span>
              </div>
            </div>
          )}

          {/* 내용 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              내용
            </label>
            {previewMode ? (
              <div className="min-h-[400px] p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                <MarkdownPreview 
                  source={content} 
                  style={{ backgroundColor: 'transparent' }}
                />
              </div>
            ) : (
              <div>
                {/* 이미지 업로드 버튼 */}
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleImageUpload}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                    </svg>
                    이미지 업로드
                  </button>
                </div>
                
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <MDEditor
                    value={content}
                    onChange={(value) => setContent(value || '')}
                    height={400}
                    data-color-mode="auto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 도움말 */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="mb-1">💡 마크다운 문법을 사용할 수 있습니다.</p>
            <p>• **굵은글씨**, *기울임글씨*, `코드`, [링크](URL)</p>
            <p>• 📷 이미지 업로드: 툴바의 이미지 버튼 클릭 (최대 10MB)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
