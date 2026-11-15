/**
 * @module uploadRouter
 * Express router providing admin-only standalone image upload endpoints for astronauts and missions.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../middlewares/authenticate.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { imageUpload } from "../middlewares/imageUpload.js";
import { ValidationError } from "../../domain/errors/AppError.js";
import type { StorageFolder } from "../../infrastructure/services/StorageService.js";

/** Router mounted at `/api/uploads` behind `sensitiveMutationLimiter`. */
export const uploadRouter = Router();

/** Registers a `POST /<folder>` multipart upload handler returning `{ url }`. */
function registerUploadRoute(folder: StorageFolder, allowedRoles: Role[]) {
  uploadRouter.post(
    `/${folder}`,
    authenticate,
    authorizeRoles(...allowedRoles),
    ...imageUpload("file", folder, "url"),
    (req, res) => {
      if (!req.body?.url) {
        throw new ValidationError("Debe adjuntar un archivo de imagen en el campo 'file'.");
      }
      res.status(201).json({ url: req.body.url });
    }
  );
}

registerUploadRoute("astronauts", [Role.ADMIN, Role.USER]);
registerUploadRoute("missions", [Role.ADMIN]);
