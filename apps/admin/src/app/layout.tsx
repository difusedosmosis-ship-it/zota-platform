import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beautiful Mind Admin",
  description: "Moderation, KYC approvals, and platform operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
