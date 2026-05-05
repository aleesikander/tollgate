import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tollgate",
  description:
    "The policy and approval layer for AI agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-page text-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
