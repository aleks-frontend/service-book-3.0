import "dotenv/config";
import { createStaffMember } from "../src/lib/staffMembers.js";
import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/lib/prisma.js";

async function seedStaffMember() {
  const email = process.env.SEED_STAFF_EMAIL;
  const password = process.env.SEED_STAFF_PASSWORD;
  const name = process.env.SEED_STAFF_NAME || "Admin";

  if (!email || !password) {
    throw new Error("SEED_STAFF_EMAIL and SEED_STAFF_PASSWORD must be set to seed a staff member.");
  }

  const ctx = await auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    console.log(`Staff member ${email} already exists, skipping.`);
    return;
  }

  await createStaffMember({ email, password, name });
  console.log(`Seeded staff member ${email}.`);
}

seedStaffMember()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
