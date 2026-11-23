import { describe, expect, it } from "vitest";
import { DELETE, GET, PATCH } from "../src/app/api/patients/[id]/route";
import { POST as restorePatient } from "../src/app/api/patients/[id]/restore/route";
import { GET as getHistory } from "../src/app/api/patients/[id]/status-history/route";
import { GET as listDeleted } from "../src/app/api/patients/deleted/route";
import { GET as listPatients, POST } from "../src/app/api/patients/route";
import {
  addUtcDays,
  formatDateOnly,
  utcToday,
} from "../src/lib/patients/dates";

const MISSING_ID = "11111111-1111-4111-8111-111111111111";

const validPatient = {
  first_name: "Ada",
  last_name: "Lovelace",
  date_of_birth: "1990-01-15",
  address_line1: "1 Main Street",
  city: "Boston",
  state: "ma",
  zip_code: "02108",
};

type PatientBody = {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  status: string;
  state: string;
  zip_code: string;
  country: string;
  ssn_last4: string | null;
  deleted_at: string | null;
};

function request(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers:
      body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function create(
  overrides: Record<string, unknown> = {},
  query = "",
): Promise<Response> {
  return POST(
    request(`/api/patients${query}`, "POST", { ...validPatient, ...overrides }),
  );
}

async function createOk(
  overrides: Record<string, unknown> = {},
  query = "",
): Promise<PatientBody> {
  const response = await create(overrides, query);
  expect(response.status).toBe(201);
  return response.json() as Promise<PatientBody>;
}

function yearsAgo(years: number): string {
  const today = utcToday();
  const candidate = new Date(
    Date.UTC(
      today.getUTCFullYear() - years,
      today.getUTCMonth(),
      today.getUTCDate(),
    ),
  );
  if (candidate.getUTCMonth() !== today.getUTCMonth()) {
    return formatDateOnly(
      new Date(
        Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth() + 1, 0),
      ),
    );
  }
  return formatDateOnly(candidate);
}

describe("POST /api/patients", () => {
  it("creates a patient, masks the SSN, and records the opening status", async () => {
    const response = await create({
      middle_name: "Augusta",
      address_line2: "",
      ssn: "900-12-3456",
      zip_code: "02108-1234",
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as PatientBody & {
      address_line2: string | null;
      middle_name: string | null;
    };

    expect(body).toMatchObject({
      first_name: "Ada",
      middle_name: "Augusta",
      last_name: "Lovelace",
      date_of_birth: "1990-01-15",
      status: "inquiry",
      state: "MA",
      zip_code: "02108-1234",
      country: "US",
      ssn_last4: "3456",
      address_line2: null,
      deleted_at: null,
    });

    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain("900-12-3456");
    expect(encoded).not.toContain("900123456");
    expect(encoded).not.toContain("ssn_encrypted");
    expect(encoded).not.toContain("ssn_hash");

    const history = await getHistory(request("/history", "GET"), ctx(body.id));
    expect(history.status).toBe(200);
    const historyBody = (await history.json()) as {
      data: { from_status: string | null; to_status: string }[];
    };
    expect(historyBody.data).toEqual([
      expect.objectContaining({ from_status: null, to_status: "inquiry" }),
    ]);
  });

  it("returns a per-field 422 for missing and impossible values", async () => {
    const response = await POST(
      request("/api/patients", "POST", {
        first_name: " ",
        date_of_birth: "2026-02-31",
        state: "Massachusetts",
        zip_code: "2108",
        ssn: "123",
      }),
    );
    expect(response.status).toBe(422);
    const body = (await response.json()) as { errors: Record<string, string> };
    expect(body.errors.first_name).toMatch(/required/i);
    expect(body.errors.last_name).toBeTruthy();
    expect(body.errors.date_of_birth).toMatch(/YYYY-MM-DD/);
    expect(body.errors.state).toMatch(/two-letter/);
    expect(body.errors.zip_code).toMatch(/ZIP/);
    expect(body.errors.ssn).toMatch(/9 digits/);
    expect(body.errors.address_line1).toBeTruthy();
    expect(body.errors.city).toBeTruthy();
  });

  it("rejects a future date of birth and an age over 130", async () => {
    const future = await create({
      date_of_birth: formatDateOnly(addUtcDays(utcToday(), 1)),
    });
    expect(future.status).toBe(422);
    expect(
      ((await future.json()) as { errors: Record<string, string> }).errors
        .date_of_birth,
    ).toMatch(/future/);

    const tooOld = await create({ date_of_birth: yearsAgo(131) });
    expect(tooOld.status).toBe(422);
    expect(
      ((await tooOld.json()) as { errors: Record<string, string> }).errors
        .date_of_birth,
    ).toMatch(/130/);
  });

  it("accepts a newborn and a patient who turned 130 today", async () => {
    expect((await create({ date_of_birth: yearsAgo(0) })).status).toBe(201);
    expect(
      (await create({ date_of_birth: yearsAgo(130), last_name: "Elder" }))
        .status,
    ).toBe(201);
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/patients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      errors: { body: "Request body must be JSON." },
    });
  });
});

