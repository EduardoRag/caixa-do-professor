import { useEffect, useState } from "react";
import { currentCompetence } from "@/lib/finance";

export function useCurrentCompetence() {
  const [competence, setCompetence] = useState(currentCompetence);
  useEffect(() => {
    const refresh = () => setCompetence(currentCompetence());
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return competence;
}