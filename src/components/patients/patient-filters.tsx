"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STATUS_HINT,
  STATUS_LABEL,
  type ListControls,
} from "@/lib/patients/display";
import {
  PATIENT_STATUSES,
  type PatientStatusValue,
} from "@/lib/patients/types";

type PatientFiltersProps = {
  controls: ListControls;
  draftSearch: string;
  onSearchChange: (value: string) => void;
  onToggleStatus: (status: PatientStatusValue, checked: boolean) => void;
};

export function PatientFilters({
  controls,
  draftSearch,
  onSearchChange,
  onToggleStatus,
}: PatientFiltersProps) {
  return (
    <div className="grid gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="grid gap-1.5">
        <Label htmlFor="patient-search">Search</Label>
        <Input
          id="patient-search"
          value={draftSearch}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Name, or exactly 4 digits for SSN last 4"
          autoComplete="off"
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Status</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {PATIENT_STATUSES.map((status) => {
            const id = `status-${status}`;
            return (
              <Label key={status} htmlFor={id} className="font-normal">
                <Checkbox
                  id={id}
                  checked={controls.status.includes(status)}
                  onCheckedChange={(checked) => onToggleStatus(status, checked)}
                />
                <span>
                  {STATUS_LABEL[status]}
                  <span className="sr-only">. </span>
                  <span className="text-muted-foreground">
                    {" "}
                    {STATUS_HINT[status]}
                  </span>
                </span>
              </Label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
