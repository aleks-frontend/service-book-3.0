import { Router } from "express";
import {
  actionInputSchema,
  actionListQuerySchema,
  type Action,
  type Page,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { bulkDeleteHandler } from "../lib/bulkDelete.js";
import { prisma } from "../lib/prisma.js";
import {
  hideLegacyId,
  idParam,
  isNotFound,
  parseBody,
  sendDelete,
  sendNotFound,
} from "../lib/routeHelpers.js";

export const actionsRouter = Router();

const LABEL = "Action";

actionsRouter.get("/", async (req, res) => {
  const parsed = actionListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }

  const { page, pageSize, search, sortDir } = parsed.data;
  const where: Prisma.ActionWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const [items, total] = await Promise.all([
    prisma.action.findMany({
      where,
      // The id tie-break keeps pages stable when names repeat.
      orderBy: [{ name: sortDir }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      omit: hideLegacyId,
    }),
    prisma.action.count({ where }),
  ]);

  const result: Page<Action> = { items, total, page, pageSize };
  res.json(result);
});

actionsRouter.post("/", async (req, res) => {
  const input = parseBody(actionInputSchema, req, res, LABEL);
  if (!input) return;

  const action: Action = await prisma.action.create({ data: input, omit: hideLegacyId });
  res.status(201).json(action);
});

actionsRouter.post(
  "/bulk-delete",
  bulkDeleteHandler(LABEL, (id) => prisma.action.delete({ where: { id } })),
);

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

// An action used on a work line stays, so old services keep their lines.
actionsRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  await sendDelete(res, LABEL, "ACTION_IN_USE", () => prisma.action.delete({ where: { id } }));
});
