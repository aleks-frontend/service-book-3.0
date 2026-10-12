import "dotenv/config";
import { prisma } from "../lib/prisma.js";

// Usage: npm run seed:dummy-actions -w @servicebook/backend
// Adds a dummy price list for trying out the app locally. Actions whose name
// already exists are skipped, so it can be run again.
const ACTIONS = [
  { name: "Dijagnostika", price: 1000 },
  { name: "Čišćenje laptopa od prašine", price: 1500 },
  { name: "Zamena ekrana na telefonu", price: 3000 },
  { name: "Zamena baterije na telefonu", price: 2000 },
  { name: "Zamena baterije na laptopu", price: 1500 },
  { name: "Zamena konektora za punjenje", price: 2500 },
  { name: "Zamena tastature na laptopu", price: 2000 },
  { name: "Zamena šarki na laptopu", price: 2500 },
  { name: "Ugradnja SSD diska", price: 1000 },
  { name: "Proširenje RAM memorije", price: 500 },
  { name: "Kloniranje diska na SSD", price: 1500 },
  { name: "Spasavanje podataka", price: 5000 },
  { name: "Uklanjanje virusa", price: 1500 },
  { name: "Instalacija Office paketa", price: 1000 },
  { name: "Instalacija drajvera", price: 800 },
  { name: "Backup podataka", price: 1000 },
  { name: "Podešavanje rutera", price: 1200 },
  { name: "Lemljenje na matičnoj ploči", price: 4000 },
  { name: "Reballing čipa", price: 6000 },
  { name: "Zamena napajanja na računaru", price: 1000 },
];

try {
  const existing = await prisma.action.findMany({
    where: { name: { in: ACTIONS.map(({ name }) => name) } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map(({ name }) => name));
  const { count } = await prisma.action.createMany({
    data: ACTIONS.filter(({ name }) => !existingNames.has(name)),
  });
  console.log(`Seeded ${count} dummy actions; ${existingNames.size} already existed.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
