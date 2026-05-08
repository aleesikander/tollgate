import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Tollgate",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f8fafc]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="https://www.usetollgate.com" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Tollgate
          </Link>
        </div>

        <h1 className="text-3xl font-semibold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: May 8, 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-muted-foreground leading-relaxed">

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">1. What We Collect</h2>
            <p>We collect only what is necessary to operate the Service:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Account data</strong> — your email address, hashed password, and organization name</li>
              <li><strong className="text-foreground">Agent data</strong> — agent names and hashed API keys</li>
              <li><strong className="text-foreground">Policy data</strong> — the YAML policies you write and save</li>
              <li><strong className="text-foreground">Action data</strong> — every call to <code className="text-xs bg-white/10 px-1 py-0.5 rounded">tg.check()</code>, including action name, payload, decision, and timestamp</li>
              <li><strong className="text-foreground">Slack integration data</strong> — workspace name, team ID, and encrypted OAuth token if you connect Slack</li>
              <li><strong className="text-foreground">Usage data</strong> — basic request logs for debugging and reliability</li>
            </ul>
            <p>We do not collect payment information directly (we have no billing system yet). We do not sell your data to third parties.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To authenticate you and operate your account</li>
              <li>To evaluate your policies against agent actions in real time</li>
              <li>To send approval notifications to Slack on your behalf</li>
              <li>To send transactional emails (password resets) via Resend</li>
              <li>To display your audit log and dashboard statistics</li>
              <li>To diagnose errors and improve reliability</li>
            </ul>
            <p>We do not use your action payloads or policy data to train machine learning models.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">3. Data Storage and Security</h2>
            <p>Your data is stored in a PostgreSQL database hosted on Railway in the United States. Slack OAuth tokens are encrypted at rest using AES-256. API keys are stored as HMAC hashes — we cannot recover plaintext keys. Passwords are hashed using bcrypt.</p>
            <p>We use HTTPS for all data in transit. Access to production infrastructure is restricted to authorized personnel.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">4. Third-Party Services</h2>
            <p>We use the following third-party services to operate Tollgate:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Railway</strong> — API hosting and database (United States)</li>
              <li><strong className="text-foreground">Vercel</strong> — frontend hosting (global CDN)</li>
              <li><strong className="text-foreground">Resend</strong> — transactional email delivery</li>
              <li><strong className="text-foreground">Slack</strong> — approval notifications (only if you connect your workspace)</li>
            </ul>
            <p>Each of these services has their own privacy policies governing their handling of data.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">5. Action Payload Data</h2>
            <p>When your agent calls <code className="text-xs bg-white/10 px-1 py-0.5 rounded">tg.check()</code>, the payload you pass is stored in our database as part of the audit record. Do not pass sensitive personal data (passwords, full credit card numbers, SSNs) as action payloads. Use anonymized identifiers (e.g. <code className="text-xs bg-white/10 px-1 py-0.5 rounded">customer_id</code>) instead of raw PII.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you delete your account, your data is permanently deleted within 30 days. Audit log entries are retained for 12 months by default. We do not currently offer configurable retention periods, but plan to.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access the data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Export your audit log data</li>
            </ul>
            <p>To exercise any of these rights, email <a href="mailto:support@usetollgate.com" className="text-primary hover:opacity-80">support@usetollgate.com</a>.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">8. Cookies</h2>
            <p>We do not use tracking cookies. The dashboard uses localStorage to store your authentication token. No third-party analytics or advertising cookies are set.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy as the Service evolves. Material changes will be communicated via email. The "last updated" date at the top of this page reflects the most recent revision.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
            <p>Privacy questions or concerns? Email <a href="mailto:support@usetollgate.com" className="text-primary hover:opacity-80">support@usetollgate.com</a>.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
