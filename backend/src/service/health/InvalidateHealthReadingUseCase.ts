import { HealthReading } from "@prisma/client";
import { IHealthReadingRepository } from "../../repository/IHealthReadingRepository.js";
import { ConflictError, NotFoundError, ValidationError } from "../../exception/AppError.js";

export const MIN_INVALIDATION_REASON_LENGTH = 5;

export function assertInvalidationReason(reason: unknown): string {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < MIN_INVALIDATION_REASON_LENGTH) {
    throw new ValidationError(
      `Reason is required (minimum ${MIN_INVALIDATION_REASON_LENGTH} characters) to invalidate or correct a reading.`
    );
  }
  return text;
}

/**
 * P1 — Append-only clinical integrity.
 * Permanently marks an erroneous reading (loose sensor, wrong crew member, duplicate)
 * as invalid (`isValid = false`). The record remains in the audit log while excluded
 * from dashboards and active clinical summaries.
 */
export class InvalidateHealthReadingUseCase {
  constructor(private readonly readingRepo: IHealthReadingRepository) {}

  async execute(id: string, reason: string, invalidatedById: string | null): Promise<HealthReading> {
    const cleanReason = assertInvalidationReason(reason);

    const existing = await this.readingRepo.findById(id);
    if (!existing) {
      throw new NotFoundError("Health reading", id);
    }
    if (!existing.isValid) {
      throw new ConflictError("Reading is already invalidated; invalidation is permanent.");
    }

    return this.readingRepo.invalidate(id, { reason: cleanReason, invalidatedById });
  }
}
