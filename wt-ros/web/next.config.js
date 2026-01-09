/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@wt-ros/common'],
  experimental: {
    optimizePackageImports: ['@mui/icons-material', '@mui/material'],
  },
};

module.exports = nextConfig;
