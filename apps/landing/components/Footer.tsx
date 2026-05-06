import { Logo } from "@/components/Logo";

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3002";
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const COLS = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "Roadmap", href: "/roadmap" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "Documentation", href: `${DOCS_URL}/docs` },
      { label: "Python SDK", href: `${DOCS_URL}/docs/sdks/python` },
      { label: "TypeScript SDK", href: `${DOCS_URL}/docs/sdks/typescript` },
      { label: "API reference", href: `${DOCS_URL}/docs/api-reference` },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle py-16">
      <div className="mx-auto max-w-[1140px] px-6 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 mb-14">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Logo size="sm" variant="full" />
            <p className="text-body-sm text-tertiary max-w-[200px] leading-[1.65]">
              The policy and approval layer for AI agents.
            </p>
            <a
              href="mailto:hello@usetollgate.com"
              className="text-body-sm text-secondary hover:text-primary transition-colors"
            >
              hello@usetollgate.com
            </a>
          </div>

          {/* Link columns */}
          {COLS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-4">
              <p className="text-micro uppercase text-tertiary tracking-[0.04em]">
                {col.heading}
              </p>
              <ul className="flex flex-col gap-3 list-none">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-body-sm text-secondary hover:text-primary transition-colors"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 pt-8 border-t border-border-subtle">
          <p className="text-body-sm text-quaternary">
            © {new Date().getFullYear()} Tollgate, Inc.
          </p>
          <p className="text-body-sm text-quaternary">
            Built for teams that ship agents.
          </p>
        </div>
      </div>
    </footer>
  );
}
