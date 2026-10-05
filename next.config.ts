import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [{ source: '/user', destination: '/user/check', permanent: false }]
  },
  async headers() {
    return [{
      source: '/services/unlock/catalog',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
      ],
    }]
  },
  // better-sqlite3 is a native module: keep it out of the bundle so the
  // route handlers require it at runtime instead.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
