import type { NextConfig } from "next";

const OFFICIAL_ORIGIN = "https://wewed.pro";
const productionVercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");

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
  async redirects() {
    if (process.env.VERCEL_ENV !== "production" || !productionVercelHost || productionVercelHost === "wewed.pro") {
      return [];
    }

    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: productionVercelHost }],
        destination: `${OFFICIAL_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
