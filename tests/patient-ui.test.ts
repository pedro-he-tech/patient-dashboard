import { describe, expect, it } from "vitest";
import {
  listControlsFromSearchParams,
  listPageHref,
  maskSsn,
  patientListApiPath,
} from "../src/lib/patients/display";
import {
  conflictFromBody,
  emptyPatientForm,
  validateCreate,
  validateUpdate,
  valuesFromPatient,
} from "../src/lib/patients/form";
import type { PatientResponse } from "../src/lib/patients/types";

const valid = {
  ...emptyPatientForm(),
  first_name: "Ada",
  last_name: "Lovelace",
  date_of_birth: "1990-01-15",
  address_line1: "1 Main Street",
  city: "Boston",
  state: "ma",
  zip_code: "02108",
  ssn: "900-12-3456",
};

describe("maskSsn", () => {
  it("shows only the last four digits", () => {
    expect(maskSsn("3456")).toBe("***-**-3456");
    expect(maskSsn("3456 ")).toBe("***-**-3456");
  });

  it("does not reveal a full number if one is passed by mistake", () => {
    expect(maskSsn("900123456")).toBe("Not on file");
    expect(maskSsn("900-12-3456")).toBe("Not on file");
    expect(maskSsn(null)).toBe("Not on file");
  });
});

describe("list query", () => {
  it("builds the live and deleted API paths", () => {
    const controls = listControlsFromSearchParams(
      new URLSearchParams(
        "search=ada&status=active&status=inquiry&sort=date_of_birth&order=desc&page=2",
      ),
    );
    expect(patientListApiPath("live", controls)).toBe(
      "/api/patients?search=ada&status=active&status=inquiry&sort=date_of_birth&order=desc&page=2",
    );
    expect(listPageHref("deleted", controls)).toBe(
      "/patients/deleted?search=ada&status=active&status=inquiry&sort=date_of_birth&order=desc&page=2",
    );
  });

  it("drops unknown status values and default sort", () => {
    const controls = listControlsFromSearchParams(
      new URLSearchParams("status=nope&sort=ssn"),
    );
    expect(controls.status).toEqual([]);
    expect(controls.sort).toBe("last_name");
    expect(patientListApiPath("live", controls)).toBe("/api/patients");
  });
});

describe("patient form", () => {
  it("rejects an incomplete create with the shared schema", () => {
    const result = validateCreate(emptyPatientForm());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.first_name).toMatch(/required/i);
      expect(result.errors.date_of_birth).toBeTruthy();
    }
  });

  it("sends a normalized create body and only the ssn field for the number", () => {
    const result = validateCreate(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.ssn).toBe("900123456");
      expect(result.body.state).toBe("MA");
      expect(result.body.country).toBe("US");
      expect(result.body).not.toHaveProperty("ssn_encrypted");
      expect(result.body).not.toHaveProperty("ssn_hash");
      expect(result.body).not.toHaveProperty("ssn_last4");
    }
  });

  it("leaves a blank SSN unchanged on edit and can clear it", () => {
    const kept = validateUpdate({ ...valid, ssn: "" }, false);
    expect(kept.ok).toBe(true);
    if (kept.ok) {
      expect(kept.body).not.toHaveProperty("ssn");
    }

    const cleared = validateUpdate({ ...valid, ssn: "900-12-3456" }, true);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.body.ssn).toBeNull();
    }
  });

  it("does not put a stored number back into the edit form", () => {
    const patient = {
      id: "11111111-1111-4111-8111-111111111111",
      first_name: "Ada",
      middle_name: null,
      last_name: "Lovelace",
      date_of_birth: "1990-01-15",
      status: "active",
      address_line1: "1 Main Street",
      address_line2: null,
      city: "Boston",
      state: "MA",
      zip_code: "02108",
      country: "US",
      ssn_last4: "3456",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    } satisfies PatientResponse;

    expect(valuesFromPatient(patient).ssn).toBe("");
    expect(JSON.stringify(valuesFromPatient(patient))).not.toContain("900");
  });

  it("reads both 409 shapes", () => {
    expect(
      conflictFromBody({ error: "ssn_duplicate", existing_id: "abc" })?.kind,
    ).toBe("ssn_duplicate");
    const possible = conflictFromBody({
      error: "possible_duplicate",
      possible_duplicates: [
        {
          id: "abc",
          first_name: "Ada",
          last_name: "Lovelace",
          date_of_birth: "1990-01-15",
          ssn_last4: "3456",
        },
      ],
    });
    expect(possible?.kind).toBe("possible_duplicate");
    if (possible?.kind === "possible_duplicate") {
      expect(possible.patients[0]?.ssn_last4).toBe("3456");
    }
  });
});
