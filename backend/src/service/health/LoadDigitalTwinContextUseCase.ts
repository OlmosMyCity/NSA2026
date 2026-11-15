/**
 * @module LoadDigitalTwinContextUseCase
 * Loads the inputs of the physiological digital twin for one crew member and enforces
 * that non-admin users only reach their own twin.
 */

import { Role } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "../../exception/AppError.js";
import { IDigitalTwinRepository } from "../../repository/IDigitalTwinRepository.js";
import { radiationEngine } from "../radiation/radiationEngine.js";
import type { TimedHealthReading } from "./digitalTwin.js";
import type { MissionEnvironment, NOAAStormScale } from "./hazards.js";

/** Number of most recent valid readings fed to the twin. */
const TWIN_READING_WINDOW = 20;

export class LoadDigitalTwinContextUseCase {
  constructor(private readonly repo: IDigitalTwinRepository) {}

  /** Enforces crew-member ownership so non-admin users can only query or simulate their own digital twin. */
  async assertAccess(user: { id: string; role: Role } | undefined, astronautId: string): Promise<void> {
    if (!user || user.role === Role.ADMIN) return;
    const ownId = await this.repo.findAstronautIdByUserId(user.id);
    if (!ownId || ownId !== astronautId) {
      throw new ForbiddenError(
        "No tienes permiso para consultar el gemelo digital de otro tripulante."
      );
    }
  }

  /**
   * Loads an astronaut's mission environment, latest 20 vital readings, and live NOAA storm scale
   * (falling back to `S0_NOMINAL` if live radiation telemetry is unreachable).
   */
  async load(astronautId: string) {
    const astronaut = await this.repo.findAstronautWithReadings(astronautId, TWIN_READING_WINDOW);

    if (!astronaut) {
      throw new NotFoundError("Astronauta", astronautId);
    }

    let stormScale: NOAAStormScale = "S0_NOMINAL";
    let radiationState: Awaited<ReturnType<typeof radiationEngine.getCurrentState>> | null = null;
    try {
      radiationState = await radiationEngine.getCurrentState();
      stormScale = radiationState.currentTelemetry.stormScale as NOAAStormScale;
    } catch {
      stormScale = "S0_NOMINAL";
    }

    const readings: TimedHealthReading[] = astronaut.readings.map((r) => ({
      heartRateBpm: r.heartRateBpm,
      systolicMmHg: r.systolicMmHg,
      diastolicMmHg: r.diastolicMmHg,
      glucoseMgDl: r.glucoseMgDl,
      temperatureC: r.temperatureC,
      spo2Pct: r.spo2Pct,
      sleepHours: r.sleepHours,
      mood: r.mood,
      takenAt: r.takenAt,
    }));

    return {
      astronaut: {
        id: astronaut.id,
        name: astronaut.name,
        role: astronaut.role,
        mission: astronaut.mission,
      },
      environment: (astronaut.mission?.environment ?? "LUNAR_BASE") as MissionEnvironment,
      readings,
      stormScale,
      radiationState,
    };
  }
}
