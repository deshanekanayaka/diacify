import { useRef } from "react";

import { ClosingCallToAction, Footer } from "../components/landing/Closing";
import { Hero } from "../components/landing/Hero";
import { Navbar } from "../components/landing/Navbar";
import { HowItWorks, WhyTrust } from "../components/landing/Sections";
import { useRevealOnScroll } from "../components/landing/useRevealOnScroll";

/**
 * The public front door.
 *
 * .landing-shell scopes the page's design tokens so they cannot leak into the
 * plain-CSS signed-in app. The landing page is soft and pill-shaped where the
 * app is square: see src/tailwind.css for why that split is deliberate.
 */
export function LandingPage() {
  const shell = useRef<HTMLDivElement>(null);
  useRevealOnScroll(shell);

  return (
    <div
      ref={shell}
      className="landing-shell min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased"
    >
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <WhyTrust />
        <ClosingCallToAction />
      </main>
      <Footer />
    </div>
  );
}
