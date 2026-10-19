import "dotenv/config";
import type { Status } from "@servicebook/schemas";
import { prisma } from "../lib/prisma.js";
import { newPublicToken, nextSequence } from "../lib/serviceNumbers.js";

// Usage: npm run seed:dummy-services -w @servicebook/backend -- [count]
// Adds dummy customers, devices and services for trying out the services list
// locally. Every run adds more; it is not meant for production data.
const count = Number(process.argv[2] ?? 30);

if (!Number.isInteger(count) || count < 1) {
  console.error("Usage: npm run seed:dummy-services -w @servicebook/backend -- [count]");
  process.exit(1);
}

const CUSTOMERS = [
  { name: "Ana Petrović", phone: "061 111 2233" },
  { name: "Bojan Jovanović", phone: "062 222 3344" },
  { name: "Čedomir Ilić", phone: "063 333 4455" },
  { name: "Dragana Nikolić", phone: "064 444 5566" },
  { name: "Đorđe Marković", phone: "065 555 6677" },
  { name: "Erika Szabó", phone: "066 666 7788" },
  { name: "Goran Stojanović", phone: "069 777 8899" },
  { name: "Ivana Kovač", phone: "060 888 9900" },
  { name: "Marko Popović", phone: "061 999 0011" },
  { name: "Žarko Tomić", phone: "062 123 4567" },
];

const DEVICES = [
  { manufacturer: "Apple", model: "iPhone 13" },
  { manufacturer: "Samsung", model: "Galaxy S21" },
  { manufacturer: "Lenovo", model: "ThinkPad T480" },
  { manufacturer: "HP", model: "EliteBook 840 G5" },
  { manufacturer: "Dell", model: "Latitude 5490" },
  { manufacturer: "Asus", model: "VivoBook 15" },
  { manufacturer: "Xiaomi", model: "Redmi Note 10" },
  { manufacturer: null, model: "USB-C punjač" },
];

const DESCRIPTIONS = [
  "Ne pali se",
  "Razbijen ekran",
  "Baterija se brzo prazni",
  "Pregreva se i gasi",
  "Ne puni",
  "Spor, potrebna reinstalacija",
  "Ne radi tastatura",
  null,
];

const STATUSES: Status[] = ["RECEIVED", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"];

try {
  const customers = await Promise.all(
    CUSTOMERS.map((customer) => prisma.customer.create({ data: customer })),
  );

  const today = new Date();
  // Oldest first, so numbers rise with the date, as they would in real use.
  for (let i = count - 1; i >= 0; i--) {
    const customer = customers[i % customers.length];
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i * 3),
    );
    const year = date.getUTCFullYear();
    const device = await prisma.device.create({
      data: { ...DEVICES[i % DEVICES.length], ownerId: customer.id },
    });
    await prisma.service.create({
      data: {
        year,
        sequence: await nextSequence(prisma, year),
        publicToken: newPublicToken(),
        date,
        description: DESCRIPTIONS[i % DESCRIPTIONS.length],
        status: STATUSES[i % STATUSES.length],
        customerId: customer.id,
        devices: { create: [{ deviceId: device.id, position: 0 }] },
      },
    });
  }
  console.log(`Seeded ${count} dummy services for ${customers.length} new customers.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
