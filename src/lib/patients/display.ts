import { parseCalendarDate } from "./dates";
import {
  LIST_SORTS,
  PATIENT_STATUSES,
  type ListSort,
  type PatientResponse,
  type PatientStatusValue,
} from "./types";

export const STATUS_LABEL: Record<PatientStatusValue, string> = {
  inquiry: "Inquiry",
  onboarding: "Onboarding",
  active: "Active",
  churned: "Churned",
};

/** Shown under the status filter so Churned is not confused with Delete. */
export const STATUS_HINT: Record<PatientStatusValue, string> = {
  inquiry: "New contact",
  onboarding: "Getting started",
  active: "Receiving care",
  churned: "Left care, still listed",
};

export type PatientListMode = "live" | "deleted";

export type ListControls = {
  search: string;
  status: PatientStatusValue[];
  sort: ListSort;
  order: "asc" | "desc";
  page: number;
};

const DEFAULT_CONTROLS: ListControls = {
  search: "",
  status: [],
  sort: "last_name",
  order: "asc",
  page: 1,
};

export function statusLabel(status: PatientStatusValue): string {
  return STATUS_LABEL[status];
}

export function fullName(
  patient: Pick<PatientResponse, "first_name" | "middle_name" | "last_name">,
): string {
  return [patient.first_name, patient.middle_name, patient.last_name]
    .filter((part) => part && part.trim() !== "")
    .join(" ");
}

/**
 * The screen only ever shows the last four digits. A value that is not exactly
 * four digits is treated as missing, so a full number cannot land in the UI
 * if a caller passes the wrong string.
 */
export function maskSsn(last4: string | null | undefined): string {
  if (!last4) {
    return "Not on file";
  }
  const digits = last4.replace(/\D/g, "");
  if (digits.length !== 4) {
    return "Not on file";
  }
  return `***-**-${digits}`;
}

/** Birthdays are calendar dates. Format in UTC so the day does not shift. */
export function formatBirthDate(isoDate: string): string {
  const date = parseCalendarDate(isoDate);
  if (!date) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isStatus(value: string): value is PatientStatusValue {
  return (PATIENT_STATUSES as readonly string[]).includes(value);
}

function isSort(value: string): value is ListSort {
  return (LIST_SORTS as readonly string[]).includes(value);
}

export function listControlsFromSearchParams(
  params: URLSearchParams,
): ListControls {
  const status = [
    ...new Set(
      params
        .getAll("status")
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(isStatus),
    ),
  ];
  const sortValue = params.get("sort") ?? "";
  const page = Number(params.get("page"));

  return {
    search: params.get("search") ?? "",
    status,
    sort: isSort(sortValue) ? sortValue : DEFAULT_CONTROLS.sort,
    order: params.get("order") === "desc" ? "desc" : "asc",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  };
}

/** Browser URL for the list. Defaults stay out of the query so the link stays short. */
export function listPageHref(
  mode: PatientListMode,
  controls: ListControls,
): string {
  const params = listSearchParams(controls);
  const query = params.toString();
  const path = mode === "deleted" ? "/patients/deleted" : "/patients";
  return query ? `${path}?${query}` : path;
}

/** API URL for the same controls. */
export function patientListApiPath(
  mode: PatientListMode,
  controls: ListControls,
): string {
  const params = listSearchParams(controls);
  const query = params.toString();
  const path = mode === "deleted" ? "/api/patients/deleted" : "/api/patients";
  return query ? `${path}?${query}` : path;
}

function listSearchParams(controls: ListControls): URLSearchParams {
  const params = new URLSearchParams();
  const search = controls.search.trim();
  if (search) {
    params.set("search", search);
  }
  for (const status of controls.status) {
    params.append("status", status);
  }
  if (controls.sort !== DEFAULT_CONTROLS.sort) {
    params.set("sort", controls.sort);
  }
  if (controls.order !== DEFAULT_CONTROLS.order) {
    params.set("order", controls.order);
  }
  if (controls.page !== 1) {
    params.set("page", String(controls.page));
  }
  return params;
}

export function nextSortOrder(
  controls: ListControls,
  sort: ListSort,
): Pick<ListControls, "sort" | "order" | "page"> {
  if (controls.sort === sort) {
    return {
      sort,
      order: controls.order === "asc" ? "desc" : "asc",
      page: 1,
    };
  }
  return { sort, order: "asc", page: 1 };
}
