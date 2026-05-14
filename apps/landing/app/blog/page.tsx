import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const POST = {
  title:
    "How we added human-in-the-loop approval to OpenAI's customer service agent",
  date: "May 14, 2026",
  readTime: "5 min read",
  description:
    "A step-by-step walkthrough of integrating tollgate with OpenAI's open-source CS agents demo — from cloning the repo to Slack approvals firing in production.",
  href: "/blog/openai-cs-agent-integration",
};

export default function BlogIndex() {
  return (
    <>
      <Nav />
      <main className="pt-[60px]">
        <div className="mx-auto max-w-[1140px] px-6 md:px-8 py-20 md:py-28">
          <div className="mb-16">
            <p className="text-micro uppercase tracking-[0.1em] mb-4 text-tertiary">
              From the team
            </p>
            <h1
              className="font-semibold leading-[1.05] tracking-[-0.025em]"
              style={{ fontSize: 40 }}
            >
              Blog
            </h1>
          </div>

          <div className="border-t border-border-subtle">
            <a
              href={POST.href}
              className="group flex flex-col md:flex-row md:items-start gap-6 md:gap-12 py-10 border-b border-border-subtle -mx-4 px-4 rounded transition-colors hover:bg-white/[0.018]"
            >
              <div className="flex flex-col gap-3 flex-1 min-w-0">
                <h2
                  className="font-semibold leading-snug transition-colors group-hover:text-primary"
                  style={{ fontSize: 18, color: "rgba(255,255,255,0.85)" }}
                >
                  {POST.title}
                </h2>
                <p
                  className="text-body-md leading-[1.75]"
                  style={{ color: "rgba(255,255,255,0.45)" }}
                >
                  {POST.description}
                </p>
              </div>
              <div className="flex md:flex-col items-start md:items-end gap-3 md:gap-2 shrink-0 md:pt-1">
                <span className="text-body-sm text-tertiary whitespace-nowrap">
                  {POST.date}
                </span>
                <span className="text-body-sm text-quaternary whitespace-nowrap">
                  {POST.readTime}
                </span>
              </div>
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
