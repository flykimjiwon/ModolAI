'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAlert } from '@/contexts/AlertContext';

export default function DbSchemaPage() {
  const { alert } = useAlert();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [expandedTables, setExpandedTables] = useState(new Set());
  const [selectedTarget, setSelectedTarget] = useState('main');
  const [availableTargets, setAvailableTargets] = useState([
    {
      value: 'main',
      label: '기본 DB (POSTGRES_URI)',
    },
  ]);

  const filteredTables = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return tables;
    return tables
      .map((table) => {
        const matchesTable = table.name.toLowerCase().includes(query);
        const filteredColumns = table.columns.filter((column) => {
          return (
            column.name.toLowerCase().includes(query) ||
            column.type.toLowerCase().includes(query)
          );
        });
        if (matchesTable || filteredColumns.length > 0) {
          return {
            ...table,
            columns: matchesTable ? table.columns : filteredColumns,
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [tables, filterText]);

  const handleExpandAll = () => {
    setExpandedTables(new Set(filteredTables.map((table) => table.name)));
  };

  const handleCollapseAll = () => {
    setExpandedTables(new Set());
  };

  const toggleTable = (tableName) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
      }
      return next;
    });
  };

  const handleTargetChange = (event) => {
    setSelectedTarget(event.target.value);
    setExpandedTables(new Set());
    setFilterText('');
  };

  useEffect(() => {
    const loadSchema = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/admin/db-schema?target=${encodeURIComponent(selectedTarget)}`,
          {
          headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!response.ok) {
          let errorMessage = 'DB 스키마 조회 실패';
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              if (errorData?.error) {
                errorMessage = errorData.error;
              } else {
                errorMessage = errorText;
              }
            } catch {
              errorMessage = errorText;
            }
          }
          throw new Error(errorMessage);
        }
        const data = await response.json();
        setTables(data.tables || []);
        if (Array.isArray(data.availableTargets) && data.availableTargets.length) {
          setAvailableTargets(data.availableTargets);
        }
        if (data.selectedTarget && data.selectedTarget !== selectedTarget) {
          setSelectedTarget(data.selectedTarget);
        }
      } catch (error) {
        console.error('DB 스키마 조회 실패:', error);
        alert(
          error.message || 'DB 스키마 조회에 실패했습니다.',
          'error',
          '조회 실패'
        );
      } finally {
        setLoading(false);
      }
    };

    loadSchema();
  }, [alert, selectedTarget]);

  return (
    <div className='space-y-6'>
      <div className='card p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h1 className='text-xl font-semibold text-gray-900 dark:text-white'>
              DB 스키마
            </h1>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              선택한 데이터베이스의 테이블과 컬럼 구성을 표시합니다.
            </p>
          </div>
          <div className='flex items-end gap-2'>
            <label className='text-xs text-gray-600 dark:text-gray-400'>
              DB 대상
            </label>
            <select
              value={selectedTarget}
              onChange={handleTargetChange}
              className='px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            >
              {availableTargets.map((target) => (
                <option key={target.value} value={target.value}>
                  {target.label}
                </option>
              ))}
            </select>
            <a
              href='/admin/settings'
              className='btn-primary text-sm px-3 py-1.5'
            >
              설정으로 돌아가기
            </a>
          </div>
        </div>
      </div>

      <div className='card p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900 dark:text-white'>
              폴더형 요약
            </h2>
            <p className='text-sm text-gray-500 dark:text-gray-400 mt-2'>
              테이블을 폴더처럼 펼쳐서 컬럼, 타입, NULL 허용 여부를 확인합니다.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={handleExpandAll}
              className='px-3 py-1.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            >
              모두 펼치기
            </button>
            <button
              type='button'
              onClick={handleCollapseAll}
              className='px-3 py-1.5 text-xs rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
            >
              모두 접기
            </button>
          </div>
        </div>
        <div className='mt-4'>
          <input
            type='text'
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder='테이블/컬럼 검색'
            className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
          />
        </div>
        <div className='mt-4 space-y-2'>
          {loading && (
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              스키마를 불러오는 중...
            </div>
          )}
          {!loading && filteredTables.length === 0 && (
            <div className='text-sm text-gray-500 dark:text-gray-400'>
              표시할 테이블이 없습니다.
            </div>
          )}
          {!loading &&
            filteredTables.map((table) => (
              <div
                key={`${table.name}-tree`}
                className='rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-3 py-2'
              >
                <button
                  type='button'
                  onClick={() => toggleTable(table.name)}
                  className='w-full text-left text-sm font-medium text-gray-900 dark:text-gray-100'
                >
                  {expandedTables.has(table.name) ? '📂' : '📁'} {table.name} (
                  {table.columns.length})
                </button>
                {expandedTables.has(table.name) && (
                  <div className='mt-2 space-y-1'>
                    {table.columns.map((column) => (
                      <div
                        key={`${table.name}-${column.name}-tree`}
                        className='text-xs text-gray-600 dark:text-gray-300 pl-4'
                      >
                        📄 {column.name}{' '}
                        <span className='text-gray-400'>({column.type})</span>
                        <span className='ml-2 text-gray-400'>
                          NULL {column.nullable ? 'YES' : 'NO'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
