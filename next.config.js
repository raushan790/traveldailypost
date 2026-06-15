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
    unoptimized: true,
  },

};

module.exports = nextConfig;