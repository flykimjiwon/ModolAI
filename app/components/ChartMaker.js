'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Check,
  Sparkles,
  Copy,
  RotateCcw,
  Palette,
} from '@/components/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useAgentHistory } from '@/hooks/useAgentHistory';
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  PieChart, Pie,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter,
  RadialBarChart, RadialBar,
  ComposedChart,
  Treemap,
  FunnelChart, Funnel, LabelList,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// COLOR THEMES (5 themes)
// ─────────────────────────────────────────────────────────────────────────────
const COLOR_THEMES = {
  ocean: {
    id: 'ocean', label: '오션 블루', caption: '차분하고 전문적인',
    colors: ['#0ea5e9', '#06b6d4', '#0284c7', '#0369a1', '#075985', '#164e63', '#155e75', '#0c4a6e'],
    bg: 'bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/30',
    accent: 'text-sky-600 dark:text-sky-400',
  },
  sunset: {
    id: 'sunset', label: '선셋 웜', caption: '따뜻하고 활기찬',
    colors: ['#f97316', '#ef4444', '#eab308', '#f59e0b', '#dc2626', '#ea580c', '#d97706', '#b91c1c'],
    bg: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30',
    accent: 'text-orange-600 dark:text-orange-400',
  },
  forest: {
    id: 'forest', label: '포레스트 그린', caption: '자연스럽고 안정적인',
    colors: ['#22c55e', '#10b981', '#059669', '#047857', '#16a34a', '#15803d', '#0d9488', '#0f766e'],
    bg: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30',
    accent: 'text-green-600 dark:text-green-400',
  },
  royal: {
    id: 'royal', label: '로열 퍼플', caption: '세련되고 고급스러운',
    colors: ['#8b5cf6', '#a855f7', '#7c3aed', '#6d28d9', '#9333ea', '#6366f1', '#4f46e5', '#4338ca'],
    bg: 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30',
    accent: 'text-violet-600 dark:text-violet-400',
  },
  mono: {
    id: 'mono', label: '모노톤', caption: '깔끔하고 명확한',
    colors: ['#374151', '#6b7280', '#4b5563', '#1f2937', '#9ca3af', '#111827', '#d1d5db', '#525252'],
    bg: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/30 dark:to-slate-950/30',
    accent: 'text-gray-600 dark:text-gray-400',
  },
  mix1: {
    id: 'mix1', label: '레인보우', caption: '다채롭고 구분이 명확한',
    colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'],
    bg: 'bg-gradient-to-br from-pink-50 to-blue-50 dark:from-pink-950/30 dark:to-blue-950/30',
    accent: 'text-pink-600 dark:text-pink-400',
  },
  mix2: {
    id: 'mix2', label: '파스텔', caption: '부드럽고 감성적인',
    colors: ['#fca5a5', '#fdba74', '#fde047', '#86efac', '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4'],
    bg: 'bg-gradient-to-br from-rose-50 to-indigo-50 dark:from-rose-950/30 dark:to-indigo-950/30',
    accent: 'text-rose-500 dark:text-rose-400',
  },
  mix3: {
    id: 'mix3', label: '네온', caption: '강렬하고 임팩트 있는',
    colors: ['#ff0080', '#ff4d00', '#ffcc00', '#00ff88', '#00ccff', '#4444ff', '#aa00ff', '#ff0044'],
    bg: 'bg-gradient-to-br from-fuchsia-50 to-cyan-50 dark:from-fuchsia-950/30 dark:to-cyan-950/30',
    accent: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CHART TYPES (10 types)
// ─────────────────────────────────────────────────────────────────────────────
const CHART_TYPES = [
  { id: 'bar', label: '막대 차트', icon: '📊', desc: '카테고리별 값 비교' },
  { id: 'line', label: '꺾은선 차트', icon: '📈', desc: '시간에 따른 추이' },
  { id: 'area', label: '영역 차트', icon: '📉', desc: '누적·변화량 시각화' },
  { id: 'pie', label: '원형 차트', icon: '🥧', desc: '비율·구성 표현' },
  { id: 'radar', label: '레이더 차트', icon: '🕸️', desc: '다차원 능력치 비교' },
  { id: 'scatter', label: '산점도', icon: '⚬', desc: '두 변수 간 상관관계' },
  { id: 'radialBar', label: '방사형 막대', icon: '🎯', desc: '진행률·달성도' },
  { id: 'composed', label: '복합 차트', icon: '📋', desc: '막대+꺾은선 조합' },
  { id: 'treemap', label: '트리맵', icon: '🗂️', desc: '계층 구조·비중 표현' },
  { id: 'funnel', label: '깔때기 차트', icon: '🔻', desc: '단계별 전환율' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA for previews
// ─────────────────────────────────────────────────────────────────────────────
const SAMPLE_DATA = {
  bar: [
    { name: '1분기', value: 400, sub: 240 },
    { name: '2분기', value: 300, sub: 139 },
    { name: '3분기', value: 520, sub: 380 },
    { name: '4분기', value: 450, sub: 280 },
  ],
  line: [
    { name: '1월', value: 65, sub: 40 },
    { name: '2월', value: 59, sub: 48 },
    { name: '3월', value: 80, sub: 60 },
    { name: '4월', value: 81, sub: 55 },
    { name: '5월', value: 56, sub: 42 },
    { name: '6월', value: 95, sub: 70 },
  ],
  area: [
    { name: '월', value: 40, sub: 24 },
    { name: '화', value: 30, sub: 13 },
    { name: '수', value: 45, sub: 28 },
    { name: '목', value: 50, sub: 39 },
    { name: '금', value: 49, sub: 38 },
  ],
  pie: [
    { name: '마케팅', value: 35 },
    { name: '개발', value: 30 },
    { name: '영업', value: 20 },
    { name: '인사', value: 15 },
  ],
  radar: [
    { name: '속도', value: 85, sub: 65 },
    { name: '안정성', value: 90, sub: 70 },
    { name: '확장성', value: 70, sub: 80 },
    { name: '보안', value: 95, sub: 75 },
    { name: '편의성', value: 75, sub: 85 },
  ],
  scatter: [
    { x: 10, y: 30, z: 200 }, { x: 30, y: 70, z: 100 },
    { x: 45, y: 50, z: 300 }, { x: 60, y: 80, z: 250 },
    { x: 75, y: 40, z: 150 }, { x: 90, y: 90, z: 350 },
  ],
  radialBar: [
    { name: '목표A', value: 85 },
    { name: '목표B', value: 72 },
    { name: '목표C', value: 60 },
    { name: '목표D', value: 45 },
  ],
  composed: [
    { name: '1월', bar: 40, line: 24 },
    { name: '2월', bar: 30, line: 18 },
    { name: '3월', bar: 52, line: 38 },
    { name: '4월', bar: 45, line: 33 },
    { name: '5월', bar: 60, line: 42 },
  ],
  treemap: [
    { name: 'React', size: 400 }, { name: 'Vue', size: 300 },
    { name: 'Angular', size: 200 }, { name: 'Svelte', size: 150 },
    { name: 'Next.js', size: 250 }, { name: 'Nuxt', size: 100 },
  ],
  funnel: [
    { name: '방문', value: 1000 },
    { name: '가입', value: 600 },
    { name: '활성화', value: 400 },
    { name: '구매', value: 200 },
    { name: '재구매', value: 80 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CHART RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function RenderChart({ type, data, colors, height = 320, t }) {
  const c = colors || COLOR_THEMES.ocean.colors;

  const commonCartesian = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 12 }} />
      <Tooltip
        contentStyle={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '13px',
        }}
      />
      <Legend wrapperStyle={{ fontSize: '12px' }} />
    </>
  );

  const valueKeys = data.length > 0
    ? Object.keys(data[0]).filter(k => k !== 'name' && k !== 'fill' && typeof data[0][k] === 'number')
    : ['value'];

  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            {commonCartesian}
            {valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={c[i % c.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            {commonCartesian}
            {valueKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={c[i % c.length]} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            {commonCartesian}
            {valueKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={c[i % c.length]} fill={c[i % c.length]} fillOpacity={0.3} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((_, i) => (
                <Cell key={i} fill={c[i % c.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'radar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#d1d5db" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 12 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            {valueKeys.map((key, i) => (
              <Radar key={key} dataKey={key} stroke={c[i % c.length]} fill={c[i % c.length]} fillOpacity={0.25} />
            ))}
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </RadarChart>
        </ResponsiveContainer>
      );

    case 'scatter':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="x" type="number" tick={{ fontSize: 12 }} />
            <YAxis dataKey="y" type="number" tick={{ fontSize: 12 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={c[0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={c[i % c.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      );

    case 'radialBar': {
      const rbData = data.map((d, i) => ({ ...d, fill: c[i % c.length] }));
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RadialBarChart innerRadius="20%" outerRadius="90%" data={rbData} startAngle={180} endAngle={0}>
            <RadialBar background dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
          </RadialBarChart>
        </ResponsiveContainer>
      );
    }

    case 'composed':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            {commonCartesian}
            <Bar dataKey={valueKeys[0] || 'bar'} fill={c[0]} radius={[4, 4, 0, 0]} />
            {valueKeys.length > 1 && (
              <Line type="monotone" dataKey={valueKeys[1]} stroke={c[1]} strokeWidth={2} dot={{ r: 4 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      );

    case 'treemap':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <Treemap
            data={data}
            dataKey="size"
            nameKey="name"
            aspectRatio={4 / 3}
            stroke="#fff"
            content={({ x, y, width: w, height: h, name, index }) => (
              <g>
                <rect x={x} y={y} width={w} height={h} fill={c[index % c.length]} stroke="#fff" strokeWidth={2} rx={4} />
                {w > 50 && h > 25 && (
                  <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={12} fontWeight={600}>
                    {name}
                  </text>
                )}
              </g>
            )}
          />
        </ResponsiveContainer>
      );

    case 'funnel':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={data} isAnimationActive>
              {data.map((_, i) => (
                <Cell key={i} fill={c[i % c.length]} />
              ))}
              <LabelList position="center" fill="#fff" stroke="none" fontSize={12} dataKey="name" />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      );

    default:
      return <p className="text-muted-foreground text-center py-10">{t('chart_maker.unsupported_chart_type', 'Unsupported chart type.')}</p>;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ChartMaker({ sidebarMenu, onRequestSidebarMenuChange }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [selectedChart, setSelectedChart] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('ocean');
  const [rawData, setRawData] = useState('');
  const [chartData, setChartData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [chartTitle, setChartTitle] = useState('');
  const chartRef = useRef(null);
  const { history: dbHistory, saveEntry: dbSaveEntry, deleteEntry: dbDeleteEntry } = useAgentHistory('10', { maxItems: 20 });

  const theme = COLOR_THEMES[selectedTheme];

  const handleGenerate = useCallback(async () => {
    if (!rawData.trim() || !selectedChart) return;

    setGenerating(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/webapp-chart-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawData, chartType: selectedChart }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || t('chart_maker.generate_failed', 'Failed to generate chart.'));
        return;
      }

      setChartData(result.data);
      setStep(3);

      // DB에 히스토리 저장
      const entryTitle = chartTitle || CHART_TYPES.find(c => c.id === selectedChart)?.label || t('chart_maker.default_chart_title', 'Chart');
      const entryId = `chart-${Date.now()}`;
      dbSaveEntry(entryId, {
        title: entryTitle,
        inputData: { rawData, chartType: selectedChart, theme: selectedTheme, chartTitle },
        outputData: result.data,
        metadata: { chartType: selectedChart, theme: selectedTheme },
      });
    } catch {
      setError(t('chart_maker.network_error', 'A network error occurred.'));
    } finally {
      setGenerating(false);
    }
  }, [rawData, selectedChart, selectedTheme, chartTitle, t, dbSaveEntry]);

  const [showThemePicker, setShowThemePicker] = useState(false);
  const [customColors, setCustomColors] = useState(['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#6b7280']);

  const activeColors = selectedTheme === 'custom' ? customColors : theme.colors;

  const handleCopyData = useCallback(() => {
    if (chartData) {
      navigator.clipboard.writeText(JSON.stringify(chartData, null, 2));
    }
  }, [chartData]);

  const handleReset = () => {
    setStep(1);
    setSelectedChart(null);
    setRawData('');
    setChartData(null);
    setError('');
    setChartTitle('');
  };

  const loadHistory = (item) => {
    const input = typeof item.input_data === 'string' ? JSON.parse(item.input_data) : item.input_data;
    const output = typeof item.output_data === 'string' ? JSON.parse(item.output_data) : item.output_data;
    setSelectedChart(input?.chartType || 'bar');
    setSelectedTheme(input?.theme || 'ocean');
    setChartTitle(input?.chartTitle || item.title || '');
    setRawData(input?.rawData || '');
    setChartData(Array.isArray(output) ? output : []);
    setStep(3);
    if (onRequestSidebarMenuChange) onRequestSidebarMenuChange('chart-compose');
  };

  // ─── History view ──────────────────────────────────────────────────────
  if (sidebarMenu === 'chart-history') {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">{t('chart_maker.history_title', 'Generation History')}</h2>
        {dbHistory.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('chart_maker.history_empty', 'No charts generated yet.')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dbHistory.map(item => {
              const meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
              const chartType = meta?.chartType || 'bar';
              const themeName = meta?.theme || 'ocean';
              return (
                <div
                  key={item.id}
                  className="text-left p-4 bg-background rounded-xl border border-border hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors group"
                >
                  <button onClick={() => loadHistory(item)} className="w-full text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{CHART_TYPES.find(c => c.id === chartType)?.icon}</span>
                      <span className="font-medium text-foreground text-sm">{item.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                        {COLOR_THEMES[themeName]?.label || themeName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at || item.updated_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => dbDeleteEntry(item.id)}
                    className="mt-2 text-[11px] text-red-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  >{t('chart_maker.delete', 'Delete')}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Step 1: Template Selection ────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          {/* Chart Type Selection */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-foreground mb-1">{t('chart_maker.step1_title', 'Step 1: Select Chart Type')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('chart_maker.step1_subtitle', 'Choose the chart type you want.')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setSelectedChart(ct.id)}
                  className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                    selectedChart === ct.id
                      ? 'border-cyan-500 bg-primary/10 shadow-md'
                      : 'border-border hover:border-cyan-300 dark:hover:border-cyan-700 bg-muted'
                  }`}
                >
                  {selectedChart === ct.id && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-cyan-600" />
                    </div>
                  )}
                  <div className="text-2xl mb-2">{ct.icon}</div>
                  <div className="font-medium text-sm text-foreground">{ct.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ct.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Color Theme Selection */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-foreground mb-1">{t('chart_maker.step2_title', 'Step 2: Select Color Theme')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('chart_maker.step2_subtitle', 'Choose a color theme to apply to the chart.')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {Object.values(COLOR_THEMES).map(th => (
                <button
                  key={th.id}
                  onClick={() => setSelectedTheme(th.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedTheme === th.id
                      ? 'border-cyan-500 shadow-md'
                      : 'border-border hover:border-cyan-300 dark:hover:border-cyan-700'
                  } ${th.bg}`}
                >
                  <div className="flex gap-1 mb-2">
                    {th.colors.slice(0, 5).map((color, i) => (
                      <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className={`font-medium text-sm ${th.accent}`}>{th.label}</div>
                  <div className="text-xs text-muted-foreground">{th.caption}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selectedChart && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-foreground mb-4">{t('chart_maker.preview_title', 'Preview')}</h2>
              <div className={`p-6 rounded-2xl border border-border ${theme.bg}`}>
                <RenderChart
                  type={selectedChart}
                  data={SAMPLE_DATA[selectedChart]}
                  colors={activeColors}
                  height={280}
                  t={t}
                />
              </div>
            </div>
          )}

          {/* Next button */}
          <div className="flex justify-end">
            <button
              onClick={() => selectedChart && setStep(2)}
              disabled={!selectedChart}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                selectedChart
                  ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {t('chart_maker.next_data_input', 'Next: Enter Data')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2: Data Input ────────────────────────────────────────────────
  if (step === 2) {
    const selectedChartInfo = CHART_TYPES.find(c => c.id === selectedChart);

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('chart_maker.back_to_chart_select', 'Back to chart selection')}
          </button>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{selectedChartInfo?.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {selectedChartInfo?.label} - {t('chart_maker.data_input_heading', 'Data Input')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('chart_maker.data_input_description', 'Enter the data to display on the chart. AI will process it automatically.')}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('chart_maker.chart_title_label', 'Chart Title (optional)')}
            </label>
            <input
              type="text"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
              placeholder={t('chart_maker.chart_title_placeholder', 'e.g. 2024 Quarterly Revenue')}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('chart_maker.data_input_label', 'Data Input')}
            </label>
            <textarea
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              placeholder={t('chart_maker.data_input_placeholder', 'Enter data freely. Examples:\n\n• Table: "item, value" or "category | number"\n• Natural language: "Jan revenue 10M, Feb 12M, Mar 8M"\n• CSV: "name,score\\nAlice,85\\nBob,92\\nCarol,78"\n• Line-separated: "Marketing 35%\\nDev 30%\\nSales 20%\\nHR 15%"')}
              rows={10}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none font-mono text-sm"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {theme.colors.slice(0, 4).map((color, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{theme.label}</span>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !rawData.trim()}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                generating || !rawData.trim()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg hover:shadow-xl'
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('chart_maker.generating', 'AI is processing data...')}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t('chart_maker.generate_button', 'Generate Chart')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 3: Result ────────────────────────────────────────────────────
  if (step === 3 && chartData) {
    const selectedChartInfo = CHART_TYPES.find(c => c.id === selectedChart);

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedChartInfo?.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  {chartTitle || selectedChartInfo?.label}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                    {theme.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{chartData.length}{t('chart_maker.data_points_suffix', ' data points')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyData}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
                title={t('chart_maker.copy_json_title', 'Copy data JSON')}
              >
                <Copy className="h-4 w-4" />
                JSON
              </button>
              <button
                onClick={() => setShowThemePicker(!showThemePicker)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
                  showThemePicker
                    ? 'border-cyan-400 bg-primary/10 text-cyan-700 dark:text-cyan-300'
                    : 'border-border text-foreground hover:bg-accent'
                }`}
                title={t('chart_maker.change_color_title', 'Change color')}
              >
                <Palette className="h-4 w-4" />
                {t('chart_maker.color_button', 'Color')}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                {t('chart_maker.new_chart_button', 'New Chart')}
              </button>
            </div>
          </div>

          {/* Color picker panel */}
          {showThemePicker && (
            <div className="mb-4 p-4 rounded-xl border border-border bg-muted">
              <p className="text-xs font-medium text-muted-foreground mb-3">{t('chart_maker.theme_change_label', 'Change theme color (applied immediately)')}</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.values(COLOR_THEMES).map(th => (
                  <button
                    key={th.id}
                    onClick={() => setSelectedTheme(th.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                      selectedTheme === th.id
                        ? 'border-cyan-400 bg-primary/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="flex gap-0.5">
                      {th.colors.slice(0, 4).map((c, i) => (
                        <span key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    {th.label}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedTheme('custom')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${
                    selectedTheme === 'custom'
                      ? 'border-cyan-400 bg-primary/10 text-cyan-700 dark:text-cyan-300'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  <Palette className="w-3 h-3" />
                  {t('chart_maker.custom_theme', 'Custom')}
                </button>
              </div>
              {selectedTheme === 'custom' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] text-muted-foreground">{t('chart_maker.custom_color_hint', 'Click a color to change it:')}</span>
                  {customColors.map((color, i) => (
                    <label key={i} className="relative cursor-pointer">
                      <span className="block w-7 h-7 rounded-lg border-2 border-border shadow-sm" style={{ backgroundColor: color }} />
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const next = [...customColors];
                          next[i] = e.target.value;
                          setCustomColors(next);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            ref={chartRef}
            className={`p-8 rounded-2xl border border-border ${selectedTheme === 'custom' ? 'bg-background' : theme.bg} mb-6`}
          >
            {chartTitle && (
              <h3 className="text-center text-base font-semibold text-foreground mb-4">
                {chartTitle}
              </h3>
            )}
            <RenderChart
              type={selectedChart}
              data={chartData}
              colors={activeColors}
              height={400}
              t={t}
            />
          </div>

          <div className="bg-background rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted border-b border-border">
              <h3 className="text-sm font-medium text-foreground">{t('chart_maker.data_table_heading', 'Data Table')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {chartData.length > 0 &&
                      Object.keys(chartData[0]).map(key => (
                        <th key={key} className="px-4 py-2 text-left font-medium text-muted-foreground">{key}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-4 py-2 text-foreground">
                          {typeof val === 'number' ? val.toLocaleString() : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <BarChart3 className="h-12 w-12 text-cyan-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">{t('chart_maker.fallback_title', 'Chart Maker')}</h2>
        <p className="text-muted-foreground mb-4">
          {t('chart_maker.fallback_description', 'Select a chart type and color, then enter your data and AI will visualize it automatically.')}
        </p>
        <button
          onClick={() => { setStep(1); if (onRequestSidebarMenuChange) onRequestSidebarMenuChange('chart-compose'); }}
          className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-colors"
        >
          {t('chart_maker.get_started_button', 'Get Started')}
        </button>
      </div>
    </div>
  );
}
