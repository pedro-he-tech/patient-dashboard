import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatBirthDate, fullName, maskSsn } from "@/lib/patients/display";
import type { SaveConflict } from "@/lib/patients/form";

export function DuplicateNotice({
  conflict,
  pending,
  onConfirm,
}: {
  conflict: SaveConflict;
  pending: boolean;
  onConfirm: () => void;
}) {
  if (conflict.kind === "ssn_duplicate") {
    return (
      <Alert variant="destructive">
        <AlertTitle>This SSN is already on file</AlertTitle>
        <AlertDescription>
          <p>{conflict.message}</p>
          <p className="mt-2">
            <Link href={`/patients/${conflict.existingId}`}>
              Open the existing patient
            </Link>
          </p>
          <p className="mt-2">
            If that chart was deleted, restore it from Deleted patients instead
            of creating another one.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <AlertTitle>Possible duplicate</AlertTitle>
      <AlertDescription>
        <p>
          Someone with this name and date of birth is already on the list. Open
          that chart, or create this one anyway if they are different people.
        </p>
        <ul className="mt-2 grid gap-2">
          {conflict.patients.map((patient) => (
            <li key={patient.id}>
              <Link href={`/patients/${patient.id}`}>{fullName(patient)}</Link>
              {" · "}
              {formatBirthDate(patient.date_of_birth)}
              {" · "}
              <span className="font-mono text-xs">
                {maskSsn(patient.ssn_last4)}
              </span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          className="mt-3"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Creating…" : "Create anyway"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
