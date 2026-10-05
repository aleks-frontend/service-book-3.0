import request from "supertest";
import { createApp } from "../src/app.js";
import { createStaffMember, type NewStaffMember } from "../src/lib/staffMembers.js";

export const STAFF: NewStaffMember = {
  email: "staff@example.com",
  password: "correct-horse-battery",
  name: "Test Staff",
};

/**
 * A Supertest agent logged in as a freshly seeded staff member. The agent
 * keeps the session cookie, so every later request is authenticated.
 */
export async function authenticatedAgent() {
  const staffMember = await createStaffMember(STAFF);
  const agent = request.agent(createApp());

  const response = await agent
    .post("/api/auth/sign-in/email")
    .send({ email: STAFF.email, password: STAFF.password });
  if (response.status !== 200) {
    throw new Error(`Test login failed with ${response.status}: ${JSON.stringify(response.body)}`);
  }

  return { agent, staffMember };
}
