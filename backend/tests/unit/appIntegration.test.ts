import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { storageService } from "../../src/service/storage/StorageService.js";
import http from "node:http";
import { Role } from "@prisma/client";
import { createApp } from "../../src/app.js";
import { tokenService } from "../../src/security/TokenService.js";

describe("Integración HTTP - Rutas y Middleware de Errores", () => {
  let server: http.Server;
  let baseUrl: string;
  let userToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-artemis-iv";
    userToken = tokenService.sign({
      id: "user-test-01",
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

  it("debe responder 200 en el health check", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe("healthy");
  });

  it("debe retornar error 400 descriptivo si la paginación de misiones tiene valores inválidos", async () => {
    const res = await fetch(`${baseUrl}/api/missions?page=invalido&limit=negativo`);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toContain("parámetros de paginación");
  });

  it("debe retornar error 400 descriptivo si la paginación de astronautas tiene valores inválidos", async () => {
    const res = await fetch(`${baseUrl}/api/astronauts?page=invalido&limit=negativo`);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toContain("parámetros de paginación");
  });

  it("debe retornar error 401 si se intenta consultar o modificar lecturas sin token JWT", async () => {
    const [listRes, summaryRes, putRes, deleteRes] = await Promise.all([
      fetch(`${baseUrl}/api/readings`),
      fetch(`${baseUrl}/api/astronauts/astro-01/summary`),
      fetch(`${baseUrl}/api/readings/reading-01`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
      fetch(`${baseUrl}/api/readings/reading-01`, { method: "DELETE" }),
    ]);
    const [invalidateRes, correctRes] = await Promise.all([
      fetch(`${baseUrl}/api/readings/reading-01/invalidate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "Sensor suelto" }) }),
      fetch(`${baseUrl}/api/readings/reading-01/corrections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }),
    ]);
    expect(invalidateRes.status).toBe(401);
    expect(correctRes.status).toBe(401);

    expect(listRes.status).toBe(401);
    expect(summaryRes.status).toBe(401);
    expect(putRes.status).toBe(401);
    expect(deleteRes.status).toBe(401);
  });

  it("debe retornar error 401 si se intenta registrar lectura sin token JWT", async () => {
    const res = await fetch(`${baseUrl}/api/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heartRateBpm: 80 }),
    });

    expect(res.status).toBe(401);
  });

  it("debe retornar error 400 si falta el astronautId o indicadores al registrar lectura autenticada", async () => {
    const res = await fetch(`${baseUrl}/api/readings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ heartRateBpm: 80 }), // Incompleto
    });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toContain("astronautId");
  });

  it("debe retornar error 403 si un usuario con rol USER intenta acceder al triaje de administración", async () => {
    const res = await fetch(`${baseUrl}/api/admin/triage`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    expect(res.status).toBe(403);
  });

  it("la supervisión del operador exige sesión (401) y rol OPERATOR (403)", async () => {
    const adminToken = tokenService.sign({ id: "admin-test-01", email: "admin@nasa.gov", role: Role.ADMIN });
    const detail = await fetch(`${baseUrl}/api/operator/crew/astro-01`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(detail.status).toBe(403);

    const [anonymous, asCrew, asSurgeon] = await Promise.all([
      fetch(`${baseUrl}/api/operator/crew`),
      fetch(`${baseUrl}/api/operator/crew`, { headers: { Authorization: `Bearer ${userToken}` } }),
      fetch(`${baseUrl}/api/operator/crew`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    ]);

    expect(anonymous.status).toBe(401);
    expect(asCrew.status).toBe(403);
    expect(asSurgeon.status).toBe(403);
  });

  it("un operador no puede usar las rutas del cirujano ni cambiar ubicaciones sin sesión", async () => {
    const operatorToken = tokenService.sign({ id: "op-test-01", email: "ops@orbvital.example", role: Role.OPERATOR });
    const [triage, createUser, location] = await Promise.all([
      fetch(`${baseUrl}/api/admin/triage`, { headers: { Authorization: `Bearer ${operatorToken}` } }),
      fetch(`${baseUrl}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${operatorToken}` },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/astronauts/astro-01/location`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "EVA" }),
      }),
    ]);

    expect(triage.status).toBe(403);
    expect(createUser.status).toBe(403);
    expect(location.status).toBe(401);
  });

  it("debe retornar error 404 en JSON (y nunca HTML) cuando la ruta no existe", async () => {
    const res = await fetch(`${baseUrl}/api/ruta-inexistente`);
    const contentType = res.headers.get("content-type") || "";
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(404);
    expect(contentType).toContain("application/json");
    expect(body.error).toContain("no existe");
  });

  it("debe retornar 400 si el registro llega sin nombre", async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.co", password: "secreto1" }),
    });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toContain("nombre");
  });

  it("debe retornar 400 si el login llega sin credenciales", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, { method: "POST" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toContain("contraseña");
  });
  it("debe retornar 401 en /api/auth/me sin token", async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toContain("Bearer");
  });
  it("debe rechazar crear misión sin token (401) y con rol USER (403), aunque envíe createdById", async () => {
    const body = JSON.stringify({
      name: "Artemis V",
      description: "Prueba",
      startDate: "2027-01-01",
      createdById: "id-falsificado",
    });
    const headers = { "Content-Type": "application/json" };

    const anon = await fetch(`${baseUrl}/api/missions`, { method: "POST", headers, body });
    const asUser = await fetch(`${baseUrl}/api/missions`, {
      method: "POST",
      headers: { ...headers, Authorization: `Bearer ${userToken}` },
      body,
    });

    expect(anon.status).toBe(401);
    expect(asUser.status).toBe(403);
  });
  it("no debe subir la imagen si un USER intenta crear un astronauta con foto (403 antes de Storage)", async () => {
    const upload = vi.spyOn(storageService, "uploadImage");
    const fd = new FormData();
    fd.append("name", "Intruso");
    fd.append("photo", new Blob([new Uint8Array(8)], { type: "image/png" }), "foto.png");

    const res = await fetch(`${baseUrl}/api/astronauts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: fd,
    });

    expect(res.status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });

  it("debe aplicar headers de seguridad y omitir x-powered-by en rutas /api", async () => {
    const res = await fetch(`${baseUrl}/api/health`);

    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("debe restringir CORS a orígenes permitidos y bloquear orígenes externos", async () => {
    const allowed = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://orbvital-nsa2026.vercel.app" },
    });
    const blocked = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: "https://evil.example" },
    });

    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://orbvital-nsa2026.vercel.app");
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("debe exigir autenticación ADMIN en POST /api/radiation/simulate", async () => {
    const adminToken = tokenService.sign({
      id: "admin-test-01",
      email: "elena.rodriguez@nasa.gov",
      role: Role.ADMIN,
    });

    const anon = await fetch(`${baseUrl}/api/radiation/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: "PEAK_STORM_S4" }),
    });
    const asUser = await fetch(`${baseUrl}/api/radiation/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ scenario: "PEAK_STORM_S4" }),
    });
    const asAdmin = await fetch(`${baseUrl}/api/radiation/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ scenario: "RESET" }),
    });

    expect(anon.status).toBe(401);
    expect(asUser.status).toBe(403);
    expect(asAdmin.status).toBe(200);
  });

  it("debe rechazar valores NaN o fuera de rango en POST /api/readings con 400", async () => {
    const res = await fetch(`${baseUrl}/api/readings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        astronautId: "astro-01",
        heartRateBpm: "no-numero",
        systolicMmHg: 120,
        diastolicMmHg: 80,
        glucoseMgDl: 95,
        temperatureC: 36.6,
        spo2Pct: 98,
        sleepHours: 7.5,
        mood: 4,
      }),
    });

    expect(res.status).toBe(400);
  });
});
