import {
  createPatientSchema,
  updatePatientSchema,
  zodFieldErrors,
  type CreatePatientInput,
  type UpdatePatientInput,
} from "./schema";
import type { PatientResponse, PatientStatusValue } from "./types";

/**
 * Form state uses empty strings for blank inputs. The shared Zod schemas turn
 * those into nulls (or omit them) so the form and the API reject the same values.
 *
 * The SSN input is never prefilled. On edit we show `ssn_last4` beside it.
 * A blank SSN on edit means "leave it", and the clear flag means "remove it".
 */

export type FieldErrors = Record<string, string>;

export type PatientFormValues = {
  first_name: string;
  middle_name: string;
  last_name: string;
  date_of_birth: string;
  status: PatientStatusValue;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_code: string;
  ssn: string;
};

export type SsnConflict = {
  kind: "ssn_duplicate";
  existingId: string;
  message: string;
};

export type PossibleDuplicateConflict = {
  kind: "possible_duplicate";
  patients: PatientResponse[];
  message: string;
};

export type SaveConflict = SsnConflict | PossibleDuplicateConflict;

export const emptyPatientForm = (): PatientFormValues => ({
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  status: "inquiry",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip_code: "",
  ssn: "",
});

export function valuesFromPatient(patient: PatientResponse): PatientFormValues {
  return {
    first_name: patient.first_name,
    middle_name: patient.middle_name ?? "",
    last_name: patient.last_name,
    date_of_birth: patient.date_of_birth,
    status: patient.status,
    address_line1: patient.address_line1,
    address_line2: patient.address_line2 ?? "",
    city: patient.city,
    state: patient.state,
    zip_code: patient.zip_code,
    ssn: "",
  };
}

export type ValidationResult<T> =
  { ok: true; body: T } | { ok: false; errors: FieldErrors };

export function validateCreate(
  values: PatientFormValues,
): ValidationResult<CreatePatientInput> {
  const parsed = createPatientSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, errors: zodFieldErrors(parsed.error) };
  }
  return { ok: true, body: parsed.data };
}

export function validateUpdate(
  values: PatientFormValues,
  clearSsn: boolean,
): ValidationResult<UpdatePatientInput> {
  const draft: Record<string, unknown> = {
    first_name: values.first_name,
    middle_name: values.middle_name,
    last_name: values.last_name,
    date_of_birth: values.date_of_birth,
    status: values.status,
    address_line1: values.address_line1,
    address_line2: values.address_line2,
    city: values.city,
    state: values.state,
    zip_code: values.zip_code,
  };

  // Sending "" would clear the SSN, because the update schema treats blank as null.
  // Omit the key unless the provider typed a replacement or asked to remove it.
  if (clearSsn) {
    draft.ssn = null;
  } else if (values.ssn.trim() !== "") {
    draft.ssn = values.ssn;
  }

  const parsed = updatePatientSchema.safeParse(draft);
  if (!parsed.success) {
    return { ok: false, errors: zodFieldErrors(parsed.error) };
  }
  return { ok: true, body: parsed.data };
}

export function fieldErrorsFromBody(body: unknown): FieldErrors | null {
  if (!body || typeof body !== "object" || !("errors" in body)) {
    return null;
  }
  const errors = body.errors;
  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return null;
  }

  const fieldErrors: FieldErrors = {};
  for (const [key, value] of Object.entries(errors)) {
    if (typeof value === "string" && value.trim() !== "") {
      fieldErrors[key] = value;
    }
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function isPatientResponse(value: unknown): value is PatientResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const patient = value as Partial<PatientResponse>;
  return (
    typeof patient.id === "string" &&
    typeof patient.first_name === "string" &&
    typeof patient.last_name === "string" &&
    typeof patient.date_of_birth === "string"
  );
}

export function conflictFromBody(body: unknown): SaveConflict | null {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return null;
  }
  const record = body as {
    error?: unknown;
    existing_id?: unknown;
    message?: unknown;
    possible_duplicates?: unknown;
  };
  const message = typeof record.message === "string" ? record.message : "";

  if (
    record.error === "ssn_duplicate" &&
    typeof record.existing_id === "string"
  ) {
    return {
      kind: "ssn_duplicate",
      existingId: record.existing_id,
      message:
        message || "A patient with this Social Security number already exists.",
    };
  }

  if (
    record.error === "possible_duplicate" &&
    Array.isArray(record.possible_duplicates)
  ) {
    return {
      kind: "possible_duplicate",
      patients: record.possible_duplicates.filter(isPatientResponse),
      message:
        message ||
        "A patient with the same name and date of birth already exists.",
    };
  }

  return null;
}
