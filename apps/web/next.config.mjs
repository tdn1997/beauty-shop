/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Web chỉ gọi API NestJS; mọi phép ghi đi qua đó, không truy cập DB trực tiếp.
  env: { API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3001' },
};

export default nextConfig;
