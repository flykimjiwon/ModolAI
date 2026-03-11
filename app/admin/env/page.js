'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ShieldCheck, TriangleAlert } from '@/components/icons';
import { useAlert } from '@/contexts/AlertContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatMatchedFiles(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return '-';
  }
  return files.join(', ');
}

function EnvValueCard({ label, value }) {
  return (
    <Card className='py-4'>
      <CardContent>
        <div className='text-xs text-muted-foreground'>{label}</div>
        <div className='mt-2 text-sm font-semibold text-foreground break-all'>
          {value || '-'}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminEnvPage() {
  const { alert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const badge = useMemo(() => {
    if (!result?.success) {
      return {
        variant: 'destructive',
        icon: <TriangleAlert className='w-4 h-4' />,
        text: '환경 점검 실패',
      };
    }

    return {
      variant: 'default',
      icon: <ShieldCheck className='w-4 h-4' />,
      text: '환경 점검 성공',
    };
  }, [result]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/env', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const raw = await response.text();
      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(`응답 파싱 실패 (${response.status})`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `환경 변수 점검 실패 (${response.status})`);
      }

      setResult(data);
    } catch (fetchError) {
      const message = fetchError.message || '환경 변수 점검 실패';
      setError(message);
      alert(message, 'error', '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [alert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className='space-y-6'>
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <h1 className='text-xl font-semibold text-foreground'>
                ENV 변수 확인
              </h1>
              <p className='text-sm text-muted-foreground mt-2'>
                현재 런타임에서 사용 중인 <code>POSTGRES_URI</code>와{' '}
                <code>NODE_ENV</code>, 그리고 값이 일치하는 <code>.env*</code>
                파일 후보를 확인합니다.
              </p>
            </div>

            <Button
              onClick={loadData}
              disabled={loading}
              size='sm'
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='pt-6 space-y-4'>
          <Badge variant={badge.variant} className='gap-2 px-3 py-1.5'>
            {badge.icon}
            <span>{badge.text}</span>
          </Badge>

          {error && (
            <div className='rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {error}
            </div>
          )}

          {result?.success && (
            <>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <EnvValueCard
                  label='NODE_ENV (runtime)'
                  value={result.runtime?.nodeEnv}
                />
                <EnvValueCard
                  label='POSTGRES_URI (runtime)'
                  value={result.runtime?.postgresUri}
                />
              </div>

              <div className='rounded-lg border border-border overflow-hidden'>
                <div className='px-4 py-2 bg-muted text-sm font-semibold text-foreground'>
                  일치 파일 후보
                </div>
                <div className='p-4 space-y-2 text-sm'>
                  <div>
                    <span className='text-muted-foreground'>NODE_ENV 후보</span>
                    <div className='text-foreground break-all'>
                      {formatMatchedFiles(result.envFiles?.nodeEnvMatchedFiles)}
                    </div>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>POSTGRES_URI 후보</span>
                    <div className='text-foreground break-all'>
                      {formatMatchedFiles(result.envFiles?.postgresUriMatchedFiles)}
                    </div>
                  </div>
                  <div className='text-xs text-muted-foreground pt-1'>
                    {result.envFiles?.caveat}
                  </div>
                </div>
              </div>

              <div className='rounded-lg border border-border overflow-hidden'>
                <div className='px-4 py-2 bg-muted text-sm font-semibold text-foreground'>
                  점검한 .env 파일
                </div>

                <div className='p-4 space-y-3 text-sm'>
                  <div className='rounded-md border border-border px-3 py-2 bg-background'>
                    <div className='text-xs text-muted-foreground'>프로젝트 루트</div>
                    <div className='mt-1 font-medium text-foreground break-all'>
                      {result.envFiles?.projectRoot || '-'}
                    </div>
                  </div>

                  <div className='border border-border rounded-md overflow-hidden'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='px-3 py-2'>파일명</TableHead>
                          <TableHead className='px-3 py-2'>존재</TableHead>
                          <TableHead className='px-3 py-2'>NODE_ENV</TableHead>
                          <TableHead className='px-3 py-2'>POSTGRES_URI</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(result.envFiles?.snapshots || []).map((item) => (
                          <TableRow key={item.fileName}>
                            <TableCell className='px-3 py-2 font-medium text-foreground whitespace-nowrap'>
                              {item.fileName}
                            </TableCell>
                            <TableCell className='px-3 py-2 text-foreground whitespace-nowrap'>
                              {item.exists ? 'YES' : 'NO'}
                            </TableCell>
                            <TableCell className='px-3 py-2 text-foreground break-all'>
                              {item.hasNodeEnv ? item.nodeEnvValue : '-'}
                            </TableCell>
                            <TableCell className='px-3 py-2 text-foreground break-all'>
                              {item.hasPostgresUri ? item.postgresUriValue : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
