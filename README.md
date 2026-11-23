# Patient Dashboard

A web-based dashboard for healthcare providers to track and view patient records.

This repository is the project scaffold: the application shell, the database, and the tooling. Patient search, forms, and the API are not built yet. The pages under Patients and Deleted patients are placeholders so the navigation can be reviewed on its own.

## Assumptions

Product decisions (who the app is for, what a status means, how deletion differs from churn, how SSNs are handled) are written down in [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md).

## Requirements

- Node.js 22 or newer
- Docker, for the local Postgres database

## Setup

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`npm install` generates the Prisma client. Generating the client does not connect to Postgres, so install still works if `.env` is not copied yet; migrating and seeding do need it. The app is at [http://localhost:3000](http://localhost:3000), which redirects to `/patients`.

The values in `.env.example` match `docker-compose.yml` and are for local development only. Replace the two SSN keys before any real patient data is stored (`openssl rand -base64 32`). The keys must be different from each other.

## Scripts

| Script               | What it does                                                         |
| -------------------- | -------------------------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                                         |
| `npm run build`      | Production build                                                     |
| `npm run lint`       | ESLint                                                               |
| `npm run format`     | Rewrite files with Prettier                                          |
| `npm run db:migrate` | Apply schema changes with Prisma Migrate, then regenerate the client |
| `npm run db:seed`    | Replace the local sample patients                                    |
| `npm run test`       | Run the API tests against a separate local database                  |

`npm run db:migrate` uses `prisma migrate dev`, which is the development workflow (it can create a new migration and needs a shadow database). It is not the command to run against a production database.

## Data model

Defined in `prisma/schema.prisma`.

- `patients` holds the record. `patient_status_history` holds one row per status change, including the first change from "no status" to Inquiry.
- `deleted_at` is a soft delete. Churned patients stay visible; deleted patients do not.
- A Social Security number is optional. It is stored as AES-256-GCM ciphertext, a keyed HMAC for duplicate checks, and the last four digits in plaintext. See `src/lib/ssn.ts`.
- Date of birth is a `DATE`. It cannot be in the future and age is capped at 130, but those rules are not database `CHECK`s: PostgreSQL requires check expressions to be immutable, and `CURRENT_DATE` is not. Application code will enforce them with the API.
- The live-patient status index is a partial index declared in the Prisma schema (`deleted_at IS NULL`).
- The duplicate-name index is also partial, and it indexes `lower(first_name)`, `lower(last_name)`, and `date_of_birth`. Prisma cannot express that expression index, so it is added in the initial SQL migration as `patients_name_dob_active_idx`.

`npm run db:seed` loads eight fictional patients. Five have fake SSNs in the unissued 900–999 range. One row is soft-deleted. Re-running the seed clears those two tables and writes them again.

## API

Routes live under `/api/patients`. Handlers parse the request and call `src/lib/patients/service.ts`. Validation is the Zod schemas in `src/lib/patients/schema.ts`, which the forms can import later. Responses never include the SSN ciphertext, the SSN hash, or the full number. `ssn_last4` is the only SSN field returned.

`npm run test` creates `patient_dashboard_test` on the local Postgres server and migrates it. The development database used by `npm run db:seed` is left alone.

## Layout

```
src/app/                  pages and the root layout
src/app/api/patients/     HTTP handlers
src/components/           header and shared UI
src/lib/patients/         validation, serialization, and the patient service
src/lib/prisma.ts         shared Prisma Client
src/lib/ssn.ts            SSN encryption and hashing
tests/                    API tests
prisma/schema.prisma      data model
prisma/migrations/        SQL migrations
prisma/seed.ts            sample patients
docs/ASSUMPTIONS.md       product assumptions
```
