import { Router } from "express";
import {
  customerInputSchema,
  customerListQuerySchema,
  type Customer,
  type Page,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import {
  hideLegacyId,
  idParam,
  isForeignKeyViolation,
  isNotFound,
  parseBody,
  sendInUse,
  sendNotFound,
} from "../lib/routeHelpers.js";

export const customersRouter = Router();

const LABEL = "Customer";

customersRouter.get("/", async (req, res) => {
  const parsed = customerListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.flatten() });
    return;
  }

  const { page, pageSize, search, sortDir } = parsed.data;
  const where: Prisma.CustomerWhereInput = search
    ? {
        OR: (["name", "phone", "email"] as const).map((field) => ({
          [field]: { contains: search, mode: "insensitive" },
        })),
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      // The id tie-break keeps pages stable when names repeat.
      orderBy: [{ name: sortDir }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      omit: hideLegacyId,
    }),
    prisma.customer.count({ where }),
  ]);

  const result: Page<Customer> = { items, total, page, pageSize };
  res.json(result);
});

customersRouter.post("/", async (req, res) => {
  const input = parseBody(customerInputSchema, req, res, LABEL);
  if (!input) return;

  const customer: Customer = await prisma.customer.create({ data: input, omit: hideLegacyId });
  res.status(201).json(customer);
});

customersRouter.get("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  const customer: Customer | null = await prisma.customer.findUnique({
    where: { id },
    omit: hideLegacyId,
  });
  if (!customer) {
    sendNotFound(res, LABEL);
    return;
  }
  res.json(customer);
});

// The edit dialog always sends every field, so an update replaces them all.
customersRouter.put("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;
  const input = parseBody(customerInputSchema, req, res, LABEL);
  if (!input) return;

  try {
    const customer: Customer = await prisma.customer.update({
      where: { id },
      data: input,
      omit: hideLegacyId,
    });
    res.json(customer);
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});

customersRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  try {
    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    // A customer who still owns devices or has services keeps them, so the delete is refused.
    if (isForeignKeyViolation(error)) {
      sendInUse(res, LABEL, "CUSTOMER_IN_USE");
      return;
    }
    if (!isNotFound(error)) throw error;
    sendNotFound(res, LABEL);
  }
});
