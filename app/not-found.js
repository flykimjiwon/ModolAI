import Link from 'next/link';

// 빌드 시점 prerender 방지
export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900'>
      <div className='text-center'>
        <h1 className='text-9xl font-bold text-gray-200 dark:text-gray-700'>
          404
        </h1>
        <h2 className='mt-4 text-3xl font-semibold text-gray-800 dark:text-gray-200'>
          페이지를 찾을 수 없습니다
        </h2>
        <p className='mt-4 text-gray-600 dark:text-gray-400'>
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>
        <div className='mt-8'>
          <Link
            href='/'
            className='inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700 transition-colors'
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