describe("duplicate patients", () => {
  it("blocks a second SSN and names the existing chart, even if it was deleted", async () => {
    const first = await createOk({ ssn: "900-12-3456" });
    const again = await create(
      { first_name: "Grace", last_name: "Hopper", ssn: "900123456" },
      "?confirm_duplicate=true",
    );
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({
      error: "ssn_duplicate",
      existing_id: first.id,
    });

    const removed = await DELETE(
      request(`/api/patients/${first.id}`, "DELETE"),
      ctx(first.id),
    );
    expect(removed.status).toBe(204);
    const afterDelete = await create({
      first_name: "Grace",
      last_name: "Hopper",
      ssn: "900-12-3456",
    });
    expect(afterDelete.status).toBe(409);
    expect(await afterDelete.json()).toMatchObject({ existing_id: first.id });
  });

  it("warns on the same name and date of birth, then allows a confirmed create", async () => {
    const first = await createOk({ middle_name: "Augusta" });
    const warned = await create({
      first_name: "ada",
      last_name: "LOVELACE",
      middle_name: "Different",
    });
    expect(warned.status).toBe(409);
    const warning = (await warned.json()) as {
      error: string;
      possible_duplicates: { id: string; ssn_last4: string | null }[];
    };
    expect(warning.error).toBe("possible_duplicate");
    expect(warning.possible_duplicates.map((patient) => patient.id)).toEqual([
      first.id,
    ]);
    expect(JSON.stringify(warning)).not.toContain("ssn_hash");

    const confirmed = await create(
      { first_name: "ada", last_name: "LOVELACE" },
      "?confirm_duplicate=true",
    );
    expect(confirmed.status).toBe(201);

    const differentDay = await create({ date_of_birth: "1990-01-16" });
    expect(differentDay.status).toBe(201);
  });
});

