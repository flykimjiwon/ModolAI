'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from '@/hooks/useTranslation';
import {
  ArrowCircleRightIcon as PhArrowCircleRight,
  ArrowCircleLeftIcon as PhArrowCircleLeft,
  ChatTextIcon as PhChatText,
} from '@phosphor-icons/react/ssr';

const ArrowRightCircle = (props) => <PhArrowCircleRight weight="light" {...props} />;
const ArrowLeftCircle = (props) => <PhArrowCircleLeft weight="light" {...props} />;
const MessageSquareIcon = (props) => <PhChatText weight="light" {...props} />;

const NODES = [
  {
    nodeType: 'input',
    labelKey: 'workflow.node_input_label',
    icon: ArrowRightCircle,
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    descKey: 'workflow.node_input_desc',
  },
  {
    nodeType: 'llm-chat',
    labelKey: 'workflow.node_llm_label',
    icon: MessageSquareIcon,
    iconBg: 'bg-purple-100 dark:bg-purple-900/40',
    iconColor: 'text-purple-600 dark:text-purple-400',
    descKey: 'workflow.node_llm_desc',
  },
  {
    nodeType: 'output',
    labelKey: 'workflow.node_output_label',
    icon: ArrowLeftCircle,
    iconBg: 'bg-green-100 dark:bg-green-900/40',
    iconColor: 'text-green-600 dark:text-green-400',
    descKey: 'workflow.node_output_desc',
  },
];

function DraggablePaletteItem({ nodeType, labelKey, icon: Icon, iconBg, iconColor, descKey }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${nodeType}`,
    data: { type: 'palette-node', nodeType },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-3 rounded-lg border border-border bg-background hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
      {...attributes}
      {...listeners}
    >
      <div className={`p-2 rounded-lg ${iconBg} flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">
          {t(labelKey)}
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{t(descKey)}</div>
      </div>
    </div>
  );
}

export default function NodePalette() {
  const { t } = useTranslation();
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">{t('workflow.palette_title')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('workflow.palette_hint')}</p>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {NODES.map((node) => (
          <DraggablePaletteItem key={node.nodeType} {...node} />
        ))}
      </div>

      {/* Usage guide */}
      <div className="px-3 py-3 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">{t('workflow.usage_title')}</p>
        <ol className="text-xs text-muted-foreground space-y-1">
          <li>{t('workflow.usage_step1')}</li>
          <li>{t('workflow.usage_step2')}</li>
          <li>{t('workflow.usage_step3')}</li>
        </ol>
      </div>
    </div>
  );
}
