import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = {
  title: "Deleted patients",
};

export default function DeletedPatientsPage() {
  return (
    <PagePlaceholder
      title="Deleted patients"
      description="Deleting a record hides it from the main list. It is not removed, and it is not the same as marking someone Churned."
      empty="Soft-deleted patients will be listed here with the time they were deleted and a Restore action."
    />
  );
}