describe("GET /api/patients", () => {
  it("filters, sorts, searches, and pages without returning deleted rows", async () => {
    const ada = await createOk({ ssn: "900-12-3456" });
    const grace = await createOk({
      first_name: "Grace",
      last_name: "Hopper",
      date_of_birth: "1906-12-09",
      status: "active",
      ssn: "900-77-1004",
    });
    const churned = await createOk({
      first_name: "Alan",
      last_name: "Turing",
      date_of_birth: "1912-06-23",
      status: "churned",
    });
    const removed = await createOk({
      first_name: "Deleted",
      last_name: "Person",
      ssn: "900-61-8843",
    });
    expect(
      (await DELETE(request("/x", "DELETE"), ctx(removed.id))).status,
    ).toBe(204);

    const live = await listPatients(request("/api/patients", "GET"));
    expect(live.status).toBe(200);
    const liveBody = (await live.json()) as {
      data: { id: string }[];
      total: number;
      page: number;
      page_size: number;
    };
    expect(liveBody.total).toBe(3);
    expect(liveBody.page).toBe(1);
    expect(liveBody.page_size).toBe(20);
    expect(liveBody.data.map((patient) => patient.id).sort()).toEqual(
      [ada.id, grace.id, churned.id].sort(),
    );

    const byStatus = await listPatients(
      request("/api/patients?status=active,churned", "GET"),
    );
    const statusBody = (await byStatus.json()) as {
      data: { id: string }[];
      total: number;
    };
    expect(statusBody.total).toBe(2);
    expect(statusBody.data.map((patient) => patient.id).sort()).toEqual(
      [grace.id, churned.id].sort(),
    );

    const repeated = await listPatients(
      request("/api/patients?status=active&status=inquiry", "GET"),
    );
    expect(((await repeated.json()) as { total: number }).total).toBe(2);

    const byName = await listPatients(
      request("/api/patients?search=ada%20lovelace", "GET"),
    );
    expect(
      ((await byName.json()) as { data: { id: string }[] }).data.map(
        (patient) => patient.id,
      ),
    ).toEqual([ada.id]);

    const byLast4 = await listPatients(
      request("/api/patients?search=1004", "GET"),
    );
    const last4Body = (await byLast4.json()) as { data: PatientBody[] };
    expect(last4Body.data.map((patient) => patient.id)).toEqual([grace.id]);
    expect(JSON.stringify(last4Body)).not.toContain("900771004");
    expect(JSON.stringify(last4Body)).not.toContain("900-77-1004");

    const notLast4 = await listPatients(
      request("/api/patients?search=100", "GET"),
    );
    expect(((await notLast4.json()) as { total: number }).total).toBe(0);

    const sorted = await listPatients(
      request("/api/patients?sort=date_of_birth&order=asc", "GET"),
    );
    expect(
      ((await sorted.json()) as { data: { id: string }[] }).data.map(
        (patient) => patient.id,
      ),
    ).toEqual([grace.id, churned.id, ada.id]);

    const page = await listPatients(
      request("/api/patients?page=2&page_size=2&sort=last_name", "GET"),
    );
    const pageBody = (await page.json()) as {
      data: { last_name: string }[];
      total: number;
      page_size: number;
    };
    expect(pageBody.total).toBe(3);
    expect(pageBody.page_size).toBe(2);
    expect(pageBody.data).toHaveLength(1);
    expect(pageBody.data[0]?.last_name).toBe("Turing");

    const deletedList = await listDeleted(
      request("/api/patients/deleted", "GET"),
    );
    const deletedBody = (await deletedList.json()) as {
      data: PatientBody[];
      total: number;
    };
    expect(deletedBody.total).toBe(1);
    expect(deletedBody.data[0]?.id).toBe(removed.id);
    expect(deletedBody.data[0]?.deleted_at).toEqual(expect.any(String));
    expect(deletedBody.data[0]?.ssn_last4).toBe("8843");
  });

  it("rejects a page size above 100 and an unknown sort", async () => {
    const tooBig = await listPatients(
      request("/api/patients?page_size=101", "GET"),
    );
    expect(tooBig.status).toBe(422);
    expect(
      ((await tooBig.json()) as { errors: Record<string, string> }).errors
        .page_size,
    ).toMatch(/100/);

    const badSort = await listPatients(
      request("/api/patients?sort=ssn", "GET"),
    );
    expect(badSort.status).toBe(422);
    expect(
      ((await badSort.json()) as { errors: Record<string, string> }).errors
        .sort,
    ).toBeTruthy();
  });
});

