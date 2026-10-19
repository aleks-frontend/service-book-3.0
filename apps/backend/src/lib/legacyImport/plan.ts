import { deviceLabel, type Status } from "@servicebook/schemas";

// Turns the old app's Firebase export into rows for the new schema. Pure: it
// reads nothing and writes nothing, so a dry run is just this plus the report.
// The mapping rules are in #17 and the implementation plan.

export type PlannedCustomer = {
  legacyId: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  facebook: string | null;
};

export type PlannedAction = { legacyId: string; name: string; price: number };

export type PlannedDevice = {
  legacyId: string;
  manufacturer: string | null;
  model: string;
  serialNumber: string | null;
  description: string | null;
  /** Null for a generic device. */
  ownerLegacyId: string | null;
};

export type PlannedLine = { label: string; quantity: number; unitPrice: number } & (
  { type: "WORK"; actionLegacyId: string } | { type: "SALE"; deviceLegacyId: string }
);

export type PlannedService = {
  /** The service's key in the export, the timestamp it was created at. */
  legacyId: string;
  /** `YYYY-MM-DD`, the day in Serbia when the legacy timestamp was taken. */
  date: string;
  description: string | null;
  status: Status;
  customerLegacyId: string;
  /** In the order they were attached, without repeats. */
  deviceLegacyIds: string[];
  lines: PlannedLine[];
  /** The legacy remarks, logged at `loggedAt`. */
  remarks: string[];
  /** The legacy timestamp in milliseconds. */
  loggedAt: number;
};

export type ImportPlan = {
  customers: PlannedCustomer[];
  actions: PlannedAction[];
  devices: PlannedDevice[];
  /** Oldest first, so service numbers rise with the date. */
  services: PlannedService[];
};

/** Something imported, but not quite as it was; `record` is its path in the export. */
export type Anomaly = { record: string; message: string };

/** Something left out of the import. */
export type Skipped = { record: string; reason: string };

export type ImportReport = {
  counts: {
    customers: number;
    devices: { owned: number; generic: number };
    actions: number;
    services: number;
    workLines: number;
    saleLines: number;
    legacyRemarks: number;
  };
  anomalies: Anomaly[];
  skipped: Skipped[];
};

const STATUSES: Record<string, Status> = {
  shipped: "DELIVERED",
  completed: "COMPLETED",
  received: "RECEIVED",
};

/** The status an unknown legacy status is imported with (and reported). */
const FALLBACK_STATUS: Status = "RECEIVED";

/** Manufacturers the old app's required field was filled with for want of one. */
const PLACEHOLDER_MANUFACTURER = /^(n\/?a|-+|\.+|\?+|x)$/i;

