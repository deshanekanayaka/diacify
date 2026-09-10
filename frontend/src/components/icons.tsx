/**
 * The line-icon set used inside feature tiles. Kept as one file rather than
 * an icon-library dependency — a handful of icons don't earn a package,
 * and inlining them as SVG means no extra request, no sprite build step.
 *
 * A thinner stroke (1.3) than a typical UI icon set, to match the light,
 * slightly hand-drawn register of the reference — a bold icon reads as a
 * button glyph, a thin one reads as an illustration.
 */

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A short checklist — the vitals a clinician types in. */
export function IconChecklist() {
  return (
    <svg viewBox="0 0 40 40" {...STROKE}>
      <rect x="8" y="6" width="24" height="28" rx="3" />
      <path d="M14 14h10M14 20h10M14 26h6" />
      <circle cx="27" cy="14" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="27" cy="20" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="27" cy="26" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A brain with radiating lines — the trained model answering. */
export function IconModel() {
  return (
    <svg viewBox="0 0 40 40" {...STROKE}>
      <path d="M17 10c-3 0-5 2-5 4.5 0 1-1 1.5-1 3s1 2 1 3.5c0 2.5 2.5 4 5 4h6c2.5 0 5-1.5 5-4 0-1.5 1-2 1-3.5s-1-2-1-3c0-2.5-2-4.5-5-4.5" />
      <path d="M20 10v18M17 14a2.5 2.5 0 0 0 0 5M23 14a2.5 2.5 0 0 1 0 5" />
      <path d="M20 5v3M9 12l2 1.6M31 12l-2 1.6M9 22l2-1.6M31 22l-2-1.6" />
    </svg>
  );
}

/** A folder with a clock — the visit history that stays on file. */
export function IconHistory() {
  return (
    <svg viewBox="0 0 40 40" {...STROKE}>
      <path d="M6 12a2 2 0 0 1 2-2h7l2.5 3H32a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
      <circle cx="27" cy="24" r="6.5" fill="var(--surface)" />
      <path d="M27 21v3l2 1.5" />
    </svg>
  );
}

/** A stacked database cylinder — trained on a real dataset. */
export function IconDatabase() {
  return (
    <svg viewBox="0 0 40 40" {...STROKE}>
      <ellipse cx="20" cy="10" rx="10" ry="4" />
      <path d="M10 10v9c0 2.2 4.5 4 10 4s10-1.8 10-4v-9" />
      <path d="M10 19v9c0 2.2 4.5 4 10 4s10-1.8 10-4v-9" />
    </svg>
  );
}

/** A shield with a check — RLS-enforced data ownership. */
export function IconShieldCheck() {
  return (
    <svg viewBox="0 0 40 40" {...STROKE}>
      <path d="M20 6 32 10v9c0 8-6 12.5-12 15-6-2.5-12-7-12-15v-9Z" />
      <path d="M15 20l4 4 7-8" />
    </svg>
  );
}

/** A document with a checked line — append-only assessment records. */
export function IconLedger() {
  return (
    <svg viewBox="0 0 40 40" {...STROKE}>
      <path d="M12 6h11l5 5v20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 10 31V7.5A1.5 1.5 0 0 1 11.5 6Z" />
      <path d="M23 6v5h5" />
      <path d="M14 21h8M14 25l2 2 4-4" />
    </svg>
  );
}

// Small UI-action icons (table/row buttons), not feature-tile icons — a
// bolder stroke than STROKE above, since these render at ~16px rather than
// the tiles' ~52px and the thinner weight disappears at that size.
const SMALL_ICON_STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A pencil — edit. */
export function IconPencil() {
  return (
    <svg viewBox="0 0 20 20" {...SMALL_ICON_STROKE}>
      <path d="M12.5 3.5 16.5 7.5 7 17H3v-4Z" />
      <path d="M11 5 15 9" />
    </svg>
  );
}

/** A trash can — delete. */
export function IconTrash() {
  return (
    <svg viewBox="0 0 20 20" {...SMALL_ICON_STROKE}>
      <path d="M4 6h12" />
      <path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6" />
      <path d="M5.5 6 6.3 16a1.5 1.5 0 0 0 1.5 1.4h4.4a1.5 1.5 0 0 0 1.5-1.4L14.5 6" />
      <path d="M8.5 9v5M11.5 9v5" />
    </svg>
  );
}

export function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" className="arrow" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h16" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}
