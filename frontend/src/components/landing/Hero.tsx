import { CallToAction, Container, Eyebrow } from "./primitives";

/**
 * The painted ground behind the hero: a warm sky that settles into soft green
 * hills along the bottom edge.
 *
 * It is drawn rather than photographed. A stock landscape behind a clinical
 * tool would be borrowed atmosphere, and it would cost a megabyte; three
 * gradients and two curves cost nothing and stay sharp at any width.
 */
function PaintedSky() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--sky-high)_0%,var(--sky-high)_35%,var(--sky-low)_100%)]" />

      {/* Two soft lights, low and wide, the way afternoon sits on a horizon. */}
      <div className="absolute top-[45%] left-1/2 h-[60rem] w-[90rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0)_65%)]" />
      <div className="absolute top-[30%] left-[15%] h-[32rem] w-[48rem] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(211,234,217,0.55)_0%,rgba(211,234,217,0)_70%)]" />

      {/* The hills. Three bands, back to front, each a little greener. */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[46%] w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 190 C 240 120, 420 220, 720 170 C 1020 120, 1220 210, 1440 160 L1440 320 L0 320 Z"
          fill="#dcefe2"
        />
        <path
          d="M0 240 C 260 180, 500 260, 780 220 C 1060 180, 1260 250, 1440 215 L1440 320 L0 320 Z"
          fill="#c4e4ce"
        />
        <path
          d="M0 285 C 300 245, 560 300, 860 270 C 1120 244, 1300 292, 1440 272 L1440 320 L0 320 Z"
          fill="var(--field)"
        />
      </svg>

      {/* The field dissolves into the next section's cream. Without this the
          hero ends on a hard green line straight across the page. */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_bottom,rgba(251,249,243,0)_0%,var(--background)_92%)]" />
    </div>
  );
}

/**
 * The public front door.
 *
 * Every claim here is one the codebase can back: no screenshots, testimonials
 * or usage counts standing in for evidence that does not exist yet.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[42rem] items-center overflow-hidden pt-36 pb-40 md:min-h-[46rem] lg:min-h-screen">
      <PaintedSky />

      <Container className="relative z-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div data-rise style={{ animationDelay: "0ms" }}>
            <Eyebrow>At the point of care</Eyebrow>
          </div>

          <h1
            data-rise
            style={{ animationDelay: "90ms" }}
            className="font-display mt-8 text-[2.75rem] leading-[1.02] tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl"
          >
            Diabetes risk classification, before the patient leaves the
            room.
          </h1>

          <p
            data-rise
            style={{ animationDelay: "180ms" }}
            className="mt-8 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground"
          >
            Trained on real patient records. Scored in seconds. Every visit
            kept.
          </p>

          <div data-rise style={{ animationDelay: "270ms" }} className="mt-10">
            <CallToAction to="/signup">Get started</CallToAction>
          </div>
        </div>
      </Container>
    </section>
  );
}
