import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCurrentCompetence } from "./use-current-competence";

afterEach(() => vi.useRealTimers());

describe("current monthly competence", () => {
  it("changes automatically at the Sao Paulo month boundary while open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T02:59:30Z"));
    const { result, unmount } = renderHook(useCurrentCompetence);
    expect(result.current).toBe("2026-10");
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe("2026-11");
    unmount();
  });

  it("refreshes the month when returning to the app", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T23:00:00Z"));
    const { result, unmount } = renderHook(useCurrentCompetence);
    expect(result.current).toBe("2026-10");
    vi.setSystemTime(new Date("2026-11-01T03:00:01Z"));
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current).toBe("2026-11");
    unmount();
  });
});