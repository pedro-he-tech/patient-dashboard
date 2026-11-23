"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DuplicateNotice } from "@/components/patients/duplicate-notice";
import { Field, fieldDescribedBy } from "@/components/patients/field";
import { useApi } from "@/components/patients/use-api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ApiRequestError, apiRequest } from "@/lib/patients/api-client";
import { maskSsn, statusLabel } from "@/lib/patients/display";
import {
  conflictFromBody,
  emptyPatientForm,
  fieldErrorsFromBody,
  validateCreate,
  validateUpdate,
  valuesFromPatient,
  type FieldErrors,
  type PatientFormValues,
  type SaveConflict,
} from "@/lib/patients/form";
import {
  PATIENT_STATUSES,
  type PatientResponse,
  type PatientStatusValue,
} from "@/lib/patients/types";
import { cn } from "@/lib/utils";

type PatientFormProps =
  { mode: "create" } | { mode: "edit"; patientId: string };

export function PatientForm(props: PatientFormProps) {
  const router = useRouter();
  const existing = useApi<PatientResponse>(
    props.mode === "edit" ? `/api/patients/${props.patientId}` : null,
  );
  const [values, setValues] = useState<PatientFormValues>(emptyPatientForm);
  const [clearSsn, setClearSsn] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [conflict, setConflict] = useState<SaveConflict | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [seededFrom, setSeededFrom] = useState<string | null>(null);

  if (
    props.mode === "edit" &&
    existing.data &&
    seededFrom !== existing.data.id
  ) {
    setSeededFrom(existing.data.id);
    setValues(valuesFromPatient(existing.data));
  }

  function update<K extends keyof PatientFormValues>(
    key: K,
    value: PatientFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setConflict(null);
  }

  async function save(confirmDuplicate: boolean) {
    setFormError(null);
    const validated =
      props.mode === "create"
        ? validateCreate(values)
        : validateUpdate(values, clearSsn);
    if (!validated.ok) {
      setErrors(validated.errors);
      setConflict(null);
      return;
    }

    setErrors({});
    setPending(true);
    try {
      const path =
        props.mode === "create"
          ? `/api/patients${confirmDuplicate ? "?confirm_duplicate=true" : ""}`
          : `/api/patients/${props.patientId}`;
      const saved = await apiRequest<PatientResponse>(path, {
        method: props.mode === "create" ? "POST" : "PATCH",
        body: JSON.stringify(validated.body),
      });
      router.push(`/patients/${saved.id}`);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        const fieldErrors = fieldErrorsFromBody(caught.body);
        if (caught.status === 422 && fieldErrors) {
          setErrors(fieldErrors);
          setConflict(null);
          return;
        }
        const nextConflict = conflictFromBody(caught.body);
        if (caught.status === 409 && nextConflict) {
          setConflict(nextConflict);
          return;
        }
      }
      setFormError("Could not save this patient. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (props.mode === "edit" && existing.loading && !existing.data) {
    return <p className="text-sm text-muted-foreground">Loading patient…</p>;
  }
  if (props.mode === "edit" && existing.notFound) {
    return <MissingPatient />;
  }
  if (props.mode === "edit" && existing.error) {
    return (
      <div>
        <p className="text-sm">{existing.error}</p>
        <Button className="mt-3" variant="outline" onClick={existing.reload}>
          Try again
        </Button>
      </div>
    );
  }

  const onFile =
    props.mode === "edit" ? maskSsn(existing.data?.ssn_last4) : null;
  const errorEntries = Object.entries(errors);

  return (
    <form
      className="grid gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {props.mode === "create" ? "New patient" : "Edit patient"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {props.mode === "create"
              ? "A new record starts as Inquiry unless you choose another status."
              : "The full SSN is not shown. Enter a new one only if you are replacing it."}
          </p>
        </div>
        <Link
          href={
            props.mode === "edit" ? `/patients/${props.patientId}` : "/patients"
          }
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Cancel
        </Link>
      </header>

      {errorEntries.length > 0 ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          Fix the highlighted fields before saving.
        </div>
      ) : null}
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {conflict ? (
        <DuplicateNotice
          conflict={conflict}
          pending={pending}
          onConfirm={() => void save(true)}
        />
      ) : null}

      <div className="grid items-start gap-4 sm:grid-cols-3">
        <TextField
          id="first_name"
          label="First name"
          autoComplete="given-name"
          value={values.first_name}
          error={errors.first_name}
          onChange={(value) => update("first_name", value)}
        />
        <TextField
          id="middle_name"
          label={
            <>
              Middle name{" "}
              <span className="font-normal text-muted-foreground">
                optional
              </span>
            </>
          }
          autoComplete="additional-name"
          value={values.middle_name}
          error={errors.middle_name}
          onChange={(value) => update("middle_name", value)}
        />
        <TextField
          id="last_name"
          label="Last name"
          autoComplete="family-name"
          value={values.last_name}
          error={errors.last_name}
          onChange={(value) => update("last_name", value)}
        />
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2">
        <TextField
          id="date_of_birth"
          label="Date of birth"
          type="date"
          autoComplete="bday"
          className="h-9"
          value={values.date_of_birth}
          error={errors.date_of_birth}
          onChange={(value) => update("date_of_birth", value)}
        />
        <Field id="status" label="Status" error={errors.status}>
          <NativeSelect
            id="status"
            className="h-9"
            value={values.status}
            aria-invalid={Boolean(errors.status)}
            aria-describedby={
              fieldDescribedBy("status", errors.status) || undefined
            }
            onChange={(event) =>
              update("status", event.target.value as PatientStatusValue)
            }
          >
            {PATIENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div
        role="group"
        aria-labelledby="address-heading"
        className="grid gap-4"
      >
        <p id="address-heading" className="text-sm font-medium">
          Address
        </p>
        <TextField
          id="address_line1"
          label="Address line 1"
          autoComplete="address-line1"
          value={values.address_line1}
          error={errors.address_line1}
          onChange={(value) => update("address_line1", value)}
        />
        <TextField
          id="address_line2"
          label={
            <>
              Address line 2{" "}
              <span className="font-normal text-muted-foreground">
                optional
              </span>
            </>
          }
          autoComplete="address-line2"
          value={values.address_line2}
          error={errors.address_line2}
          onChange={(value) => update("address_line2", value)}
        />
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <TextField
            id="city"
            label="City"
            autoComplete="address-level2"
            value={values.city}
            error={errors.city}
            onChange={(value) => update("city", value)}
          />
          <TextField
            id="state"
            label="State"
            autoComplete="address-level1"
            value={values.state}
            error={errors.state}
            onChange={(value) => update("state", value)}
            maxLength={2}
          />
          <TextField
            id="zip_code"
            label="ZIP"
            autoComplete="postal-code"
            inputMode="numeric"
            value={values.zip_code}
            error={errors.zip_code}
            onChange={(value) => update("zip_code", value)}
          />
        </div>
      </div>

      <Field
        id="ssn"
        label="SSN"
        error={errors.ssn}
        hint="Optional. Used only to tell patients apart. After saving, only the last four digits are shown."
      >
        {onFile ? (
          <p className="text-sm">
            On file: <span className="font-mono">{onFile}</span>
          </p>
        ) : null}
        <Input
          id="ssn"
          name="ssn"
          value={clearSsn ? "" : values.ssn}
          disabled={clearSsn}
          autoComplete="off"
          inputMode="numeric"
          spellCheck={false}
          aria-invalid={Boolean(errors.ssn)}
          aria-describedby={
            fieldDescribedBy("ssn", errors.ssn, "shown") || undefined
          }
          placeholder={
            props.mode === "edit" ? "New SSN, if replacing" : "Optional"
          }
          onChange={(event) => update("ssn", event.target.value)}
        />
        {props.mode === "edit" && existing.data?.ssn_last4 ? (
          <Label htmlFor="clear-ssn" className="font-normal">
            <Checkbox
              id="clear-ssn"
              checked={clearSsn}
              onCheckedChange={(checked) => {
                setClearSsn(checked);
                setConflict(null);
              }}
            />
            Remove the SSN on file
          </Label>
        ) : null}
      </Field>

      <div>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : props.mode === "create"
              ? "Create patient"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  hint,
  onChange,
  type = "text",
  ...inputProps
}: {
  id: string;
  label: ReactNode;
  value: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
} & Omit<
  ComponentProps<typeof Input>,
  "id" | "value" | "onChange" | "aria-invalid" | "aria-describedby"
>) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <Input
        id={id}
        type={type}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(id, error, hint) || undefined}
        onChange={(event) => onChange(event.target.value)}
        {...inputProps}
      />
    </Field>
  );
}

function MissingPatient() {
  return (
    <div className="grid gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        Patient not found
      </h1>
      <p className="text-sm text-muted-foreground">
        This chart is not on the active list. It may have been deleted.
      </p>
      <div className="flex gap-2">
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
