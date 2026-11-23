import { z } from "zod";
import {
  MAX_PATIENT_AGE_YEARS,
  ageInYears,
  parseCalendarDate,
  utcToday,
} from "./dates";
import { PatientValidationError } from "./errors";
import { PATIENT_STATUSES } from "./types";

/**
 * Shared patient contract for the API and the forms.
 *
 * This module does not touch the database, so a client component can import
 * it. JSON keys are snake_case because the design names the wire fields that
 * way (`page_size`, `date_of_birth`, `confirm_duplicate`, `possible_duplicates`).
 * One schema means the form and the route reject the same values.
 */

export const patientStatusSchema = z.enum(PATIENT_STATUSES, {
  error: "Status must be inquiry, onboarding, active, or churned.",
});

export type PatientStatusValue = z.infer<typeof patientStatusSchema>;

function requiredText(label: string, max: number) {
  return z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);
}

/** Blank, missing, and null all become null. Used on create, where "blank" means "not provided". */
function optionalTextOnCreate(max: number, label: string) {
  return z
    .union([
      z
        .string()
        .trim()
        .max(max, `${label} must be ${max} characters or fewer.`),
      z.null(),
    ])
    .optional()
    .transform((value) => {
      if (value == null) {
        return null;
      }
      return value === "" ? null : value;
    });
}

/**
 * On update, a missing key leaves the column alone. Null or "" clears it.
 * The two have to stay distinct, which is why update is not `create.partial()`.
 */
function optionalTextOnUpdate(max: number, label: string) {
  return z
    .union([
      z
        .string()
        .trim()
        .max(max, `${label} must be ${max} characters or fewer.`),
      z.null(),
    ])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      if (value === null || value === "") {
        return null;
      }
      return value;
    });
}

export const dateOfBirthSchema = z
  .string({ error: "Date of birth is required." })
  .trim()
  .superRefine((value, ctx) => {
    if (value === "") {
      ctx.addIssue({
        code: "custom",
        message: "Date of birth is required.",
      });
      return;
    }

    const date = parseCalendarDate(value);
    if (!date) {
      ctx.addIssue({
        code: "custom",
        message: "Use a real calendar date in YYYY-MM-DD form.",
      });
      return;
    }

    const today = utcToday();
    if (date.getTime() > today.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "Date of birth cannot be in the future.",
      });
      return;
    }

    if (ageInYears(date, today) > MAX_PATIENT_AGE_YEARS) {
      ctx.addIssue({
        code: "custom",
        message: `Date of birth cannot be more than ${MAX_PATIENT_AGE_YEARS} years ago.`,
      });
    }
  });

export const stateSchema = z
  .string({ error: "State is required." })
  .trim()
  .toUpperCase()
  .superRefine((value, ctx) => {
    if (value === "") {
      ctx.addIssue({ code: "custom", message: "State is required." });
      return;
    }
    if (!/^[A-Z]{2}$/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Use a two-letter state code.",
      });
    }
  });

export const zipCodeSchema = z
  .string({ error: "ZIP code is required." })
  .trim()
  .superRefine((value, ctx) => {
    if (value === "") {
      ctx.addIssue({ code: "custom", message: "ZIP code is required." });
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Use a 5-digit ZIP or ZIP+4.",
      });
    }
  });

export const countrySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Use a two-letter country code.");

const SSN_DIGIT_MESSAGE = "SSN must contain exactly 9 digits.";

function ssnDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length === 9 ? digits : null;
}

/**
 * Nine digits, ignoring dashes and spaces. Exported so a form can validate an
 * SSN on its own. Blank is not a valid SSN here; create and update decide
 * whether blank means "not provided" or "clear the value".
 */
export const ssnSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!ssnDigits(value)) {
      ctx.addIssue({ code: "custom", message: SSN_DIGIT_MESSAGE });
    }
  })
  .transform((value) => value.replace(/\D/g, ""));

