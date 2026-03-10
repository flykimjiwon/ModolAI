'use client';

import React from 'react';
import PropTypes from 'prop-types';
import { X, Loader2 } from 'lucide-react';

/**
 * 응답 생성 중에 입력 영역만 비활성화하고 중단 버튼을 표시합니다.
 * 채팅 내용은 계속 볼 수 있도록 합니다.
 * @param {{ onStop: () => void }} props
 */
export default function LoadingSpinner({ onStop }) {
  return (
    <>
      {/* 입력 영역 오버레이 - 입력창과 버튼만 비활성화 */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-sm">
        <div className="h-32" /> {/* 입력 영역 높이만큼 */}
      </div>
      
      {/* 플로팅 중단 버튼 */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="card p-3 flex items-center gap-3 shadow-lg">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <span className="text-gray-600 dark:text-gray-400 text-sm">응답 생성 중...</span>
          <button
            onClick={onStop}
            className="btn-danger flex items-center gap-1 text-xs py-1 px-2"
          >
            <X className="h-3 w-3" />
            중단
          </button>
        </div>
      </div>
    </>
  );
}

// PropTypes 로 간단히 타입 체크 (선택사항)
LoadingSpinner.propTypes = {
  onStop: PropTypes.func.isRequired,
};
