/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["bullmq", "ioredis", "pdf-parse", "exceljs"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        "@valkey/valkey-glide": "commonjs @valkey/valkey-glide",
      });
    }
    return config;
  },
};

export default nextConfig;
