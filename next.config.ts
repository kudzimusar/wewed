import type { NextConfig } from "next";

const OFFICIAL_ORIGIN = "https://wewed.pro";
const productionVercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^https?:\/\//, "").replace(/\/$/, "");
const vercelSuffix = ["vercel", "app"].join(".");

// These are routing-only legacy aliases. They remain here so old bookmarks,
// printed QR destinations, and previously shared links preserve their path
// while moving to the canonical Wewed origin.
const LEGACY_PUBLIC_HOSTS = [
  `wewed-nu.${vercelSuffix}`,
  `wewed-pay-pass-project.${vercelSuffix}`,
  `wewed-git-main-pay-pass-project.${vercelSuffix}`,
] as const;

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
    if (process.env.VERCEL_ENV !== "production") {
      return [];
    }

    const redirectHosts = new Set<string>([
      ...LEGACY_PUBLIC_HOSTS,
      "www.wewed.pro",
    ]);

    if (productionVercelHost && productionVercelHost !== "wewed.pro") {
      redirectHosts.add(productionVercelHost);
    }

    return [...redirectHosts].map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${OFFICIAL_ORIGIN}/:path*`,
      permanent: true,
    }));
  },
};

export default nextConfig;
