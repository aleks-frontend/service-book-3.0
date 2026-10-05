import "dotenv/config";
import { createStaffMember } from "../lib/staffMembers.js";
import { prisma } from "../lib/prisma.js";

// Usage: npm run staff:create -w @servicebook/backend -- <email> <password> [name]
const [email, password, name = email?.split("@")[0]] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npm run staff:create -w @servicebook/backend -- <email> <password> [name]");
  process.exit(1);
}

try {
  const staffMember = await createStaffMember({ email, password, name: name! });
  console.log(`Created staff member ${staffMember.email}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
