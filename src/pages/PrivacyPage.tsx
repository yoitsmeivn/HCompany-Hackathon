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

export default function PrivacyPage() {
  usePageTitle("Privacy Policy");

  return (
    <>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "44px 28px 72px" }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Kylian Privacy Policy
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--k-faint)" }}>
          Last updated: July 2026
        </p>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: 13.5,
            color: "var(--k-muted)",
            lineHeight: 1.7,
          }}
        >
          Kylian provides conversational and task-related assistance through voice, SMS, web
          chat, and computer-access workflows. This Privacy Policy describes the information
          Kylian collects, how it is used, and the choices available to you.
        </p>

        <Section title="Information we may collect">
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>Mobile phone number</li>
            <li>Messages sent to and from Kylian</li>
            <li>Voice-call transcripts and session events</li>
            <li>Computer-task requests and results</li>
            <li>Device, session, and diagnostic information needed to operate the service</li>
          </ul>
        </Section>

        <Section title="How information is used">
          <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>To provide conversational assistance</li>
            <li>To process user-requested computer tasks</li>
            <li>
              To send clarification questions, approval requests, status updates, and completion
              messages
            </li>
            <li>To maintain safety, prevent abuse, and improve reliability</li>
          </ul>
        </Section>

        <Section title="SMS and mobile data">
          <p style={{ margin: 0 }}>
            Mobile information and SMS consent data will not be sold, rented, or shared with
            third parties or affiliates for marketing or promotional purposes.
          </p>
        </Section>

        <Section title="Message frequency">
          <p style={{ margin: 0 }}>
            Message frequency varies depending on user activity and requested tasks.
          </p>
        </Section>

        <Section title="Rates">
          <p style={{ margin: 0 }}>Message and data rates may apply.</p>
        </Section>

        <Section title="Opt-out">
          <p style={{ margin: 0 }}>Reply STOP to opt out of SMS messages.</p>
        </Section>

        <Section title="Help">
          <p style={{ margin: 0 }}>Reply HELP for assistance.</p>
        </Section>

        <Section title="Service providers">
          <p style={{ margin: 0 }}>
            Kylian may use service providers such as telecommunications, hosting, speech, and AI
            infrastructure providers only as needed to operate the service.
          </p>
        </Section>

        <Section title="Data security">
          <p style={{ margin: 0 }}>
            Reasonable technical and organizational safeguards are used to protect information,
            but no system can guarantee absolute security.
          </p>
        </Section>

        <Section title="Data retention">
          <p style={{ margin: 0 }}>
            Information is retained only as long as reasonably necessary to provide the service,
            comply with legal obligations, and resolve disputes.
          </p>
        </Section>

        <Section title="User choices">
          <p style={{ margin: 0 }}>
            You may request access, correction, or deletion of your information by contacting
            the email below.
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
          <Link to="/terms" style={{ color: "var(--k-muted)" }}>
            Terms and Conditions
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
