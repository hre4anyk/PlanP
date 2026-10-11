import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // Allow the Base44 preview proxy origin to load dev assets / HMR.
  // Only active in the sandbox; has no effect in normal local dev.
  ...(process.env.BASE44_PREVIEW_MODE === "1" && process.env.BASE44_PUBLIC_HOST_SUFFIX
    ? { allowedDevOrigins: [`3000-${process.env.BASE44_PUBLIC_HOST_SUFFIX}`] }
    : {}),
};

export default nextConfig;
