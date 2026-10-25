import type { Metadata } from "next";
import "./globals.css";
import PasswordVisibility from "./password-visibility";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://reviewsaathiv1.vercel.app"),
  title: {
    default: "AI Review Assistant for Google Reviews | Review Saathi",
    template: "%s | Review Saathi",
  },
  description: "Use AI to turn real customer experiences into editable Google review drafts, private feedback and stronger local visibility for your business.",
  keywords: [
    "QR code for Google reviews",
    "customer feedback QR code",
    "Google review QR code generator",
    "restaurant review QR code",
    "collect customer feedback",
    "AI review assistant",
    "local business review management",
    "improve Google reviews",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    type: "website",
    siteName: "Review Saathi",
    title: "AI Review Assistant for Google Reviews | Review Saathi",
    description: "Turn real customer experiences into editable Google review drafts and stronger local visibility.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "AI Review Assistant for Google Reviews | Review Saathi",
    description: "Turn real customer experiences into editable Google review drafts and stronger local visibility.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><div className="next-shell"><PasswordVisibility />{children}</div></body></html>;
}
