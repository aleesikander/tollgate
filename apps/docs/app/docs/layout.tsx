import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { Logo } from "@tollgate/ui";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <Logo size="sm" variant="full" />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
