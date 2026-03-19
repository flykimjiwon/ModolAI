'use client';
import { memo, useRef, useState, useEffect, useCallback } from 'react';
import { LucideImage, Send } from '@/components/icons';
import { PaintBrush, UserGear } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import ModelSelector from './ModelSelector';
import { useAlert } from '@/contexts/AlertContext';
import { useTranslation } from '@/hooks/useTranslation';

let _imgIdCounter = 0;

const ChatInput = memo(function ChatInput({
  input,
  setInput,
  sendMessage,
  loading,
  modelsLoading,
  handleKeyDown,
  selectedModel,
  setSelectedModel,
  modelOptions,
  modelConfig,
  inputRef,
  currentRoom,
  showFloatingTooltip,
  tooltipMessage,
  onTooltipDismiss,
  sessionTooltipDismissed,
  selectedImages,
  setSelectedImages,
  maxImagesPerMessage = 5,
  userDefaultModelId,
  onSetUserDefault,
  drawEnabled = false,
  drawMode = false,
  onDrawModeToggle,
  customInstructionActive = false,
  onCustomInstructionClick,
}) {
  const { alert } = useAlert();
  const { t } = useTranslation();
  const imageInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const isEditableTarget = (target) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName?.toLowerCase();
    return tag === 'textarea' || tag === 'input';
  };

  const resizeTextarea = useCallback(() => {
    const el = inputRef?.current;
    if (!el) return;
    el.style.height = 'auto';
    const styles = window.getComputedStyle(el);
    const lineHeight = parseInt(styles.lineHeight, 10) || 20;
    const paddingTop = parseInt(styles.paddingTop, 10) || 0;
    const paddingBottom = parseInt(styles.paddingBottom, 10) || 0;
    const maxHeight = lineHeight * 16 + paddingTop + paddingBottom;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputRef]);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const maxImages = Number.isFinite(maxImagesPerMessage)
    ? maxImagesPerMessage
    : 5;
  const currentImageCount = selectedImages?.length || 0;
  const hasImages = currentImageCount > 0;

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const generateImageId = () => {
    if (typeof crypto !== 'undefined') {
      if (crypto.randomUUID) return crypto.randomUUID();
      if (crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      }
    }
    return `${Date.now()}-${++_imgIdCounter}`;
  };

  const addImagesFromFiles = async (files) => {
    if (!files || files.length === 0) return;

    const availableSlots = Math.max(0, maxImages - currentImageCount);
    if (availableSlots <= 0) {
      alert(
        t('chat.image_max_count', { max: maxImages }),
        'warning',
        t('chat.upload_limit')
      );
      return;
    }

    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ]);
    const maxSizeBytes = 10 * 1024 * 1024;
    const errors = [];

    const validFiles = files.filter((file) => {
      if (!allowedTypes.has(file.type)) {
        errors.push(t('chat.image_unsupported', { name: file.name }));
        return false;
      }
      if (file.size > maxSizeBytes) {
        errors.push(t('chat.image_max_size', { name: file.name }));
        return false;
      }
      return true;
    });

    if (validFiles.length > availableSlots) {
      errors.push(t('chat.image_max_count_short', { max: maxImages }));
    }

    const filesToRead = validFiles.slice(0, availableSlots);
    try {
      const dataUrls = await Promise.all(
        filesToRead.map((file) => readFileAsDataUrl(file))
      );
      const nextImages = filesToRead.map((file, index) => ({
        id: generateImageId(),
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl: dataUrls[index],
      }));
      console.log('[ChatInput] 선택된 이미지:', {
        count: nextImages.length,
        images: nextImages.map((image, index) => ({
          index: index + 1,
          name: image.name,
          size: image.size,
          type: image.type,
        })),
      });
      setSelectedImages((prev) => [...(prev || []), ...nextImages]);
    } catch (error) {
      console.error('이미지 읽기 실패:', error);
      alert(
        t('chat.image_read_error'),
        'error',
        t('chat.upload_failed')
      );
    } finally {
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }

    if (errors.length > 0) {
      alert(errors.join('\n'), 'warning', t('chat.upload_limit'));
    }
  };

  const handleImageChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    await addImagesFromFiles(files);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handlePaste = async (event) => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItems = items.filter((item) => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    event.preventDefault();
    const files = imageItems
      .map((item) => item.getAsFile())
      .filter(Boolean);
    await addImagesFromFiles(files);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer?.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    await addImagesFromFiles(imageFiles);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsDragging(false);
  };

  const handleRemoveImage = (imageId) => {
    setSelectedImages((prev) =>
      (prev || []).filter((image) => image.id !== imageId)
    );
  };

  useEffect(() => {
    const handleWindowDragOver = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
    };

    const handleWindowDragEnter = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dragCounterRef.current += 1;
      setIsGlobalDragging(true);
    };

    const handleWindowDragLeave = (event) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
      if (dragCounterRef.current === 0) {
        setIsGlobalDragging(false);
      }
    };

    const handleWindowDrop = async (event) => {
      if (!event.dataTransfer?.files?.length) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dragCounterRef.current = 0;
      setIsGlobalDragging(false);
      const files = Array.from(event.dataTransfer.files);
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      await addImagesFromFiles(imageFiles);
    };

    const handleWindowPaste = async (event) => {
      if (isEditableTarget(event.target)) return;
      const items = Array.from(event.clipboardData?.items || []);
      const imageItems = items.filter((item) => item.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      event.preventDefault();
      const files = imageItems
        .map((item) => item.getAsFile())
        .filter(Boolean);
      await addImagesFromFiles(files);
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [addImagesFromFiles]);

  return (
    <footer className='w-full max-w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto p-4 bg-background border-t border-border'>
      {isGlobalDragging && (
        <div className='fixed inset-0 z-50 flex items-center justify-center pointer-events-none'>
          <div className='absolute inset-0 bg-primary/10' />
          <div className='relative px-4 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground shadow-lg'>
            {t('chat.image_drop_hint')}
          </div>
        </div>
      )}
      <div className='relative'>
        {currentImageCount > 0 && (
          <div className='mb-3 flex flex-wrap gap-2'>
            {selectedImages.map((image) => (
              <div
                key={image.id}
                className='relative w-16 h-16 rounded-md overflow-hidden border border-border bg-muted'
              >
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  className='w-full h-full object-cover'
                />
                <button
                  type='button'
                  onClick={() => handleRemoveImage(image.id)}
                  className='absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/80'
                  aria-label={t('chat.image_remove')}
                  title={t('chat.image_remove')}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          id='chat-input'
          data-testid='chat-input'
          ref={inputRef}
          rows={3}
          className={`w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-colors duration-200 w-full resize-none min-h-[48px] max-h-96 pr-48 ${
            isDragging
              ? 'border-ring ring-2 ring-ring/30 bg-accent'
              : ''
          }`}
          placeholder={
            modelsLoading
              ? t('chat.model_loading')
              : t('chat.input_placeholder')
          }
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea();
          }}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onKeyDown={handleKeyDown}
          disabled={loading || !currentRoom || modelsLoading}
        />
        {isDragging && (
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <div className='px-3 py-1.5 rounded-full text-xs font-medium bg-primary text-primary-foreground shadow'>
              {t('chat.image_drop_hint')}
            </div>
          </div>
        )}

        <div className='absolute top-2 right-2 flex items-center gap-2'>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            className='text-muted-foreground hover:text-foreground cursor-pointer'
            aria-label={t('chat.image_upload')}
            title={t('chat.image_upload_count', { current: currentImageCount, max: maxImages })}
            onClick={() => imageInputRef.current?.click()}
          >
            <LucideImage className='h-4 w-4' />
            {currentImageCount > 0 && (
              <span className='ml-1 text-[10px] text-muted-foreground'>
                {currentImageCount}/{maxImages}
              </span>
            )}
          </Button>
          {onCustomInstructionClick && (
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={`relative cursor-pointer ${
                customInstructionActive
                  ? 'text-primary hover:text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label='Custom Instruction'
              title={
                customInstructionActive
                  ? 'Custom Instruction enabled'
                  : 'Custom Instruction'
              }
              onClick={onCustomInstructionClick}
            >
              <UserGear className='h-4 w-4' weight='duotone' />
              {customInstructionActive && (
                <span className='absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary' />
              )}
            </Button>
          )}
          {drawEnabled && onDrawModeToggle && (
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              className={`relative cursor-pointer ${
                drawMode
                  ? 'text-emerald-500 hover:text-emerald-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label='Draw mode'
              title={drawMode ? 'Draw mode enabled' : 'Draw mode'}
              onClick={onDrawModeToggle}
            >
              <PaintBrush className='h-4 w-4' weight={drawMode ? 'duotone' : 'regular'} />
              {drawMode && (
                <span className='absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500' />
              )}
            </Button>
          )}
          {/* 문서 업로드는 추후 기능 추가를 위해 비활성화 */}
          <input
            ref={imageInputRef}
            type='file'
            accept='.jpg,.jpeg,.png,.gif,.webp'
            className='hidden'
            onChange={handleImageChange}
          />
          {/* 문서 업로드 input은 추후 기능 추가 시 사용 */}
          {modelConfig && modelOptions.length > 0 && (
            <ModelSelector
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              modelConfig={modelConfig}
              disabled={loading || !currentRoom || modelsLoading}
              showFloatingTooltip={showFloatingTooltip}
              tooltipMessage={tooltipMessage}
              onTooltipDismiss={onTooltipDismiss}
              sessionTooltipDismissed={sessionTooltipDismissed}
              showCategorySections={false}
              userDefaultModelId={userDefaultModelId}
              onSetUserDefault={onSetUserDefault}
            />
          )}

          <Button
            id='chat-send-button'
            data-testid='chat-send-button'
            variant={
              loading || !currentRoom
                ? 'secondary'
                : input.trim().length > 0 || hasImages
                ? 'default'
                : 'secondary'
            }
            size='icon-sm'
            className='min-w-[36px]'
            onClick={(e) => {
              e.preventDefault();
              if ((input.trim() || hasImages) && !loading) {
                sendMessage(input);
              }
            }}
            disabled={
              loading ||
              !currentRoom ||
              modelsLoading ||
              (input.trim().length === 0 && !hasImages)
            }
            aria-label={t('chat.send')}
          >
            <Send className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </footer>
  );
});

export default ChatInput;
