import { Request, Response, NextFunction, RequestHandler } from "express";
import multer from "multer";
import { ValidationError } from "../../domain/errors/AppError.js";
import { IMAGE_EXTENSIONS, StorageFolder, storageService } from "../../infrastructure/services/StorageService.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB, igual que el frontend

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype in IMAGE_EXTENSIONS) cb(null, true);
    else cb(new ValidationError("Formato de imagen inválido. Solo se admiten JPG, PNG, WEBP o SVG."));
  },
});

/**
 * Acepta un archivo opcional en `field` (multipart/form-data), lo sube a Supabase Storage
 * y deja su URL pública en `req.body[bodyKey]`. Las peticiones JSON pasan sin cambios.
 * Ej: router.post("/", authenticate, ...imageUpload("patch", "missions", "patchUrl"), controller.create)
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
        req.body = { ...(req.body ?? {}), [bodyKey]: await storageService.uploadImage(req.file, folder) };
      }
      next();
    } catch (error) {
      next(error);
    }
  };

  return [parse, store];
}
