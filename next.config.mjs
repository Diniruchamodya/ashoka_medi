/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    '/api/orders/items/*/result': [
      './node_modules/@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-400-normal.woff2',
      './node_modules/@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff2',
    ],
  },
}

export default nextConfig
