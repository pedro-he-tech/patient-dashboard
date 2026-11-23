import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientDetail } from "@/components/patients/patient-detail";

export const metadata: Metadata = {
  title: "Patient",
};

export default function PatientPage({
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
      <PatientDetailLoader params={params} />
    </Suspense>
  );
}

async function PatientDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PatientDetail id={id} />;
}
