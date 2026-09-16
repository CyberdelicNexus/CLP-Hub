import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // 90 is for the landing hero and film poster: soft dark gradients band
    // visibly at the default 75.
    qualities: [75, 90],
  },
};

export default withNextIntl(nextConfig);
