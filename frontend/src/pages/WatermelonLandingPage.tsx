import Navbar from "../components/landing/navbar";
import Hero from "../components/landing/hero";
import Stats from "../components/landing/stats";
import Features from "../components/landing/features";
import Footer from "../components/landing/footer";

/**
 * The public front door, built from the Watermelon UI landing-01 template.
 *
 * Every claim is one the codebase can back. The template's testimonial and
 * three bento sections are deliberately left out: they carried invented
 * reviews and showcased Watermelon's own component library, neither of which
 * is evidence for Diacify.
 *
 * .landing-shell scopes the Tailwind design tokens so they cannot leak into
 * the plain-CSS signed-in app. See src/tailwind.css.
 */
export function WatermelonLandingPage() {
  return (
    <main className="landing-shell dark bg-background min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <Footer />
    </main>
  );
}
