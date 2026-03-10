'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Table,
  Coins,
  CircleHelp,
} from 'lucide-react';

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
  '#EC4899',
  '#6366F1',
];

// 차트 타입 토글 컴포넌트
const ChartTypeToggle = ({ currentType, onTypeChange, availableTypes }) => {
  const typeIcons = {
    table: Table,
    bar: BarChart3,
    pie: PieChartIcon,
    line: TrendingUp,
  };

  const typeLabels = {
    table: '표',
    bar: '막대',
    pie: '원형',
    line: '선형',
  };

  return (
    <div className='flex items-center gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg'>
      {availableTypes.map((type) => {
        const Icon = typeIcons[type];
        return (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentType === type
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            title={typeLabels[type]}
          >
            <Icon className='h-3 w-3' />
            <span className='hidden sm:inline'>{typeLabels[type]}</span>
          </button>
        );
      })}
    </div>
  );
};

const TitleWithTooltip = ({ title, tooltip }) => {
  if (!tooltip) {
    return <h3 className='text-lg font-medium text-gray-900 dark:text-white'>{title}</h3>;
  }

  return (
    <span className='relative inline-flex items-center gap-1 group'>
      <h3 className='text-lg font-medium text-gray-900 dark:text-white'>{title}</h3>
      <CircleHelp className='h-4 w-4 text-gray-400 cursor-help' />
      <span className='pointer-events-none absolute left-0 bottom-full z-10 mb-2 w-72 rounded-md bg-gray-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100'>
        {tooltip}
      </span>
    </span>
  );
};

