import type { ReactNode } from "react";

import {
  ArtAppendOnly,
  ArtDataset,
  ArtFiveValues,
  ArtIsolation,
  ArtTrainedModel,
  ArtVisitHistory,
} from "./illustrations";
import { Container, Headline } from "./primitives";

interface PanelContent {
  label: string;
  art: ReactNode;
  title: string;
  body: string;
}

const STEPS: PanelContent[] = [
  {
    label: "01",
    art: <ArtFiveValues />,
    title: "Type what you measured",
    body: "Five values a consult already produces. Nothing extra to collect.",
  },
  {
    label: "02",
    art: <ArtTrainedModel />,
    title: "A trained model answers",
    body: "A random forest, scored on the server. Never in the browser.",
  },
  {
    label: "03",
    art: <ArtVisitHistory />,
    title: "Every visit stays on file",
    body: "Past verdicts are never overwritten, so you can see what changed and when.",
  },
];

const REASONS: PanelContent[] = [
  {
    label: "Real data",
    art: <ArtDataset />,
    title: "Trained on real patient records",
    body: "A random forest fitted to a real clinical dataset, not a rule of thumb or a lookup table.",
  },
  {
    label: "Privacy",
    art: <ArtIsolation />,
    title: "Your patients stay yours",
    body: "Isolation is enforced by the database itself through row-level security, not by application code a future change could forget.",
  },
  {
    label: "Audit trail",
    art: <ArtAppendOnly />,
    title: "Assessments are append-only",
    body: "A retrained model adds a new verdict. It never silently overwrites a judgement you have already seen.",
  },
];

/** One card: the graphic on its own tinted plate, then the label, heading and
 *  body. Giving the graphic the full width of the card is what makes it read
 *  as an illustration rather than a bullet marker. */
function Panel({
  label,
  art,
  title,
  body,
  tint,
  delayMs,
}: PanelContent & { tint: string; delayMs: number }) {
  return (
    <article
      data-rise
      style={{ animationDelay: `${delayMs}ms` }}
      className="group flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-border transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-28px_rgba(22,40,31,0.5)]"
    >
      <div className={`h-44 overflow-hidden ${tint}`}>
        <div className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]">
          {art}
        </div>
      </div>
      <div className="flex flex-col p-8">
        <span className="text-xs font-medium tracking-wide text-muted-foreground">
          {label}
        </span>
        <h3 className="font-display mt-3 text-[1.75rem] leading-[1.15] tracking-tight text-balance text-foreground">
          {title}
        </h3>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </article>
  );
}

/** The three steps a clinician actually performs, in order. */
export function HowItWorks() {
  return (
    <section className="bg-background py-24 md:py-32">
      <Container>
        <div className="max-w-3xl">
          <div data-rise>
            <Headline>How it works.</Headline>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Panel
              key={step.label}
              {...step}
              tint="bg-secondary"
              delayMs={index * 90}
            />
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
        <div className="max-w-3xl">
          <div data-rise>
            <Headline>Why you can trust the number.</Headline>
          </div>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {REASONS.map((reason, index) => (
            <Panel
              key={reason.label}
              {...reason}
              tint="bg-[#f2f8f4]"
              delayMs={index * 90}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
