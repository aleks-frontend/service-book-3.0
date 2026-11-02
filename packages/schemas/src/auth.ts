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

/** What this deployment offers, switched on by its configuration. */
export type Features = {
  /** AI polish of the customer report: on when an AI provider key is configured. */
  aiPolish: boolean;
};

/** `GET /api/me`: the logged-in staff member and the features they can use. */
export type Me = StaffMember & { features: Features };
