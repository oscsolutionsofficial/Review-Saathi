import type { Metadata } from "next";
import "./globals.css";
import PasswordVisibility from "./password-visibility";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://reviewsaathiv1.vercel.app"),
  title: {
    default: "Review Saathi | QR Code Google Reviews & Customer Feedback",
    template: "%s | Review Saathi",
  },
  description: "Help local businesses collect honest Google reviews and private customer feedback with one simple QR code. Support multiple languages, locations and reports.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Review Saathi",
    title: "Review Saathi | QR Code Google Reviews & Customer Feedback",
    description: "Collect honest customer feedback and Google reviews with one simple QR code.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Review Saathi | QR Code Google Reviews & Customer Feedback",
    description: "Collect honest customer feedback and Google reviews with one simple QR code.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><div className="next-shell"><PasswordVisibility />{children}</div></body></html>;
}