describe("patient lifecycle", () => {
  it("reads, updates, soft-deletes, and restores a patient", async () => {
    const created = await createOk({ status: "onboarding" });

    const found = await GET(
      request(`/api/patients/${created.id}`, "GET"),
      ctx(created.id),
    );
    expect(found.status).toBe(200);
    expect(((await found.json()) as PatientBody).status).toBe("onboarding");

    const missing = await GET(
      request("/api/patients/nope", "GET"),
      ctx(MISSING_ID),
    );
    expect(missing.status).toBe(404);

    const patched = await PATCH(
      request(`/api/patients/${created.id}`, "PATCH", {
        city: "Cambridge",
        status: "active",
      }),
      ctx(created.id),
    );
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({
      city: "Cambridge",
      status: "active",
    });

    const sameStatus = await PATCH(
      request(`/api/patients/${created.id}`, "PATCH", { status: "active" }),
      ctx(created.id),
    );
    expect(sameStatus.status).toBe(200);

    const back = await PATCH(
      request(`/api/patients/${created.id}`, "PATCH", { status: "churned" }),
      ctx(created.id),
    );
    expect(back.status).toBe(200);
    const returned = await PATCH(
      request(`/api/patients/${created.id}`, "PATCH", { status: "active" }),
      ctx(created.id),
    );
    expect(returned.status).toBe(200);

    const history = await getHistory(
      request("/history", "GET"),
      ctx(created.id),
    );
    const events = (
      (await history.json()) as {
        data: {
          from_status: string | null;
          to_status: string;
          changed_at: string;
        }[];
      }
    ).data;
    expect(events[0]).toMatchObject({
      from_status: "churned",
      to_status: "active",
    });
    expect(
      events.map((event) => `${event.from_status}->${event.to_status}`).sort(),
    ).toEqual(
      [
        "active->churned",
        "churned->active",
        "null->onboarding",
        "onboarding->active",
      ].sort(),
    );
    const stamps = events.map((event) => event.changed_at);
    expect(stamps).toEqual([...stamps].sort().reverse());

    const removed = await DELETE(request("/x", "DELETE"), ctx(created.id));
    expect(removed.status).toBe(204);
    expect(await removed.text()).toBe("");

    expect((await GET(request("/x", "GET"), ctx(created.id))).status).toBe(404);
    expect(
      (await getHistory(request("/x", "GET"), ctx(created.id))).status,
    ).toBe(404);
    expect(
      (await DELETE(request("/x", "DELETE"), ctx(created.id))).status,
    ).toBe(404);

    const stillListed = await listPatients(
      request("/api/patients?search=Lovelace", "GET"),
    );
    expect(((await stillListed.json()) as { total: number }).total).toBe(0);

    const restored = await restorePatient(
      request("/x", "POST"),
      ctx(created.id),
    );
    expect(restored.status).toBe(200);
    expect(((await restored.json()) as PatientBody).deleted_at).toBeNull();
    expect((await GET(request("/x", "GET"), ctx(created.id))).status).toBe(200);

    const again = await restorePatient(request("/x", "POST"), ctx(created.id));
    expect(again.status).toBe(200);
    expect(
      (await restorePatient(request("/x", "POST"), ctx(MISSING_ID))).status,
    ).toBe(404);
  });

  it("rolls back a status change when the new SSN is already on file", async () => {
    const owner = await createOk({ ssn: "900-22-7781", status: "inquiry" });
    const other = await createOk({
      first_name: "Grace",
      last_name: "Hopper",
      ssn: "900-54-2208",
    });

    const conflict = await PATCH(
      request(`/api/patients/${other.id}`, "PATCH", {
        ssn: "900-22-7781",
        status: "active",
      }),
      ctx(other.id),
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ existing_id: owner.id });

    const unchanged = (await (
      await GET(request("/x", "GET"), ctx(other.id))
    ).json()) as PatientBody;
    expect(unchanged.status).toBe("inquiry");
    expect(unchanged.ssn_last4).toBe("2208");

    const history = await getHistory(request("/x", "GET"), ctx(other.id));
    expect(((await history.json()) as { data: unknown[] }).data).toHaveLength(
      1,
    );
  });

  it("lets an update reuse the patient's own SSN and clear it", async () => {
    const patient = await createOk({ ssn: "900-61-8843" });
    const same = await PATCH(
      request(`/api/patients/${patient.id}`, "PATCH", { ssn: "900618843" }),
      ctx(patient.id),
    );
    expect(same.status).toBe(200);
    expect(((await same.json()) as PatientBody).ssn_last4).toBe("8843");

    const cleared = await PATCH(
      request(`/api/patients/${patient.id}`, "PATCH", { ssn: null }),
      ctx(patient.id),
    );
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as PatientBody).ssn_last4).toBeNull();
  });

  it("does not block an update that collides on name and date of birth", async () => {
    await createOk();
    const other = await createOk({
      first_name: "Grace",
      last_name: "Hopper",
      date_of_birth: "1906-12-09",
    });
    const response = await PATCH(
      request(`/api/patients/${other.id}`, "PATCH", {
        first_name: "Ada",
        last_name: "Lovelace",
        date_of_birth: "1990-01-15",
      }),
      ctx(other.id),
    );
    expect(response.status).toBe(200);
  });
});
