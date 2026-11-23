-- CreateEnum
CREATE TYPE "patient_status" AS ENUM ('inquiry', 'onboarding', 'active', 'churned');

-- CreateTable
CREATE TABLE "patients" (
    "id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "status" "patient_status" NOT NULL DEFAULT 'inquiry',
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "zip_code" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'US',
    "ssn_encrypted" BYTEA,
    "ssn_last4" CHAR(4),
    "ssn_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_status_history" (
    "id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "from_status" "patient_status",
    "to_status" "patient_status" NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_ssn_hash_key" ON "patients"("ssn_hash");

-- CreateIndex
CREATE INDEX "patients_status_active_idx" ON "patients"("status") WHERE ("deleted_at" IS NULL);

-- CreateIndex
CREATE INDEX "patient_status_history_patient_changed_idx" ON "patient_status_history"("patient_id", "changed_at");

-- AddForeignKey
ALTER TABLE "patient_status_history" ADD CONSTRAINT "patient_status_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- date_of_birth is a DATE so a time zone cannot move the calendar day.
-- "Not in the future" and "age <= 130" are not CHECK constraints: PostgreSQL
-- requires CHECK expressions to be immutable, and CURRENT_DATE is not.
-- Application code enforces both rules.

-- The three SSN columns describe one value. Either all are null or none are.
ALTER TABLE "patients" ADD CONSTRAINT "patients_ssn_all_or_nothing" CHECK (
    (
        "ssn_encrypted" IS NULL
        AND "ssn_last4" IS NULL
        AND "ssn_hash" IS NULL
    )
    OR (
        "ssn_encrypted" IS NOT NULL
        AND "ssn_last4" IS NOT NULL
        AND "ssn_hash" IS NOT NULL
    )
);

-- Case-insensitive duplicate lookup for rows that are not soft-deleted.
-- Prisma's schema language cannot index lower(), so the index is declared here.
CREATE INDEX "patients_name_dob_active_idx"
ON "patients" (lower("first_name"), lower("last_name"), "date_of_birth")
WHERE "deleted_at" IS NULL;
