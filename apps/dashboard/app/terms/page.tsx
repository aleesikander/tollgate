import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Tollgate",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="https://www.usetollgate.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Tollgate
          </Link>
        </div>

        <h1 className="text-3xl font-semibold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: May 8, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>By creating an account or using Tollgate ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms apply to all users, including individuals and organizations.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
            <p>Tollgate provides a policy and approval layer for AI agents. The Service allows developers to define rules that govern agent actions, require human approval for sensitive operations, and maintain an audit trail of agent activity. Tollgate does not itself execute agent actions — it evaluates and approves or blocks them.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials and API keys. You must notify us immediately at support@usetollgate.com if you suspect unauthorized access. Each API key is scoped to a single agent and must not be shared across agents.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violate any applicable law or regulation</li>
              <li>Transmit malicious code or interfere with the Service's infrastructure</li>
              <li>Attempt to gain unauthorized access to other users' data</li>
              <li>Reverse engineer or extract proprietary algorithms from the Service</li>
              <li>Use the Service to process data you do not have rights to process</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. API Keys and Security</h2>
            <p>API keys are generated at agent creation and displayed once. You are solely responsible for storing keys securely. Tollgate cannot recover lost keys — a new key must be generated. Any actions taken using your API keys are your responsibility.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Data and Privacy</h2>
            <p>By using the Service, you grant Tollgate a limited license to process data submitted through the Service solely to provide the Service. Action payloads, policy definitions, and audit logs are stored in accordance with our <Link href="/privacy" className="text-primary hover:opacity-80">Privacy Policy</Link>. You retain ownership of all data you submit.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Service Availability</h2>
            <p>We aim for high availability but do not guarantee uninterrupted access. The Service is provided "as is." We are not liable for downtime, data loss, or interruptions. We recommend configuring <code className="text-xs bg-white/10 px-1 py-0.5 rounded">fail_open</code> mode appropriately for your production agents.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, Tollgate shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to actions taken or blocked by agents operating under your policies. You are responsible for testing your policies before deploying agents to production.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Intellectual Property</h2>
            <p>The Service, including its software, design, and documentation, is owned by Tollgate. You retain all rights to your policies, agent configurations, and data. Nothing in these Terms transfers ownership of either party's intellectual property.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Termination</h2>
            <p>You may delete your account at any time. We may suspend or terminate accounts that violate these Terms. Upon termination, your data may be deleted after a 30-day grace period. We will make reasonable efforts to notify you before termination except in cases of severe violation.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">11. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Material changes will be communicated via email to your registered address. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">12. Contact</h2>
            <p>Questions about these Terms? Email us at <a href="mailto:support@usetollgate.com" className="text-primary hover:opacity-80">support@usetollgate.com</a>.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
