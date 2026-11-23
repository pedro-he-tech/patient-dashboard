import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads the database URL here, not from schema.prisma.
 * `prisma generate` loads this file but does not connect, and it runs from
 * `npm install` before a developer has copied `.env`. The fallback is the
 * database from docker-compose.yml. Seed and the app still need `.env`,
 * because the SSN keys are not given a default.
 */
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://patient:patient@localhost:5432/patient_dashboard";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: databaseUrl,
  },
});
