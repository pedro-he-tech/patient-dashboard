import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientForm } from "@/components/patients/patient-form";

export const metadata: Metadata = {
  title: "Edit patient",
};

export default function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Loading patient…</p>
      }
    >
      <EditPatientLoader params={params} />
    </Suspense>
  );
}

async function EditPatientLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientForm mode="edit" patientId={id} />;
}
