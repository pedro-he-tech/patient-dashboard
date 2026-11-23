import { beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";

beforeEach(async () => {
  await prisma.patientStatusHistory.deleteMany();
  await prisma.patient.deleteMany();
});
