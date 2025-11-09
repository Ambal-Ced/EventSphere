/** @type {import('next').NextConfig} */
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseHost = "";
try {
  if (supabaseUrl) {
    supabaseHost = new URL(supabaseUrl).hostname;
  }
} catch {}

const nextConfig = {
  reactStrictMode: true,
  compress: true, // Enable gzip compression
  // PPR is enabled by default in Next.js 15 when using Suspense boundaries
  // No experimental flag needed - it works automatically with your current setup
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https",
              hostname: supabaseHost,
              pathname: "/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "localhost",
        pathname: "/**",
      },
    ],
    // Image optimization settings
    formats: ['image/avif', 'image/webp'], // Modern formats for better compression
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048], // Responsive image sizes
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384], // Image sizes for different devices
    qualities: [75, 85, 90, 95, 100], // Configure allowed quality values
    minimumCacheTTL: 60 * 60 * 24 * 30, // Cache images for 30 days
    unoptimized: false, // Keep optimization enabled
    // Optimize images to be under 60KB
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

module.exports = withBundleAnalyzer(nextConfig);
