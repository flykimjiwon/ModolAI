/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Strict Mode 비활성화 (중복 실행 방지)

  // Docker 빌드를 위한 standalone 출력 모드
  output: 'standalone',

  // 프로덕션 빌드 최적화
  productionBrowserSourceMaps: false, // 브라우저 소스맵 비활성화 (용량 절감)

  // 프로덕션에서 콘솔 로그 제거 (error만 유지)
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? {
            exclude: ['error'],
          }
        : false,
  },

  // 이미지 설정
  images: {
    unoptimized: true, // 로컬 이미지 최적화 비활성화
    domains: ['localhost', '127.0.0.1', '192.168.12.154'], // 로컬 및 운영환경 도메인 허용
  },

  // 리다이렉트 설정
  async redirects() {
    return [
      {
        source: '/chat/completions',
        destination: '/',
        permanent: false,
      },
    ];
  },

  // VSCode Continue와 같은 Ollama 호환 클라이언트를 위한 리디렉션 설정
  async rewrites() {
    return [
      {
        source: '/api/generate',
        destination: '/api/model-servers/generate',
      },
      {
        source: '/api/chat',
        destination: '/api/model-servers/chat', // 향후 chat 엔드포인트를 위해 미리 추가
      },
      // fastapi search api
      {
        source: '/techai-api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
      // OpenAI 호환 API를 위한 리라이트 규칙
      {
        source: '/v1/chat/completions',
        destination: '/api/v1/chat/completions',
      },
      {
        source: '/v1/completions',
        destination: '/api/v1/completions',
      },
      {
        source: '/v1/embeddings',
        destination: '/api/v1/embeddings',
      },
      {
        source: '/v1/rerank',
        destination: '/api/v1/rerank',
      },
      {
        source: '/v1/models',
        destination: '/api/v1/models',
      },
    ];
  },

  // Next.js 15+ 새로운 설정 구조
  serverExternalPackages: ['tesseract.js', 'winston'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/tesseract.js/**/*.wasm',
      './node_modules/tesseract.js/**/*.proto',
    ],
  },

  // webpack 설정: winston을 서버 전용으로 처리
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 번들에서 winston 제외
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        url: false,
      };
    }
    return config;
  },

  // Turbopack 설정: webpack을 사용하므로 빈 설정 추가
  turbopack: {},
};

export default nextConfig;
