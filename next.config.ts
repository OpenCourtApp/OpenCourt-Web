import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow loading dev resources (HMR, etc.) when the app is opened from the
  // machine's LAN IP instead of localhost. Next 16 blocks these by default.
  allowedDevOrigins: ['192.168.0.6'],
};

export default nextConfig;
