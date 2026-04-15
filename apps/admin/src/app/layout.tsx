import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zota Office",
  description: "Operations, verification, governance, and finance across Zota.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
