/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  // XMTP Browser SDK requires these headers for OPFS (Origin Private File System) support
  // These enable SharedArrayBuffer which XMTP needs for SQLite WASM
  // IMPORTANT: Only apply to /chat to avoid blocking external resources on other pages
  async headers() {
    return [
      {
        source: '/chat',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless', // Less restrictive than require-corp
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
