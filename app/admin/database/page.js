'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Database,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Copy,
  RefreshCw,
  ArrowUpDown,
  Table2,
  Eye,
  EyeOff,
  Hash,
  AlertTriangle,
} from 'lucide-react';
import { useAlert } from '@/contexts/AlertContext';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { getColumnDescription, getTableDescription } from '@/lib/dbColumnDescriptions';

function formatCellValue(value, colType) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  if (
    colType &&
    (colType.includes('timestamp') || colType.includes('date')) &&
    typeof value === 'string'
  ) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
      });
    }
  }
  return String(value);
}

function truncateText(text, max = 100) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max) + '…';
}

function CellValue({ value, colType, isPrimaryKey }) {
  const [expanded, setExpanded] = useState(false);
  const formatted = formatCellValue(value, colType);

  if (formatted === null) {
    return (
      <span className='inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 select-none'>
        NULL
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
          value
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        }`}
      >
        {value ? 'true' : 'false'}
      </span>
    );
  }

  const displayText = String(formatted);
  const isLong = displayText.length > 100;
  const isJson = typeof value === 'object';

  return (
    <div className='group/cell relative'>
      <span
        className={`${isPrimaryKey ? 'font-semibold text-blue-700 dark:text-blue-300' : ''} ${
          isLong || isJson ? 'cursor-pointer' : ''
        }`}
        onClick={() => {
          if (isLong || isJson) setExpanded(!expanded);
        }}
        title={isLong ? displayText : undefined}
      >
        {expanded ? displayText : truncateText(displayText)}
      </span>
      {(isLong || isJson) && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className='ml-1 text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
        >
          더보기
        </button>
      )}
      {expanded && (
        <button
          onClick={() => setExpanded(false)}
          className='ml-1 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        >
          접기
        </button>
      )}
    </div>
  );
}

function Tooltip({ children, text, delay = 0, className = '' }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState('bottom');
  const triggerRef = useRef(null);
  const timerRef = useRef(null);

  const handleEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        setPosition(spaceBelow < 120 && spaceAbove > 120 ? 'top' : 'bottom');
      }
      setShow(true);
    }, delay);
  }, [delay]);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!text) return children;

  return (
    <span
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {show && (
        <span
          className={`absolute z-50 max-w-[300px] px-2.5 py-1.5 text-xs leading-relaxed rounded-lg border whitespace-normal break-words pointer-events-none transition-opacity duration-150 ${
            position === 'bottom' ? 'top-full mt-1.5 left-1/2 -translate-x-1/2' : 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'
          } bg-white text-gray-900 border-gray-200 shadow-lg dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700`}
        >
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border bg-white dark:bg-gray-900 ${
              position === 'bottom'
                ? '-top-1 border-l border-t border-gray-200 dark:border-gray-700'
                : '-bottom-1 border-r border-b border-gray-200 dark:border-gray-700'
            }`}
          />
          {text}
        </span>
      )}
    </span>
  );
}

