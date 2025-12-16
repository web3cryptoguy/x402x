/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Add headers to handle CSP for webpack dev mode and third-party libraries
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            // Allow unsafe-eval only in development for webpack and wagmi/viem
            // In production, this should be removed or restricted
            value: isDev
              ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
              : "script-src 'self' 'unsafe-inline' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' https: wss: ws:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, dev }) => {
    // Ignore React Native and Node.js modules in web environment
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'encoding': false,
        'pino-pretty': false,
      };
      // In development, use 'cheap-module-source-map' instead of 'eval' to avoid CSP issues
      // This provides source maps without using eval()
      if (dev && config.devtool === 'eval') {
        config.devtool = 'cheap-module-source-map';
      }
    }
    // Also ignore these modules in server-side rendering
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'encoding': false,
      'pino-pretty': false,
    };
    return config;
  },
}

module.exports = nextConfig

