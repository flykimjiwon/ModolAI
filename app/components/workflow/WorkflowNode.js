'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MessageSquare } from '@/components/icons';
import {
  ArrowCircleRightIcon as PhArrowCircleRight,
  ArrowCircleLeftIcon as PhArrowCircleLeft,
} from '@phosphor-icons/react/ssr';

const ArrowRightCircle = (props) => <PhArrowCircleRight weight="light" {...props} />;
const ArrowLeftCircle = (props) => <PhArrowCircleLeft weight="light" {...props} />;

// Node type config (3 types)
const NODE_TYPE_CONFIG = {
  input: {
    borderColor: 'border-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    icon: ArrowRightCircle,
    label: '입력',
    hasPorts: { left: 0, right: 1 },
  },
  output: {
    borderColor: 'border-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
    icon: ArrowLeftCircle,
    label: '출력',
    hasPorts: { left: 1, right: 0 },
  },
  'llm-chat': {
    borderColor: 'border-purple-400',
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    icon: MessageSquare,
    label: 'LLM 채팅',
    hasPorts: { left: 1, right: 1 },
  },
};

// Port component — 16px circle, scales on hover
function Port({ side, nodeId, onPortMouseDown, onPortMouseUp }) {
  const isLeft = side === 'left';

  return (
    <div
      className={`w-4 h-4 rounded-full border-2 cursor-crosshair transition-all duration-150
        hover:scale-125 hover:shadow-lg z-10
        ${isLeft
          ? 'border-blue-400 bg-blue-100 hover:bg-blue-300 dark:bg-blue-900 dark:hover:bg-blue-700'
          : 'border-green-400 bg-green-100 hover:bg-green-300 dark:bg-green-900 dark:hover:bg-green-700'
        }`}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (!isLeft) onPortMouseDown?.(e, nodeId, side);
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        if (isLeft) onPortMouseUp?.(e, nodeId, side);
      }}
      title={isLeft ? '입력 포트 — 여기로 연결 받기' : '출력 포트 — 클릭해서 연결 시작'}
    />
  );
}

// Draggable workflow node
export default function WorkflowNode({
  node,
  isSelected,
  isConnectSource,
  onSelect,
  onPortMouseDown,
  onPortMouseUp,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: node.id,
    data: { type: 'canvas-node', node },
  });

  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG['llm-chat'];
  const Icon = config.icon;

  const style = {
    position: 'absolute',
    left: node.x,
    top: node.y,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isSelected ? 20 : isDragging ? 30 : 10,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  // Summary info shown inside the node
  const summaryText = (() => {
    if (node.type === 'input') {
      return node.data?.variableName ? `변수: ${node.data.variableName}` : null;
    }
    if (node.type === 'llm-chat') {
      if (node.data?.model) return node.data.model;
      if (node.data?.prompt) return node.data.prompt.slice(0, 40);
      return null;
    }
    if (node.type === 'output') {
      return node.data?.variableName ? `변수: ${node.data.variableName}` : null;
    }
    return null;
  })();

  const hasLeftPort = config.hasPorts.left > 0;
  const hasRightPort = config.hasPorts.right > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-56 min-h-20 rounded-lg border-2 bg-background shadow-sm select-none
        ${config.borderColor}
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${isConnectSource ? 'ring-2 ring-blue-500 ring-offset-2 shadow-blue-200 dark:shadow-blue-900' : ''}
      `}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(node.id);
      }}
      {...attributes}
      {...listeners}
    >
      {/* Input port (left center) */}
      {hasLeftPort && (
        <div className="absolute top-1/2 -translate-y-1/2 -left-2.5 z-10">
          <Port
            side="left"
            nodeId={node.id}
            onPortMouseDown={onPortMouseDown}
            onPortMouseUp={onPortMouseUp}
          />
        </div>
      )}

      {/* Node content */}
      <div className="p-3">
        {/* Top: icon + type label + grip */}
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded ${config.iconBg}`}>
            <Icon className={`w-4 h-4 ${config.iconColor}`} />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {config.label}
          </span>
          <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 ml-auto" />
        </div>

        {/* Node name */}
        <div className="text-sm font-semibold text-foreground truncate">
          {node.data?.label || node.label || '노드'}
        </div>

        {/* Summary info */}
        {summaryText && (
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {summaryText}
          </div>
        )}
      </div>

      {/* Output port (right center) */}
      {hasRightPort && (
        <div className="absolute top-1/2 -translate-y-1/2 -right-2.5 z-10">
          <Port
            side="right"
            nodeId={node.id}
            onPortMouseDown={onPortMouseDown}
            onPortMouseUp={onPortMouseUp}
          />
        </div>
      )}
    </div>
  );
}
