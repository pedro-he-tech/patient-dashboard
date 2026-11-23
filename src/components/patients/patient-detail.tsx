"use client";

import { useState } from "react";
import Link from "next/link";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";
import { StatusBadge } from "@/components/patients/status-badge";
import { StatusTimeline } from "@/components/patients/status-timeline";
import { useApi } from "@/components/patients/use-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiRequestError, apiRequest } from "@/lib/patients/api-client";
import {
  formatBirthDate,
  fullName,
  maskSsn,
  statusLabel,
} from "@/lib/patients/display";
import {
  PATIENT_STATUSES,
  type PatientResponse,
  type PatientStatusValue,
  type StatusHistoryResponse,
} from "@/lib/patients/types";
import { cn } from "@/lib/utils";

export function PatientDetail({ id }: { id: string }) {
  const patient = useApi<PatientResponse>(`/api/patients/${id}`);
  const history = useApi<{ data: StatusHistoryResponse[] }>(
    `/api/patients/${id}/status-history`,
  );
  const [statusError, setStatusError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  async function changeStatus(status: PatientStatusValue) {
    if (!patient.data || status === patient.data.status) {
      return;
    }
    setSavingStatus(true);
    setStatusError(null);
    try {
      await apiRequest(`/api/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      patient.reload();
      history.reload();
    } catch (caught) {
      const message =
        caught instanceof ApiRequestError
          ? "Could not change the status."
          : "Could not change the status.";
      setStatusError(message);
    } finally {
      setSavingStatus(false);
    }
  }

  if (patient.loading && !patient.data) {
    return <p className="text-sm text-muted-foreground">Loading patient…</p>;
  }
  if (patient.notFound) {
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Patient not found
        </h1>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          This chart is not on the active list. It may have been deleted.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/patients" className={cn(buttonVariants())}>
            Back to patients
          </Link>
          <Link
            href="/patients/deleted"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Deleted patients
          </Link>
        </div>
      </div>
    );
  }
  if (patient.error || !patient.data) {
    return (
      <div>
        <p className="text-sm">
          {patient.error ?? "Could not load this patient."}
        </p>
        <Button className="mt-3" variant="outline" onClick={patient.reload}>
          Try again
        </Button>
      </div>
    );
  }

  const record = patient.data;
  const name = fullName(record);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href="/patients"
              className="underline-offset-4 hover:underline"
            >
              Patients
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{name}</h1>
          <div className="mt-2">
            <StatusBadge status={record.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/patients/${id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Edit
          </Link>
          <DeletePatientDialog id={id} name={name} />
        </div>
      </header>

      <section className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:grid-cols-2">
        <Info
          label="Date of birth"
          value={formatBirthDate(record.date_of_birth)}
        />
        <Info label="SSN" value={maskSsn(record.ssn_last4)} mono />
        <Info label="Address" value={formatAddress(record)} />
        <div className="grid gap-1.5">
          <label
            htmlFor="quick-status"
            className="text-xs text-muted-foreground"
          >
            Change status
          </label>
          <NativeSelect
            id="quick-status"
            value={record.status}
            disabled={savingStatus}
            onChange={(event) =>
              void changeStatus(event.target.value as PatientStatusValue)
            }
          >
            {PATIENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </NativeSelect>
          {savingStatus ? (
            <p className="text-xs text-muted-foreground">Saving status…</p>
          ) : null}
          {statusError ? (
            <p role="alert" className="text-xs text-destructive">
              {statusError}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <h2 className="mb-4 text-base font-medium">Status history</h2>
        {history.loading && !history.data ? (
          <p className="text-sm text-muted-foreground">Loading history…</p>
        ) : null}
        {history.error ? (
          <div>
            <p className="text-sm">{history.error}</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={history.reload}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {history.data ? <StatusTimeline events={history.data.data} /> : null}
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn("mt-1 text-sm whitespace-pre-line", mono && "font-mono")}
      >
        {value}
      </p>
    </div>
  );
}

function formatAddress(patient: PatientResponse): string {
  const cityLine = [patient.city, patient.state].filter(Boolean).join(", ");
  return [
    patient.address_line1,
    patient.address_line2,
    [cityLine, patient.zip_code].filter(Boolean).join(" "),
  ]
    .filter((line) => line && line.trim() !== "")
    .join("\n");
}
