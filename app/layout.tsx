import type { Metadata } from "next";
import "./globals.css";
import PasswordVisibility from "./password-visibility";

export const metadata: Metadata = {
  title: "Review Saathi",
  description: "Authentic customer reviews for local businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning><div className="next-shell"><PasswordVisibility />{children}</div></body></html>;
}
