/**
 * @module imageUpload
 * Multipart image upload middleware backed by Multer memory storage and `storageService`,
 * enforcing a 5 MB limit, MIME allowlist, and magic-byte verification while passing JSON bodies through.
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../exception/AppError.js";
import {
  hasValidImageMagicBytes,
  IMAGE_EXTENSIONS,
  StorageFolder,
  storageService,
} from "../service/storage/StorageService.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, matching frontend upload limits

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in IMAGE_EXTENSIONS) cb(null, true);
    else cb(new ValidationError("Formato de imagen inválido. Solo se admiten JPG, PNG o WEBP."));
  },
});

/**
 * Accepts an optional file on `field` (`multipart/form-data`), verifies magic bytes,
 * uploads it via `storageService`, and writes its public URL into `req.body[bodyKey]`.
 * Standard `application/json` requests pass through untouched.
 * Example: `router.post("/", authenticate, ...imageUpload("patch", "missions", "patchUrl"), controller.create)`
 */
export function imageUpload(field: string, folder: StorageFolder, bodyKey: string): RequestHandler[] {
  const parse: RequestHandler = (req, res, next) => {
    parser.single(field)(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        next(
          new ValidationError(
            err.code === "LIMIT_FILE_SIZE"
              ? "El archivo excede el tamaño máximo permitido de 5 MB."
              : `Archivo inválido en el campo '${field}'.`
          )
        );
        return;
      }
      next(err);
    });
  };

  const store = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.file) {
        if (!hasValidImageMagicBytes(req.file.buffer, req.file.mimetype)) {
          throw new ValidationError("El contenido del archivo no coincide con un formato JPG, PNG o WEBP válido.");
        }
        req.body = { ...(req.body ?? {}), [bodyKey]: await storageService.uploadImage(req.file, folder) };
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  return [parse, store];
}
