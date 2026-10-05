import type { StaffMember } from "@servicebook/schemas";
import { auth } from "./auth.js";

export type NewStaffMember = {
  email: string;
  password: string;
  name: string;
};

export async function findStaffMemberByEmail(email: string): Promise<StaffMember | null> {
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email);
  return found && { id: found.user.id, name: found.user.name, email: found.user.email };
}

/**
 * Creates a staff member who can log in with email and password. Sign-up is
 * disabled, so this goes through Better Auth's internal adapter (as in the
 * bakery seed) rather than the public sign-up endpoint.
 */
export async function createStaffMember({
  email,
  password,
  name,
}: NewStaffMember): Promise<StaffMember> {
  if (await findStaffMemberByEmail(email)) {
    throw new Error(`A staff member with email ${email} already exists.`);
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);
  const user = await ctx.internalAdapter.createUser(
    { email, name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashedPassword,
  });

  return { id: user.id, name: user.name, email: user.email };
}
