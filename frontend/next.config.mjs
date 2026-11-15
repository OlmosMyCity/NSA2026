/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Siempre definida en el build: así `process.env.NEXT_PUBLIC_USE_MOCKS === 'true'` se resuelve
  // en compilación y el mock server (con sus credenciales de demo) no se emite si no se usa.
  env: {
    NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS === 'true' ? 'true' : 'false',
  },
  images: {
    unoptimized: true,
    dangerouslyAllowSVG: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || process.env.API_PROXY_TARGET || '')
      .trim()
      .replace(/\/+$/, '');
    if (!backendUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${backendUrl}/health`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;

