import type { Metadata } from "next";
import type { Viewport } from "next";
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
  title: "Zota Consumer",
  description: "Zota by Beautiful Mind. Find trusted local services, chats, calls, and bookings fast.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${main.variable} ${code.variable} antialiased`}>{children}</body>
    </html>
  );
}
