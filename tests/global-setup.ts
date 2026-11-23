import { execSync } from "node:child_process";
import { Client } from "pg";

const ADMIN_URL =
  "postgresql://patient:patient@localhost:5432/patient_dashboard";
const TEST_DATABASE_URL =
  "postgresql://patient:patient@localhost:5432/patient_dashboard_test";

/** Create the test database once, then apply the committed migrations to it. */
export async function setup(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  const existing = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    ["patient_dashboard_test"],
  );
  if (existing.rowCount === 0) {
    await admin.query("CREATE DATABASE patient_dashboard_test");
  }
  await admin.end();

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
