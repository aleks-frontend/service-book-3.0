import { Router } from "express";
import type { Me } from "@servicebook/schemas";
import { textPolisherOf } from "../lib/textPolisher.js";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  const { id, name, email } = req.user!;
  const me: Me = { id, name, email, features: { aiPolish: textPolisherOf(req) !== null } };
  res.json(me);
});
