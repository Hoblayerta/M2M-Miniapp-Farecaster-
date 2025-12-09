/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
  // NOTE: CORS headers removed because they block XMTP in Farcaster iframes
  // OPFS doesn't work in third-party iframes regardless of headers
  // The browser-sdk will fall back to indexedDB automatically
};

module.exports = nextConfig;
