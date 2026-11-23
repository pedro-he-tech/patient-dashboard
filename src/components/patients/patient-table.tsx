"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/patients/status-badge";
import { Button } from "@/components/ui/button";
import {
  formatBirthDate,
  formatTimestamp,
  fullName,
  maskSsn,
  type ListControls,
  type PatientListMode,
} from "@/lib/patients/display";
import type { ListSort, PatientResponse } from "@/lib/patients/types";
import { cn } from "@/lib/utils";

type PatientTableProps = {
  patients: PatientResponse[];
  controls: ListControls;
  mode: PatientListMode;
  onSort: (sort: ListSort) => void;
  onRestore?: (id: string) => void;
  restoringId?: string | null;
};

const COLUMNS: { sort: ListSort; label: string }[] = [
  { sort: "last_name", label: "Name" },
  { sort: "date_of_birth", label: "Date of birth" },
  { sort: "status", label: "Status" },
  { sort: "created_at", label: "Added" },
];

export function PatientTable({
  patients,
  controls,
  mode,
  onSort,
  onRestore,
  restoringId,
}: PatientTableProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            {mode === "deleted" ? "Deleted patients" : "Patients"}
          </caption>
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              {COLUMNS.map((column) => (
                <SortHeader
                  key={column.sort}
                  label={column.label}
                  sort={column.sort}
                  controls={controls}
                  onSort={onSort}
                />
              ))}
              <th scope="col" className="px-3 py-2 font-medium">
                SSN
              </th>
              {mode === "deleted" ? (
                <th scope="col" className="px-3 py-2 font-medium">
                  Deleted
                </th>
              ) : null}
              {mode === "deleted" ? (
                <th scope="col" className="px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => (
              <tr key={patient.id} className="border-b last:border-0">
                <td className="px-3 py-3">
                  <PatientName patient={patient} linked={mode === "live"} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {formatBirthDate(patient.date_of_birth)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={patient.status} />
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                  {formatTimestamp(patient.created_at)}
                </td>
                <td className="px-3 py-3 font-mono text-xs whitespace-nowrap">
                  {maskSsn(patient.ssn_last4)}
                </td>
                {mode === "deleted" ? (
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                    {patient.deleted_at
                      ? formatTimestamp(patient.deleted_at)
                      : "—"}
                  </td>
                ) : null}
                {mode === "deleted" ? (
                  <td className="px-3 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoringId === patient.id}
                      onClick={() => onRestore?.(patient.id)}
                    >
                      {restoringId === patient.id ? "Restoring…" : "Restore"}
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {patients.map((patient) => (
          <li
            key={patient.id}
            className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
          >
            <div className="flex items-start justify-between gap-3">
              <PatientName patient={patient} linked={mode === "live"} />
              <StatusBadge status={patient.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Date of birth</dt>
                <dd>{formatBirthDate(patient.date_of_birth)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">SSN</dt>
                <dd className="font-mono text-xs">
                  {maskSsn(patient.ssn_last4)}
                </dd>
              </div>
              {mode === "deleted" && patient.deleted_at ? (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Deleted</dt>
                  <dd>{formatTimestamp(patient.deleted_at)}</dd>
                </div>
              ) : null}
            </dl>
            {mode === "deleted" ? (
              <Button
                className="mt-3"
                variant="outline"
                disabled={restoringId === patient.id}
                onClick={() => onRestore?.(patient.id)}
              >
                {restoringId === patient.id ? "Restoring…" : "Restore"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function PatientName({
  patient,
  linked,
}: {
  patient: PatientResponse;
  linked: boolean;
}) {
  const name = fullName(patient);
  const place = [patient.city, patient.state].filter(Boolean).join(", ");
  const content = (
    <>
      <span className="font-medium">{name}</span>
      {place ? (
        <span className="block text-xs text-muted-foreground">{place}</span>
      ) : null}
    </>
  );

  if (!linked) {
    return <div>{content}</div>;
  }

  return (
    <Link
      href={`/patients/${patient.id}`}
      className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {content}
    </Link>
  );
}

function SortHeader({
  label,
  sort,
  controls,
  onSort,
}: {
  label: string;
  sort: ListSort;
  controls: ListControls;
  onSort: (sort: ListSort) => void;
}) {
  const active = controls.sort === sort;
  const ariaSort = active
    ? controls.order === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const Icon = !active
    ? ChevronsUpDown
    : controls.order === "asc"
      ? ChevronUp
      : ChevronDown;

  return (
    <th scope="col" aria-sort={ariaSort} className="px-3 py-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(sort)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
        <span className="sr-only">
          {active
            ? `, sorted ${controls.order === "asc" ? "ascending" : "descending"}`
            : ", sort"}
        </span>
      </button>
    </th>
  );
}
