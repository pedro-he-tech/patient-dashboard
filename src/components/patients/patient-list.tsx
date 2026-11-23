"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PatientFilters } from "@/components/patients/patient-filters";
import { PatientTable } from "@/components/patients/patient-table";
import { useApi } from "@/components/patients/use-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiRequest } from "@/lib/patients/api-client";
import {
  listControlsFromSearchParams,
  listPageHref,
  nextSortOrder,
  patientListApiPath,
  type ListControls,
  type PatientListMode,
} from "@/lib/patients/display";
import type {
  ListSort,
  PatientListResponse,
  PatientStatusValue,
} from "@/lib/patients/types";
import { cn } from "@/lib/utils";

export function PatientList({ mode }: { mode: PatientListMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const controls = listControlsFromSearchParams(searchParams);
  const [draftSearch, setDraftSearch] = useState(controls.search);
  const [trackedSearch, setTrackedSearch] = useState(controls.search);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const controlsRef = useRef(controls);

  if (controls.search !== trackedSearch) {
    setTrackedSearch(controls.search);
    setDraftSearch(controls.search);
  }

  const resource = useApi<PatientListResponse>(
    patientListApiPath(mode, controls),
    { keepPrevious: true },
  );

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  useEffect(() => {
    const latest = controlsRef.current;
    if (draftSearch === latest.search) {
      return;
    }
    const timeout = window.setTimeout(() => {
      const current = controlsRef.current;
      router.replace(
        listPageHref(mode, { ...current, search: draftSearch, page: 1 }),
        { scroll: false },
      );
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [draftSearch, mode, router]);

  function replaceControls(next: ListControls) {
    router.replace(listPageHref(mode, next), { scroll: false });
  }

  function toggleStatus(status: PatientStatusValue, checked: boolean) {
    const nextStatus = checked
      ? [...controls.status, status]
      : controls.status.filter((value) => value !== status);
    replaceControls({ ...controls, status: nextStatus, page: 1 });
  }

  function sortBy(sort: ListSort) {
    replaceControls({ ...controls, ...nextSortOrder(controls, sort) });
  }

  async function restore(id: string) {
    setRestoringId(id);
    setActionError(null);
    try {
      await apiRequest(`/api/patients/${id}/restore`, { method: "POST" });
      resource.reload();
    } catch {
      setActionError("Could not restore that patient. Try again.");
    } finally {
      setRestoringId(null);
    }
  }

  const filtered = controls.search.trim() !== "" || controls.status.length > 0;
  const result = resource.data;

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === "deleted" ? "Deleted patients" : "Patients"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {mode === "deleted"
              ? "These records were hidden from the main list. Restore puts a chart back. This is not the same as Churned."
              : "Search by name, or type exactly four digits to match an SSN last 4. Churned patients stay on this list."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "live" ? (
            <>
              <Link
                href="/patients/deleted"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Deleted patients
              </Link>
              <Link href="/patients/new" className={cn(buttonVariants())}>
                New patient
              </Link>
            </>
          ) : (
            <Link
              href="/patients"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Back to patients
            </Link>
          )}
        </div>
      </header>

      <PatientFilters
        controls={controls}
        draftSearch={draftSearch}
        onSearchChange={setDraftSearch}
        onToggleStatus={toggleStatus}
      />

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <section aria-busy={resource.loading} aria-live="polite">
        {resource.loading && !result ? (
          <p className="text-sm text-muted-foreground">Loading patients…</p>
        ) : null}
        {resource.loading && result ? (
          <p className="text-sm text-muted-foreground">Updating results…</p>
        ) : null}
        {resource.error && !result ? (
          <div className="rounded-xl border border-dashed px-6 py-10 text-center">
            <p className="text-sm">{resource.error}</p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={resource.reload}
            >
              Try again
            </Button>
          </div>
        ) : null}
        {resource.error && result ? (
          <p role="alert" className="text-sm text-destructive">
            {resource.error}
          </p>
        ) : null}
        {result &&
        result.data.length === 0 &&
        !resource.loading &&
        !resource.error ? (
          <EmptyList mode={mode} filtered={filtered} />
        ) : null}
        {result && result.data.length > 0 ? (
          <div className="grid gap-4">
            <PatientTable
              patients={result.data}
              controls={controls}
              mode={mode}
              onSort={sortBy}
              onRestore={restore}
              restoringId={restoringId}
            />
            <Pagination
              page={result.page}
              pageSize={result.page_size}
              total={result.total}
              onPage={(page) => replaceControls({ ...controls, page })}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function EmptyList({
  mode,
  filtered,
}: {
  mode: PatientListMode;
  filtered: boolean;
}) {
  const title = filtered
    ? "No patients match"
    : mode === "deleted"
      ? "No deleted patients"
      : "No patients yet";
  const body = filtered
    ? "Try a different name, last 4, or status."
    : mode === "deleted"
      ? "Deleted charts will show up here, with when they were hidden and a Restore button."
      : "Add the first patient to start the list.";

  return (
    <div className="rounded-xl border border-dashed px-6 py-16 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {mode === "live" && !filtered ? (
        <Link href="/patients/new" className={cn(buttonVariants(), "mt-4")}>
          New patient
        </Link>
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <p className="text-sm">
          Page {page} of {pageCount}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
