import { useEffect, useState } from "react";
import { currentLessonDay } from "@/lib/lesson-days";

export function useLessonToday() {
  const [today, setToday] = useState<ReturnType<typeof currentLessonDay> | null>(null);
  useEffect(() => {
    const refresh = () => setToday(currentLessonDay(new Date()));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return today;
}