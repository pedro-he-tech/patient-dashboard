import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientList } from "@/components/patients/patient-list";

export const metadata: Metadata = {
  title: "Patients",
};

export default function PatientsPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <PatientList mode="live" />
    </Suspense>
  );
}

function ListFallback() {
  return <p className="text-sm text-muted-foreground">Loading patients…</p>;
}
