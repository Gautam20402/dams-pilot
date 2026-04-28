/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@dams/types','@dams/validators'],
  experimental: { serverComponentsExternalPackages: [] },
}
export default nextConfig
