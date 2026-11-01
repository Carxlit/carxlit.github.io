/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'playwright',
      'playwright-core'
    ],
  },
};

export default nextConfig;

