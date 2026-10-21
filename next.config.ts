import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(isDevelopment ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
      { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data: https://images.unsplash.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}; connect-src 'self' https://*.supabase.co https://api.openai.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
    ] }];
  },
};

export default nextConfig;