function optionalSsn(blankMeans: "omit" | "clear") {
  return z
    .union([z.string(), z.null()])
    .optional()
    .superRefine((value, ctx) => {
      if (typeof value !== "string") {
        return;
      }
      if (value.trim() === "") {
        return;
      }
      if (!ssnDigits(value)) {
        ctx.addIssue({ code: "custom", message: SSN_DIGIT_MESSAGE });
      }
    })
    .transform((value) => {
      if (value === undefined) {
        return blankMeans === "omit" ? undefined : null;
      }
      if (value === null || value.trim() === "") {
        return null;
      }
      return value.replace(/\D/g, "");
    });
}

/** Create: omitted, null, and "" all mean the patient has no SSN. */
const createSsnSchema = optionalSsn("clear");

/** Update: omitted leaves the SSN alone. null and "" clear it. */
const updateSsnSchema = optionalSsn("omit");

export const createPatientSchema = z.object({
  first_name: requiredText("First name", 100),
  middle_name: optionalTextOnCreate(100, "Middle name"),
  last_name: requiredText("Last name", 100),
  date_of_birth: dateOfBirthSchema,
  status: patientStatusSchema.default("inquiry"),
  address_line1: requiredText("Address line 1", 200),
  address_line2: optionalTextOnCreate(200, "Address line 2"),
  city: requiredText("City", 100),
  state: stateSchema,
  zip_code: zipCodeSchema,
  country: countrySchema.default("US"),
  ssn: createSsnSchema,
});

export const updatePatientSchema = z.object({
  first_name: requiredText("First name", 100).optional(),
  middle_name: optionalTextOnUpdate(100, "Middle name"),
  last_name: requiredText("Last name", 100).optional(),
  date_of_birth: dateOfBirthSchema.optional(),
  status: patientStatusSchema.optional(),
  address_line1: requiredText("Address line 1", 200).optional(),
  address_line2: optionalTextOnUpdate(200, "Address line 2"),
  city: requiredText("City", 100).optional(),
  state: stateSchema.optional(),
  zip_code: zipCodeSchema.optional(),
  country: countrySchema.optional(),
  ssn: updateSsnSchema,
});

const wholeNumber = z
  .string()
  .regex(/^[1-9]\d*$/, "Must be a whole number of 1 or more.")
  .transform(Number);

export const listQuerySchema = z.object({
  search: z
    .string()
    .trim()
    .max(200, "Search must be 200 characters or fewer.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  status: z.array(patientStatusSchema).optional(),
  sort: z
    .enum(["last_name", "date_of_birth", "created_at", "status"], {
      error: "Sort must be last_name, date_of_birth, created_at, or status.",
    })
    .default("last_name"),
  order: z
    .enum(["asc", "desc"], { error: "Order must be asc or desc." })
    .default("asc"),
  page: wholeNumber.optional().default(1),
  page_size: wholeNumber
    .refine((value) => value <= 100, "page_size cannot be greater than 100.")
    .optional()
    .default(20),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;

export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key =
      issue.path.filter((part) => typeof part !== "number").join(".") || "body";
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function parseWith<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new PatientValidationError(zodFieldErrors(parsed.error));
  }
  return parsed.data;
}

export function parseCreatePatient(body: unknown): CreatePatientInput {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new PatientValidationError({
      body: "Request body must be a JSON object.",
    });
  }
  return parseWith(createPatientSchema, body);
}

export function parseUpdatePatient(body: unknown): UpdatePatientInput {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new PatientValidationError({
      body: "Request body must be a JSON object.",
    });
  }
  return parseWith(updatePatientSchema, body);
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PatientValidationError({ body: "Request body must be JSON." });
  }
}

function readStatuses(url: URL): string[] | undefined {
  const values = url.searchParams
    .getAll("status")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value !== "");
  return values.length > 0 ? values : undefined;
}

export function parseListQuery(url: URL): ListQuery {
  return parseWith(listQuerySchema, {
    search: url.searchParams.get("search") ?? undefined,
    status: readStatuses(url),
    sort: url.searchParams.get("sort") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    page_size: url.searchParams.get("page_size") ?? undefined,
  });
}

export function confirmDuplicate(url: URL): boolean {
  return url.searchParams.get("confirm_duplicate") === "true";
}
