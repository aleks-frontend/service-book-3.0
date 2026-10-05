import { Router } from "express";
import type { StaffMember } from "@servicebook/schemas";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  const { id, name, email } = req.user!;
  const staffMember: StaffMember = { id, name, email };
  res.json(staffMember);
});
