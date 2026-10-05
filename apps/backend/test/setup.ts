import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { resetDatabase } from "./resetDatabase.js";

beforeEach(resetDatabase);

afterAll(async () => {
  await prisma.$disconnect();
});
