import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  STATUSES,
  tooManyDays,
  type EarningsBucket,
  type EarningsQuery,
} from "@servicebook/schemas";
import { formatAmount, formatPeriod, formatRsd, todayPlainDate } from "@/lib/format";
import { useEarningsQuery, useStatusCountsQuery } from "@/lib/statistics";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingRegion } from "@/components/LoadingRegion";
import { StatusBadge } from "@/components/StatusBadge";

const BUCKET_LABELS: Record<EarningsBucket, string> = {
  day: "Day",
  month: "Month",
  year: "Year",
};

/**
 * The earnings query for the picked range, or null while it is incomplete or
 * ends before it starts. A range too long for days is grouped by month.
 */
function earningsQuery(from: string, to: string, bucket: EarningsBucket): EarningsQuery | null {
  if (!from || !to || from > to) return null;
  return { from, to, bucket: bucket === "day" && tooManyDays(from, to) ? "month" : bucket };
}

export function StatisticsPage() {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Statistics")}</h1>
      <EarningsCard />
      <StatusCountsCard />
    </section>
  );
}

/** Earnings with the range and grouping they are shown for; nothing else on the page follows the range. */
function EarningsCard() {
  const { t, i18n } = useTranslation();
  const id = useId();

  // This year so far, by month.
  const [from, setFrom] = useState(() => `${todayPlainDate().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(todayPlainDate);
  const [bucket, setBucket] = useState<EarningsBucket>("month");

  const query = earningsQuery(from, to, bucket);
  const daysDisabled = !query || tooManyDays(from, to);
  const { data, isPlaceholderData, isError } = useEarningsQuery(query);

  return (
    <section aria-labelledby={id} className="space-y-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="text-lg font-semibold">
          {t("Earnings")}
        </h2>
        {query && data && (
          <p className="text-sm text-muted-foreground">
            {t("Total")}:{" "}
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {formatRsd(data.earnings, i18n.language)}
            </span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-from`} className="text-sm font-medium">
            {t("From")}
          </label>
          <Input
            id={`${id}-from`}
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-to`} className="text-sm font-medium">
            {t("To")}
          </label>
          <Input
            id={`${id}-to`}
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1.5">
          <label id={`${id}-bucket`} className="text-sm font-medium">
            {t("Group by")}
          </label>
          <Select
            value={query?.bucket ?? bucket}
            onValueChange={(value) => setBucket(value as EarningsBucket)}
          >
            <SelectTrigger className="w-36" aria-labelledby={`${id}-bucket`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BUCKET_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} disabled={value === "day" && daysDisabled}>
                  {t(label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!query ? (
        <p className="text-sm text-destructive">
          {t("Choose a start date on or before the end date.")}
        </p>
      ) : isError ? (
        <p className="text-sm text-destructive">{t("Could not load the earnings.")}</p>
      ) : (
        <LoadingRegion refreshing={isPlaceholderData}>
          <figure aria-label={t("Earnings chart")} className="h-72">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.buckets} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(period: string) => formatPeriod(period, i18n.language)}
                    tickLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(amount: number) => formatAmount(amount, i18n.language)}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                    fontSize={12}
                  />
                  <Tooltip
                    labelFormatter={(period) => formatPeriod(String(period), i18n.language)}
                    formatter={(earnings) => [
                      formatRsd(Number(earnings), i18n.language),
                      t("Earnings"),
                    ]}
                    cursor={{ className: "fill-muted" }}
                  />
                  <Bar
                    dataKey="earnings"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={64}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </figure>
        </LoadingRegion>
      )}
    </section>
  );
}

function StatusCountsCard() {
  const { t } = useTranslation();
  const id = useId();
  const { data, isError } = useStatusCountsQuery();

  return (
    <section aria-labelledby={id} className="space-y-4 rounded-md border bg-card p-4">
      <h2 id={id} className="text-lg font-semibold">
        {t("Services by status")}
      </h2>
      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load the status counts.")}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STATUSES.map((status) => (
            <div key={status} className="space-y-1 rounded-md border p-3">
              <dt>
                <StatusBadge status={status} />
              </dt>
              <dd className="text-2xl font-semibold tabular-nums">{data?.[status] ?? "–"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
