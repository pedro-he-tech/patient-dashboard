import type {
  Patient,
  PatientStatusHistory,
} from "../../generated/prisma/client";
import { formatDateOnly } from "./dates";
import type { PatientResponse, StatusHistoryResponse } from "./types";

export type {
  PatientListResponse,
  PatientResponse,
  StatusHistoryResponse,
} from "./types";

/** CHAR columns come back space-padded. Trim so "MA" is not "MA ". */
function trimChar(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trimEnd();
  return trimmed === "" ? null : trimmed;
}

export function serializePatient(patient: Patient): PatientResponse {
  return {
    id: patient.id,
    first_name: patient.firstName,
    middle_name: patient.middleName,
    last_name: patient.lastName,
    date_of_birth: formatDateOnly(patient.dateOfBirth),
    status: patient.status,
    address_line1: patient.addressLine1,
    address_line2: patient.addressLine2,
    city: patient.city,
    state: trimChar(patient.state) ?? "",
    zip_code: patient.zipCode,
    country: trimChar(patient.country) ?? "",
    ssn_last4: trimChar(patient.ssnLast4),
    created_at: patient.createdAt.toISOString(),
    updated_at: patient.updatedAt.toISOString(),
    deleted_at: patient.deletedAt ? patient.deletedAt.toISOString() : null,
  };
}

export function serializeStatusHistory(
  row: PatientStatusHistory,
): StatusHistoryResponse {
  return {
    id: row.id,
    patient_id: row.patientId,
    from_status: row.fromStatus,
    to_status: row.toStatus,
    changed_at: row.changedAt.toISOString(),
  };
}
