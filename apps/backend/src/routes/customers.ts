import { Router } from "express";
import {
  customerInputSchema,
  customerListQuerySchema,
  type Customer,
  type Page,
  type Service,
} from "@servicebook/schemas";
import { Prisma } from "../generated/prisma/client.js";
import { bulkDeleteHandler } from "../lib/bulkDelete.js";
import { prisma } from "../lib/prisma.js";
import { findCustomerIdsByPhone, isPhoneTerm } from "../lib/phoneSearch.js";
import { findServiceHistory } from "../lib/serviceRows.js";
import {
  hideLegacyId,
  idParam,
  isNotFound,
  parseBody,
  sendDelete,
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
  // Prisma can't compare phones by their digits, so those matches come back as ids.
  const phoneMatches = search && isPhoneTerm(search) ? await findCustomerIdsByPhone(search) : [];
  const where: Prisma.CustomerWhereInput = search
    ? {
        OR: [
          ...(["name", "phone", "email"] as const).map((field) => ({
            [field]: { contains: search, mode: "insensitive" as const },
          })),
          { id: { in: phoneMatches } },
        ],
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

customersRouter.post(
  "/bulk-delete",
  bulkDeleteHandler(LABEL, (id) => prisma.customer.delete({ where: { id } })),
);

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

// The customer's services, newest first, for the history in their drawer.
customersRouter.get("/:id/services", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  if (!(await prisma.customer.findUnique({ where: { id }, select: { id: true } }))) {
    sendNotFound(res, LABEL);
    return;
  }
  const services: Service[] = await findServiceHistory({ customerId: id });
  res.json(services);
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

// A customer who still owns devices or has services keeps them, so the delete is refused.
customersRouter.delete("/:id", async (req, res) => {
  const id = idParam(req, res, LABEL);
  if (!id) return;

  await sendDelete(res, LABEL, "CUSTOMER_IN_USE", () => prisma.customer.delete({ where: { id } }));
});
