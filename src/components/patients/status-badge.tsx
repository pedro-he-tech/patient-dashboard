import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/patients/display";
import type { PatientStatusValue } from "@/lib/patients/types";
import { cn } from "@/lib/utils";

const TONE: Record<PatientStatusValue, string> = {
  inquiry: "border-sky-200 bg-sky-50 text-sky-950",
  onboarding: "border-amber-200 bg-amber-50 text-amber-950",
  active: "border-teal-200 bg-teal-50 text-teal-950",
  churned: "border-stone-200 bg-stone-100 text-stone-700",
};

export function StatusBadge({ status }: { status: PatientStatusValue }) {
  return (
    <Badge variant="outline" className={cn("capitalize", TONE[status])}>
      {statusLabel(status)}
    </Badge>
  );
}
