import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { deviceLabel, type Service } from "@servicebook/schemas";
import { formatPlainDate, formatRsd } from "@/lib/format";
import { useChangedFlag } from "@/lib/useChangedFlag";
import { CardSkeletons, TableSkeletonRows } from "./Skeletons";
import { StatusSelect } from "./StatusSelect";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

/** How the Services page shows its list; staff members pick one and it is remembered. */
export type ServicesView = "table" | "cards";

type ServicesListProps = {
  services: Service[];
  view: ServicesView;
  onOpen: (service: Service) => void;
  /** The first page is still loading: placeholders show instead of the empty message. */
  loading: boolean;
  emptyMessage: string;
};

const CARD_GRID_CLASS = "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3";

function devicesText(service: Service) {
  return service.devices.map(deviceLabel).join(", ");
}

/** Opens the service on click, or on Enter when the row or card has focus. */
function openProps(service: Service, onOpen: (service: Service) => void) {
  return {
    tabIndex: 0,
    onClick: () => onOpen(service),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && event.target === event.currentTarget) onOpen(service);
    },
  };
}

/** The loaded services, newest first, as a table or as cards. */
export function ServicesList({ services, view, onOpen, loading, emptyMessage }: ServicesListProps) {
  if (services.length === 0 && loading) {
    return view === "cards" ? (
      <CardSkeletons className={CARD_GRID_CLASS} />
    ) : (
      <ServicesTable services={services} onOpen={onOpen} loading />
    );
  }
  if (services.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border border-dashed bg-card text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }
  return view === "cards" ? (
    <ServiceCards services={services} onOpen={onOpen} />
  ) : (
    <ServicesTable services={services} onOpen={onOpen} />
  );
}

function ServicesTable({
  services,
  onOpen,
  loading = false,
}: Pick<ServicesListProps, "services" | "onOpen"> & { loading?: boolean }) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<Service>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("Number"),
        cell: ({ getValue }) => (
          <span className="font-display text-[1.0625rem] font-bold tabular-nums tracking-[0.02em]">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "date",
        header: t("Date"),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">
            {formatPlainDate(getValue<string>(), i18n.language)}
          </span>
        ),
      },
      {
        id: "customer",
        header: t("Customer"),
        cell: ({ row }) => (
          <div>
            <div>{row.original.customer.name}</div>
            <div className="text-xs text-muted-foreground">{row.original.customer.phone}</div>
          </div>
        ),
      },
      {
        id: "devices",
        header: t("Devices"),
        cell: ({ row }) => devicesText(row.original),
      },
      {
        accessorKey: "status",
        header: t("Status"),
        cell: ({ row }) => (
          <StatusSelect serviceId={row.original.id} status={row.original.status} />
        ),
      },
      {
        accessorKey: "total",
        header: () => <div className="text-right">{t("Total")}</div>,
        cell: ({ getValue }) => (
          <div className="whitespace-nowrap text-right tabular-nums">
            {formatRsd(getValue<number>(), i18n.language)}
          </div>
        ),
      },
    ],
    [t, i18n.language],
  );

  const table = useReactTable({
    data: services,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (service) => service.id,
  });

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableSkeletonRows columns={columns.length} />
          ) : (
            table
              .getRowModel()
              .rows.map((row) => <ServiceRow key={row.id} row={row} onOpen={onOpen} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** One service's row; it flashes once when the service's status changes. */
function ServiceRow({ row, onOpen }: { row: Row<Service>; onOpen: (service: Service) => void }) {
  const changed = useChangedFlag(row.original.status);

  return (
    <TableRow
      className="cursor-pointer data-[changed]:animate-flash"
      data-changed={changed || undefined}
      {...openProps(row.original, onOpen)}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function ServiceCards({ services, onOpen }: Pick<ServicesListProps, "services" | "onOpen">) {
  return (
    <ul className={CARD_GRID_CLASS}>
      {services.map((service) => (
        <ServiceCard key={service.id} service={service} onOpen={onOpen} />
      ))}
    </ul>
  );
}

/** One service as a repair tag; it flashes once when the service's status changes. */
function ServiceCard({
  service,
  onOpen,
}: {
  service: Service;
  onOpen: (service: Service) => void;
}) {
  const { i18n } = useTranslation();
  const changed = useChangedFlag(service.status);

  return (
    // The phone row takes up a stretched card's spare height, keeping the footer at the bottom.
    <li
      className="repair-tag grid min-w-0 cursor-pointer grid-cols-1 grid-rows-[auto_auto_1fr_auto] gap-1.5"
      data-changed={changed || undefined}
      {...openProps(service, onOpen)}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="min-w-0 truncate font-display text-2xl font-bold leading-tight"
          title={service.customer.name}
        >
          {service.customer.name}
        </span>
        <StatusSelect serviceId={service.id} status={service.status} />
      </div>
      <div className="line-clamp-2 font-medium">{devicesText(service)}</div>
      <div className="text-[0.8125rem] leading-5 text-muted-foreground">
        {service.customer.phone}
      </div>
      <div className="flex items-baseline justify-between gap-2 border-t border-dashed pt-1.5 text-[0.8125rem] leading-5">
        <span className="min-w-0 truncate text-muted-foreground">
          <span className="font-display text-sm font-bold leading-none tabular-nums tracking-[0.02em] text-foreground">
            {service.number}
          </span>
          {" · "}
          {formatPlainDate(service.date, i18n.language)}
        </span>
        <strong className="shrink-0 tabular-nums">{formatRsd(service.total, i18n.language)}</strong>
      </div>
    </li>
  );
}
