import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // better-sqlite3 is a native module: keep it out of the bundle so the
  // route handlers require it at runtime instead.
  serverExternalPackages: ['better-sqlite3'],
}

export default nextConfig
