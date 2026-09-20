import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Every section measures its content against the same column. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 md:px-10 ${className}`}>
      {children}
    </div>
  );
}

/** The arrow that sits in the circle on the end of a call to action. */
function ArrowGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="M12 6l6 6-6 6" />
    </svg>
  );
}

type CallToActionTone = "solid" | "quiet" | "night";

const TONE_CLASSES: Record<CallToActionTone, string> = {
  solid: "bg-primary text-primary-foreground hover:bg-[#0e2a1f]",
  quiet: "bg-card text-foreground ring-1 ring-border hover:bg-secondary",
  night: "bg-night-foreground text-night hover:bg-white",
};

const CIRCLE_CLASSES: Record<CallToActionTone, string> = {
  solid: "bg-primary-foreground/15",
  quiet: "bg-secondary",
  night: "bg-night/10",
};

/** The page's one button shape: a pill with the label and a circled arrow.
 *  Repeating a single, confident shape is what the reference pages do, and it
 *  is why their heroes read as calm rather than busy. */
export function CallToAction({
  to,
  children,
  tone = "solid",
  className = "",
  tabIndex,
}: {
  to: string;
  children: ReactNode;
  tone?: CallToActionTone;
  className?: string;
  tabIndex?: number;
}) {
  return (
    <Link
      to={to}
      tabIndex={tabIndex}
      className={`group inline-flex items-center gap-3 rounded-full py-2 pr-2 pl-6 text-[0.95rem] font-medium transition-colors active:scale-[0.98] ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 ${CIRCLE_CLASSES[tone]}`}
      >
        <ArrowGlyph />
      </span>
    </Link>
  );
}

/** A section headline. Fraunces, set large and tight, is the warm note that
 *  keeps the page from looking like every other product site. */
export function Headline({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-display text-4xl leading-[1.05] tracking-tight text-balance text-foreground md:text-5xl lg:text-6xl ${className}`}
    >
      {children}
    </h2>
  );
}
