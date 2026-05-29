import { useEffect, useState } from "react";

/**
 * useIsMobile
 * Returns true when the viewport width is less than 768px.
 * Listens to window resize events and cleans up on unmount.
 */
export function useIsMobile(): boolean {
  const getIsMobile = () => (typeof window !== "undefined" ? window.innerWidth < 768 : false);

  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => setIsMobile(getIsMobile());
    window.addEventListener("resize", handleResize);
    // In case something external changed zoom/layout, re-evaluate once on mount
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}
