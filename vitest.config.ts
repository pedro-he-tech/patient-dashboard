import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Tests talk to their own database so they can wipe rows without touching the
 * seeded development data. Keys match .env.example; they are not secrets.
 */
export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL:
        "postgresql://patient:patient@localhost:5432/patient_dashboard_test",
      SSN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      SSN_HMAC_KEY: "ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=",
    },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
