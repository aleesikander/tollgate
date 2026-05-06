"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@tollgate/ui";

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:3002";
const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3001";

const NAV_LINKS = [
  { label: "Docs", href: `${DOCS_URL}/docs` },
  { label: "Pricing", href: "#pricing" },
  { label: "Company", href: "#company" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-page/80 backdrop-blur-md border-b border-border-subtle">
        <div className="mx-auto max-w-[1140px] px-6 md:px-8 h-[60px] flex items-center justify-between">
          {/* Left: logo */}
          <a href="/" aria-label="Tollgate home" className="shrink-0">
            <Logo size="md" variant="full" />
          </a>

          {/* Center: desktop nav links */}
          <ul className="hidden md:flex items-center gap-8 list-none absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ label, href }) => (
              <li key={label}>
                <a
                  href={href}
                  className="text-body-md text-secondary hover:text-primary transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>

          {/* Right: two-button group + hamburger */}
          <div className="flex items-center gap-2">
            <a
              href={`${DASHBOARD_URL}/login`}
              className="hidden md:block border border-border-default text-secondary px-4 py-2 rounded-tg-md text-body-md font-medium hover:text-primary hover:border-border-strong transition-colors"
            >
              Sign in
            </a>
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="hidden md:block bg-accent text-primary px-4 py-2 rounded-tg-md text-body-md font-medium hover:opacity-90 transition-opacity"
            >
              Get started
            </a>
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              className="md:hidden flex items-center justify-center w-9 h-9 text-secondary hover:text-primary transition-colors"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 top-[60px] bg-page z-40 md:hidden flex flex-col px-6 pt-8 gap-6">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              className="text-heading-md text-primary"
            >
              {label}
            </a>
          ))}
          <hr className="border-border-subtle" />
          <a href={`${DASHBOARD_URL}/login`} className="text-heading-md text-secondary">
            Sign in
          </a>
          <a
            href={`${DASHBOARD_URL}/signup`}
            className="bg-accent text-primary px-[15px] py-[11px] rounded-tg-md text-body-lg font-medium text-center"
          >
            Get started
          </a>
        </div>
      )}
    </>
  );
}
