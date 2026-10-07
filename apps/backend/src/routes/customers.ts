import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  customerInputSchema,
  customerListQuerySchema,
  type Customer,
  type Page,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";

export const customersRouter = Router();

// The legacy ID is for the import only; staff members never see it.
const hideLegacyId = { legacyId: true } as const;

function sendNotFound(res: Response) {
  res.status(404).json({ error: "Customer not found" });
}

/**
 * The customer id from the path, or null after sending a 404. A malformed id
 * names no customer, so it is a 404 like any unknown id, not a 400.
 */
function customerId(req: Request, res: Response): string | null {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) sendNotFound(res);
  return id.success ? id.data : null;
}

/** The parsed body, or null after sending a 400 with the issue details. */
function customerInput(req: Request, res: Response) {
  const parsed = customerInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid customer", details: parsed.error.flatten() });
  }
  return parsed.success ? parsed.data : null;
}

function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

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
  const input = customerInput(req, res);
  if (!input) return;

  const customer: Customer = await prisma.customer.create({ data: input, omit: hideLegacyId });
  res.status(201).json(customer);
});

customersRouter.get("/:id", async (req, res) => {
  const id = customerId(req, res);
  if (!id) return;

  const customer: Customer | null = await prisma.customer.findUnique({
    where: { id },
    omit: hideLegacyId,
  });
  if (!customer) {
    sendNotFound(res);
    return;
  }
  res.json(customer);
});

// The edit dialog always sends every field, so an update replaces them all.
customersRouter.put("/:id", async (req, res) => {
  const id = customerId(req, res);
  if (!id) return;
  const input = customerInput(req, res);
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
    sendNotFound(res);
  }
});

customersRouter.delete("/:id", async (req, res) => {
  const id = customerId(req, res);
  if (!id) return;

  try {
    await prisma.customer.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    if (!isNotFound(error)) throw error;
    sendNotFound(res);
  }
});