function RowFormModal({ schema, primaryKeys, row, onSave, onClose, isEdit }) {
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (isEdit && row) {
      setFormData({ ...row });
    } else {
      const initial = {};
      schema.forEach((col) => {
        if (!col.defaultValue && !primaryKeys.includes(col.name)) {
          initial[col.name] = '';
        }
      });
      setFormData(initial);
    }
  }, [schema, primaryKeys, row, isEdit]);

  const editableColumns = useMemo(() => {
    if (isEdit) return schema;
    return schema.filter((col) => {
      const hasSerial =
        col.defaultValue &&
        (col.defaultValue.includes('nextval') || col.defaultValue.includes('gen_random'));
      return !hasSerial;
    });
  }, [schema, isEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {};
    editableColumns.forEach((col) => {
      const val = formData[col.name];
      if (val === '' || val === undefined) {
        if (col.nullable) {
          data[col.name] = null;
        }
        return;
      }
      if (col.type.includes('int') || col.type.includes('float') || col.type.includes('numeric') || col.type.includes('decimal') || col.type === 'real' || col.type === 'double') {
        data[col.name] = Number(val);
      } else if (col.type === 'bool' || col.type === 'boolean') {
        data[col.name] = val === 'true' || val === true;
      } else if (col.type === 'json' || col.type === 'jsonb') {
        try {
          data[col.name] = JSON.parse(val);
        } catch {
          data[col.name] = val;
        }
      } else {
        data[col.name] = val;
      }
    });
    onSave(data);
  };

  const getInputType = (colType) => {
    if (colType.includes('int') || colType.includes('float') || colType.includes('numeric') || colType.includes('decimal') || colType === 'real' || colType === 'double') return 'number';
    if (colType.includes('bool')) return 'select';
    if (colType.includes('timestamp') || colType.includes('date')) return 'datetime-local';
    if (colType === 'json' || colType === 'jsonb') return 'textarea';
    if (colType === 'text' || colType.includes('varchar') && (schema.find((c) => c.type === colType)?.maxLength || 0) > 255) return 'textarea';
    return 'text';
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700'>
        <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
            {isEdit ? '행 수정' : '행 추가'}
          </h3>
          <button onClick={onClose} className='p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'>
            <X className='h-5 w-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='flex-1 overflow-y-auto px-6 py-4'>
          <div className='space-y-4'>
            {editableColumns.map((col) => {
              const inputType = getInputType(col.type);
              const isPk = primaryKeys.includes(col.name);
              const isDisabledPk = isEdit && isPk;

              return (
                <div key={col.name}>
                  <label className='flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5'>
                    {col.name}
                    {isPk && (
                      <span className='text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-mono'>
                        PK
                      </span>
                    )}
                    <span className='text-[10px] text-gray-400 font-mono'>{col.type}</span>
                    {col.nullable && (
                      <span className='text-[10px] text-gray-400'>nullable</span>
                    )}
                  </label>

                  {inputType === 'select' ? (
                    <select
                      value={String(formData[col.name] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                      disabled={isDisabledPk}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm'
                    >
                      <option value=''>선택...</option>
                      <option value='true'>true</option>
                      <option value='false'>false</option>
                    </select>
                  ) : inputType === 'textarea' ? (
                    <textarea
                      value={typeof formData[col.name] === 'object' ? JSON.stringify(formData[col.name], null, 2) : String(formData[col.name] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                      disabled={isDisabledPk}
                      rows={3}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm resize-y'
                    />
                  ) : (
                    <input
                      type={inputType}
                      value={String(formData[col.name] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [col.name]: e.target.value })}
                      disabled={isDisabledPk}
                      step={inputType === 'number' ? 'any' : undefined}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed text-sm'
                    />
                  )}
                </div>
              );
            })}
          </div>
        </form>

        <div className='flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
          >
            취소
          </button>
          <button
            type='submit'
            onClick={handleSubmit}
            className='px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
          >
            {isEdit ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DatabasePage() {
  const { alert, confirm } = useAlert();
  const { isReadOnly } = useAdminAuth();

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('');

  const [selectedTable, setSelectedTable] = useState(null);
  const [schema, setSchema] = useState([]);
  const [primaryKeys, setPrimaryKeys] = useState([]);
  const [data, setData] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [searchText, setSearchText] = useState('');
  const [searchColumn, setSearchColumn] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [schemaOpen, setSchemaOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const searchTimerRef = useRef(null);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchText]);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('token') : ''}`,
    'Content-Type': 'application/json',
  }), []);

  const fetchTables = useCallback(async () => {
    try {
      setTablesLoading(true);
      const res = await fetch('/api/admin/database', { headers: authHeaders });
      if (!res.ok) throw new Error('테이블 목록 조회 실패');
      const json = await res.json();
      setTables(json.tables || []);
    } catch (err) {
      console.error('테이블 조회 실패:', err);
      alert(err.message || '테이블 목록을 불러오는데 실패했습니다.', 'error', '조회 실패');
    } finally {
      setTablesLoading(false);
    }
  }, [authHeaders, alert]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const fetchTableData = useCallback(async () => {
    if (!selectedTable) return;
    try {
      setDataLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (sortCol) {
        params.set('sort', sortCol);
        params.set('dir', sortDir);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
        if (searchColumn) params.set('column', searchColumn);
      }
      const res = await fetch(
        `/api/admin/database/${encodeURIComponent(selectedTable)}?${params}`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error('테이블 데이터 조회 실패');
      const json = await res.json();
      setSchema(json.schema || []);
      setPrimaryKeys(json.primaryKeys || []);
      setData(json.data || []);
      setTotalRows(json.pagination?.totalRows || 0);
      setTotalPages(json.pagination?.totalPages || 0);
    } catch (err) {
      console.error('데이터 조회 실패:', err);
      alert(err.message || '데이터를 불러오는데 실패했습니다.', 'error', '조회 실패');
    } finally {
      setDataLoading(false);
    }
  }, [selectedTable, page, limit, sortCol, sortDir, debouncedSearch, searchColumn, authHeaders, alert]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const handleSelectTable = useCallback((tableName) => {
    setSelectedTable(tableName);
    setPage(1);
    setSortCol('');
    setSortDir('asc');
    setSearchText('');
    setSearchColumn('');
    setDebouncedSearch('');
    setSchemaOpen(false);
    setMobileSidebarOpen(false);
  }, []);

  const handleSort = useCallback((colName) => {
    setSortCol((prev) => {
      if (prev === colName) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return colName;
      }
      setSortDir('asc');
      return colName;
    });
    setPage(1);
  }, []);

  const handleAddRow = useCallback(async (rowData) => {
    try {
      const res = await fetch(`/api/admin/database/${encodeURIComponent(selectedTable)}`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ row: rowData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '행 추가 실패');
      alert('행이 추가되었습니다.', 'success', '추가 완료');
      setShowAddModal(false);
      fetchTableData();
      fetchTables();
    } catch (err) {
      console.error('행 추가 실패:', err);
      alert(err.message || '행 추가에 실패했습니다.', 'error', '추가 실패');
    }
  }, [selectedTable, authHeaders, alert, fetchTableData, fetchTables]);

  const handleEditRow = useCallback(async (rowData) => {
    try {
      const pk = {};
      primaryKeys.forEach((k) => {
        pk[k] = editRow[k];
      });
      const res = await fetch(`/api/admin/database/${encodeURIComponent(selectedTable)}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ primaryKey: pk, row: rowData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '행 수정 실패');
      alert('행이 수정되었습니다.', 'success', '수정 완료');
      setEditRow(null);
      fetchTableData();
    } catch (err) {
      console.error('행 수정 실패:', err);
      alert(err.message || '행 수정에 실패했습니다.', 'error', '수정 실패');
    }
  }, [selectedTable, primaryKeys, editRow, authHeaders, alert, fetchTableData]);

  const handleDeleteRow = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const pk = {};
      primaryKeys.forEach((k) => {
        pk[k] = deleteTarget[k];
      });
      const res = await fetch(`/api/admin/database/${encodeURIComponent(selectedTable)}`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ primaryKey: pk }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '행 삭제 실패');
      alert('행이 삭제되었습니다.', 'success', '삭제 완료');
      setDeleteTarget(null);
      fetchTableData();
      fetchTables();
    } catch (err) {
      console.error('행 삭제 실패:', err);
      alert(err.message || '행 삭제에 실패했습니다.', 'error', '삭제 실패');
    }
  }, [selectedTable, primaryKeys, deleteTarget, authHeaders, alert, fetchTableData, fetchTables]);

  const filteredTables = useMemo(() => {
    if (!tableFilter.trim()) return tables;
    const q = tableFilter.toLowerCase();
    return tables.filter((t) => t.name.toLowerCase().includes(q));
  }, [tables, tableFilter]);

  const paginationRange = useMemo(() => {
    const range = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [page, totalPages]);

  const startRow = (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, totalRows);

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('클립보드에 복사되었습니다.', 'success', '복사 완료');
    }).catch(() => {
      alert('복사에 실패했습니다.', 'error', '복사 실패');
    });
  }, [alert]);

  useEffect(() => {
    if (showAddModal || editRow || deleteTarget) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showAddModal, editRow, deleteTarget]);

  return (
    <div className='space-y-0 w-full max-w-[95vw] mx-auto'>
      <div className='border-b border-gray-200 dark:border-gray-700 pb-4 mb-4'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
              <Database className='h-6 w-6' />
              DB 뷰어
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-1'>
              데이터베이스 테이블을 조회하고 관리합니다.
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className='lg:hidden p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors'
            >
              <Table2 className='h-5 w-5' />
            </button>
            <div className='text-right hidden sm:block'>
              <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                {tables.length}
              </div>
              <div className='text-sm text-gray-500 dark:text-gray-400'>총 테이블</div>
            </div>
          </div>
        </div>
      </div>

      <div className='flex gap-4 min-h-[calc(100vh-220px)]'>
        {mobileSidebarOpen && (
          <div className='fixed inset-0 z-40 lg:hidden'>
            <div className='absolute inset-0 bg-black/40' onClick={() => setMobileSidebarOpen(false)} />
            <div className='absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-xl z-50'>
              <div className='flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700'>
                <span className='text-sm font-semibold text-gray-900 dark:text-white'>테이블 목록</span>
                <button onClick={() => setMobileSidebarOpen(false)} className='p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700'>
                  <X className='h-4 w-4 text-gray-500' />
                </button>
              </div>
              <div className='p-3'>
                <div className='relative'>
                  <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400' />
                  <input
                    type='text'
                    placeholder='테이블 검색...'
                    value={tableFilter}
                    onChange={(e) => setTableFilter(e.target.value)}
                    className='w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                  />
                </div>
              </div>
              <div className='flex-1 overflow-y-auto px-2 pb-2'>
                {filteredTables.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleSelectTable(t.name)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors mb-0.5 ${
                      selectedTable === t.name
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className='truncate'>{t.name}</span>
                    <span className='flex-shrink-0 ml-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>
                      {t.rowCount?.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
              <div className='p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 text-center'>
                {filteredTables.length} / {tables.length} 테이블
              </div>
            </div>
          </div>
        )}

        <div className='hidden lg:flex w-64 flex-shrink-0 flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
          <div className='p-3 border-b border-gray-200 dark:border-gray-700'>
            <div className='relative'>
              <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400' />
              <input
                type='text'
                placeholder='테이블 검색...'
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
                className='w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
              />
            </div>
          </div>

          <div className='flex-1 overflow-y-auto px-2 py-2'>
            {tablesLoading ? (
              <div className='space-y-2 px-2'>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className='h-9 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse' />
                ))}
              </div>
            ) : filteredTables.length === 0 ? (
              <div className='text-center py-8 text-sm text-gray-400 dark:text-gray-500'>
                테이블이 없습니다
              </div>
            ) : (
              filteredTables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => handleSelectTable(t.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors mb-0.5 ${
                    selectedTable === t.name
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span className='truncate'>{t.name}</span>
                  <span className='flex-shrink-0 ml-2 text-[11px] tabular-nums text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded'>
                    {t.rowCount?.toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className='p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 text-center'>
            {filteredTables.length} / {tables.length} 테이블
          </div>
        </div>

        <div className='flex-1 min-w-0 flex flex-col'>
          {!selectedTable ? (
            <div className='flex-1 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
              <div className='text-center'>
                <Database className='mx-auto h-16 w-16 text-gray-300 dark:text-gray-600' />
                <h3 className='mt-3 text-lg font-medium text-gray-500 dark:text-gray-400'>
                  테이블을 선택하세요
                </h3>
                <p className='mt-1 text-sm text-gray-400 dark:text-gray-500'>
                  왼쪽 목록에서 테이블을 선택하면 데이터를 조회할 수 있습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className='flex flex-col gap-3'>
              <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex items-center gap-3'>
                    <h2 className='text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2'>
                      <Table2 className='h-5 w-5 text-blue-600 dark:text-blue-400' />
                      {selectedTable}
                    </h2>
                    <span className='text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded'>
                      {totalRows.toLocaleString()} 행
                    </span>
                    <span className='text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded'>
                      {schema.length} 컬럼
                    </span>
                  </div>
                  {getTableDescription(selectedTable) && (
                    <p className='w-full text-xs text-gray-500 dark:text-gray-400 mt-1'>
                      {getTableDescription(selectedTable)}
                    </p>
                  )}

                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => setSchemaOpen(!schemaOpen)}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                    >
                      {schemaOpen ? <EyeOff className='h-3.5 w-3.5' /> : <Eye className='h-3.5 w-3.5' />}
                      스키마
                    </button>
                    <button
                      onClick={() => { fetchTableData(); fetchTables(); }}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                    >
                      <RefreshCw className='h-3.5 w-3.5' />
                      새로고침
                    </button>
                    {!isReadOnly && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors'
                      >
                        <Plus className='h-3.5 w-3.5' />
                        행 추가
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {schemaOpen && (
                <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden'>
                  <div className='px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'>
                    <h3 className='text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5'>
                      <Hash className='h-3.5 w-3.5' />
                      스키마 정보
                    </h3>
                  </div>
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='bg-gray-50 dark:bg-gray-700/30'>
                          <th className='text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>컬럼명</th>
                          <th className='text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>타입</th>
                          <th className='text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>NULL</th>
                          <th className='text-left px-4 py-2 font-medium text-gray-500 dark:text-gray-400'>기본값</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-gray-100 dark:divide-gray-700'>
                        {schema.map((col) => (
                          <tr key={col.name} className='hover:bg-gray-50 dark:hover:bg-gray-700/20'>
                            <td className='px-4 py-1.5'>
                              <Tooltip text={getColumnDescription(selectedTable, col.name) || col.type}>
                                <span className={`font-mono text-xs ${primaryKeys.includes(col.name) ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-900 dark:text-gray-100'}`}>
                                  {col.name}
                                </span>
                                {primaryKeys.includes(col.name) && (
                                  <span className='ml-1.5 text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'>
                                    PK
                                  </span>
                                )}
                              </Tooltip>
                            </td>
                            <td className='px-4 py-1.5 font-mono text-xs text-gray-600 dark:text-gray-400'>{col.type}</td>
                            <td className='px-4 py-1.5'>
                              <span className={`text-xs ${col.nullable ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {col.nullable ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td className='px-4 py-1.5 font-mono text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate'>
                              {col.defaultValue || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                <div className='flex flex-col sm:flex-row gap-3'>
                  <div className='relative flex-1'>
                    <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400' />
                    <input
                      type='text'
                      placeholder='데이터 검색...'
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className='w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white'
                    />
                  </div>
                  <select
                    value={searchColumn}
                    onChange={(e) => { setSearchColumn(e.target.value); setPage(1); }}
                    className='px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-w-[140px]'
                  >
                    <option value=''>모든 컬럼</option>
                    {schema.map((col) => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex-1'>
                {dataLoading ? (
                  <div className='flex items-center justify-center h-48'>
                    <Loader2 className='h-8 w-8 text-blue-500 animate-spin' />
                  </div>
                ) : data.length === 0 ? (
                  <div className='text-center py-16'>
                    <Database className='mx-auto h-12 w-12 text-gray-300 dark:text-gray-600' />
                    <h3 className='mt-2 text-sm font-medium text-gray-500 dark:text-gray-400'>
                      데이터가 없습니다
                    </h3>
                    {debouncedSearch && (
                      <p className='mt-1 text-xs text-gray-400'>검색 조건을 변경해보세요.</p>
                    )}
                  </div>
                ) : (
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600'>
                          {schema.map((col) => {
                            const isSorted = sortCol === col.name;
                            const isPk = primaryKeys.includes(col.name);
                            return (
                              <th
                                key={col.name}
                                className='text-left px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors select-none whitespace-nowrap'
                                onClick={() => handleSort(col.name)}
                              >
                                <Tooltip text={getColumnDescription(selectedTable, col.name) || col.type}>
                                  <span className='flex items-center gap-1'>
                                    <span className={isPk ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>
                                      {col.name}
                                    </span>
                                    {isPk && (
                                      <span className='text-[8px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'>
                                        PK
                                      </span>
                                    )}
                                    {isSorted ? (
                                      sortDir === 'asc' ? (
                                        <ChevronUp className='h-3 w-3 text-blue-500' />
                                      ) : (
                                        <ChevronDown className='h-3 w-3 text-blue-500' />
                                      )
                                    ) : (
                                      <ArrowUpDown className='h-3 w-3 text-gray-300 dark:text-gray-600' />
                                    )}
                                  </span>
                                </Tooltip>
                              </th>
                            );
                          })}
                          {!isReadOnly && (
                            <th className='text-right px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400 sticky right-0 bg-gray-50 dark:bg-gray-700/50 whitespace-nowrap min-w-[100px]'>
                              작업
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-gray-100 dark:divide-gray-700'>
                        {data.map((row, rowIdx) => {
                          const rowKey = primaryKeys.length > 0
                            ? primaryKeys.map((k) => row[k]).join('-')
                            : rowIdx;
                          return (
                            <tr key={rowKey} className='hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors'>
                              {schema.map((col) => {
                                const cellDesc = getColumnDescription(selectedTable, col.name);
                                const cellTooltip = cellDesc
                                  ? `${col.name} - ${cellDesc}`
                                  : `${col.name} (${col.type})`;
                                return (
                                  <td
                                    key={col.name}
                                    className='px-4 py-2 text-gray-900 dark:text-gray-100 max-w-[300px] align-top'
                                  >
                                    <Tooltip text={cellTooltip} delay={300} className='w-full'>
                                      <CellValue
                                        value={row[col.name]}
                                        colType={col.type}
                                        isPrimaryKey={primaryKeys.includes(col.name)}
                                      />
                                    </Tooltip>
                                  </td>
                                );
                              })}
                              {!isReadOnly && (
                                <td className='px-4 py-2 text-right sticky right-0 bg-white dark:bg-gray-800 whitespace-nowrap'>
                                  <div className='flex items-center justify-end gap-1'>
                                    <button
                                      onClick={() => setEditRow(row)}
                                      className='p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors'
                                      title='수정'
                                    >
                                      <Edit2 className='h-3.5 w-3.5' />
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarget(row)}
                                      className='p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors'
                                      title='삭제'
                                    >
                                      <Trash2 className='h-3.5 w-3.5' />
                                    </button>
                                    <button
                                      onClick={() => copyToClipboard(JSON.stringify(row, null, 2))}
                                      className='p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors'
                                      title='JSON 복사'
                                    >
                                      <Copy className='h-3.5 w-3.5' />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {totalPages > 0 && data.length > 0 && (
                <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3'>
                  <div className='flex flex-col sm:flex-row items-center justify-between gap-3'>
                    <div className='text-sm text-gray-600 dark:text-gray-400'>
                      {totalRows.toLocaleString()}건 중 {startRow.toLocaleString()}~{endRow.toLocaleString()} 표시
                    </div>

                    <div className='flex items-center gap-2'>
                      <select
                        value={limit}
                        onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                        className='px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white'
                      >
                        <option value={25}>25행</option>
                        <option value={50}>50행</option>
                        <option value={100}>100행</option>
                      </select>

                      <div className='flex items-center'>
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className='p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                        >
                          <ChevronLeft className='h-4 w-4 text-gray-600 dark:text-gray-400' />
                        </button>

                        <div className='flex items-center mx-1'>
                          {paginationRange.map((p) => (
                            <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`min-w-[32px] h-8 text-xs rounded-lg transition-colors ${
                                p === page
                                  ? 'bg-blue-600 text-white font-medium'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                          className='p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
                        >
                          <ChevronRight className='h-4 w-4 text-gray-600 dark:text-gray-400' />
                        </button>
                      </div>

                      <span className='text-xs text-gray-500 dark:text-gray-400'>
                        {page} / {totalPages}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <RowFormModal
          schema={schema}
          primaryKeys={primaryKeys}
          onSave={handleAddRow}
          onClose={() => setShowAddModal(false)}
          isEdit={false}
        />
      )}

      {editRow && (
        <RowFormModal
          schema={schema}
          primaryKeys={primaryKeys}
          row={editRow}
          onSave={handleEditRow}
          onClose={() => setEditRow(null)}
          isEdit={true}
        />
      )}

      {deleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
          <div className='absolute inset-0 bg-black/50 backdrop-blur-sm' onClick={() => setDeleteTarget(null)} />
          <div className='relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700'>
            <div className='flex items-start gap-4'>
              <div className='flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center'>
                <AlertTriangle className='h-5 w-5 text-red-600 dark:text-red-400' />
              </div>
              <div className='flex-1'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
                  정말 삭제하시겠습니까?
                </h3>
                <div className='mt-2 space-y-1'>
                  {primaryKeys.map((k) => (
                    <p key={k} className='text-sm text-gray-600 dark:text-gray-400'>
                      <span className='font-medium text-gray-800 dark:text-gray-200'>{k}:</span>{' '}
                      {String(deleteTarget[k])}
                    </p>
                  ))}
                </div>
                <p className='mt-3 text-sm text-gray-500 dark:text-gray-400'>
                  이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => setDeleteTarget(null)}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
              >
                취소
              </button>
              <button
                onClick={handleDeleteRow}
                className='px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors'
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
