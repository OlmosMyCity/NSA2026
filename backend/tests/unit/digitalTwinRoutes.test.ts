import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { Role } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { tokenService } from "../../src/security/TokenService.js";

describe("Integración HTTP - Rutas de Gemelo Digital y Decisiones", () => {
  let server: http.Server;
  let baseUrl: string;
  let userToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-artemis-iv";
    process.env.DEMO_OFFLINE = "true";
    userToken = tokenService.sign({
      id: "user-twin-01",
      email: "r.wiseman@nasa.gov",
      role: Role.USER,
    });

    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("exige JWT (401) en /api/astronauts/digital-twin/evaluate", async () => {
    const res = await fetch(`${baseUrl}/api/astronauts/digital-twin/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readings: [] }),
    });
    expect(res.status).toBe(401);
  });

  it("valida el payload (400) cuando faltan campos requeridos", async () => {
    const res = await fetch(`${baseUrl}/api/astronauts/digital-twin/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ readings: [{ heartRateBpm: "bad" }] }),
    });
    expect(res.status).toBe(400);
  });

  it("evalúa el gemelo y retorna decisión en 200 con JWT válido", async () => {
    const res = await fetch(`${baseUrl}/api/astronauts/digital-twin/evaluate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        environment: "ROVER",
        radiation: { stormScale: "S4_SEVERE", shielding: "EVA_SUIT" },
        readings: [
          {
            heartRateBpm: 92,
            systolicMmHg: 122,
            diastolicMmHg: 78,
            glucoseMgDl: 100,
            temperatureC: 36.7,
            spo2Pct: 97,
            sleepHours: 7.5,
            mood: 4,
            takenAt: new Date().toISOString(),
          },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      twin: { overallStatus: string };
      decision: {
        escalar: boolean;
        accion: string;
        confianza: number;
        score: Record<string, unknown>;
      };
    };

    expect(body.twin.overallStatus).toBe("amber");
    expect(body.decision.escalar).toBe(true);
    expect(body.decision.accion).toBe("shelter_shielding");
    expect(body.decision.confianza).toBe(1);
    expect(body.decision.score).toBeDefined();
    const rawDecision = body.decision as unknown as Record<string, unknown>;
    expect(rawDecision.source).toBeUndefined();
    expect(rawDecision.disclaimer).toBeUndefined();
    expect(rawDecision.discrepancy).toBeUndefined();
    expect(rawDecision.modelEstimate).toBeUndefined();
  });
});
