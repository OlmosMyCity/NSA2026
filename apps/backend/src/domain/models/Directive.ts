/**
 * @module domain/models/Directive
 * Domain DTOs for operational or clinical directives issued to crew members.
 */

/** Payload for issuing a new directive to an astronaut, optionally linked to an incident and issuer. */
export interface CreateDirectiveDTO {
  astronautId: string;
  issuedById?: string | null;
  incidentId?: string | null;
  content: string;
}
