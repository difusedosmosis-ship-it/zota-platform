import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zota Business",
  description: "Zota by Beautiful Mind. Manage onboarding, KYC, conversations, calls, and service operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
