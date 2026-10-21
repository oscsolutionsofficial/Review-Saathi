import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Review Saathi",
  description: "Authentic customer reviews for local businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><div className="next-shell">{children}</div></body></html>;
}
