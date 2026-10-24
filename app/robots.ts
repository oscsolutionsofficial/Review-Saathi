import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reviewsaathiv1.vercel.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/client/", "/admin/", "/api/", "/login", "/onboarding", "/forgot-password", "/change-password"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
