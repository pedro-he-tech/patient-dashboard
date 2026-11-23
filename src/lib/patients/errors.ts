import type { PatientResponse } from "./serialize";

/** The request body or query string failed the shared patient schema. */
export class PatientValidationError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(fieldErrors: Record<string, string>) {
    super("Validation failed");
    this.name = "PatientValidationError";
    this.fieldErrors = fieldErrors;
  }
}

/**
 * The SSN hash already belongs to a row, including a soft-deleted one.
 * The unique index is not partial, so the database would reject the insert
 * anyway. Returning the id lets the provider open or restore that chart.
 */
export class SsnDuplicateError extends Error {
  readonly existingId: string;

  constructor(existingId: string) {
    super("SSN already on file");
    this.name = "SsnDuplicateError";
    this.existingId = existingId;
  }
}

/** Same first name, last name, and date of birth as a patient who is not deleted. */
export class PossibleDuplicateError extends Error {
  readonly possibleDuplicates: PatientResponse[];

  constructor(possibleDuplicates: PatientResponse[]) {
    super("Possible duplicate patient");
    this.name = "PossibleDuplicateError";
    this.possibleDuplicates = possibleDuplicates;
  }
}

/** Missing id, malformed id, or a live-only route looking at a deleted row. */
export class PatientNotFoundError extends Error {
  constructor() {
    super("Patient not found");
    this.name = "PatientNotFoundError";
  }
}
