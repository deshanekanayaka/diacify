import { riskColorClass, type RiskCategory } from "@/lib/risk";

export function RiskPill({ category }: { category: RiskCategory }) {
  const c = riskColorClass(category);
  const label = category === "high" ? "High" : category === "medium" ? "Medium" : "Low";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.pill}`}>{label}</span>;
}

export function ScoreBar({ score, category }: { score: number; category: RiskCategory }) {
  const c = riskColorClass(category);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={`absolute inset-y-0 left-0 ${c.bg}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums">{Math.round(score)}</span>
    </div>
  );
}

export function Sparkline({ values, category }: { values: number[]; category?: RiskCategory }) {
  if (!values || values.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const w = 80, h = 24, pad = 2;
  const min = 0, max = 100;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const stroke = category === "high" ? "var(--risk-high)" : category === "medium" ? "var(--risk-medium)" : category === "low" ? "var(--risk-low)" : "var(--primary)";
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendArrow({ from, to }: { from: number | null; to: number | null }) {
  if (from == null || to == null) return <span className="text-muted-foreground">→</span>;
  const diff = to - from;
  if (Math.abs(diff) < 2) return <span title="Stable" className="text-muted-foreground">→</span>;
  if (diff > 0) return <span title={`Worsening by ${Math.round(diff)}`} className="text-risk-high">↑</span>;
  return <span title={`Improving by ${Math.round(-diff)}`} className="text-risk-low">↓</span>;
}
