import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/app/usePageTitle";
import Footer from "@/components/marketing/Footer";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <div style={{ marginTop: 8, fontSize: 13.5, color: "var(--k-muted)", lineHeight: 1.7 }}>
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  usePageTitle("Terms and Conditions");

  return (
    <>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "44px 28px 72px" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Kylian Terms and Conditions
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--k-faint)" }}>
          Last updated: July 2026
        </p>

        <Section title="Service description">
          <p style={{ margin: 0 }}>
            Kylian is a remote personal computer assistant that can provide conversational
            support and help users access, understand, navigate, organize, and operate their
            computers.
          </p>
        </Section>

        <Section title="SMS consent">
          <p style={{ margin: 0 }}>
            By opting in, you agree to receive conversational, support, approval-request,
            task-status, and task-completion SMS messages from Kylian.
          </p>
        </Section>

        <Section title="Message frequency">
          <p style={{ margin: 0 }}>Message frequency varies.</p>
        </Section>

        <Section title="Rates">
          <p style={{ margin: 0 }}>Message and data rates may apply.</p>
        </Section>

        <Section title="Opt-out">
          <p style={{ margin: 0 }}>Reply STOP to unsubscribe.</p>
        </Section>

        <Section title="Help">
          <p style={{ margin: 0 }}>Reply HELP for assistance.</p>
        </Section>

        <Section title="Optional consent">
          <p style={{ margin: 0 }}>
            Consent to receive SMS messages is not required to use Kylian's primary service.
          </p>
        </Section>

        <Section title="Automated systems">
          <p style={{ margin: 0 }}>
            Kylian may use automated systems and artificial intelligence to generate responses
            and assist with user-requested tasks.
          </p>
        </Section>

        <Section title="User responsibility">
          <p style={{ margin: 0 }}>
            You are responsible for reviewing and approving sensitive, destructive, financial,
            private, irreversible, or externally visible actions before they are completed.
          </p>
        </Section>

        <Section title="No guaranteed results">
          <p style={{ margin: 0 }}>
            Kylian does not guarantee that every request will be completed successfully or that
            all generated responses will be error-free.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p style={{ margin: 0 }}>
            You may not use Kylian for unlawful, abusive, deceptive, harmful, or unauthorized
            activity.
          </p>
        </Section>

        <Section title="Availability">
          <p style={{ margin: 0 }}>
            The service may be changed, interrupted, or discontinued at any time.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p style={{ margin: 0 }}>
            To the maximum extent permitted by law, Kylian and its operator are not liable for
            indirect, incidental, special, consequential, or punitive damages arising from use
            of the service.
          </p>
        </Section>

        <Section title="Changes">
          <p style={{ margin: 0 }}>
            These terms may be updated from time to time. Continued use after updates
            constitutes acceptance of the revised terms.
          </p>
        </Section>

        <Section title="Contact">
          <p style={{ margin: 0 }}>
            <a href="mailto:ivan@soartravel.app" style={{ color: "var(--k-ink)" }}>
              ivan@soartravel.app
            </a>
          </p>
        </Section>

        <nav
          style={{
            marginTop: 40,
            paddingTop: 18,
            borderTop: "1px solid var(--k-border-soft)",
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            fontSize: 12.5,
          }}
        >
          <Link to="/privacy" style={{ color: "var(--k-muted)" }}>
            Privacy Policy
          </Link>
          <Link to="/" style={{ color: "var(--k-muted)" }}>
            Back to Kylian
          </Link>
        </nav>
      </main>
      <Footer />
    </>
  );
}
