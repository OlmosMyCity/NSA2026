/**
 * @module IFaceSampleRepository
 * Persistence contract for crew facial biometric samples.
 */

/** Sample row as stored; `embedding` is raw JSON and must be validated by the caller. */
export interface StoredFaceSample {
  id: string;
  astronautId: string;
  imageUrl: string;
  label: string | null;
  embedding: unknown;
  qualityScore: number;
  uploadedById: string | null;
  createdAt: Date;
}

/** Active astronaut with its stored samples, oldest first. */
export interface AstronautWithFaceSamples {
  id: string;
  name: string;
  role: string;
  missionId: string;
  photoUrl: string | null;
  faceSamples: StoredFaceSample[];
}

export interface CreateFaceSampleData {
  astronautId: string;
  imageUrl: string;
  /** Explicit label, or `null` to use `defaultLabel(position)`. */
  label: string | null;
  defaultLabel: (position: number) => string;
  embedding: number[];
  qualityScore: number;
  uploadedById: string | null;
}

export type CreateFaceSampleResult =
  | { status: "CREATED"; sample: StoredFaceSample }
  | { status: "ASTRONAUT_NOT_FOUND" }
  | { status: "LIMIT_REACHED" };

export interface IFaceSampleRepository {
  astronautExists(astronautId: string): Promise<boolean>;
  listByAstronaut(astronautId: string): Promise<StoredFaceSample[]>;
  listAstronautsWithSamples(missionId?: string): Promise<AstronautWithFaceSamples[]>;
  /**
   * Atomically stores a sample if the astronaut exists and has fewer than `maxSamples`;
   * the first sample also becomes the profile photo when the astronaut has none.
   */
  createWithinLimit(data: CreateFaceSampleData, maxSamples: number): Promise<CreateFaceSampleResult>;
  /** Deletes the sample if it belongs to the astronaut; returns whether it existed. */
  deleteForAstronaut(astronautId: string, sampleId: string): Promise<boolean>;
}
