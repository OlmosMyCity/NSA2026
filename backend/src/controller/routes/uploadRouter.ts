/**
 * @module uploadRouter
 * Express router providing admin-only standalone image upload endpoints for astronauts and missions.
 */

import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../security/authenticate.js";
import { authorizeRoles } from "../../security/authorizeRoles.js";
import { imageUpload } from "../../config/imageUpload.js";
import { ValidationError } from "../../exception/AppError.js";
import type { StorageFolder } from "../../service/storage/StorageService.js";

/** Router mounted at `/api/uploads` behind `sensitiveMutationLimiter`. */
export const uploadRouter = Router();

/** Registers an `ADMIN`-only `POST /<folder>` multipart upload handler returning `{ url }`. */
function registerUploadRoute(folder: StorageFolder) {
  uploadRouter.post(
    `/${folder}`,
    authenticate,
    authorizeRoles(Role.ADMIN),
    ...imageUpload("file", folder, "url"),
    (req, res) => {
      if (!req.body?.url) {
        throw new ValidationError("Debe adjuntar un archivo de imagen en el campo 'file'.");
      }
      res.status(201).json({ url: req.body.url });
    }
  );
}

registerUploadRoute("astronauts");
registerUploadRoute("missions");
