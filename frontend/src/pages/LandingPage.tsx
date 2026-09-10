import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Wordmark } from "../components/Wordmark";
import {
  IconArrowRight,
  IconChecklist,
  IconDatabase,
  IconHistory,
  IconLedger,
  IconModel,
  IconShieldCheck,
} from "../components/icons";

/**
 * The public front door. Every claim here is one the codebase can back:
 * PRODUCT.md forbids standing in evidence (screenshots, testimonials, demo
 * data) that does not exist yet, so the page argues from what was built,
 * with no hero graphic standing in for evidence that doesn't exist —
 * headline, subhead, and CTA carry the hero on their own.
 */
const HOW_IT_WORKS = [
  {
    label: "01 · Input",
    icon: <IconChecklist />,
    title: "Type what you measured",
    body: "Five values a consult already produces. Nothing extra to collect.",
  },
  {
    label: "02 · Model",
    icon: <IconModel />,
    title: "A trained model answers",
    body: "A random forest, scored server-side. Never in the browser.",
  },
  {
    label: "03 · History",
    icon: <IconHistory />,
    title: "Every visit stays on file",
    body: "Past verdicts are never overwritten, so you can see what changed and when.",
  },
];

const WHY_TRUST_IT = [
  {
    label: "Real data",
    icon: <IconDatabase />,
    title: "Trained on real patient records",
    body: "A random forest fitted to a real clinical dataset, not a rule of thumb or a lookup table.",
    highlight: true,
  },
  {
    label: "Privacy",
    icon: <IconShieldCheck />,
    title: "Your patients stay yours",
    body: "Isolation is enforced by the database itself through row-level security, not application code.",
  },
  {
    label: "Audit trail",
    icon: <IconLedger />,
    title: "Assessments are append-only",
    body: "A retrained model adds a new verdict. It never silently overwrites a judgement you've already seen.",
  },
];

export function LandingPage() {
  return (
    <>
      <header className="topbar">
        <Wordmark />
        <span className="spacer" />
        <Link to="/signin" className="btn btn--quiet">
          Sign in
        </Link>
        <Link to="/signup" className="btn">
          Get started
        </Link>
      </header>

      <main className="page">
        <section className="hero">
          <h1 className="t-display">
            Diabetes risk classification, <span className="t-display--muted">before the patient</span>{" "}
            leaves the room.
          </h1>
          <p className="t-body hero__subhead">
            Trained on real patient records. Scored in seconds. Every visit kept.
          </p>
          <Link to="/signup" className="btn btn--large">
            Get started
            <IconArrowRight />
          </Link>
        </section>

        <h2 className="t-title" style={{ marginBottom: "1.5rem" }}>
          Three fields, one answer.
        </h2>
        <div className="tiles">
          {HOW_IT_WORKS.map((tile) => (
            <FeatureTile key={tile.label} {...tile} />
          ))}
        </div>

        <h2 className="t-title" style={{ margin: "3.5rem 0 1.5rem", textAlign: "center" }}>
          Why you can trust the number.
        </h2>
        <div className="tiles">
          {WHY_TRUST_IT.map((tile) => (
            <FeatureTile key={tile.label} {...tile} />
          ))}
        </div>

        <section style={{ textAlign: "center", padding: "3.5rem 0 2rem" }}>
          <h2 className="t-title" style={{ marginBottom: "1.5rem" }}>
            Ready to try it?
          </h2>
          <Link to="/signup" className="btn btn--large">
            Get started
          </Link>
        </section>

        <footer className="site-footer">
          <Wordmark />
          <span className="t-caption">© 2026 Diacify · Not a diagnostic device</span>
        </footer>
      </main>
    </>
  );
}

interface FeatureTileProps {
  label: string;
  icon: ReactNode;
  title: string;
  body: string;
  highlight?: boolean;
}

/** One feature tile: a labelled rule, a bare icon in its own whitespace, then heading and body. */
function FeatureTile({ label, icon, title, body, highlight }: FeatureTileProps) {
  return (
    <div className={`tile${highlight ? " tile--highlight" : ""}`}>
      <span className="tile__label">{label}</span>
      <div className="tile__icon-zone">{icon}</div>
      <h3 className="t-section" style={{ marginBottom: "0.5rem" }}>
        {title}
      </h3>
      <p className="t-body">{body}</p>
    </div>
  );
}
