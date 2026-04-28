/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dams/types','@dams/validators'],
  experimental: { serverComponentsExternalPackages: [] },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '../../node_modules/**',
      ],
    }
    return config
  },
}
export default nextConfig
