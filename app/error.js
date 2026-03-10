'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Error:', error);
  }, [error]);

  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900'>
      <div className='text-center'>
        <h1 className='text-9xl font-bold text-gray-200 dark:text-gray-700'>
          오류
        </h1>
        <h2 className='mt-4 text-3xl font-semibold text-gray-800 dark:text-gray-200'>
          문제가 발생했습니다
        </h2>
        <p className='mt-4 text-gray-600 dark:text-gray-400'>
          페이지를 불러오는 중 오류가 발생했습니다.
        </p>
        <div className='mt-8 space-x-4'>
          <button
            onClick={() => reset()}
            className='inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors'
          >
            다시 시도
          </button>
          <Link
            href='/'
            className='inline-flex items-center rounded-lg bg-gray-600 px-6 py-3 text-white hover:bg-gray-700 transition-colors'
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
