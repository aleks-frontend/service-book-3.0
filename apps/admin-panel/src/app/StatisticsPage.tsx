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
import { ChartSkeleton, Skeleton } from "@/components/Skeletons";
import { StatusBadge } from "@/components/StatusBadge";

// Recharts draws in SVG with its own defaults; these take the theme's tokens instead.
const CHART_TICK = { fill: "hsl(var(--muted-foreground))" };
const CHART_TOOLTIP = {
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  border: "1px solid hsl(var(--input))",
  borderRadius: "var(--radius)",
};

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
      <h1 className="font-display text-title">{t("Statistics")}</h1>
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
  const { data, isPending, isPlaceholderData, isError } = useEarningsQuery(query);

  return (
    <section aria-labelledby={id} className="space-y-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={id} className="font-display text-2xl font-extrabold leading-none">
          {t("Earnings")}
        </h2>
        {query && !isError && (
          <p className="flex items-baseline gap-1 text-sm text-muted-foreground">
            {t("Total")}:{" "}
            {data ? (
              <span className="font-display text-2xl font-bold tabular-nums text-foreground">
                {formatRsd(data.earnings, i18n.language)}
              </span>
            ) : (
              <Skeleton className="h-6 w-32 self-center" />
            )}
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
            {isPending ? (
              <ChartSkeleton />
            ) : (
              data && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.buckets} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid vertical={false} className="stroke-border" />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(period: string) => formatPeriod(period, i18n.language)}
                      tickLine={false}
                      tick={CHART_TICK}
                      stroke="hsl(var(--foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(amount: number) => formatAmount(amount, i18n.language)}
                      tickLine={false}
                      axisLine={false}
                      tick={CHART_TICK}
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
                      contentStyle={CHART_TOOLTIP}
                    />
                    {/* Yellow is too faint on white alone; the ink outline carries the bar, as on the logo. */}
                    <Bar
                      dataKey="earnings"
                      fill="hsl(var(--primary))"
                      stroke="hsl(var(--primary-foreground))"
                      strokeWidth={1}
                      maxBarSize={64}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )
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
  const { data, isPending, isError } = useStatusCountsQuery();

  return (
    <section aria-labelledby={id} className="space-y-4 rounded-md border bg-card p-4">
      <h2 id={id} className="font-display text-2xl font-extrabold leading-none">
        {t("Services by status")}
      </h2>
      {isError ? (
        <p className="text-sm text-destructive">{t("Could not load the status counts.")}</p>
      ) : (
        <dl aria-busy={isPending} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {STATUSES.map((status) => (
            <div key={status} className="space-y-1 rounded-md border p-3">
              <dt>
                <StatusBadge status={status} />
              </dt>
              <dd className="font-display text-3xl font-bold leading-none tabular-nums">
                {data ? (
                  data[status]
                ) : (
                  // Inline, so the line keeps the number's height and the card doesn't grow.
                  <Skeleton className="inline-block h-6 w-12 align-middle" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
