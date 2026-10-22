import { describe, expect, it } from "vitest";
import { buildChargeMessage, computeStatus, parseBRLToCents, shiftCompetence, whatsappLink } from "./finance";

describe("finance rules", () => {
  it("parses BRL input into integer cents", () => {
    expect(parseBRLToCents("150")).toBe(15000);
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("80,5")).toBe(8050);
    expect(parseBRLToCents("0")).toBeNull();
    expect(parseBRLToCents("-10")).toBeNull();
    expect(parseBRLToCents("abc")).toBeNull();
  });

  it("partial payment leaves balance = amount - paid", () => {
    expect(computeStatus(20000, 5000, "2026-10-10", "2026-10-05")).toEqual({ balance: 15000, payment: "parcial", overdue: false });
  });

  it("overdue only when balance positive and due date passed, without overriding payment status", () => {
    expect(computeStatus(20000, 0, "2026-10-10", "2026-10-11")).toEqual({ balance: 20000, payment: "pendente", overdue: true });
    expect(computeStatus(20000, 20000, "2026-10-10", "2026-10-11").overdue).toBe(false);
  });

  it("shifts competences across years", () => {
    expect(shiftCompetence("2026-01", -1)).toBe("2025-12");
    expect(shiftCompetence("2026-12", 1)).toBe("2027-01");
  });

  it("WhatsApp link uses the student's phone and the correct balance", () => {
    const msg = buildChargeMessage({ name: "Ana Souza", competence: "2026-10", balanceCents: 15000, dueDate: "2026-10-10" });
    const link = whatsappLink("11987654321", msg);
    expect(link.startsWith("https://wa.me/5511987654321?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1] ?? "")).toContain("150,00");
  });
});
