import { prisma } from "../src/lib/prisma";
import { decryptSsn, normalizeSsn, storeSsn } from "../src/lib/ssn";

/**
 * Local sample data. Running the seed again wipes these tables and rewrites
 * them, so it is safe to re-run while developing. Every SSN is in the 900–999
 * range, which is not issued, and is stored only as ciphertext plus a hash.
 */

type Status = "inquiry" | "onboarding" | "active" | "churned";

type SeedPatient = {
  firstName: string;
  middleName?: string;
  lastName: string;
  /** Calendar day, YYYY-MM-DD. */
  dateOfBirth: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  /** Fake SSN. Omit when the patient does not have one on file. */
  ssn?: string;
  createdAt: string;
  /** Transitions after the opening inquiry row. The last one is the current status. */
  history?: { to: Status; at: string }[];
  deletedAt?: string;
};

const patients: SeedPatient[] = [
  {
    firstName: "Amara",
    middleName: "J",
    lastName: "Okonkwo",
    dateOfBirth: "1978-06-02",
    addressLine1: "18 Beacon Street",
    city: "Boston",
    state: "MA",
    zipCode: "02108",
    ssn: "900-12-3456",
    createdAt: "2025-11-03T15:00:00.000Z",
    history: [
      { to: "onboarding", at: "2025-11-05T15:00:00.000Z" },
      { to: "active", at: "2025-11-12T15:00:00.000Z" },
    ],
  },
  {
    firstName: "Luis",
    middleName: "Miguel",
    lastName: "Herrera",
    dateOfBirth: "1991-11-23",
    addressLine1: "410 Congress Avenue",
    addressLine2: "Apt 14B",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    ssn: "900-22-7781",
    createdAt: "2026-09-14T15:00:00.000Z",
    history: [{ to: "onboarding", at: "2026-09-16T15:00:00.000Z" }],
  },
  {
    firstName: "Priya",
    lastName: "Nair",
    dateOfBirth: "2001-01-09",
    addressLine1: "88 South 4th Street",
    city: "San Jose",
    state: "CA",
    zipCode: "95112",
    createdAt: "2026-11-02T16:30:00.000Z",
  },
  {
    firstName: "Noah",
    middleName: "Elijah",
    lastName: "Brooks",
    dateOfBirth: "2016-04-30",
    addressLine1: "2550 North Clark Street",
    city: "Chicago",
    state: "IL",
    zipCode: "60614",
    createdAt: "2026-04-02T15:00:00.000Z",
    history: [{ to: "active", at: "2026-04-06T15:00:00.000Z" }],
  },
  {
    firstName: "Helen",
    lastName: "Cho",
    dateOfBirth: "1942-08-17",
    addressLine1: "500 Pine Street",
    city: "Seattle",
    state: "WA",
    zipCode: "98101",
    ssn: "900-77-1004",
    createdAt: "2024-06-11T15:00:00.000Z",
    history: [
      { to: "onboarding", at: "2024-06-18T15:00:00.000Z" },
      { to: "active", at: "2024-07-01T15:00:00.000Z" },
      { to: "churned", at: "2026-02-09T15:00:00.000Z" },
    ],
  },
  {
    firstName: "Sofia",
    middleName: "Elena",
    lastName: "Rossi",
    dateOfBirth: "1988-12-05",
    addressLine1: "200 South Biscayne Boulevard",
    addressLine2: "Suite 1200",
    city: "Miami",
    state: "FL",
    zipCode: "33101-4820",
    ssn: "900-54-2208",
    createdAt: "2026-10-28T15:00:00.000Z",
  },
  {
    firstName: "Eleanor",
    middleName: "Grace",
    lastName: "Whitfield",
    dateOfBirth: "1930-02-14",
    addressLine1: "1600 Glenarm Place",
    city: "Denver",
    state: "CO",
    zipCode: "80202",
    ssn: "900-61-8843",
    createdAt: "2024-03-01T15:00:00.000Z",
    // Left the practice and later came back. Churned is not terminal.
    history: [
      { to: "active", at: "2024-03-20T15:00:00.000Z" },
      { to: "churned", at: "2025-11-02T15:00:00.000Z" },
      { to: "active", at: "2026-06-18T15:00:00.000Z" },
    ],
  },
  {
    firstName: "Jonah",
    lastName: "Blake",
    dateOfBirth: "1995-07-19",
    addressLine1: "10 Market Street",
    city: "Philadelphia",
    state: "PA",
    zipCode: "19106",
    createdAt: "2026-08-21T15:00:00.000Z",
    // Entered twice by mistake. Soft-deleted, not churned.
    deletedAt: "2026-08-21T18:10:00.000Z",
  },
];

/** Noon UTC so the DATE column stays on this calendar day in every US time zone. */
function calendarDay(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function instant(iso: string): Date {
  return new Date(iso);
}

function currentStatus(patient: SeedPatient): Status {
  const history = patient.history ?? [];
  return history.length > 0 ? history[history.length - 1].to : "inquiry";
}

function ssnData(patient: SeedPatient) {
  if (!patient.ssn) {
    return {};
  }

  const digits = normalizeSsn(patient.ssn);
  if (!digits.startsWith("9")) {
    throw new Error(
      `Seed SSN for ${patient.firstName} ${patient.lastName} must use the unissued 900-999 range.`,
    );
  }

  const stored = storeSsn(digits);
  const roundTrip = decryptSsn(stored.ssnEncrypted);
  if (roundTrip !== digits) {
    throw new Error(
      `SSN encryption did not round-trip for ${patient.firstName} ${patient.lastName}.`,
    );
  }

  return stored;
}

async function main() {
  await prisma.$transaction(async (tx) => {
    // History rows reference patients, and the foreign key is ON DELETE RESTRICT.
    await tx.patientStatusHistory.deleteMany();
    await tx.patient.deleteMany();

    for (const patient of patients) {
      const history = patient.history ?? [];
      let previous: Status = "inquiry";
      const statusHistory = [
        {
          fromStatus: null,
          toStatus: "inquiry" as const,
          changedAt: instant(patient.createdAt),
        },
        ...history.map((change) => {
          const row = {
            fromStatus: previous,
            toStatus: change.to,
            changedAt: instant(change.at),
          };
          previous = change.to;
          return row;
        }),
      ];

      await tx.patient.create({
        data: {
          firstName: patient.firstName,
          middleName: patient.middleName ?? null,
          lastName: patient.lastName,
          dateOfBirth: calendarDay(patient.dateOfBirth),
          status: currentStatus(patient),
          addressLine1: patient.addressLine1,
          addressLine2: patient.addressLine2 ?? null,
          city: patient.city,
          state: patient.state,
          zipCode: patient.zipCode,
          country: "US",
          createdAt: instant(patient.createdAt),
          updatedAt: instant(
            history.length > 0
              ? history[history.length - 1].at
              : patient.createdAt,
          ),
          deletedAt: patient.deletedAt ? instant(patient.deletedAt) : null,
          ...ssnData(patient),
          statusHistory: { create: statusHistory },
        },
      });
    }
  });

  const withSsn = patients.filter((patient) => patient.ssn).length;
  const deleted = patients.filter((patient) => patient.deletedAt).length;
  console.log(
    `Seeded ${patients.length} patients (${withSsn} with an SSN, ${deleted} soft-deleted).`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
