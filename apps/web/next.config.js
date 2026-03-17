/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@amc/shared', '@amc/simulation-engine'],
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
