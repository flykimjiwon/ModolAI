'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Upload, Save, RefreshCw, Globe, MessageCircle, Lightbulb, Trash2, AlertTriangle, ImageIcon, Code } from '@/components/icons';
import Image from 'next/image'; // Image 컴포넌트 임포트
import { useAlert } from '@/contexts/AlertContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const BRANDING_EVENT_NAME = 'modolai-site-branding-updated';

export default function SettingsPage() {
  const { alert, confirm } = useAlert();
  const [tooltipEnabled, setTooltipEnabled] = useState(true);
  const [tooltipMessage, setTooltipMessage] = useState(
    '더 고성능의 모델도 사용할 수 있어요'
  );
  const [chatWidgetEnabled, setChatWidgetEnabled] = useState(false);
  const [profileEditEnabled, setProfileEditEnabled] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(true);
  const [supportContacts, setSupportContacts] = useState([]);
  const [supportContactsEnabled, setSupportContactsEnabled] = useState(true);
  const [siteTitle, setSiteTitle] = useState('ModolAI');
  const [siteDescription, setSiteDescription] = useState('ModolAI');
  const [faviconUrl, setFaviconUrl] = useState(null);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [roomNameGenerationModel, setRoomNameGenerationModel] = useState('gemma3:4b');
  const [maxImagesPerMessage, setMaxImagesPerMessage] = useState(5);
  const [maxUserQuestionLength, setMaxUserQuestionLength] = useState(300000);
  const [imageAnalysisModel, setImageAnalysisModel] = useState('');
  const [imageAnalysisPrompt, setImageAnalysisPrompt] = useState(
    '이 이미지를 설명해줘.'
  );
  const [endpoints, setEndpoints] = useState(''); // 콤마 구분 문자열
  const [endpointType, setEndpointType] = useState('ollama'); // 'ollama' | 'openai-compatible'
  const [openaiCompatBase, setOpenaiCompatBase] = useState('');
  const [openaiCompatApiKeyInput, setOpenaiCompatApiKeyInput] = useState('');
  const [clearOpenaiKey, setClearOpenaiKey] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingSection, setSavingSection] = useState(null); // 현재 저장 중인 섹션 추적
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [initSchemaResult, setInitSchemaResult] = useState(null);
  const [dbResetType, setDbResetType] = useState('partial'); // 'partial' | 'all'
  const [dbResetTables, setDbResetTables] = useState(new Set());
  const [dbResetConfirmText, setDbResetConfirmText] = useState('');
  const [dbResetResult, setDbResetResult] = useState(null);
  const [loginType, setLoginType] = useState('local'); // 'local' | 'sso'
  const [apiConfigExample, setApiConfigExample] = useState('');
  const [apiCurlExample, setApiCurlExample] = useState('');

  const dbResetTableOptions = [
    {
      key: 'chat_history',
      label: 'chat_history (개별 대화 기록)',
      description: '메인 채팅 기록 (/)',
    },
    {
      key: 'chat_rooms',
      label: 'chat_rooms (채팅방)',
      description: '메인 채팅 방 목록/이름 (/)',
    },
    {
      key: 'messages',
      label: 'messages (관리자 메시지 로그)',
      description: '관리자 메시지 로그 (/admin/messages)',
    },
    {
      key: 'chat_files',
      label: 'chat_files (첨부 파일)',
      description: '채팅 첨부 이미지/파일 메타',
    },
    {
      key: 'model_logs',
      label: 'model_logs (모델 로그)',
      description: '모델 호출 로그/인스턴스 상태 (/admin/instances)',
    },
    {
      key: 'model_server_error_history',
      label: 'model_server_error_history',
      description: '모델 서버 오류 이력 (/admin/model-server-error-history)',
    },
    {
      key: 'model_server_status',
      label: 'model_server_status',
      description: '모델 서버 상태/헬스 (/admin/instances)',
    },
    {
      key: 'external_api_prompts',
      label: 'external_api_prompts',
      description: '외부 API 프롬프트 기록 (/admin/external-api-logs)',
    },
    {
      key: 'external_api_logs',
      label: 'external_api_logs',
      description: '외부 API 호출 로그/통계 (/admin/external-api-logs)',
    },
    {
      key: 'api_tokens',
      label: 'api_tokens',
      description: 'API 키 관리 (/admin/api-keys, /my-api-keys)',
    },
    {
      key: 'notices',
      label: 'notices',
      description: '공지사항/팝업 (/notice, /admin/notice)',
    },
    {
      key: 'user_chats',
      label: 'user_chats',
      description: '채팅 위젯 데이터 (화면 우측 위젯)',
    },
    {
      key: 'qa_logs',
      label: 'qa_logs',
      description: '질의응답 로그 (내부 분석)',
    },
    {
      key: 'app_error_logs',
      label: 'app_error_logs',
      description: '앱 오류 로그 (/admin/app-error-logs)',
    },
  ];

  // 설정 로드
  useEffect(() => {
    fetchSettings();
    fetchAvailableModels();
    fetchMigrationStatus();
  }, []);

  // 사용 가능한 모델 목록 로드 (관리자 모델 설정 기준)
  const fetchAvailableModels = async () => {
    try {
      setModelsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/models', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const categories = data?.modelConfig?.categories || {};

        const groupedModels = Object.entries(categories).map(
          ([categoryKey, category]) => {
            const serverName = category.label || categoryKey;
            const models = Array.isArray(category.models)
              ? category.models
              : [];

            // label 기준으로 중복 제거 (같은 label은 라운드로빈으로 하나만 표시)
            const seenLabels = new Set();
            const uniqueModels = [];

            models.forEach((model) => {
              const modelName = model.modelName || model.id || '';
              const label = model.label || modelName;

              if (!seenLabels.has(label)) {
                seenLabels.add(label);
                const isMultimodal =
                  modelName.includes('llava') ||
                  modelName.includes('gemma3') ||
                  modelName.includes('bakllava') ||
                  modelName.includes('vision') ||
                  modelName.includes('multimodal');
                uniqueModels.push({
                  id: model.id || modelName,
                  label: label,
                  tooltip: model.tooltip || '',
                  isMultimodal,
                });
              }
            });

            return {
              serverName,
              provider: 'config',
              models: uniqueModels.sort((a, b) => a.label.localeCompare(b.label)),
            };
          }
        );

        setAvailableModels(groupedModels);
        console.log('사용 가능한 모델 목록 (관리자 설정):', groupedModels);
      } else {
        console.warn('모델 목록 로드 실패:', response.status);
        setAvailableModels([]);
      }
    } catch (error) {
      console.error('모델 목록 로드 실패:', error);
      setAvailableModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/settings', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTooltipEnabled(
          data.tooltipEnabled !== undefined ? data.tooltipEnabled : true
        );
        setTooltipMessage(
          data.tooltipMessage || '더 고성능의 모델도 사용할 수 있어요'
        );
        setChatWidgetEnabled(
          data.chatWidgetEnabled !== undefined ? data.chatWidgetEnabled : false
        );
        setProfileEditEnabled(
          data.profileEditEnabled !== undefined ? data.profileEditEnabled : false
        );
        setBoardEnabled(
          data.boardEnabled !== undefined ? data.boardEnabled : true
        );
        setSupportContacts(Array.isArray(data.supportContacts) ? data.supportContacts : []);
        setSupportContactsEnabled(
          data.supportContactsEnabled !== undefined
            ? data.supportContactsEnabled
            : true
        );
      setSiteTitle(data.siteTitle || 'ModolAI');
      setSiteDescription(data.siteDescription || 'ModolAI');
          setFaviconUrl(data.faviconUrl || null);
          setRoomNameGenerationModel(data.roomNameGenerationModel || 'gemma3:4b');
          setMaxImagesPerMessage(data.maxImagesPerMessage || 5);
          setMaxUserQuestionLength(data.maxUserQuestionLength || 300000);
          setImageAnalysisModel(data.imageAnalysisModel || '');
          setImageAnalysisPrompt(
            data.imageAnalysisPrompt || '이 이미지를 설명해줘.'
          );
        setEndpoints(
          typeof data.endpoints === 'string'
            ? data.endpoints
            : 'http://localhost:11434'
        );
        setEndpointType(data.endpointType || 'ollama');
        setOpenaiCompatBase(data.openaiCompatBase || '');
        setOpenaiCompatApiKeyInput('');
        setClearOpenaiKey(false);
        setLoginType(data.loginType || 'local');
        setApiConfigExample(data.apiConfigExample || '');
        setApiCurlExample(data.apiCurlExample || '');
      } else {
        setTooltipEnabled(true);
        setTooltipMessage('더 고성능의 모델도 사용할 수 있어요');
        setChatWidgetEnabled(true);
        setBoardEnabled(true);
        setSupportContacts([]);
        setSupportContactsEnabled(true);
      setSiteTitle('ModolAI');
      setSiteDescription('ModolAI');
        setFaviconUrl(null);
        setRoomNameGenerationModel('gemma3:4b');
        setMaxUserQuestionLength(300000);
        setEndpoints('http://localhost:11434');
        setEndpointType('ollama');
        setOpenaiCompatBase('');
        setOpenaiCompatApiKeyInput('');
        setClearOpenaiKey(false);
        setLoginType('local');
        setApiConfigExample('');
        setApiCurlExample('');
      }
    } catch (error) {
      console.error('설정 로드 실패:', error);
      setTooltipEnabled(true);
      setTooltipMessage('더 고성능의 모델도 사용할 수 있어요');
      setChatWidgetEnabled(false);
      setProfileEditEnabled(false);
      setBoardEnabled(true);
      setSupportContacts([]);
      setSupportContactsEnabled(true);
      setSiteTitle('ModolAI');
      setSiteDescription('ModolAI');
        setFaviconUrl(null);
        setEndpoints('http://localhost:11434');
        setMaxUserQuestionLength(300000);
      setEndpointType('ollama');
      setOpenaiCompatBase('');
      setOpenaiCompatApiKeyInput('');
      setClearOpenaiKey(false);
      setLoginType('local');
      setApiConfigExample('');
      setApiCurlExample('');
    } finally {
      setLoading(false);
    }
  };

  const fetchMigrationStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/migrate-models', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setMigrationStatus(data);
    } catch (error) {
      console.warn('스키마 상태 조회 실패:', error);
    }
  };


  const runModelMigration = async () => {
    const confirmed = await confirm(
      '모델 스키마 마이그레이션을 실행할까요?',
      'DB 스키마 보정'
    );
    if (!confirmed) return;

    try {
      setSavingSection('db-migration');
      setMigrationResult(null);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/migrate-models', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '마이그레이션 실패');
      }

      const data = await response.json();
      setMigrationResult(data);
      setMigrationStatus(data);
      alert(data.message || '마이그레이션 완료', 'success', '완료');
    } catch (error) {
      console.error('마이그레이션 실패:', error);
      alert(
        error.message || '마이그레이션 중 오류가 발생했습니다.',
        'error',
        '실패'
      );
    } finally {
      setSavingSection(null);
    }
  };

  const handleInitSchema = async () => {
    const confirmed = await confirm(
      '현재 DB에 없는 테이블을 전부 생성합니다. 이미 있는 테이블은 건드리지 않습니다. 계속할까요?',
      '초기 스키마 생성'
    );
    if (!confirmed) return;

    try {
      setSavingSection('init-schema');
      setInitSchemaResult(null);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/init-schema', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '스키마 생성 실패');
      }

      const data = await response.json();
      setInitSchemaResult(data);
      alert(data.message || '스키마 생성 완료', 'success', '완료');
    } catch (error) {
      alert(error.message || '스키마 생성 중 오류가 발생했습니다.', 'error', '실패');
    } finally {
      setSavingSection(null);
    }
  };

  const toggleDbResetTable = (tableKey) => {
    setDbResetTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });
  };

  const resetDatabase = async () => {
    const isAll = dbResetType === 'all';
    const warningText = isAll
      ? '전체 초기화는 복구할 수 없습니다. users/settings 등 핵심 테이블은 보존되지만, 대화/로그 데이터는 삭제됩니다.'
      : '선택한 테이블 데이터가 영구 삭제됩니다.';
    const confirmed = await confirm(
      `정말 실행할까요?\n${warningText}`,
      isAll ? '전체 DB 초기화' : '스키마별 초기화'
    );
    if (!confirmed) return;

    if (dbResetConfirmText.trim().toUpperCase() !== 'RESET') {
      alert('확인 문구가 올바르지 않습니다. RESET을 입력해주세요.', 'error', '확인 필요');
      return;
    }

    if (!isAll && dbResetTables.size === 0) {
      alert('초기화할 테이블을 선택해주세요.', 'warning', '선택 필요');
      return;
    }

    try {
      setSavingSection('db-reset');
      setDbResetResult(null);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/db-reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: isAll ? 'all' : 'partial',
          tables: isAll ? undefined : Array.from(dbResetTables),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'DB 초기화 실패');
      }

      const data = await response.json();
      setDbResetResult(data);
      alert(data.message || 'DB 초기화 완료', 'success', '완료');
      setDbResetConfirmText('');
      setDbResetTables(new Set());
    } catch (error) {
      console.error('DB 초기화 실패:', error);
      alert(
        error.message || 'DB 초기화 중 오류가 발생했습니다.',
        'error',
        '실패'
      );
    } finally {
      setSavingSection(null);
    }
  };

  // 개별 섹션 저장 함수들
  const saveSiteBranding = async () => {
    try {
      setSavingSection('branding');
      const token = localStorage.getItem('token');
      const body = {
        siteTitle,
        siteDescription,
        faviconUrl,
        boardEnabled,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        window.dispatchEvent(
          new CustomEvent(BRANDING_EVENT_NAME, {
            detail: {
              siteTitle,
              siteDescription,
              faviconUrl,
            },
          })
        );
        alert('사이트 브랜딩 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };


  const saveChatWidget = async () => {
    try {
      setSavingSection('widget');
      const token = localStorage.getItem('token');
      const body = {
        chatWidgetEnabled,
        profileEditEnabled,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('채팅 위젯 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  // 채팅 위젯 이력 미노출 처리
  const deleteChatHistory = async () => {
    const confirmed = await confirm(
      '모든 채팅 위젯 메시지를 사용자에게 미노출 처리하시겠습니까? 데이터는 데이터베이스에 보관되며, 사용자에게만 보이지 않습니다.',
      '채팅 이력 미노출 확인'
    );
    
    if (!confirmed) return;

    try {
      setSavingSection('widget-delete');
      const token = localStorage.getItem('token');
      const response = await fetch('/api/webapp-chat', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(
          data.message || '채팅 위젯 이력이 미노출 처리되었습니다.',
          'success',
          '처리 완료'
        );
      } else {
        let errorMessage = '이력 미노출 처리에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('채팅 이력 미노출 처리 실패:', error);
      alert(
        error.message || '채팅 이력 미노출 처리에 실패했습니다.',
        'error',
        '처리 실패'
      );
    } finally {
      setSavingSection(null);
    }
  };

  const saveRoomNameSettings = async () => {
    try {
      setSavingSection('roomName');
      const token = localStorage.getItem('token');
      const body = {
        roomNameGenerationModel,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('대화방명 생성 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  const saveImageSettings = async () => {
    try {
      setSavingSection('image');
      const token = localStorage.getItem('token');
      const body = {
        maxImagesPerMessage,
        imageAnalysisModel,
        imageAnalysisPrompt,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('이미지 업로드 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 작업 실패:', error.message);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  const saveQuestionLengthSettings = async () => {
    try {
      setSavingSection('questionLength');
      const token = localStorage.getItem('token');
      const body = {
        maxUserQuestionLength,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('질문 길이 제한이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 작업 실패:', error.message);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  const saveTooltipSettings = async () => {
    try {
      setSavingSection('tooltip');
      const token = localStorage.getItem('token');
      const body = {
        tooltipEnabled,
        tooltipMessage,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('툴팁 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
    // 에러 발생 시 무시 (선택적 작업)
    console.warn('[Catch] 작업 실패:', error.message);
  }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  const saveLoginTypeSettings = async () => {
    try {
      setSavingSection('loginType');
      const token = localStorage.getItem('token');
      const body = {
        loginType,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('로그인 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 작업 실패:', error.message);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  const saveApiTokenExamples = async () => {
    try {
      setSavingSection('apiTokenExamples');
      const token = localStorage.getItem('token');
      const body = {
        apiConfigExample,
        apiCurlExample,
      };
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('API 키 예시 설정이 저장되었습니다.', 'success', '저장 완료');
        fetchSettings();
      } else {
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 작업 실패:', error.message);
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSavingSection(null);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const body = {
        tooltipEnabled,
        tooltipMessage,
        chatWidgetEnabled,
        boardEnabled,
        supportContacts,
        supportContactsEnabled,
        siteTitle,
        siteDescription,
        faviconUrl,
        roomNameGenerationModel,
        endpointType,
      };
      if (endpointType === 'ollama') {
        body.endpoints = endpoints;
      } else {
        body.openaiCompatBase = openaiCompatBase;
        if (clearOpenaiKey) {
          body.openaiCompatApiKey = '';
        } else if (openaiCompatApiKeyInput.trim()) {
          body.openaiCompatApiKey = openaiCompatApiKeyInput.trim();
        }
      }
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert('전체 설정이 저장되었습니다.', 'success', '저장 완료');
        // 저장 후 키 입력 상태 초기화 및 재조회
        setOpenaiCompatApiKeyInput('');
        setClearOpenaiKey(false);
        fetchSettings();
      } else {
        // 에러 응답 본문 읽기
        let errorMessage = '설정 저장에 실패했습니다.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (error) {
          console.warn('[Catch] 에러 발생:', error.message);
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('설정 저장 실패:', error);
      alert(error.message || '설정 저장에 실패했습니다.', 'error', '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleFaviconUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setFaviconUploading(true);
      const formData = new FormData();
      formData.append('favicon', file);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/upload-favicon', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setFaviconUrl(data.faviconUrl);
        alert('파비콘이 업로드되었습니다. 설정을 저장하세요.', 'success', '업로드 완료');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '파비콘 업로드 실패');
      }
    } catch (error) {
      console.error('파비콘 업로드 실패:', error);
      alert('파비콘 업로드에 실패했습니다: ' + error.message, 'error', '업로드 실패');
    } finally {
      setFaviconUploading(false);
    }
  };

  const addSupportContact = () => {
    setSupportContacts((prev) => [
      ...(prev || []),
      { department: '', name: '', phone: '' },
    ]);
  };

  const updateSupportContact = (index, field, value) => {
    setSupportContacts((prev) => {
      const next = [...(prev || [])];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
  };

  const removeSupportContact = (index) => {
    setSupportContacts((prev) => {
      const next = [...(prev || [])];
      next.splice(index, 1);
      return next;
    });
  };


  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>
            설정
          </h1>
          <p className='text-muted-foreground mt-1'>
            시스템 설정을 관리합니다. 각 섹션별로 개별 저장할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 사이트 브랜딩 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Globe className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              사이트 브랜딩
            </h2>
          </div>
          <button
            onClick={saveSiteBranding}
            disabled={savingSection === 'branding' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'branding' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              사이트 제목
            </label>
            <input
              type='text'
              value={siteTitle}
              onChange={(e) => setSiteTitle(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
              placeholder='ModolAI'
              maxLength={50}
              disabled={loading}
            />
            <p className='text-sm text-muted-foreground mt-1'>
              {siteTitle.length}/50자 • 브라우저 탭에 표시되는 제목입니다.
            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              사이트 설명
            </label>
            <textarea
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
              placeholder='ModolAI'
              maxLength={200}
              rows={2}
              disabled={loading}
            />
            <p className='text-sm text-muted-foreground mt-1'>
              {siteDescription.length}/200자 • 검색엔진과 브라우저에서 사용되는
              설명입니다.
            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              파비콘 (사이트 아이콘)
            </label>
            <div className='flex items-center gap-4'>
              {faviconUrl && (
                <div className='flex items-center gap-2'>
                  <Image
                    src={faviconUrl}
                    alt='Current favicon'
                    width={32}
                    height={32}
                    className='w-8 h-8 rounded'
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span className='text-sm text-muted-foreground'>
                    현재 파비콘
                  </span>
                </div>
              )}
              <label className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 px-4 py-2 cursor-pointer disabled:opacity-50'>
                <Upload className='h-4 w-4' />
                {faviconUploading ? '업로드 중...' : '파비콘 업로드'}
                <input
                  type='file'
                  accept='.ico,.png,.svg'
                  onChange={handleFaviconUpload}
                  className='hidden'
                  disabled={faviconUploading || loading}
                />
              </label>
            </div>
            <p className='text-sm text-muted-foreground mt-1'>
              .ico, .png, .svg 파일을 지원합니다. (최대 1MB)
            </p>
          </div>

          <div className='border border-border rounded-lg p-4 bg-muted'>
            <h4 className='text-sm font-medium text-foreground mb-2'>
              미리보기
            </h4>
            <div className='flex items-center gap-3 p-2 bg-background rounded border'>
              {faviconUrl ? (
                <Image
                  src={faviconUrl}
                  alt='Favicon preview'
                  width={16}
                  height={16}
                  className='w-4 h-4'
                />
              ) : (
                <div className='w-4 h-4 bg-muted rounded'></div>
              )}
              <span className='text-sm font-medium text-foreground'>
                {siteTitle}
              </span>
            </div>
            <p className='text-xs text-muted-foreground mt-1'>
              브라우저 탭 미리보기
            </p>
          </div>

          <div className='border border-border rounded-lg p-4 bg-muted'>
            <h4 className='text-sm font-medium text-foreground mb-2'>
              자유게시판
            </h4>
            <div className='flex items-center justify-between'>
              <div>
                <label className='block text-sm font-medium text-foreground mb-1'>
                  자유게시판 사용
                </label>
                <p className='text-sm text-muted-foreground'>
                  사이드바에 자유게시판 메뉴를 노출합니다.
                </p>
              </div>
              <button
                onClick={() => setBoardEnabled(!boardEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                  boardEnabled
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
                disabled={loading}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform duration-200 ease-in-out ${
                    boardEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 로그인 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Globe className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              로그인 설정
            </h2>
          </div>
          <button
            onClick={saveLoginTypeSettings}
            disabled={savingSection === 'loginType' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'loginType' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-foreground mb-3'>
              기본 로그인 방식
            </label>
            <div className='flex flex-wrap items-center gap-4'>
              <label className='inline-flex items-center gap-2 text-sm text-foreground cursor-pointer'>
                <input
                  type='radio'
                  name='login-type'
                  value='local'
                  checked={loginType === 'local'}
                  onChange={() => setLoginType('local')}
                  className='accent-primary'
                  disabled={loading}
                />
                <span className='font-medium'>일반 로그인</span>
                <span className='text-muted-foreground'>(이메일/비밀번호)</span>
              </label>
              <label className='inline-flex items-center gap-2 text-sm text-foreground cursor-pointer'>
                <input
                  type='radio'
                  name='login-type'
                  value='sso'
                  checked={loginType === 'sso'}
                  onChange={() => setLoginType('sso')}
                  className='accent-primary'
                  disabled={loading}
                />
                <span className='font-medium'>그룹사 로그인 (SSO)</span>
                <span className='text-muted-foreground'>(사번/비밀번호)</span>
              </label>
            </div>
            <p className='text-sm text-muted-foreground mt-2'>
              비로그인 사용자가 접근할 때 기본으로 리다이렉트되는 로그인 페이지를 설정합니다.
            </p>
          </div>

          <div className='border border-border rounded-lg p-4 bg-muted'>
            <h4 className='text-sm font-medium text-foreground mb-2'>
              로그인 페이지 URL
            </h4>
            <ul className='text-sm text-muted-foreground space-y-1'>
              <li>• 일반 로그인: <code className='bg-muted px-1 rounded'>/login</code></li>
              <li>• 그룹사 로그인 (SSO): <code className='bg-muted px-1 rounded'>/sso</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* 담당자 정보 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <MessageCircle className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              담당자 정보
            </h2>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between border border-border rounded-lg p-3 bg-muted'>
            <div>
              <p className='text-sm font-medium text-foreground'>
                로그인 화면 표시
              </p>
              <p className='text-xs text-muted-foreground'>
                로그인 화면 우측 하단에 담당자 카드를 표시합니다.
              </p>
            </div>
            <button
              onClick={() =>
                setSupportContactsEnabled(!supportContactsEnabled)
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                supportContactsEnabled
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform duration-200 ease-in-out ${
                  supportContactsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {supportContacts.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              등록된 담당자가 없습니다.
            </p>
          ) : (
            supportContacts.map((contact, index) => (
              <div
                key={`support-${index}`}
                className='grid grid-cols-1 md:grid-cols-4 gap-3 items-center border border-border rounded-lg p-3 bg-muted'
              >
                <input
                  type='text'
                  value={contact.department || ''}
                  onChange={(e) =>
                    updateSupportContact(index, 'department', e.target.value)
                  }
                  className='px-3 py-2 border border-input rounded-md bg-background text-foreground'
                  placeholder='그룹'
                />
                <input
                  type='text'
                  value={contact.name || ''}
                  onChange={(e) =>
                    updateSupportContact(index, 'name', e.target.value)
                  }
                  className='px-3 py-2 border border-input rounded-md bg-background text-foreground'
                  placeholder='이름'
                />
                <input
                  type='text'
                  value={contact.phone || ''}
                  onChange={(e) =>
                    updateSupportContact(index, 'phone', e.target.value)
                  }
                  className='px-3 py-2 border border-input rounded-md bg-background text-foreground'
                  placeholder='전화번호'
                />
                <button
                  onClick={() => removeSupportContact(index)}
                  className='inline-flex items-center justify-center rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm px-3 py-2'
                >
                  삭제
                </button>
              </div>
            ))
          )}

          <button
            onClick={addSupportContact}
            className='inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm px-3 py-2'
          >
            담당자 추가
          </button>
        </div>
      </div>

      {/* 채팅 위젯 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <MessageCircle className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              채팅 위젯
            </h2>
          </div>
          <button
            onClick={saveChatWidget}
            disabled={savingSection === 'widget' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'widget' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                실시간 채팅 위젯 활성화
              </label>
              <p className='text-sm text-muted-foreground'>
                사용자들이 실시간으로 소통할 수 있는 채팅 위젯을 화면 우측
                하단에 표시합니다.
              </p>
            </div>
            <button
              onClick={() => setChatWidgetEnabled(!chatWidgetEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                chatWidgetEnabled
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
              disabled={loading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform duration-200 ease-in-out ${
                  chatWidgetEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                프로필 수정 메뉴 표시
              </label>
              <p className='text-sm text-muted-foreground'>
                사이드바의 프로필 수정 메뉴를 노출합니다. SSO 환경에서는 끌 수 있습니다.
              </p>
            </div>
            <button
              onClick={() => setProfileEditEnabled(!profileEditEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                profileEditEnabled
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
              disabled={loading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform duration-200 ease-in-out ${
                  profileEditEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className='border border-border rounded-lg p-4 bg-muted'>
            <h4 className='text-sm font-medium text-foreground mb-2'>
              채팅 위젯 정보
            </h4>
            <ul className='text-sm text-muted-foreground space-y-1'>
              <li>• 로그인한 사용자만 채팅 참여 가능</li>
              <li>• 실시간으로 메시지 동기화 (1초 간격)</li>
              <li>• &apos;general&apos; 룸에서 모든 사용자가 대화 공유</li>
              <li>• 비활성화 시 모든 사용자에게 채팅 위젯이 숨겨짐</li>
            </ul>
          </div>

          <div className='border border-red-200 dark:border-red-800 rounded-lg p-4 bg-red-50 dark:bg-red-900/20'>
            <h4 className='text-sm font-medium text-red-900 dark:text-red-200 mb-2'>
              위험 영역
            </h4>
            <p className='text-sm text-red-600 dark:text-red-400 mb-3'>
              채팅 위젯의 모든 메시지를 사용자에게 미노출 처리합니다. 데이터는 데이터베이스에 보관되며, 사용자에게만 보이지 않습니다.
            </p>
            <p className='text-xs text-red-500 dark:text-red-400 mb-3'>
              ℹ️ 실제 데이터는 삭제되지 않으며, 관리자는 데이터베이스에서 확인할 수 있습니다.
            </p>
            <button
              onClick={deleteChatHistory}
              disabled={savingSection === 'widget-delete' || loading}
              className='inline-flex items-center justify-center rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
            >
              <Trash2 className='h-3.5 w-3.5' />
              {savingSection === 'widget-delete' ? '처리 중...' : '채팅 이력 미노출'}
            </button>
          </div>
        </div>
      </div>
      {/* 대화방명 생성 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <MessageCircle className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              대화방명 생성 설정
            </h2>
          </div>
          <button
            onClick={saveRoomNameSettings}
            disabled={savingSection === 'roomName' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'roomName' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='block text-sm font-medium text-foreground'>
                대화방명 생성 모델
              </label>
              <button
                onClick={fetchAvailableModels}
                disabled={modelsLoading}
                className='flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50'
                title='로컬 모델 목록 새로고침'
              >
                <RefreshCw
                  className={`h-3 w-3 ${
                    modelsLoading ? 'animate-spin' : ''
                  }`}
                />
                새로고침
              </button>
            </div>
            <select
              value={roomNameGenerationModel}
              onChange={(e) => setRoomNameGenerationModel(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
              disabled={loading || modelsLoading}
            >
              {modelsLoading ? (
                <option value=''>모델 목록 로드 중...</option>
              ) : availableModels.length === 0 ? (
                <option value='gemma3:4b'>Gemma 3 4B (기본값)</option>
              ) : (
                <>
                  {availableModels.map((server) => (
                    <optgroup
                      key={server.serverName}
                      label={`📡 ${server.serverName} (${server.provider})`}
                    >
                      {server.models.map((model) => (
                        <option key={model.label} value={model.label}>
                          {model.label}{' '}
                          {model.isMultimodal ? '(멀티모달)' : '(텍스트)'}
                          {model.tooltip ? ` - ${model.tooltip}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </>
              )}
            </select>
            <p className='text-sm text-muted-foreground mt-1'>
              새 대화방 생성 시 대화 내용을 바탕으로 방 이름을 자동 생성하는 데 사용되는 모델입니다.
              가벼운 텍스트 모델을 사용하는 것을 권장합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 질문 길이 제한 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <MessageCircle className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              질문 길이 제한
            </h2>
          </div>
          <button
            onClick={saveQuestionLengthSettings}
            disabled={savingSection === 'questionLength' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'questionLength' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-2'>
          <label className='block text-sm font-medium text-foreground'>
            최대 질문 길이 (자)
          </label>
          <input
            type='number'
            min={1000}
            max={1000000}
            value={maxUserQuestionLength}
            onChange={(e) =>
              setMaxUserQuestionLength(
                Number(e.target.value || 0)
              )
            }
            className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
          />
          <p className='text-sm text-muted-foreground'>
            길이 제한이 없거나 비정상적으로 큰 입력을 방지하기 위한 설정입니다.
          </p>
        </div>
      </div>

      {/* 이미지 업로드 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <ImageIcon className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              이미지 업로드 설정
            </h2>
          </div>
          <button
            onClick={saveImageSettings}
            disabled={savingSection === 'image' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'image' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              메시지당 최대 이미지 개수
            </label>
            <input
              type='number'
              min='1'
              max='20'
              value={maxImagesPerMessage}
              onChange={(e) => setMaxImagesPerMessage(Number(e.target.value))}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
              disabled={loading}
            />
            <p className='text-sm text-muted-foreground mt-1'>
              한 번에 업로드할 수 있는 최대 이미지 개수입니다. (1~20)
            </p>
          </div>

          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='block text-sm font-medium text-foreground'>
                이미지 분석 모델
              </label>
              <button
                onClick={fetchAvailableModels}
                disabled={modelsLoading}
                className='flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50'
                title='로컬 모델 목록 새로고침'
              >
                <RefreshCw
                  className={`h-3 w-3 ${
                    modelsLoading ? 'animate-spin' : ''
                  }`}
                />
                새로고침
              </button>
            </div>
            <select
              value={imageAnalysisModel}
              onChange={(e) => setImageAnalysisModel(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
              disabled={loading || modelsLoading}
            >
              <option value=''>선택 안 함</option>
              {modelsLoading ? (
                <option value=''>모델 목록 로드 중...</option>
              ) : availableModels.length === 0 ? (
                <option value=''>모델 없음</option>
              ) : (
                <>
                  {availableModels.map((server) => (
                    <optgroup
                      key={server.serverName}
                      label={`📡 ${server.serverName} (${server.provider})`}
                    >
                      {server.models.map((model) => (
                        <option key={model.label} value={model.label}>
                          {model.label}{' '}
                          {model.isMultimodal ? '(멀티모달)' : '(텍스트)'}
                          {model.tooltip ? ` - ${model.tooltip}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </>
              )}
            </select>
            <p className='text-sm text-muted-foreground mt-1'>
              이미지를 분석할 때 사용할 Vision 모델을 선택합니다.
              이미지 업로드 시 이 모델이 사용됩니다.
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              이미지 분석 기본 질문
            </label>
            <textarea
              value={imageAnalysisPrompt}
              onChange={(e) => setImageAnalysisPrompt(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
              rows='2'
              placeholder='예: 이 이미지를 설명해줘.'
              disabled={loading}
            />
            <p className='text-sm text-muted-foreground mt-1'>
              텍스트 없이 이미지 전송 시 이 문구가 자동으로 사용됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 사용자 안내 툴팁 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Lightbulb className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              사용자 안내 툴팁
            </h2>
          </div>
          <button
            onClick={saveTooltipSettings}
            disabled={savingSection === 'tooltip' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'tooltip' ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <label className='block text-sm font-medium text-foreground mb-1'>
                모델 선택 안내 툴팁 활성화
              </label>
              <p className='text-sm text-muted-foreground'>
                사용자가 페이지에 접속할 때마다 보여지는 둥둥 떠다니는 안내
                메시지 (X 클릭시 해당 세션에서만 숨김)
              </p>
            </div>
            <button
              onClick={() => setTooltipEnabled(!tooltipEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${
                tooltipEnabled ? 'bg-primary' : 'bg-muted'
              }`}
              disabled={loading}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform duration-200 ease-in-out ${
                  tooltipEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {tooltipEnabled && (
            <div>
              <label className='block text-sm font-medium text-foreground mb-2'>
                툴팁 메시지
              </label>
              <input
                type='text'
                value={tooltipMessage}
                onChange={(e) => setTooltipMessage(e.target.value)}
                className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground'
                placeholder='더 고성능의 모델도 사용할 수 있어요'
                maxLength={100}
                disabled={loading}
              />
              <p className='text-sm text-muted-foreground mt-1'>
                {tooltipMessage.length}/100자 • 페이지 접속시마다 표시되며, X
                클릭시 해당 세션에서만 숨겨집니다.
              </p>
            </div>
          )}

          {/* 툴팁 미리보기 */}
          <div className='border border-border rounded-lg p-4 bg-muted'>
            <h4 className='text-sm font-medium text-foreground mb-2'>
              미리보기
            </h4>
            <div className='relative inline-block'>
              <div className='flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-xs'>
                모델 선택
              </div>
              {tooltipEnabled && (
                <div className='absolute -top-14 left-1/2 transform -translate-x-1/2 z-10'>
                  <div className='relative bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap animate-bounce'>
                    {tooltipMessage}
                    {/* 말풍선 꼬리 */}
                    <div className='absolute top-full left-1/2 transform -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-primary'></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API 키 페이지 예시 설정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Code className='h-5 w-5 text-primary' />
            <h2 className='text-lg font-semibold text-foreground'>
              API 키 페이지 예시 설정
            </h2>
          </div>
          <button
            onClick={saveApiTokenExamples}
            disabled={savingSection === 'apiTokenExamples' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Save className='h-3.5 w-3.5' />
            {savingSection === 'apiTokenExamples' ? '저장 중...' : '저장'}
          </button>
        </div>

        <p className='text-sm text-muted-foreground mb-4'>
          /my-api-keys 페이지에 표시되는 config 예시와 curl 예시를 관리합니다.
          환경에 맞게 직접 수정하세요.
        </p>

        <div className='space-y-4'>
          <div className='bg-primary/10 border border-primary/30 rounded-lg p-3 mb-4'>
            <p className='text-sm text-primary'>
              <strong>플레이스홀더 안내:</strong> <code className='bg-primary/20 px-1 rounded'>{'{{KEY}}'}</code> → 사용자가 선택한 API 키로 자동 치환됩니다.
            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              VSCode Continue config 예시 (YAML)
            </label>
            <textarea
              value={apiConfigExample}
              onChange={(e) => setApiConfigExample(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground font-mono text-sm'
              rows='10'
              placeholder={`name: Local Agent
version: 1.0.0
schema: v1
models:
  - title: "My Chat Model"
    provider: "openai"
    model: "gemma3:4b"
    apiKey: "{{KEY}}"
    baseUrl: "http://localhost:3000/v1"`}
              disabled={loading}
            />
            <p className='text-sm text-muted-foreground mt-1'>
              사용자가 모델과 키를 선택하면 플레이스홀더가 실제 값으로 치환됩니다. 비워두면 기본 예시가 표시됩니다.
            </p>
          </div>

          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              curl 테스트 예시 (Windows 기본)
            </label>
            <textarea
              value={apiCurlExample}
              onChange={(e) => setApiCurlExample(e.target.value)}
              className='w-full px-3 py-2 border border-input rounded-md bg-background text-foreground font-mono text-sm'
              rows='6'
              placeholder={`curl -X POST http://localhost:3000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer {{KEY}}" ^
  -d "{\\"model\\": \\"gemma3:4b\\", \\"messages\\": [{\\"role\\": \\"user\\", \\"content\\": \\"Hello!\\"}], \\"stream\\": true}"`}
              disabled={loading}
            />
            <p className='text-sm text-muted-foreground mt-1'>
              Windows 형식 기준으로 작성하세요. 비워두면 기본 예시가 표시됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* DB 스키마 보정 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <RefreshCw className='h-5 w-5 text-muted-foreground' />
            <h2 className='text-lg font-semibold text-foreground'>
              DB 스키마 보정
            </h2>
          </div>
          <div className='flex items-center gap-2'>
            <button
              onClick={fetchMigrationStatus}
              disabled={savingSection === 'db-migration' || loading}
              className='inline-flex items-center justify-center rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
            >
              <RefreshCw className='h-3.5 w-3.5' />
              상태 확인
            </button>
            <button
              onClick={runModelMigration}
              disabled={savingSection === 'db-migration' || loading}
              className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  savingSection === 'db-migration' ? 'animate-spin' : ''
                }`}
              />
              {savingSection === 'db-migration'
                ? '실행 중...'
                : '마이그레이션 실행'}
            </button>
          </div>
        </div>
        <p className='text-sm text-muted-foreground'>
          프론트만 배포하는 환경에서 models 테이블 컬럼을 최신 스키마로
          보정합니다. (예: api_config, api_key, app_error_logs)
        </p>
        {migrationStatus && (
          <div className='mt-3 text-xs text-muted-foreground'>
            상태: {migrationStatus.isUpToDate ? '최신' : '보정 필요'}
            {migrationStatus.missing?.length > 0 && (
              <span className='ml-2'>
                누락 컬럼: {migrationStatus.missing.map((c) => c.name).join(', ')}
              </span>
            )}
            {migrationStatus.missingTables?.length > 0 && (
              <span className='ml-2'>
                누락 테이블: {migrationStatus.missingTables.join(', ')}
              </span>
            )}
          </div>
        )}
        {migrationResult?.columns && (
          <div className='mt-3 text-xs text-muted-foreground'>
            현재 컬럼 수: {migrationResult.columns.length}
          </div>
        )}
      </div>

      {/* 초기 스키마 생성 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <RefreshCw className='h-5 w-5 text-muted-foreground' />
            <h2 className='text-lg font-semibold text-foreground'>
              초기 스키마 생성
            </h2>
          </div>
          <button
            onClick={handleInitSchema}
            disabled={savingSection === 'init-schema' || loading}
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                savingSection === 'init-schema' ? 'animate-spin' : ''
              }`}
            />
            {savingSection === 'init-schema' ? '생성 중...' : '스키마 생성 실행'}
          </button>
        </div>
        <p className='text-sm text-muted-foreground'>
          새 DB(예: modol_dev)에 전체 테이블을 한 번에 생성합니다. 이미 존재하는 테이블은 건드리지 않으며, 없는 테이블만 생성합니다.
        </p>
        {initSchemaResult && (
          <div className='mt-3 space-y-1 text-xs text-muted-foreground'>
            <div>{initSchemaResult.message}</div>
            {initSchemaResult.created?.length > 0 && (
              <div className='text-primary'>
                생성됨: {initSchemaResult.created.join(', ')}
              </div>
            )}
            {initSchemaResult.skipped?.length > 0 && (
              <div className='text-muted-foreground'>
                이미 존재: {initSchemaResult.skipped.join(', ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DB 초기화 */}
      <div className='bg-card border border-border rounded-xl shadow-sm p-6 border border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-900/10'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <AlertTriangle className='h-5 w-5 text-red-600' />
            <h2 className='text-lg font-semibold text-red-900 dark:text-red-200'>
              DB 초기화 (위험)
            </h2>
          </div>
          <button
            onClick={resetDatabase}
            disabled={savingSection === 'db-reset' || loading}
            className='inline-flex items-center justify-center rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 text-sm px-3 py-1.5'
          >
            <Trash2 className='h-3.5 w-3.5' />
            {savingSection === 'db-reset' ? '처리 중...' : '초기화 실행'}
          </button>
        </div>

        <p className='text-sm text-red-700 dark:text-red-300'>
          실수 방지를 위해 반드시 확인 모달이 뜨며, 확인 문구(RESET)를 입력해야 실행됩니다.
        </p>

        <div className='mt-4 space-y-4'>
          <div className='flex flex-wrap items-center gap-4'>
            <label className='inline-flex items-center gap-2 text-sm text-foreground'>
              <input
                type='radio'
                name='db-reset-type'
                value='partial'
                checked={dbResetType === 'partial'}
                onChange={() => setDbResetType('partial')}
                className='accent-red-600'
                disabled={loading}
              />
              스키마별 초기화
            </label>
            <label className='inline-flex items-center gap-2 text-sm text-foreground'>
              <input
                type='radio'
                name='db-reset-type'
                value='all'
                checked={dbResetType === 'all'}
                onChange={() => setDbResetType('all')}
                className='accent-red-600'
                disabled={loading}
              />
              전체 초기화 (users/settings 등 핵심 테이블 보존)
            </label>
          </div>

          {dbResetType === 'partial' && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
              {dbResetTableOptions.map((table) => (
                <label
                  key={table.key}
                  className='flex items-start gap-2 text-sm text-foreground bg-muted/70 border border-destructive/30 rounded-md px-3 py-2'
                >
                  <input
                    type='checkbox'
                    checked={dbResetTables.has(table.key)}
                    onChange={() => toggleDbResetTable(table.key)}
                    className='accent-red-600 mt-1'
                    disabled={loading}
                  />
                  <div>
                    <div className='font-medium'>{table.label}</div>
                    <div className='text-xs text-muted-foreground'>
                      {table.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div>
            <label className='block text-sm font-medium text-foreground mb-2'>
              확인 문구 입력 (RESET)
            </label>
            <input
              type='text'
              value={dbResetConfirmText}
              onChange={(e) => setDbResetConfirmText(e.target.value)}
              className='w-full px-3 py-2 border border-red-200 dark:border-red-800 rounded-md bg-background text-foreground'
              placeholder='RESET'
              disabled={loading}
            />
          </div>

          {dbResetResult?.deletedTables?.length > 0 && (
            <div className='text-xs text-foreground'>
              마지막 처리: {dbResetResult.deletedTables.join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className='bg-card border border-border rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-3'>
            <Globe className='h-5 w-5 text-muted-foreground' />
            <h2 className='text-lg font-semibold text-foreground'>
              DB 스키마 보기
            </h2>
          </div>
          <Link
            href='/admin/db-schema'
            className='inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm px-3 py-1.5'
          >
            이동
          </Link>
        </div>
        <p className='text-sm text-muted-foreground'>
          현재 데이터베이스 테이블/컬럼 구조를 확인합니다.
        </p>
      </div>

    </div>
  );
}
