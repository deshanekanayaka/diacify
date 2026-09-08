import "./VisitTabStrip.css";

export type VisitTab = "history" | "new-visit";

const TABS: { id: VisitTab; label: string }[] = [
  { id: "history", label: "History" },
  { id: "new-visit", label: "New Visit" },
];

/** The patient screen's own mini chart-tabs, switching between visit history and a new entry. */
export function VisitTabStrip({ active, onChange }: { active: VisitTab; onChange: (tab: VisitTab) => void }) {
  return (
    <div className="visit-tab-strip" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
