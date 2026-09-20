import { Link } from "react-router-dom";

import { CallToAction, Container } from "./primitives";

/** The last ask before the footer, on its own dark panel so it reads as an
 *  ending rather than one more section. */
export function ClosingCallToAction() {
  return (
    <section className="bg-background px-6 pb-24 md:px-10 md:pb-32">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-primary px-8 py-20 text-center md:px-16 md:py-28">
        <h2
          data-rise
          className="font-display mx-auto max-w-2xl text-4xl leading-[1.05] tracking-tight text-balance text-primary-foreground md:text-6xl"
        >
          Screen your next patient in under a minute.
        </h2>
        <p
          data-rise
          style={{ animationDelay: "90ms" }}
          className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-pretty text-primary-foreground/70"
        >
          No setup, no data import. Create an account and record your first
          visit.
        </p>
        <div
          data-rise
          style={{ animationDelay: "180ms" }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <CallToAction to="/signup" tone="night">
            Get started
          </CallToAction>
          <Link
            to="/signin"
            className="link-underline rounded-full px-6 py-3.5 text-[0.95rem] font-medium text-primary-foreground/70 transition-colors hover:text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

const PRODUCT_LINKS = [
  { label: "Create account", to: "/signup" },
  { label: "Sign in", to: "/signin" },
];

const ENGINEERING_LINKS = [
  { label: "Architecture guide", href: "/docs" },
  { label: "Source", href: "https://github.com/deshanekanayaka/diacify" },
];

/** The site footer. Every link points at a route or a page that exists: a
 *  column of legal and social links Diacify does not have would read worse
 *  than a short footer. */
export function Footer() {
  return (
    <footer className="bg-night text-night-foreground">
      <Container className="py-20">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="max-w-sm">
            <span className="font-display text-2xl tracking-tight">
              Diacify
            </span>
            <p className="mt-4 text-[0.975rem] leading-relaxed text-night-muted">
              Diabetes risk classification from the five values a consult
              already measures, scored on the server and kept visit by visit.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-wide text-night-muted">
              Product
            </h3>
            <ul className="mt-5 list-none space-y-3 p-0">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="link-underline text-[0.975rem] text-night-foreground/80 transition-colors hover:text-night-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-medium tracking-wide text-night-muted">
              Engineering
            </h3>
            <ul className="mt-5 list-none space-y-3 p-0">
              {ENGINEERING_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="link-underline text-[0.975rem] text-night-foreground/80 transition-colors hover:text-night-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 border-t border-night-border pt-8 text-sm text-night-muted">
          © 2026 Diacify
        </div>
      </Container>
    </footer>
  );
}
