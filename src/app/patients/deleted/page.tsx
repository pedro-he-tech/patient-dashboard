import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientList } from "@/components/patients/patient-list";

export const metadata: Metadata = {
  title: "Deleted patients",
};

export default function DeletedPatientsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading patients…</p>
      }
    >
      <PatientList mode="deleted" />
    </Suspense>
  );
}
