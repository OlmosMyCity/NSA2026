import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import http from "node:http";
import express from "express";
import { imageUpload } from "../../src/interface/middlewares/imageUpload.js";
import { errorHandler } from "../../src/interface/middlewares/errorHandler.js";
import { storageService } from "../../src/infrastructure/services/StorageService.js";

describe("imageUpload middleware + storageService", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.post("/echo", ...imageUpload("patch", "missions", "patchUrl"), (req, res) => {
      res.json(req.body);
    });
    app.use(errorHandler);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  afterEach(() => vi.restoreAllMocks());

  const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  const form = (type: string, size = 10, bytes?: Uint8Array) => {
    const payload =
      bytes ??
      (() => {
        const buf = new Uint8Array(size);
        if (type === "image/png" && size >= PNG_HEADER.length) {
          buf.set(PNG_HEADER, 0);
        }
        return buf;
      })();
    const fd = new FormData();
    fd.append("name", "Artemis V");
    fd.append("patch", new Blob([payload], { type }), "parche.png");
    return fd;
  };

  it("debe subir la imagen y dejar la URL en req.body junto al resto de campos", async () => {
    const upload = vi.spyOn(storageService, "uploadImage").mockResolvedValue("https://cdn/parche.png");

    const res = await fetch(`${baseUrl}/echo`, { method: "POST", body: form("image/png") });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: "Artemis V", patchUrl: "https://cdn/parche.png" });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ mimetype: "image/png" }), "missions");
  });

  it("debe dejar pasar JSON sin archivo sin llamar a Storage", async () => {
    const upload = vi.spyOn(storageService, "uploadImage");

    const res = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Artemis V", patchUrl: null }),
    });

    expect(await res.json()).toEqual({ name: "Artemis V", patchUrl: null });
    expect(upload).not.toHaveBeenCalled();
  });

  it("debe responder 400 con un tipo de archivo no permitido", async () => {
    const res = await fetch(`${baseUrl}/echo`, { method: "POST", body: form("application/pdf") });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("Formato");
  });

  it("debe responder 400 si la imagen supera 5 MB", async () => {
    const res = await fetch(`${baseUrl}/echo`, { method: "POST", body: form("image/png", 5 * 1024 * 1024 + 1) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("5 MB");
  });

  it("debe responder 400 con SVG o contenido falsificado sin llamar a Storage", async () => {
    const upload = vi.spyOn(storageService, "uploadImage");

    const svgRes = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      body: form("image/svg+xml", 24, Buffer.from("<svg><script>alert(1)</script></svg>")),
    });
    expect(svgRes.status).toBe(400);

    const spoofedRes = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      body: form("image/png", 24, Buffer.from("<svg>malicious</svg>")),
    });
    expect(spoofedRes.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("storageService debe hacer POST a Supabase y devolver la URL pública", async () => {
    process.env.SUPABASE_URL = "https://demo.supabase.co/";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    process.env.SUPABASE_STORAGE_BUCKET = "artemis-assets";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const webpBuffer = Buffer.from("RIFF\x00\x00\x00\x00WEBP");
    const url = await storageService.uploadImage({ buffer: webpBuffer, mimetype: "image/webp" }, "astronauts");

    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toMatch(/^https:\/\/demo\.supabase\.co\/storage\/v1\/object\/artemis-assets\/astronauts\/.+\.webp$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer service-key");
    expect(url).toBe(target.replace("/object/artemis-assets/", "/object/public/artemis-assets/"));
  });
});