// 사용자별 사용량 차트
export const UserStatsChart = ({ data, title, tooltip }) => {
  const [chartType, setChartType] = useState('table');

  const chartData =
    data?.slice(0, 10).map((user, index) => ({
      name: user.name || user.email,
      count: user.messageCount,
      avgPerDay: user.avgPerDay,
      email: user.email,
      department: user.department,
      cell: user.cell,
    })) || [];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [value + '회', '메시지 수']}
                labelFormatter={(label) => `사용자: ${label}`}
              />
              <Bar dataKey='count' fill='#3B82F6' />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill='#8884d8'
                dataKey='count'
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value + '회', '메시지 수']} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [value + '회', '메시지 수']}
                labelFormatter={(label) => `사용자: ${label}`}
              />
              <Line
                type='monotone'
                dataKey='count'
                stroke='#3B82F6'
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default: // table
        return (
          <div className='space-y-4'>
            {data?.slice(0, 10).map((user, index) => (
              <div key={user._id} className='flex items-center justify-between'>
                <div className='flex items-center min-w-0 flex-1'>
                  <div className='flex-shrink-0 w-8'>
                    <span className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                      #{index + 1}
                    </span>
                  </div>
                  <div className='ml-3 min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                      {user.name || user.email}
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {user.department} • {user.cell}
                    </p>
                  </div>
                </div>
                <div className='flex items-center'>
                  <div className='text-right mr-4'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>
                      {user.messageCount}회
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {user.avgPerDay != null ? Number(user.avgPerDay).toFixed(1) : '0.0'}회/일
                    </p>
                  </div>
                  <div className='w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                    <div
                      className='bg-blue-600 h-2 rounded-full'
                      style={{
                        width: `${Math.min(
                          (user.messageCount / (data?.[0]?.messageCount || 1)) *
                            100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <TitleWithTooltip title={title} tooltip={tooltip} />
        <ChartTypeToggle
          currentType={chartType}
          onTypeChange={setChartType}
          availableTypes={['table', 'bar', 'pie', 'line']}
        />
      </div>
      {!data || data.length === 0 ? (
        <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-8'>
          데이터가 없습니다
        </p>
      ) : (
        renderChart()
      )}
    </div>
  );
};

// 모델별 사용량 차트
export const ModelStatsChart = ({ data, title }) => {
  const [chartType, setChartType] = useState('table');

  const chartData =
    data?.map((model) => ({
      name: model.label || model._id || '알 수 없음',
      count: model.count,
      percentage: (
        (model.count / (data?.reduce((sum, m) => sum + m.count, 0) || 1)) *
        100
      ).toFixed(1),
    })) || [];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [value + '회', '사용 횟수']}
                labelFormatter={(label) => `모델: ${label}`}
              />
              <Bar dataKey='count' fill='#10B981' />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ name, percentage }) => `${name} ${percentage}%`}
                outerRadius={80}
                fill='#8884d8'
                dataKey='count'
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value + '회', '사용 횟수']} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis />
              <Tooltip
                formatter={(value, name) => [value + '회', '사용 횟수']}
                labelFormatter={(label) => `모델: ${label}`}
              />
              <Line
                type='monotone'
                dataKey='count'
                stroke='#10B981'
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default: // table
        return (
          <div className='space-y-4'>
            {data?.map((model, index) => (
              <div
                key={model._id}
                className='flex items-center justify-between'
              >
                <div className='flex items-center min-w-0 flex-1'>
                  <div className='flex-shrink-0'>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        index === 0
                          ? 'bg-blue-500'
                          : index === 1
                          ? 'bg-green-500'
                          : index === 2
                          ? 'bg-yellow-500'
                          : 'bg-gray-400'
                      }`}
                    ></div>
                  </div>
                  <div className='ml-3 min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                      {model.label || model._id || '알 수 없음'}
                    </p>
                  </div>
                </div>
                <div className='flex items-center'>
                  <span className='text-sm font-medium text-gray-900 dark:text-white mr-2'>
                    {model.count}회
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    (
                    {(
                      (model.count /
                        (data?.reduce((sum, m) => sum + m.count, 0) || 1)) *
                      100
                    ).toFixed(1)}
                    %)
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
          {title}
        </h3>
        <ChartTypeToggle
          currentType={chartType}
          onTypeChange={setChartType}
          availableTypes={['table', 'bar', 'pie', 'line']}
        />
      </div>
      {!data || data.length === 0 ? (
        <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-8'>
          데이터가 없습니다
        </p>
      ) : (
        renderChart()
      )}
    </div>
  );
};

// 부서별 사용량 차트
export const DepartmentStatsChart = ({ data, title, tooltip }) => {
  const [chartType, setChartType] = useState('table');

  const chartData =
    data?.map((dept) => ({
      name: dept._id || '기타',
      userCount: dept.userCount,
      messageCount: dept.messageCount,
    })) || [];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey='userCount' fill='#8B5CF6' name='사용자 수' />
              <Bar dataKey='messageCount' fill='#F59E0B' name='메시지 수' />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ name, userCount }) => `${name} ${userCount}명`}
                outerRadius={80}
                fill='#8884d8'
                dataKey='userCount'
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value + '명', '사용자 수']} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type='monotone'
                dataKey='userCount'
                stroke='#8B5CF6'
                strokeWidth={2}
                name='사용자 수'
              />
              <Line
                type='monotone'
                dataKey='messageCount'
                stroke='#F59E0B'
                strokeWidth={2}
                name='메시지 수'
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default: // table
        return (
          <div className='space-y-4'>
            {data?.map((dept, index) => (
              <div key={dept._id} className='flex items-center justify-between'>
                <div className='flex items-center min-w-0 flex-1'>
                  <div className='flex-shrink-0'>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        index === 0
                          ? 'bg-purple-500'
                          : index === 1
                          ? 'bg-indigo-500'
                          : index === 2
                          ? 'bg-pink-500'
                          : index === 3
                          ? 'bg-red-500'
                          : 'bg-orange-500'
                      }`}
                    ></div>
                  </div>
                  <div className='ml-3 min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                      {dept._id || '기타'}
                    </p>
                  </div>
                </div>
                <div className='flex items-center'>
                  <span className='text-sm font-medium text-gray-900 dark:text-white mr-2'>
                    {dept.userCount}명
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    ({dept.messageCount}회)
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <TitleWithTooltip title={title} tooltip={tooltip} />
        <ChartTypeToggle
          currentType={chartType}
          onTypeChange={setChartType}
          availableTypes={['table', 'bar', 'pie', 'line']}
        />
      </div>
      {!data || data.length === 0 ? (
        <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-8'>
          데이터가 없습니다
        </p>
      ) : (
        renderChart()
      )}
    </div>
  );
};

// 숫자 포맷 헬퍼 (토큰 수 표시용)
const formatTokenCount = (count) => {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1) + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K';
  }
  return count.toString();
};

// 사용자별 토큰 사용량 차트
export const TokenUsageChart = ({ data, title }) => {
  const [chartType, setChartType] = useState('table');

  const chartData =
    data?.slice(0, 10).map((user) => ({
      name: user.name || user.email,
      totalTokens: user.totalTokens,
      promptTokens: user.promptTokens,
      responseTokens: user.responseTokens,
      requestCount: user.requestCount,
      email: user.email,
      department: user.department,
      cell: user.cell,
    })) || [];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis tickFormatter={(v) => formatTokenCount(v)} />
              <Tooltip
                formatter={(value, name) => {
                  const labels = {
                    totalTokens: '총 토큰',
                    promptTokens: '입력 토큰',
                    responseTokens: '출력 토큰',
                  };
                  return [value.toLocaleString(), labels[name] || name];
                }}
                labelFormatter={(label) => `사용자: ${label}`}
              />
              <Legend
                formatter={(value) => {
                  const labels = {
                    totalTokens: '총 토큰',
                    promptTokens: '입력',
                    responseTokens: '출력',
                  };
                  return labels[value] || value;
                }}
              />
              <Bar dataKey='promptTokens' fill='#3B82F6' stackId='a' />
              <Bar dataKey='responseTokens' fill='#10B981' stackId='a' />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill='#8884d8'
                dataKey='totalTokens'
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value.toLocaleString(), '토큰']}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis tickFormatter={(v) => formatTokenCount(v)} />
              <Tooltip
                formatter={(value) => [value.toLocaleString(), '토큰']}
                labelFormatter={(label) => `사용자: ${label}`}
              />
              <Line
                type='monotone'
                dataKey='totalTokens'
                stroke='#8B5CF6'
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default: // table
        return (
          <div className='space-y-4'>
            {data?.slice(0, 10).map((user, index) => (
              <div key={user._id} className='flex items-center justify-between'>
                <div className='flex items-center min-w-0 flex-1'>
                  <div className='flex-shrink-0 w-8'>
                    <span className='text-sm font-medium text-gray-500 dark:text-gray-400'>
                      #{index + 1}
                    </span>
                  </div>
                  <div className='ml-3 min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                      {user.name || user.email}
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {user.department} • {user.cell}
                    </p>
                  </div>
                </div>
                <div className='flex items-center'>
                  <div className='text-right mr-4'>
                    <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                      총합 {user.totalTokens?.toLocaleString() || 0}
                    </p>
                    <p className='text-xs text-gray-700 dark:text-gray-300'>
                      입력 {formatTokenCount(user.promptTokens || 0)} / 출력 {formatTokenCount(user.responseTokens || 0)}
                    </p>
                  </div>
                  <div className='w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                    <div
                      className='bg-purple-600 h-2 rounded-full'
                      style={{
                        width: `${Math.min(
                          (user.totalTokens / (data?.[0]?.totalTokens || 1)) *
                            100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <Coins className='h-5 w-5 text-purple-600' />
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            {title}
          </h3>
        </div>
        <ChartTypeToggle
          currentType={chartType}
          onTypeChange={setChartType}
          availableTypes={['table', 'bar', 'pie', 'line']}
        />
      </div>
      {!data || data.length === 0 ? (
        <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-8'>
          토큰 사용 데이터가 없습니다
        </p>
      ) : (
        renderChart()
      )}
    </div>
  );
};

// 부서별 토큰 사용량 차트
export const DepartmentTokenUsageChart = ({ data, title }) => {
  const [chartType, setChartType] = useState('table');

  const chartData =
    data?.map((dept) => ({
      name: dept._id || '기타',
      totalTokens: dept.totalTokens,
      promptTokens: dept.promptTokens,
      responseTokens: dept.responseTokens,
      requestCount: dept.requestCount,
      userCount: dept.userCount,
    })) || [];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis tickFormatter={(v) => formatTokenCount(v)} />
              <Tooltip
                formatter={(value, name) => {
                  const labels = {
                    totalTokens: '총 토큰',
                    promptTokens: '입력 토큰',
                    responseTokens: '출력 토큰',
                  };
                  return [value.toLocaleString(), labels[name] || name];
                }}
              />
              <Legend
                formatter={(value) => {
                  const labels = {
                    promptTokens: '입력',
                    responseTokens: '출력',
                  };
                  return labels[value] || value;
                }}
              />
              <Bar dataKey='promptTokens' fill='#3B82F6' stackId='a' />
              <Bar dataKey='responseTokens' fill='#10B981' stackId='a' />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill='#8884d8'
                dataKey='totalTokens'
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [value.toLocaleString(), '토큰']}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis
                dataKey='name'
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-45}
                textAnchor='end'
                height={80}
              />
              <YAxis tickFormatter={(v) => formatTokenCount(v)} />
              <Tooltip
                formatter={(value) => [value.toLocaleString(), '토큰']}
              />
              <Line
                type='monotone'
                dataKey='totalTokens'
                stroke='#F59E0B'
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default: // table
        return (
          <div className='space-y-4'>
            {data?.map((dept, index) => (
              <div key={dept._id} className='flex items-center justify-between'>
                <div className='flex items-center min-w-0 flex-1'>
                  <div className='flex-shrink-0'>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        index === 0
                          ? 'bg-purple-500'
                          : index === 1
                          ? 'bg-indigo-500'
                          : index === 2
                          ? 'bg-pink-500'
                          : index === 3
                          ? 'bg-red-500'
                          : 'bg-orange-500'
                      }`}
                    ></div>
                  </div>
                  <div className='ml-3 min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white truncate'>
                      {dept._id || '기타'}
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {dept.userCount}명 • {dept.requestCount}회 요청
                    </p>
                  </div>
                </div>
                <div className='flex items-center'>
                  <div className='text-right mr-2'>
                    <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                      총합 {dept.totalTokens?.toLocaleString() || 0}
                    </p>
                    <p className='text-xs text-gray-700 dark:text-gray-300'>
                      입력 {formatTokenCount(dept.promptTokens || 0)} / 출력 {formatTokenCount(dept.responseTokens || 0)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <Coins className='h-5 w-5 text-amber-600' />
          <h3 className='text-lg font-medium text-gray-900 dark:text-white'>
            {title}
          </h3>
        </div>
        <ChartTypeToggle
          currentType={chartType}
          onTypeChange={setChartType}
          availableTypes={['table', 'bar', 'pie', 'line']}
        />
      </div>
      {!data || data.length === 0 ? (
        <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-8'>
          토큰 사용 데이터가 없습니다
        </p>
      ) : (
        renderChart()
      )}
    </div>
  );
};

// 일별 활동량 차트
export const DailyActivityChart = ({ data, title, tooltip }) => {
  const [chartType, setChartType] = useState('table');

  const chartData =
    data?.slice(-7).map((day) => ({
      date: new Date(day._id).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Seoul',
      }),
      messageCount: day.messageCount,
      userCount: day.userCount,
      fullDate: day._id,
    })) || [];

  const renderChart = () => {
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey='messageCount' fill='#10B981' name='메시지 수' />
              <Bar dataKey='userCount' fill='#3B82F6' name='활동 사용자' />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx='50%'
                cy='50%'
                labelLine={false}
                label={({ date, messageCount }) => `${date} ${messageCount}개`}
                outerRadius={80}
                fill='#8884d8'
                dataKey='messageCount'
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value + '개', '메시지 수']} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width='100%' height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray='3 3' />
              <XAxis dataKey='date' />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type='monotone'
                dataKey='messageCount'
                stroke='#10B981'
                strokeWidth={2}
                name='메시지 수'
              />
              <Line
                type='monotone'
                dataKey='userCount'
                stroke='#3B82F6'
                strokeWidth={2}
                name='활동 사용자'
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default: // table
        return (
          <div className='space-y-2'>
            {data?.slice(-7).map((day) => (
              <div
                key={day._id}
                className='flex items-center justify-between py-2'
              >
                <div className='flex items-center'>
                  <span className='text-sm text-gray-900 dark:text-white'>
                    {new Date(day._id).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: 'Asia/Seoul',
                    })}
                  </span>
                </div>
                <div className='flex items-center'>
                  <div className='text-right mr-3'>
                    <p className='text-sm font-medium text-gray-900 dark:text-white'>
                      {day.messageCount}개
                    </p>
                    <p className='text-xs text-gray-500 dark:text-gray-400'>
                      {day.userCount}명 활동
                    </p>
                  </div>
                  <div className='w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                    <div
                      className='bg-green-600 h-2 rounded-full'
                      style={{
                        width: `${Math.min(
                          (day.messageCount /
                            (data?.reduce(
                              (max, d) => Math.max(max, d.messageCount),
                              0
                            ) || 1)) *
                            100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  return (
    <div className='bg-white dark:bg-gray-800 shadow rounded-lg p-6'>
      <div className='flex items-center justify-between mb-4'>
        <TitleWithTooltip title={title} tooltip={tooltip} />
        <ChartTypeToggle
          currentType={chartType}
          onTypeChange={setChartType}
          availableTypes={['table', 'bar', 'line', 'pie']}
        />
      </div>
      {!data || data.length === 0 ? (
        <p className='text-sm text-gray-500 dark:text-gray-400 text-center py-8'>
          데이터가 없습니다
        </p>
      ) : (
        renderChart()
      )}
    </div>
  );
};
