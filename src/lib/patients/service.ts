import type { Patient, Prisma } from "../../generated/prisma/client";
import { Prisma as PrismaNamespace } from "../../generated/prisma/client";
import { prisma } from "../prisma";
import { parseCalendarDate } from "./dates";
import {
  PatientNotFoundError,
  PossibleDuplicateError,
  SsnDuplicateError,
} from "./errors";
import type {
  CreatePatientInput,
  ListQuery,
  UpdatePatientInput,
} from "./schema";
import {
  serializePatient,
  serializeStatusHistory,
  type PatientListResponse,
  type PatientResponse,
  type StatusHistoryResponse,
} from "./serialize";
import { hashSsn, storeSsn } from "../ssn";

/**
 * Patient use cases. Route handlers only parse HTTP and call these functions.
 *
 * Duplicate rules:
 * - The same SSN is a hard stop on create and update, including when the other
 *   row is soft-deleted. `ssn_hash` is unique across the whole table.
 * - The same first name, last name, and date of birth (middle name ignored,
 *   case ignored) is a warning on create. `?confirm_duplicate=true` bypasses
 *   it. Deleted rows are not warnings: the supporting index only covers live
 *   patients. Update does not repeat this warning; the design only requires
 *   SSN dedupe on PATCH.
 * - A status change and the history row are written in one transaction, so a
 *   chart never shows a status the timeline cannot explain.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SORT_COLUMNS = {
  last_name: "lastName",
  date_of_birth: "dateOfBirth",
  created_at: "createdAt",
  status: "status",
} as const;

type PatientDb = Prisma.TransactionClient;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Prisma's Bytes fields want a Uint8Array backed by a plain ArrayBuffer, not a Node Buffer. */
function ssnBytes(ssn: string): {
  ssnEncrypted: Uint8Array<ArrayBuffer>;
  ssnLast4: string;
  ssnHash: string;
} {
  const stored = storeSsn(ssn);
  const ssnEncrypted = new Uint8Array(
    new ArrayBuffer(stored.ssnEncrypted.byteLength),
  );
  ssnEncrypted.set(stored.ssnEncrypted);
  return {
    ssnEncrypted,
    ssnLast4: stored.ssnLast4,
    ssnHash: stored.ssnHash,
  };
}

function calendarDate(isoDate: string): Date {
  const date = parseCalendarDate(isoDate);
  if (!date) {
    // The schema already rejected this. Reaching it means a caller skipped validation.
    throw new Error(`Invalid calendar date reached the service: ${isoDate}`);
  }
  return date;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function assertSsnAvailable(
  db: PatientDb,
  ssn: string,
  exceptId?: string,
): Promise<void> {
  const existing = await db.patient.findUnique({
    where: { ssnHash: hashSsn(ssn) },
    select: { id: true },
  });
  if (existing && existing.id !== exceptId) {
    throw new SsnDuplicateError(existing.id);
  }
}

async function findNameDobDuplicates(
  db: PatientDb,
  input: { first_name: string; last_name: string; date_of_birth: string },
): Promise<Patient[]> {
  return db.patient.findMany({
    where: {
      deletedAt: null,
      dateOfBirth: calendarDate(input.date_of_birth),
      firstName: { equals: input.first_name, mode: "insensitive" },
      lastName: { equals: input.last_name, mode: "insensitive" },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });
}

/**
 * Each word must appear in the first, middle, or last name, so "Ada Lovelace"
 * matches a chart whose names are split across columns. A search that is
 * exactly four digits also matches `ssn_last4`. There is no trigram index, so
 * this is case-insensitive substring match rather than edit distance.
 */
function searchFilter(
  search: string | undefined,
): Prisma.PatientWhereInput | undefined {
  if (!search) {
    return undefined;
  }

  const tokens = search.split(/\s+/).filter((token) => token !== "");
  const nameMatch: Prisma.PatientWhereInput = {
    AND: tokens.map((token) => ({
      OR: [
        { firstName: { contains: token, mode: "insensitive" } },
        { middleName: { contains: token, mode: "insensitive" } },
        { lastName: { contains: token, mode: "insensitive" } },
      ],
    })),
  };

  if (/^\d{4}$/.test(search)) {
    return { OR: [nameMatch, { ssnLast4: search }] };
  }

  return nameMatch;
}

function listWhere(
  query: ListQuery,
  deleted: boolean,
): Prisma.PatientWhereInput {
  const filters: Prisma.PatientWhereInput[] = [
    deleted ? { deletedAt: { not: null } } : { deletedAt: null },
  ];

  if (query.status && query.status.length > 0) {
    filters.push({ status: { in: query.status } });
  }

  const search = searchFilter(query.search);
  if (search) {
    filters.push(search);
  }

  return { AND: filters };
}

async function listPatients(
  query: ListQuery,
  deleted: boolean,
): Promise<PatientListResponse> {
  const where = listWhere(query, deleted);
  // `id` is the tie-break so two patients with the same sort key cannot swap
  // pages between requests.
  const orderBy = [
    { [SORT_COLUMNS[query.sort]]: query.order },
    { id: "asc" as const },
  ];

  const [total, rows] = await prisma.$transaction([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    }),
  ]);

  return {
    data: rows.map(serializePatient),
    total,
    page: query.page,
    page_size: query.page_size,
  };
}

export function listLivePatients(
  query: ListQuery,
): Promise<PatientListResponse> {
  return listPatients(query, false);
}

