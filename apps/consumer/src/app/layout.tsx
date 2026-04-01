import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zota",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
