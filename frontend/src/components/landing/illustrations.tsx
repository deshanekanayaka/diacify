/**
 * The six card graphics.
 *
 * They are flat shapes rather than line icons on purpose. A 1.3px stroke
 * reads as a small UI glyph and disappears at this size; solid blocks in the
 * mint range hold their own in a panel and say something about the card
 * instead of just labelling it.
 *
 * Each one draws the thing the card describes: five input rows, a decision
 * tree, a stack of visits, a dataset, two separated tenants, a growing ledger.
 */

const PALETTE = {
  wash: "#eaf5ee",
  mid: "#b7dcc5",
  strong: "#6fae8c",
  ink: "#16382b",
  paper: "#ffffff",
} as const;

/** The frame every graphic is drawn inside, so all six share one silhouette. */
function Plate({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 240 150"
      className="h-full w-full"
      role="presentation"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Five value rows, the last one still being filled. */
export function ArtFiveValues() {
  const rows = [0, 1, 2, 3, 4];
  return (
    <Plate>
      <rect x="44" y="18" width="152" height="114" rx="10" fill={PALETTE.paper} />
      {rows.map((row) => (
        <g key={row}>
          <rect
            x="60"
            y={34 + row * 20}
            width="34"
            height="8"
            rx="4"
            fill={PALETTE.mid}
          />
          <rect
            x="104"
            y={34 + row * 20}
            width={row === 4 ? 30 : 76}
            height="8"
            rx="4"
            fill={row === 4 ? PALETTE.strong : PALETTE.wash}
          />
        </g>
      ))}
      <rect x="138" y="114" width="4" height="12" rx="2" fill={PALETTE.ink} />
    </Plate>
  );
}

/** A decision tree splitting to its leaves: one tree out of the forest. */
export function ArtTrainedModel() {
  return (
    <Plate>
      <g stroke={PALETTE.mid} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M120 40 L84 74" />
        <path d="M120 40 L156 74" />
        <path d="M84 74 L62 110" />
        <path d="M84 74 L106 110" />
        <path d="M156 74 L134 110" />
        <path d="M156 74 L178 110" />
      </g>
      <circle cx="120" cy="34" r="12" fill={PALETTE.ink} />
      <circle cx="84" cy="74" r="9" fill={PALETTE.strong} />
      <circle cx="156" cy="74" r="9" fill={PALETTE.strong} />
      <circle cx="62" cy="114" r="7" fill={PALETTE.mid} />
      <circle cx="106" cy="114" r="7" fill={PALETTE.mid} />
      <circle cx="134" cy="114" r="7" fill={PALETTE.mid} />
      <circle cx="178" cy="114" r="7" fill={PALETTE.ink} />
    </Plate>
  );
}

/** A stack of visits, the newest card on top and the older ones behind. */
export function ArtVisitHistory() {
  return (
    <Plate>
      <rect x="66" y="22" width="108" height="30" rx="8" fill={PALETTE.wash} />
      <rect x="58" y="50" width="124" height="34" rx="9" fill={PALETTE.mid} />
      <rect x="48" y="82" width="144" height="42" rx="10" fill={PALETTE.paper} />
      <rect x="64" y="96" width="60" height="7" rx="3.5" fill={PALETTE.ink} />
      <rect x="64" y="109" width="36" height="6" rx="3" fill={PALETTE.mid} />
      <circle cx="166" cy="103" r="12" fill={PALETTE.strong} />
    </Plate>
  );
}

/** A dataset: many rows, a scattering of them positive. */
export function ArtDataset() {
  const columns = [0, 1, 2, 3, 4, 5, 6, 7];
  const rows = [0, 1, 2, 3, 4];
  const positives = new Set(["1-0", "3-2", "0-3", "5-1", "6-4", "2-2", "7-3"]);
  return (
    <Plate>
      {rows.map((row) =>
        columns.map((column) => {
          const isPositive = positives.has(`${column}-${row}`);
          return (
            <rect
              key={`${column}-${row}`}
              x={44 + column * 19}
              y={26 + row * 21}
              width="14"
              height="14"
              rx="4"
              fill={isPositive ? PALETTE.ink : PALETTE.mid}
              opacity={isPositive ? 1 : 0.55}
            />
          );
        }),
      )}
    </Plate>
  );
}

/** Two tenants, each sealed in its own region, with the wall between them. */
export function ArtIsolation() {
  return (
    <Plate>
      <rect x="34" y="28" width="76" height="94" rx="12" fill={PALETTE.wash} />
      <rect x="130" y="28" width="76" height="94" rx="12" fill={PALETTE.wash} />
      <rect x="118" y="34" width="4" height="82" rx="2" fill={PALETTE.ink} />

      <circle cx="72" cy="58" r="13" fill={PALETTE.strong} />
      <rect x="52" y="80" width="40" height="7" rx="3.5" fill={PALETTE.mid} />
      <rect x="58" y="95" width="28" height="7" rx="3.5" fill={PALETTE.mid} />

      <circle cx="168" cy="58" r="13" fill={PALETTE.mid} />
      <rect x="148" y="80" width="40" height="7" rx="3.5" fill={PALETTE.mid} />
      <rect x="154" y="95" width="28" height="7" rx="3.5" fill={PALETTE.mid} />
    </Plate>
  );
}

/** A ledger that only grows: past entries fixed, the new one appended. */
export function ArtAppendOnly() {
  const entries = [0, 1, 2];
  return (
    <Plate>
      <rect x="56" y="18" width="4" height="114" rx="2" fill={PALETTE.wash} />
      {entries.map((entry) => (
        <g key={entry}>
          <circle cx="58" cy={34 + entry * 32} r="8" fill={PALETTE.mid} />
          <rect
            x="80"
            y={28 + entry * 32}
            width={entry === 0 ? 104 : 84}
            height="12"
            rx="6"
            fill={PALETTE.wash}
          />
        </g>
      ))}
      <circle cx="58" cy="130" r="10" fill={PALETTE.ink} />
      <rect x="80" y="122" width="116" height="16" rx="8" fill={PALETTE.strong} />
    </Plate>
  );
}