export function listDeletedPatients(
  query: ListQuery,
): Promise<PatientListResponse> {
  return listPatients(query, true);
}

export async function getPatient(id: string): Promise<PatientResponse> {
  if (!isUuid(id)) {
    throw new PatientNotFoundError();
  }

  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient || patient.deletedAt) {
    throw new PatientNotFoundError();
  }

  return serializePatient(patient);
}

function patientData(input: CreatePatientInput): Prisma.PatientCreateInput {
  return {
    firstName: input.first_name,
    middleName: input.middle_name,
    lastName: input.last_name,
    dateOfBirth: calendarDate(input.date_of_birth),
    status: input.status,
    addressLine1: input.address_line1,
    addressLine2: input.address_line2,
    city: input.city,
    state: input.state,
    zipCode: input.zip_code,
    country: input.country,
    ...(input.ssn ? ssnBytes(input.ssn) : {}),
    statusHistory: {
      create: {
        fromStatus: null,
        toStatus: input.status,
      },
    },
  };
}

export async function createPatient(
  input: CreatePatientInput,
  options: { confirmDuplicate: boolean },
): Promise<PatientResponse> {
  if (input.ssn) {
    await assertSsnAvailable(prisma, input.ssn);
  }

  if (!options.confirmDuplicate) {
    const duplicates = await findNameDobDuplicates(prisma, input);
    if (duplicates.length > 0) {
      throw new PossibleDuplicateError(duplicates.map(serializePatient));
    }
  }

  try {
    const created = await prisma.patient.create({ data: patientData(input) });
    return serializePatient(created);
  } catch (error) {
    // The pre-check above can lose a race with another request. The unique
    // index is the backstop, and the response still names the existing chart.
    if (isUniqueViolation(error) && input.ssn) {
      const existing = await prisma.patient.findUnique({
        where: { ssnHash: hashSsn(input.ssn) },
        select: { id: true },
      });
      if (existing) {
        throw new SsnDuplicateError(existing.id);
      }
    }
    throw error;
  }
}

function updateData(input: UpdatePatientInput): Prisma.PatientUpdateInput {
  const data: Prisma.PatientUpdateInput = {};

  if (input.first_name !== undefined) data.firstName = input.first_name;
  if (input.middle_name !== undefined) data.middleName = input.middle_name;
  if (input.last_name !== undefined) data.lastName = input.last_name;
  if (input.date_of_birth !== undefined) {
    data.dateOfBirth = calendarDate(input.date_of_birth);
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.address_line1 !== undefined)
    data.addressLine1 = input.address_line1;
  if (input.address_line2 !== undefined)
    data.addressLine2 = input.address_line2;
  if (input.city !== undefined) data.city = input.city;
  if (input.state !== undefined) data.state = input.state;
  if (input.zip_code !== undefined) data.zipCode = input.zip_code;
  if (input.country !== undefined) data.country = input.country;

  if (input.ssn === null) {
    data.ssnEncrypted = null;
    data.ssnLast4 = null;
    data.ssnHash = null;
  } else if (input.ssn !== undefined) {
    const stored = ssnBytes(input.ssn);
    data.ssnEncrypted = stored.ssnEncrypted;
    data.ssnLast4 = stored.ssnLast4;
    data.ssnHash = stored.ssnHash;
  }

  return data;
}

export async function updatePatient(
  id: string,
  input: UpdatePatientInput,
): Promise<PatientResponse> {
  if (!isUuid(id)) {
    throw new PatientNotFoundError();
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.patient.findUnique({ where: { id } });
      if (!existing || existing.deletedAt) {
        throw new PatientNotFoundError();
      }

      if (input.ssn) {
        await assertSsnAvailable(tx, input.ssn, id);
      }

      const updated = await tx.patient.update({
        where: { id },
        data: updateData(input),
      });

      if (input.status !== undefined && input.status !== existing.status) {
        await tx.patientStatusHistory.create({
          data: {
            patientId: id,
            fromStatus: existing.status,
            toStatus: input.status,
          },
        });
      }

      return serializePatient(updated);
    });
  } catch (error) {
    if (isUniqueViolation(error) && input.ssn) {
      const existing = await prisma.patient.findUnique({
        where: { ssnHash: hashSsn(input.ssn) },
        select: { id: true },
      });
      if (existing) {
        throw new SsnDuplicateError(existing.id);
      }
    }
    throw error;
  }
}

export async function deletePatient(id: string): Promise<void> {
  if (!isUuid(id)) {
    throw new PatientNotFoundError();
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.patient.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new PatientNotFoundError();
    }

    await tx.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  });
}

export async function restorePatient(id: string): Promise<PatientResponse> {
  if (!isUuid(id)) {
    throw new PatientNotFoundError();
  }

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) {
    throw new PatientNotFoundError();
  }

  if (!existing.deletedAt) {
    return serializePatient(existing);
  }

  const restored = await prisma.patient.update({
    where: { id },
    data: { deletedAt: null },
  });
  return serializePatient(restored);
}

export async function listStatusHistory(
  id: string,
): Promise<StatusHistoryResponse[]> {
  if (!isUuid(id)) {
    throw new PatientNotFoundError();
  }

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });
  if (!patient || patient.deletedAt) {
    throw new PatientNotFoundError();
  }

  const rows = await prisma.patientStatusHistory.findMany({
    where: { patientId: id },
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
  });
  return rows.map(serializeStatusHistory);
}
