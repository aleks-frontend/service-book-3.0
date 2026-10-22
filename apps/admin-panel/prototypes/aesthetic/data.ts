// PROTOTYPE (#24): made-up services shaped like the imported legacy records.
// No real customers: names and phone numbers are invented.

export const STATUSES = ["RECEIVED", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  RECEIVED: "Received",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export type Line = { type: "WORK" | "SALE"; label: string; quantity: number; unitPrice: number };

export type LogEntry =
  | { kind: "note"; author: string; at: string; text: string }
  | { kind: "legacy"; at: string; text: string }
  | { kind: "status"; author: string; at: string; from: Status; to: Status };

export type Service = {
  id: string;
  number: string;
  date: string;
  customer: { name: string; phone: string };
  devices: string[];
  status: Status;
  description: string;
  lines: Line[];
  customerReport: string;
  log: LogEntry[];
};

export function total(service: Service) {
  return service.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
}

export function formatRsd(amount: number) {
  return `${amount.toLocaleString("sr-Latn-RS")} RSD`;
}

export function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("sr-Latn-RS", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const SAMPLE_LINE =
  "Đorđe iz Ćuprije šalje Žaklini račun od 4.500 RSD. Szűcs Ödön hoz egy nyomtatót Győrből.";

export const SERVICES: Service[] = [
  {
    id: "s142",
    number: "2026-0142",
    date: "2026-10-21",
    customer: { name: "Dragana Ćirić", phone: "060 555 0142" },
    devices: ["Samsung Galaxy S21"],
    status: "IN_PROGRESS",
    description: "Razbijen ekran, dodir radi samo u donjoj polovini.",
    lines: [
      { type: "WORK", label: "Dijagnostika", quantity: 1, unitPrice: 1000 },
      { type: "WORK", label: "Zamena ekrana", quantity: 1, unitPrice: 2500 },
      { type: "SALE", label: "Zaštitno staklo S21", quantity: 1, unitPrice: 1000 },
    ],
    customerReport: "",
    log: [
      {
        kind: "status",
        author: "Aleksa",
        at: "21. oktobar 2026. 09:12",
        from: "RECEIVED",
        to: "IN_PROGRESS",
      },
      {
        kind: "note",
        author: "Aleksa",
        at: "21. oktobar 2026. 11:40",
        text: "Naručen ekran, stiže u četvrtak. Mušterija obaveštena.",
      },
    ],
  },
  {
    id: "s141",
    number: "2026-0141",
    date: "2026-10-21",
    customer: { name: "Szűcs Ödön", phone: "063 555 0141" },
    devices: ["HP 250 G7", "USB-C punjač"],
    status: "RECEIVED",
    description: "Ne pali se, punjač greje.",
    lines: [{ type: "WORK", label: "Dijagnostika", quantity: 1, unitPrice: 1000 }],
    customerReport: "",
    log: [],
  },
  {
    id: "s140",
    number: "2026-0140",
    date: "2026-10-20",
    customer: { name: "Nikola Đorđević", phone: "064 555 0140" },
    devices: ["Lenovo IdeaPad 3"],
    status: "COMPLETED",
    description: "Spor, greje se. Ugraditi SSD i preneti podatke.",
    lines: [
      { type: "WORK", label: "Čišćenje i zamena paste", quantity: 1, unitPrice: 1500 },
      { type: "WORK", label: "Ugradnja SSD-a", quantity: 1, unitPrice: 1000 },
      { type: "SALE", label: "Kingston A400 240GB", quantity: 1, unitPrice: 3200 },
      { type: "WORK", label: "Reinstalacija Windowsa", quantity: 1, unitPrice: 2000 },
    ],
    customerReport:
      "Laptop očišćen od prašine, zamenjena termalna pasta. Ugrađen SSD od 240 GB, sistem reinstaliran i podaci preneti. Laptop testiran pod opterećenjem, temperatura u granicama normale.",
    log: [
      {
        kind: "status",
        author: "Aleksa",
        at: "20. oktobar 2026. 10:02",
        from: "RECEIVED",
        to: "IN_PROGRESS",
      },
      {
        kind: "note",
        author: "Milica",
        at: "20. oktobar 2026. 15:30",
        text: "Podaci preneti, 112 GB. Mušterija tražila da sačuvamo stari disk.",
      },
      {
        kind: "status",
        author: "Milica",
        at: "21. oktobar 2026. 08:45",
        from: "IN_PROGRESS",
        to: "COMPLETED",
      },
    ],
  },
  {
    id: "s139",
    number: "2026-0139",
    date: "2026-10-18",
    customer: { name: "Kovács Réka", phone: "062 555 0139" },
    devices: ["Canon PIXMA MG2550S"],
    status: "DELIVERED",
    description: "Ne uvlači papir.",
    lines: [
      { type: "WORK", label: "Čišćenje valjaka", quantity: 1, unitPrice: 800 },
      { type: "WORK", label: "Dijagnostika", quantity: 1, unitPrice: 1000 },
    ],
    customerReport: "Očišćeni valjci za uvlačenje papira. Štampač testiran sa 20 listova.",
    log: [
      {
        kind: "status",
        author: "Aleksa",
        at: "18. oktobar 2026. 12:20",
        from: "COMPLETED",
        to: "DELIVERED",
      },
    ],
  },
  {
    id: "s138",
    number: "2026-0138",
    date: "2026-10-17",
    customer: { name: "Milena Šarić", phone: "065 555 0138" },
    devices: ["Apple iPhone 8"],
    status: "CANCELLED",
    description: "Baterija se brzo prazni.",
    lines: [{ type: "WORK", label: "Dijagnostika", quantity: 1, unitPrice: 1000 }],
    customerReport: "",
    log: [
      {
        kind: "note",
        author: "Milica",
        at: "17. oktobar 2026. 13:05",
        text: "Mušterija odustala zbog cene baterije.",
      },
      {
        kind: "status",
        author: "Milica",
        at: "17. oktobar 2026. 13:06",
        from: "RECEIVED",
        to: "CANCELLED",
      },
    ],
  },
  {
    id: "s137",
    number: "2026-0137",
    date: "2026-10-16",
    customer: { name: "Žarko Lukić", phone: "069 555 0137" },
    devices: ["Xiaomi Redmi Note 10"],
    status: "COMPLETED",
    description: "Ne puni se.",
    lines: [{ type: "WORK", label: "Zamena konektora za punjenje", quantity: 1, unitPrice: 2200 }],
    customerReport: "Zamenjen konektor za punjenje. Telefon puni normalno.",
    log: [],
  },
  {
    id: "s136",
    number: "2026-0136",
    date: "2026-10-15",
    customer: { name: "Tóth Gergő", phone: "061 555 0136" },
    devices: ["Asus VivoBook 15"],
    status: "DELIVERED",
    description: "Tastatura ne radi posle prolivene kafe.",
    lines: [
      { type: "WORK", label: "Zamena tastature", quantity: 1, unitPrice: 2500 },
      { type: "SALE", label: "Tastatura Asus X515", quantity: 1, unitPrice: 3900 },
      { type: "SALE", label: "Logitech M185", quantity: 2, unitPrice: 1450 },
    ],
    customerReport: "Zamenjena tastatura. Prodata dva miša Logitech M185.",
    log: [
      { kind: "legacy", at: "15. oktobar 2026. 09:00", text: "Klijent javio da ekran treperi" },
    ],
  },
  {
    id: "s135",
    number: "2026-0135",
    date: "2026-10-14",
    customer: { name: "Ivana Stojković", phone: "/" },
    devices: ["Samsung Galaxy A52"],
    status: "IN_PROGRESS",
    description: "Kamera ne fokusira.",
    lines: [{ type: "WORK", label: "Dijagnostika", quantity: 1, unitPrice: 1000 }],
    customerReport: "",
    log: [],
  },
  {
    id: "s134",
    number: "2026-0134",
    date: "2026-10-12",
    customer: { name: "Horváth Bence", phone: "066 555 0134" },
    devices: ["Dell Latitude 5490"],
    status: "RECEIVED",
    description: "Zaboravljena lozinka, sačuvati podatke.",
    lines: [],
    customerReport: "",
    log: [],
  },
];
