import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <Logo size="sm" variant="full" />,
        url: process.env.NEXT_PUBLIC_LANDING_URL ?? "https://www.usetollgate.com",
      }}
    >
      {children}
    </DocsLayout>
  );
}
