/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  experimental: {
    // 메모리 사용량 최적화
    workerThreads: false,
    cpus: 1
  },
  // 빌드 캐시 설정
  compress: true
}