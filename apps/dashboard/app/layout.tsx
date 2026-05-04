import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tollgate — Agent Control Plane",
  description: "Policy-driven approval layer for AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`h-full dark ${inter.variable}`}>
      <body className="h-full bg-[#0a0a0f] text-[#f8fafc] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
