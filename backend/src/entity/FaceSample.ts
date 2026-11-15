/**
 * @module entity/FaceSample
 * Entity shapes and DTOs for crew facial biometric enrollment samples.
 */

/** Input to enroll one facial biometric sample for an astronaut. */
export interface EnrollFaceSampleDTO {
  astronautId: string;
  imageUrl: string;
  label?: string | null;
  embedding: number[];
  qualityScore?: number;
  uploadedById?: string | null;
}

/** Stored facial sample with its L2-normalized embedding. */
export interface FaceSampleRecord {
  id: string;
  astronautId: string;
  imageUrl: string;
  label: string | null;
  embedding: number[];
  qualityScore: number;
  uploadedById: string | null;
  createdAt: Date;
}

/** Enrolled embeddings of one crew member, used by the vision service to identify faces. */
export interface MissionBiometricProfile {
  astronautId: string;
  astronautName: string;
  role: string;
  missionId: string;
  photoUrl: string | null;
  sampleCount: number;
  embeddings: number[][];
}
