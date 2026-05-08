import { notFound } from "next/navigation";
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from "fumadocs-ui/page";
import { source } from "@/lib/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { HowItWorksFlow } from "@/components/HowItWorksFlow";
import { QuickstartStepper } from "@/components/QuickstartStepper";
import { PolicyEvalFlow } from "@/components/PolicyEvalFlow";
import { ApiLifecycle } from "@/components/ApiLifecycle";
import { SlackApprovalFlow } from "@/components/SlackApprovalFlow";
import { SlackMessageDemo } from "@/components/SlackMessageDemo";
import { AuditLogDemo } from "@/components/AuditLogDemo";

interface Props {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            Tab,
            Tabs,
            Callout,
            Card,
            Cards,
            HowItWorksFlow,
            QuickstartStepper,
            PolicyEvalFlow,
            ApiLifecycle,
            SlackApprovalFlow,
            SlackMessageDemo,
            AuditLogDemo,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  return { title: page.data.title };
}
