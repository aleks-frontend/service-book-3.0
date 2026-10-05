// Run by globalSetup with DATABASE_URL pointing at the e2e database.
import { createStaffMember } from "../apps/backend/src/lib/staffMembers.js";
import { prisma } from "../apps/backend/src/lib/prisma.js";
import { resetDatabase } from "../apps/backend/test/resetDatabase.js";
import { STAFF } from "./env.js";

await resetDatabase();
await createStaffMember(STAFF);
await prisma.$disconnect();
