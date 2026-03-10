'use client';

import { useEffect, useState } from 'react';
import {
  X,
  AlertCircle,
  Info,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export function AlertModal({ isOpen, onClose, title, message, type = 'info' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const iconMap = {
    info: <Info className='h-6 w-6 text-blue-500' />,
    warning: <AlertTriangle className='h-6 w-6 text-yellow-500' />,
    error: <AlertCircle className='h-6 w-6 text-red-500' />,
    success: <CheckCircle className='h-6 w-6 text-green-500' />,
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* 배경 오버레이 */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
        onClick={onClose}
      />

      {/* 모달 */}
      <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100'>
        <div className='bg-white dark:bg-gray-800 p-6 rounded-t-xl'>
          <div className='flex items-start gap-4'>
            <div className='flex-shrink-0 mt-0.5'>{iconMap[type]}</div>
            <div className='flex-1 min-w-0'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                {title}
              </h3>
              <div className='text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line'>
                {Array.isArray(message)
                  ? message.map((msg, index) => <div key={index}>{msg}</div>)
                  : message}
              </div>
            </div>
            <button
              onClick={onClose}
              className='flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
              aria-label='닫기'
            >
              <X className='h-5 w-5 text-gray-500 dark:text-gray-400' />
            </button>
          </div>
        </div>

        <div className='p-6'>
          <button
            onClick={onClose}
            className='w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm'
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = '확인',
  cancelText = '취소',
}) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(false); // 모달이 열릴 때 로딩 상태 초기화
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const iconMap = {
    info: <Info className='h-6 w-6 text-blue-500' />,
    warning: <AlertTriangle className='h-6 w-6 text-yellow-500' />,
    error: <AlertCircle className='h-6 w-6 text-red-500' />,
    success: <CheckCircle className='h-6 w-6 text-green-500' />,
  };

  const handleConfirm = async () => {
    if (isLoading) return; // 이미 실행 중이면 무시

    setIsLoading(true);
    try {
      if (onConfirm) {
        await onConfirm();
      }
      onClose();
    } catch (error) {
      console.error('ConfirmModal onConfirm 실행 중 오류:', error);
      setIsLoading(false); // 오류 발생 시에도 로딩 상태 해제
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      {/* 배경 오버레이 */}
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity'
        onClick={isLoading ? undefined : onClose}
      />

      {/* 모달 */}
      <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100'>
        <div className='bg-white dark:bg-gray-800 p-6 rounded-t-xl'>
          <div className='flex items-start gap-4'>
            <div className='flex-shrink-0 mt-0.5'>{iconMap[type]}</div>
            <div className='flex-1 min-w-0'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-1'>
                {title}
              </h3>
              <div className='text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line'>
                {Array.isArray(message)
                  ? message.map((msg, index) => <div key={index}>{msg}</div>)
                  : message}
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className='flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              aria-label='닫기'
            >
              <X className='h-5 w-5 text-gray-500 dark:text-gray-400' />
            </button>
          </div>
        </div>

        <div className='p-6 flex gap-3'>
          <button
            onClick={onClose}
            disabled={isLoading}
            className='flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className='flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
          >
            {isLoading && <Loader2 className='h-4 w-4 animate-spin' />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
