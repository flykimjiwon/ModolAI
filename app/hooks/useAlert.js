'use client';

import { useState, useCallback } from 'react';
import { AlertModal, ConfirmModal } from '@/components/ui/modal';

/**
 * 전역 alert 모달을 관리하는 훅
 * alert() 대신 사용할 수 있는 모달 시스템
 */
export function useAlert() {
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info', // 'info' | 'success' | 'warning' | 'error'
  });

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null,
    confirmText: '확인',
    cancelText: '취소',
  });

  const alert = useCallback((message, type = 'info', title = null) => {
    setAlertModal({
      isOpen: true,
      title:
        title ||
        (type === 'error'
          ? '오류'
          : type === 'warning'
          ? '경고'
          : type === 'success'
          ? '성공'
          : '알림'),
      message: String(message),
      type,
    });
  }, []);

  const confirm = useCallback((message, title = '확인', type = 'warning') => {
    return new Promise((resolve) => {
      setConfirmModal({
        isOpen: true,
        title,
        message: String(message),
        type,
        onConfirm: () => resolve(true),
        confirmText: '확인',
        cancelText: '취소',
      });
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModal((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (confirmModal.onConfirm) {
      await confirmModal.onConfirm();
    }
    closeConfirm();
  }, [confirmModal, closeConfirm]);

  const AlertComponent = (
    <>
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
      />
    </>
  );

  return {
    alert,
    confirm,
    AlertComponent,
  };
}
