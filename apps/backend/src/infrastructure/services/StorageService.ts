import { randomUUID } from "node:crypto";

export type StorageFolder = "missions" | "astronauts";

/** Tipos aceptados (igual que la validación del frontend) → extensión del archivo. */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados para subir imágenes.");
  }
  return { url: url.replace(/\/+$/, ""), key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "artemis-assets" };
}

/** Supabase Storage (API REST compatible con S3) usando la service key: solo desde el backend. */
export const storageService = {
  async uploadImage(file: { buffer: Buffer; mimetype: string }, folder: StorageFolder): Promise<string> {
    const { url, key, bucket } = getConfig();
    const path = `${folder}/${Date.now()}-${randomUUID()}.${IMAGE_EXTENSIONS[file.mimetype] ?? "bin"}`;

    const res = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.mimetype,
        "Cache-Control": "3600",
      },
      body: new Uint8Array(file.buffer),
    });

    if (!res.ok) {
      throw new Error(`Supabase Storage respondió ${res.status}: ${await res.text()}`);
    }

    return `${url}/storage/v1/object/public/${bucket}/${path}`;
  },
};
