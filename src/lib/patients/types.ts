/**
 * JSON shapes returned by the patient API. This file has no database imports,
 * so client components can use the types without pulling Prisma into the browser.
 *
 * `ssn_last4` is the only SSN field. The ciphertext and the hash are not part
 * of this type, and the full number is never on it.
 */

export const PATIENT_STATUSES = [
  "inquiry",
  "onboarding",
  "active",
  "churned",
] as const;

export type PatientStatusValue = (typeof PATIENT_STATUSES)[number];

export const LIST_SORTS = [
  "last_name",
  "date_of_birth",
  "created_at",
  "status",
] as const;

export type ListSort = (typeof LIST_SORTS)[number];

export type PatientResponse = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  status: PatientStatusValue;
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
  from_status: PatientStatusValue | null;
  to_status: PatientStatusValue;
  changed_at: string;
};

export type PatientListResponse = {
  data: PatientResponse[];
  total: number;
  page: number;
  page_size: number;
};
