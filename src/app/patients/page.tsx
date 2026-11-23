import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = {
  title: "Patients",
};

export default function PatientsPage() {
  return (
    <PagePlaceholder
      title="Patients"
      description="Search, filter, and open records for the practice. Every new patient starts as Inquiry, and Churned patients stay on this list."
      empty="The patient table will go here, with name search, status filters, sorting, and pages of results."
    />
  );
}
