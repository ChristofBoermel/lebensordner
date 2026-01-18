/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Prevent trailing slash redirects that break webhooks
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig
