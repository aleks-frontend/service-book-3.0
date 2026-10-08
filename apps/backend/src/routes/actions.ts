import { Router } from "express";
import { actionInputSchema, type Action } from "@servicebook/schemas";
import { prisma } from "../lib/prisma.js";
import { hideLegacyId, idParam, isNotFound, parseBody, sendNotFound } from "../lib/routeHelpers.js";

export const actionsRouter = Router();

const LABEL = "Action";

// The price list is short, so it is sent whole and searched in the admin panel.
actionsRouter.get("/", async (_req, res) => {
  const actions: Action[] = await prisma.action.findMany({
    // The id tie-break keeps the order stable when names repeat.
    orderBy: [{ name: "asc" }, { id: "asc" }],
    omit: hideLegacyId,
  });
  res.json(actions);
});

actionsRouter.post("/", async (req, res) => {
  const input = parseBody(actionInputSchema, req, res, LABEL);
  if (!input) return;

  const action: Action = await prisma.action.create({ data: input, omit: hideLegacyId });
  res.status(201).json(action);
});

actionsRouter.get("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const action: Action | null = await prisma.action.findUnique({
    where: { id },
    omit: hideLegacyId,
  });
  if (!action) {
    sendNotFound(res, LABEL);
    return;
  }
  res.json(action);
});

actionsRouter.put("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;
  const input = parseBody(actionInputSchema, req, res, LABEL);
  if (!input) return;

  try {
    const action: Action = await prisma.action.update({
      where: { id },
      data: input,
      omit: hideLegacyId,
    });
    res.json(action);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});

actionsRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  try {
    await prisma.action.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});
