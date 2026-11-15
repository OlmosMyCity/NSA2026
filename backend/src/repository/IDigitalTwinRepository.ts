/**
 * @module IDigitalTwinRepository
 * Read contract for the data the physiological digital twin needs about a crew member.
 */

import type { Astronaut, HealthReading, Mission } from "@prisma/client";

/** Astronaut with its mission summary and the latest valid readings (newest first). */
export type AstronautTwinRecord = Astronaut & {
  mission: Pick<Mission, "id" | "name" | "environment"> | null;
  readings: HealthReading[];
};

export interface IDigitalTwinRepository {
  /** Id of the active astronaut profile linked to a user account, or `null`. */
  findAstronautIdByUserId(userId: string): Promise<string | null>;
  /** Active astronaut with mission and its latest `readingLimit` valid readings. */
  findAstronautWithReadings(astronautId: string, readingLimit: number): Promise<AstronautTwinRecord | null>;
}
