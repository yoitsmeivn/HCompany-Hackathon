import { usePageTitle } from "@/app/usePageTitle";
import Hero from "@/components/marketing/Hero";
import Features from "@/components/marketing/Features";
import HowItWorks from "@/components/marketing/HowItWorks";
import Security from "@/components/marketing/Security";
import Footer from "@/components/marketing/Footer";

export default function LandingPage() {
  usePageTitle();

  return (
    <>
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
      </main>
      <Footer />
    </>
  );
}
