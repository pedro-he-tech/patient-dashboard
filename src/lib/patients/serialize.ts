import type {
  Patient,
  PatientStatus,
  PatientStatusHistory,
} from "../../generated/prisma/client";
import { formatDateOnly } from "./dates";

/**
 * Wire shape of a patient. Field names match the design (`page_size`,
 * `ssn_last4`, `date_of_birth`). This object is an allow-list: `ssn_encrypted`
 * and `ssn_hash` are never copied onto it, so a new secret column cannot leak
 * by being spread from the database row.
 */
export type PatientResponse = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  status: PatientStatus;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  ssn_last4: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type StatusHistoryResponse = {
  id: string;
  patient_id: string;
  from_status: PatientStatus | null;
  to_status: PatientStatus;
  changed_at: string;
};

export type PatientListResponse = {
  data: PatientResponse[];
  total: number;
  page: number;
  page_size: number;
};

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
