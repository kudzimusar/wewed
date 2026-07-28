import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    qualities: [75, 85, 90],
  },
  allowedDevOrigins: [
    "*.space-z.ai",
    "*.space-z.dev",
    "preview-chat-*.space-z.ai",
    "localhost",
    "127.0.0.1",
  ],
  serverExternalPackages: [
    "@prisma/client",
    "qrcode",
    "xlsx",
    "papaparse",
    "json2csv",
    "z-ai-web-dev-sdk",
    "socket.io",
    "socket.io-client",
    "sharp",
  ],
};

export default nextConfig;
