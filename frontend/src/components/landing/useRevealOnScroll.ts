import { useEffect } from "react";

/** How far into the viewport an element must come before it reveals. A
 *  negative bottom margin means the reveal starts slightly before the element
 *  reaches the fold, so the motion is finishing as you arrive rather than
 *  starting under your eyes. */
const REVEAL_MARGIN = "0px 0px -12% 0px";

/**
 * Reveals every element marked `data-rise` inside `root` once it scrolls into
 * view, by setting `data-visible` on it. The animation itself lives in CSS.
 *
 * Without this the whole page animates on mount, so every section below the
 * fold has already finished by the time you scroll to it.
 *
 * @param root The landing shell. Nothing happens until it is mounted.
 */
export function useRevealOnScroll(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const shell = root.current;
    if (!shell) return;

    const targets = shell.querySelectorAll<HTMLElement>("[data-rise]");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-visible", "");
          // Reveal once. Re-animating on every pass turns a calm page into a
          // flickering one when the reader scrolls back up.
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: REVEAL_MARGIN },
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [root]);
}
