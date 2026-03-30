import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const main = Space_Grotesk({
  variable: "--font-main",
  subsets: ["latin"],
});

const code = JetBrains_Mono({
  variable: "--font-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Zota Vendor",
  description: "Zota by Beautiful Mind. Manage onboarding, KYC, conversations, calls, and service operations.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${main.variable} ${code.variable} antialiased`}>{children}</body>
    </html>
  );
}
