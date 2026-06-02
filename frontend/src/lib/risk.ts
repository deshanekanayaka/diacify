export type RiskCategory = "high" | "medium" | "low";

/**
 * Returns Tailwind classes for a given risk category.
 * - text: text color utility (kept for compatibility)
 * - bg: background color utility for progress bars
 * - pill: combined classes for the pill badge (bg + text)
 */
export function riskColorClass(category: RiskCategory): { text: string; bg: string; pill: string } {
  switch (category) {
    case "high":
      return {
        text: "text-red-600",
        bg: "bg-red-500",
        pill: "bg-red-100 text-red-700",
      };
    case "medium":
      return {
        text: "text-amber-500",
        bg: "bg-amber-500",
        pill: "bg-amber-100 text-amber-700",
      };
    case "low":
    default:
      return {
        text: "text-green-600",
        bg: "bg-green-500",
        pill: "bg-green-100 text-green-700",
      };
  }
}
