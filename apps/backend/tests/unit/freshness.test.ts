import { describe, it, expect } from "vitest";
import { evaluateFreshness, resolveFreshnessWindowMs } from "../../src/application/health/freshness.js";

const WINDOW = 15 * 60_000;
const takenAt = new Date("2026-11-14T10:00:00Z");
const at = (offsetMs: number) => new Date(takenAt.getTime() + offsetMs);

describe("evaluateFreshness", () => {
  it("sin lectura no hay vigencia", () => {
    expect(evaluateFreshness(null, takenAt, WINDOW)).toEqual({ isFresh: false, expiresAt: null });
  });

  it("es vigente hasta un instante antes de los 15 minutos", () => {
    expect(evaluateFreshness(takenAt, at(WINDOW - 1_000), WINDOW).isFresh).toBe(true);
  });

  it("vence exactamente a los 15 minutos y después", () => {
    expect(evaluateFreshness(takenAt, at(WINDOW), WINDOW).isFresh).toBe(false);
    expect(evaluateFreshness(takenAt, at(WINDOW + 1_000), WINDOW).isFresh).toBe(false);
  });

  it("informa el momento de vencimiento", () => {
    expect(evaluateFreshness(takenAt, takenAt, WINDOW).expiresAt?.toISOString()).toBe("2026-11-14T10:15:00.000Z");
  });
});

describe("resolveFreshnessWindowMs", () => {
  it("usa 15 minutos por defecto o ante valores inválidos", () => {
    expect(resolveFreshnessWindowMs(undefined)).toBe(WINDOW);
    expect(resolveFreshnessWindowMs("abc")).toBe(WINDOW);
    expect(resolveFreshnessWindowMs("0")).toBe(WINDOW);
  });

  it("acepta una ventana configurada", () => {
    expect(resolveFreshnessWindowMs("30")).toBe(30 * 60_000);
  });
});