const COLLECTIONS = ["customers", "devices", "actions", "services"] as const;

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trimmed text, or null when blank or missing. */
function text(value: unknown) {
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

/** Like `text`, with runs of whitespace (often doubled spaces in legacy names) made single. */
function singleLine(value: unknown) {
  return text(value)?.replace(/\s+/g, " ") ?? null;
}

/** An array field; the old app stored an empty one as "" or left it out. */
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** The day in Serbia, as `YYYY-MM-DD`, of a millisecond timestamp. */
function belgradeDate(ms: number) {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Belgrade" });
}

export function planLegacyImport(raw: unknown): { plan: ImportPlan; report: ImportReport } {
  const anomalies: Anomaly[] = [];
  const skipped: Skipped[] = [];
  const anomaly = (record: string, message: string) => anomalies.push({ record, message });

  // A console export of the whole database wraps the app's tree in `ssot`.
  const wrapped = isRecord(raw) && isRecord(raw.ssot);
  const tree = wrapped ? raw.ssot : raw;
  if (!isRecord(tree)) throw new Error("The export is not a Firebase JSON object");
  const root: Raw = tree;
  if (wrapped) {
    for (const key of Object.keys(raw)) {
      if (key !== "ssot") skipped.push({ record: `/${key}`, reason: "Outside the app's tree" });
    }
  }

  for (const key of Object.keys(root)) {
    if ((COLLECTIONS as readonly string[]).includes(key)) continue;
    skipped.push({ record: key, reason: "Not one of the old app's collections" });
  }

  /** The collection's records keyed by their legacy id; anything else is skipped. */
  function records(collection: (typeof COLLECTIONS)[number]) {
    const value = root[collection as string];
    const result = new Map<string, Raw>();
    if (!isRecord(value)) {
      if (value !== undefined) skipped.push({ record: collection, reason: "Not a collection" });
      return result;
    }
    for (const [id, record] of Object.entries(value)) {
      if (isRecord(record)) result.set(id, record);
      else skipped.push({ record: `${collection}/${id}`, reason: "Not a record" });
    }
    return result;
  }

  /**
   * A whole number from a number or a numeric string. A fraction is rounded
   * and reported; anything else is null, and the caller skips the record.
   */
  function integer(value: unknown, record: string, field: string) {
    const number = typeof value === "string" && value.trim() === "" ? NaN : Number(value);
    if (!Number.isFinite(number)) return null;
    if (!Number.isInteger(number)) {
      anomaly(record, `${field} ${JSON.stringify(value)} rounded to ${Math.round(number)}`);
    }
    return Math.round(number);
  }

  /** A legacy line's quantity and unit price, or null after skipping it. */
  function priced(legacyLine: Raw, path: string) {
    const quantity = integer(legacyLine.quantity, path, "quantity");
    const unitPrice = integer(legacyLine.price, path, "price");
    if (quantity !== null && unitPrice !== null) return { quantity, unitPrice };
    skipped.push({ record: path, reason: "Quantity or price is not a number" });
    return null;
  }

  const customers: PlannedCustomer[] = [];
  for (const [legacyId, record] of records("customers")) {
    const path = `customers/${legacyId}`;
    const name = singleLine(record.name);
    if (!name) {
      skipped.push({ record: path, reason: "No name" });
      continue;
    }
    customers.push({
      legacyId,
      name,
      // Placeholder and junk phones are kept as they are.
      phone: String(record.phone ?? "").trim(),
      email: text(record.email),
      address: text(record.address),
      facebook: text(record.facebook),
    });
  }

  const actions: PlannedAction[] = [];
  for (const [legacyId, record] of records("actions")) {
    const path = `actions/${legacyId}`;
    const name = singleLine(record.name);
    const price = integer(record.price, path, "price");
    if (!name || price === null) {
      skipped.push({ record: path, reason: !name ? "No name" : "Price is not a number" });
      continue;
    }
    actions.push({ legacyId, name, price });
  }

  // Devices first without owners: ownership follows from the services below.
  const devices = new Map<string, PlannedDevice>();
  const flaggedAsSold = new Map<string, boolean>();
  for (const [legacyId, record] of records("devices")) {
    const path = `devices/${legacyId}`;
    const manufacturer = singleLine(record.manufacturer);
    const model = singleLine(record.model) ?? singleLine(record.name);
    if (!model) {
      skipped.push({ record: path, reason: "No model or name" });
      continue;
    }
    const serialNumber = text(record.serial);
    if (manufacturer && PLACEHOLDER_MANUFACTURER.test(manufacturer)) {
      anomaly(path, `Placeholder manufacturer ${JSON.stringify(manufacturer)}`);
    }
    // The old app derived the name from manufacturer and model, then the
    // serial in some form, e.g. "(sn: …)". The new one derives its label, so
    // only names someone edited away from that are reported.
    const derived = deviceLabel({ manufacturer, model });
    const legacyName = singleLine(record.name);
    const rest = legacyName?.startsWith(derived) ? legacyName.slice(derived.length).trim() : null;
    if (legacyName && !(rest === "" || (serialNumber && rest?.includes(serialNumber)))) {
      anomaly(path, `Name ${JSON.stringify(legacyName)} differs from ${JSON.stringify(derived)}`);
    }
    devices.set(legacyId, {
      legacyId,
      manufacturer,
      model,
      serialNumber,
      description: text(record.title),
      ownerLegacyId: null,
    });
    flaggedAsSold.set(legacyId, record.isNewDevice === true);
  }

  const customerIds = new Set(customers.map(({ legacyId }) => legacyId));
  const actionsById = new Map(actions.map((action) => [action.legacyId, action]));
  const services: PlannedService[] = [];
  /** Which customers' services each device is attached to. */
  const usedBy = new Map<string, Set<string>>();

  for (const [legacyId, record] of records("services")) {
    const path = `services/${legacyId}`;
    const ms = typeof record.date === "number" ? record.date : Number(legacyId);
    if (!Number.isFinite(ms)) {
      skipped.push({ record: path, reason: "No date" });
      continue;
    }

    const serviceCustomers = list(record.customers).map(String);
    const customerLegacyId = serviceCustomers[0];
    if (customerLegacyId === undefined || !customerIds.has(customerLegacyId)) {
      skipped.push({ record: path, reason: "No known customer" });
      continue;
    }
    if (serviceCustomers.length > 1) {
      anomaly(path, `Only the first of ${serviceCustomers.length} customers kept`);
    }

    const rawStatus = String(record.status ?? "");
    let status = STATUSES[rawStatus];
    if (!status) {
      anomaly(path, `Unknown status ${JSON.stringify(rawStatus)} imported as ${FALLBACK_STATUS}`);
      status = FALLBACK_STATUS;
    }

    const deviceLegacyIds: string[] = [];
    for (const deviceId of list(record.devices).map(String)) {
      if (!devices.has(deviceId)) {
        anomaly(path, `Unknown device ${deviceId} left out`);
        continue;
      }
      if (deviceLegacyIds.includes(deviceId)) continue;
      if (flaggedAsSold.get(deviceId)) {
        anomaly(path, `Device ${deviceId} is flagged as sold but attached as serviced`);
      }
      deviceLegacyIds.push(deviceId);
      usedBy.set(deviceId, (usedBy.get(deviceId) ?? new Set()).add(customerLegacyId));
    }

    const lines: PlannedLine[] = [];
    list(record.actions).forEach((legacyLine, index) => {
      const linePath = `${path}/actions/${index}`;
      const action = isRecord(legacyLine)
        ? actionsById.get(String(legacyLine.actionId))
        : undefined;
      if (!isRecord(legacyLine) || !action) {
        skipped.push({ record: linePath, reason: "No known action" });
        return;
      }
      const price = priced(legacyLine, linePath);
      if (!price) return;
      lines.push({ type: "WORK", actionLegacyId: action.legacyId, label: action.name, ...price });
    });
    list(record.newDevices).forEach((legacyLine, index) => {
      const linePath = `${path}/newDevices/${index}`;
      const device = isRecord(legacyLine) ? devices.get(String(legacyLine.deviceId)) : undefined;
      if (!isRecord(legacyLine) || !device) {
        skipped.push({ record: linePath, reason: "No known device" });
        return;
      }
      if (!flaggedAsSold.get(device.legacyId)) {
        anomaly(linePath, `Device ${device.legacyId} is sold but not flagged as sold`);
      }
      const price = priced(legacyLine, linePath);
      if (!price) return;
      lines.push({
        type: "SALE",
        deviceLegacyId: device.legacyId,
        // The name the device had when it was sold.
        label: text(legacyLine.deviceName) ?? deviceLabel(device),
        ...price,
      });
    });

    const remarks: string[] = [];
    // A `title` field from the app's first months; kept so nothing is lost.
    const title = text(record.title);
    if (title) {
      anomaly(path, "Old `title` field kept as a legacy remark");
      remarks.push(title);
    }
    const remark = text(record.remark);
    if (remark) remarks.push(remark);

    services.push({
      legacyId,
      date: belgradeDate(ms),
      description: text(record.description),
      status,
      customerLegacyId,
      deviceLegacyIds,
      lines,
      remarks,
      loggedAt: ms,
    });
  }

  // A device serviced for exactly one customer is theirs; one that appeared
  // under several customers, or was only ever sold, stays generic (ADR-0004).
  for (const [deviceId, owners] of usedBy) {
    if (owners.size === 1) devices.get(deviceId)!.ownerLegacyId = [...owners][0]!;
  }

  services.sort((a, b) => a.loggedAt - b.loggedAt || a.legacyId.localeCompare(b.legacyId));
  const plannedDevices = [...devices.values()];
  const plannedLines = services.flatMap(({ lines }) => lines);

  return {
    plan: { customers, actions, devices: plannedDevices, services },
    report: {
      counts: {
        customers: customers.length,
        devices: {
          owned: plannedDevices.filter(({ ownerLegacyId }) => ownerLegacyId).length,
          generic: plannedDevices.filter(({ ownerLegacyId }) => !ownerLegacyId).length,
        },
        actions: actions.length,
        services: services.length,
        workLines: plannedLines.filter(({ type }) => type === "WORK").length,
        saleLines: plannedLines.filter(({ type }) => type === "SALE").length,
        legacyRemarks: services.reduce((sum, { remarks }) => sum + remarks.length, 0),
      },
      anomalies,
      skipped,
    },
  };
}
