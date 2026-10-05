import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** The logged-in staff member, as returned by `GET /api/me`. */
export const staffMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});

export type StaffMember = z.infer<typeof staffMemberSchema>;
