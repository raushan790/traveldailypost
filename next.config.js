/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.traveldailypost.com',
      },
    ],
    // NOTE: `unoptimized: true` is required for static export (`output: 'export'`)
    // when using remote images. Next.js image optimization API routes are not
    // available in static HTML exports. To enable optimization, either:
    //   1. Remove `output: 'export'` and use the default Node.js server, OR
    //   2. Replace `next/image` with native `<img>` tags + native lazy loading
    unoptimized: true,
  },

};

module.exports = nextConfig;