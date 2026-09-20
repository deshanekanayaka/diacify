import { PaintedField } from "../PaintedField";
import { CallToAction, Container } from "./primitives";

/**
 * The public front door.
 *
 * Every claim here is one the codebase can back: no screenshots, testimonials
 * or usage counts standing in for evidence that does not exist yet.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[42rem] items-center overflow-hidden pt-36 pb-40 md:min-h-[46rem] lg:min-h-screen">
      <PaintedField />

      {/* The field dissolves into the next section's cream. Without this the
          hero ends on a hard green line straight across the page. It lives
          here rather than in PaintedField because the auth panel has its own
          edge and must not fade out. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_bottom,rgba(251,249,243,0)_0%,var(--background)_92%)]" />

      <Container className="relative z-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1
            data-rise
            className="font-serif text-[2.75rem] leading-[1.02] tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl"
          >
            Diabetes risk classification, before the patient leaves the
            room.
          </h1>

          <p
            data-rise
            style={{ animationDelay: "90ms" }}
            className="mt-8 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground"
          >
            Trained on real patient records. Scored in seconds. Every visit
            kept.
          </p>

          <div data-rise style={{ animationDelay: "180ms" }} className="mt-10">
            <CallToAction to="/signup">Get started</CallToAction>
          </div>
        </div>
      </Container>
    </section>
  );
}
