import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { CallToAction, Container } from "./primitives";

/** Reading position past which the bar stops being transparent, in pixels.
 *  Roughly one thumb of scroll: enough that it is a deliberate move, not a
 *  flicker on a trackpad nudge. */
const SOLID_AFTER_PX = 24;

/** Reading position past which the bar grows its own call to action. Set
 *  below the fold so the pill only appears once the hero's button has gone:
 *  two identical buttons on one screen is one button too many. */
const CALL_TO_ACTION_AFTER_PX = 560;

/**
 * The public top bar. It floats over the hero's painted sky and only grows a
 * surface once you scroll, which is what keeps the hero feeling open.
 *
 * There is no centre navigation. Diacify has no marketing pages to point at,
 * and inventing a Features and Pricing menu that goes nowhere would be worse
 * than the space it fills.
 */
export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showsCallToAction, setShowsCallToAction] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SOLID_AFTER_PX);
      setShowsCallToAction(window.scrollY > CALL_TO_ACTION_AFTER_PX);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "border-b border-border bg-background/80 py-3 backdrop-blur-md"
          : "border-b border-transparent py-5"
      }`}
    >
      <Container className="flex items-center justify-between">
        <Link
          to="/"
          className="font-display text-xl tracking-tight text-foreground"
        >
          Diacify
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/signin"
            className="link-underline rounded-full px-5 py-2.5 text-[0.95rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <div
            className={`transition-all duration-500 ${
              showsCallToAction
                ? "translate-x-0 opacity-100"
                : "pointer-events-none translate-x-3 opacity-0"
            }`}
            aria-hidden={!showsCallToAction}
          >
            <CallToAction to="/signup" tabIndex={showsCallToAction ? 0 : -1}>
              Get started
            </CallToAction>
          </div>
        </div>
      </Container>
    </header>
  );
}
