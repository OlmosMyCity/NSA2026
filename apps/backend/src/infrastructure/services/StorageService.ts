/**
 * @module StorageService
 * Image storage adapter supporting Vercel Blob (primary) and Supabase Storage (fallback),
 * enforcing an explicit MIME allowlist and magic-byte validation to block spoofed files and Stored XSS.
 */

import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { ValidationError } from "../../domain/errors/AppError.js";

/** Supported object-storage folders for uploaded assets. */
export type StorageFolder = "missions" | "astronauts";

/** Accepted raster MIME types mapped to canonical file extensions (SVG excluded to prevent Stored XSS). */
export const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Verifies that the leading bytes (magic signature) of an uploaded buffer match its declared MIME type.
 */
export function hasValidImageMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (!Buffer.isBuffer(buffer)) return false;

  switch (mimetype) {
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case "image/webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    default:
      return false;
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN o SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados para subir imágenes."
    );
  }
  return { url: url.replace(/\/+$/, ""), key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "artemis-assets" };
}

/**
 * Image storage service: uploads to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set,
 * and falls back to the Supabase Storage REST API otherwise.
 */
export const storageService = {
  /**
   * Validates image MIME type and magic bytes, stores the payload under a UUID key,
   * and returns the public HTTPS asset URL.
   */
  async uploadImage(file: { buffer: Buffer; mimetype: string }, folder: StorageFolder): Promise<string> {
    const ext = IMAGE_EXTENSIONS[file.mimetype];
    if (!ext || !hasValidImageMagicBytes(file.buffer, file.mimetype)) {
      throw new ValidationError("El archivo no es una imagen JPG, PNG o WEBP válida.");
    }

    const path = `${folder}/${Date.now()}-${randomUUID()}.${ext}`;
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

    if (blobToken) {
      const blob = await put(path, file.buffer, {
        access: "public",
        contentType: file.mimetype,
        token: blobToken,
      });
      return blob.url;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      if (process.env.NODE_ENV !== "production") {
        return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      }
    }

    const { url, key, bucket } = getSupabaseConfig();

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
