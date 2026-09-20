import type { ReactNode } from "react";

import {
  IconChecklist,
  IconDatabase,
  IconHistory,
  IconLedger,
  IconModel,
  IconShieldCheck,
} from "../icons";
import { Container, Eyebrow, Headline } from "./primitives";

interface PanelContent {
  label: string;
  icon: ReactNode;
  title: string;
  body: string;
}

const STEPS: PanelContent[] = [
  {
    label: "01",
    icon: <IconChecklist className="h-7 w-7" />,
    title: "Type what you measured",
    body: "Five values a consult already produces. Nothing extra to collect.",
  },
  {
    label: "02",
    icon: <IconModel className="h-7 w-7" />,
    title: "A trained model answers",
    body: "A random forest, scored on the server. Never in the browser.",
  },
  {
    label: "03",
    icon: <IconHistory className="h-7 w-7" />,
    title: "Every visit stays on file",
    body: "Past verdicts are never overwritten, so you can see what changed and when.",
  },
];

const REASONS: PanelContent[] = [
  {
    label: "Real data",
    icon: <IconDatabase className="h-7 w-7" />,
    title: "Trained on real patient records",
    body: "A random forest fitted to a real clinical dataset, not a rule of thumb or a lookup table.",
  },
  {
    label: "Privacy",
    icon: <IconShieldCheck className="h-7 w-7" />,
    title: "Your patients stay yours",
    body: "Isolation is enforced by the database itself through row-level security, not by application code a future change could forget.",
  },
  {
    label: "Audit trail",
    icon: <IconLedger className="h-7 w-7" />,
    title: "Assessments are append-only",
    body: "A retrained model adds a new verdict. It never silently overwrites a judgement you have already seen.",
  },
];

/** One panel in either grid: a quiet label, the icon in its own air, then the
 *  heading and body. The icon is given room rather than tucked beside the
 *  title, which is what stops a card grid reading as a list of bullets. */
function Panel({
  label,
  icon,
  title,
  body,
  delayMs,
}: PanelContent & { delayMs: number }) {
  return (
    <article
      data-rise
      style={{ animationDelay: `${delayMs}ms` }}
      className="flex flex-col rounded-2xl bg-card p-8 ring-1 ring-border"
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="mt-8 text-primary">{icon}</span>
      <h3 className="font-display mt-6 text-2xl leading-tight tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-3 text-[0.975rem] leading-relaxed text-muted-foreground">
        {body}
      </p>
    </article>
  );
}

/** The three steps a clinician actually performs, in order. */
export function HowItWorks() {
  return (
    <section className="bg-background py-24 md:py-32">
      <Container>
        <div className="max-w-2xl">
          <div data-rise>
            <Eyebrow>How it works</Eyebrow>
          </div>
          <div data-rise style={{ animationDelay: "90ms" }}>
            <Headline className="mt-6">Three steps, inside one consult.</Headline>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Panel key={step.label} {...step} delayMs={index * 90} />
          ))}
        </div>
      </Container>
    </section>
  );
}

/** Why the number on the screen deserves to be believed. */
export function WhyTrust() {
  return (
    <section className="bg-secondary py-24 md:py-32">
      <Container>
        <div className="max-w-2xl">
          <div data-rise>
            <Eyebrow>The evidence</Eyebrow>
          </div>
          <div data-rise style={{ animationDelay: "90ms" }}>
            <Headline className="mt-6">Why you can trust the number.</Headline>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {REASONS.map((reason, index) => (
            <Panel key={reason.label} {...reason} delayMs={index * 90} />
          ))}
        </div>
      </Container>
    </section>
  );
}
