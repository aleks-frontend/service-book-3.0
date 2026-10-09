import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { deviceLabel, type Service } from "@servicebook/schemas";
import { formatPlainDate, formatRsd } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

/** How the Services page shows its list; staff members pick one and it is remembered. */
export type ServicesView = "table" | "cards";

type ServicesListProps = {
  services: Service[];
  view: ServicesView;
  onOpen: (service: Service) => void;
  emptyMessage: string;
};

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
export function ServicesList({ services, view, onOpen, emptyMessage }: ServicesListProps) {
  if (services.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground">
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

function ServicesTable({ services, onOpen }: Pick<ServicesListProps, "services" | "onOpen">) {
  const { t, i18n } = useTranslation();

  const columns = useMemo<ColumnDef<Service>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("Number"),
        cell: ({ getValue }) => (
          <span className="font-medium tabular-nums">{getValue<string>()}</span>
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
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} className="cursor-pointer" {...openProps(row.original, onOpen)}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ServiceCards({ services, onOpen }: Pick<ServicesListProps, "services" | "onOpen">) {
  const { i18n } = useTranslation();

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {services.map((service) => (
        <li
          key={service.id}
          className="cursor-pointer space-y-2 rounded-md border bg-card p-4 transition-colors hover:bg-muted/50"
          {...openProps(service, onOpen)}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold tabular-nums">{service.number}</div>
              <div className="text-xs text-muted-foreground">
                {formatPlainDate(service.date, i18n.language)}
              </div>
            </div>
            <StatusBadge status={service.status} />
          </div>
          <div className="text-sm">
            <span className="font-medium">{service.customer.name}</span>{" "}
            <span className="text-muted-foreground">{service.customer.phone}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{devicesText(service)}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatRsd(service.total, i18n.language)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
