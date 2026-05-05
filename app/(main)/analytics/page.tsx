"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Download, ImageIcon, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { exportAnalyticsReportPdf, type AnalyticsReportPayload } from "@/lib/analytics-report-pdf";
import type { AnalyticsData } from "@/types";

const AnalyticsCharts = dynamic(() => import("./AnalyticsCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-6">
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-[420px] rounded-[20px]" />
    </div>
  ),
});

type AnalyticsFilter = "today" | "yesterday" | "week" | "month" | "semester" | "year" | "custom";

async function fetchAnalytics(params: {
  filter: AnalyticsFilter;
  year?: number;
  month?: number;
  semester?: number;
  from?: string;
  to?: string;
}): Promise<AnalyticsData> {
  const search = new URLSearchParams({ filter: params.filter });
  if (params.year) search.set("year", String(params.year));
  if (params.month) search.set("month", String(params.month));
  if (params.semester) search.set("semester", String(params.semester));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const res = await fetch(`/api/analytics?${search.toString()}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function ProductRowAvatar({ image }: { image?: string }) {
  const [failed, setFailed] = useState(false);
  const src = image?.trim() ?? "";
  const showImg = Boolean(src) && !failed;

  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {showImg ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

function buildAnalyticsSearchParams(params: {
  filter: AnalyticsFilter;
  year?: number;
  month?: number;
  semester?: number;
  from?: string;
  to?: string;
}): URLSearchParams {
  const search = new URLSearchParams({ filter: params.filter });
  if (params.year) search.set("year", String(params.year));
  if (params.month) search.set("month", String(params.month));
  if (params.semester) search.set("semester", String(params.semester));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  return search;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const now = new Date();
  const currentYear = now.getFullYear();
  const [filter, setFilter] = useState<AnalyticsFilter>("today");
  const [year, setYear] = useState<number>(currentYear);
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [semester, setSemester] = useState<number>(now.getMonth() < 6 ? 1 : 2);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const hasInvalidCustomRange = Boolean(customFrom && customTo && customFrom > customTo);
  const canApplyCustom = Boolean(customFrom && customTo && !hasInvalidCustomRange);

  const queryParams = useMemo(() => {
    if (filter === "today" || filter === "yesterday" || filter === "week") return { filter } as const;
    if (filter === "month") return { filter, year, month } as const;
    if (filter === "semester") return { filter, year, semester } as const;
    if (filter === "custom")
      return {
        filter,
        from: appliedCustom?.from ?? "",
        to: appliedCustom?.to ?? "",
      } as const;
    return { filter, year } as const;
  }, [appliedCustom?.from, appliedCustom?.to, filter, month, semester, year]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "analytics",
      queryParams.filter,
      "year" in queryParams ? queryParams.year : null,
      "month" in queryParams ? queryParams.month : null,
      "semester" in queryParams ? queryParams.semester : null,
      "from" in queryParams ? queryParams.from : null,
      "to" in queryParams ? queryParams.to : null,
    ],
    queryFn: () => fetchAnalytics(queryParams),
    enabled:
      session?.user?.role === "directeur" &&
      (filter !== "custom" || Boolean(appliedCustom?.from && appliedCustom?.to)),
    staleTime: 60 * 1000,
  });

  if (status === "loading") return <Skeleton className="h-96" />;
  if (session?.user?.role !== "directeur") {
    return <p className="py-20 text-center text-muted-foreground">Accès réservé au Directeur</p>;
  }

  const summary = data?.summary;
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalProfit = summary?.totalGrossProfit ?? 0;
  const totalSales = summary?.totalSales ?? 0;
  const marginRate = summary?.marginRate ?? 0;
  const revenueDelta = summary?.revenueDeltaPct ?? 0;
  const profitDelta = summary?.profitDeltaPct ?? 0;
  const products = data?.productRevenue ?? [];
  const productsTotalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);

  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const monthOptions = [
    { value: 1, label: "Janvier" },
    { value: 2, label: "Février" },
    { value: 3, label: "Mars" },
    { value: 4, label: "Avril" },
    { value: 5, label: "Mai" },
    { value: 6, label: "Juin" },
    { value: 7, label: "Juillet" },
    { value: 8, label: "Août" },
    { value: 9, label: "Septembre" },
    { value: 10, label: "Octobre" },
    { value: 11, label: "Novembre" },
    { value: 12, label: "Décembre" },
  ];

  const handleExportReport = async () => {
    try {
      setIsExporting(true);
      const search = buildAnalyticsSearchParams(queryParams);
      const res = await fetch(`/api/analytics/report?${search.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const report = (await res.json()) as AnalyticsReportPayload;
      await exportAnalyticsReportPdf(report);
    } finally {
      setIsExporting(false);
    }
  };

  const filtersAction = (
    <div className="w-full sm:w-auto flex flex-col items-stretch sm:items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={filter} onValueChange={(value) => setFilter(value as AnalyticsFilter)}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Choisir une période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{"Aujourd'hui"}</SelectItem>
            <SelectItem value="yesterday">Hier</SelectItem>
            <SelectItem value="year">Année</SelectItem>
            <SelectItem value="semester">Semestre</SelectItem>
            <SelectItem value="month">Mois</SelectItem>
            <SelectItem value="week">Semaine</SelectItem>
            <SelectItem value="custom">Période personnalisée</SelectItem>
          </SelectContent>
        </Select>

        {(filter === "year" || filter === "semester" || filter === "month") && (
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filter === "month" && (
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Mois" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filter === "semester" && (
          <Select value={String(semester)} onValueChange={(value) => setSemester(Number(value))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Semestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Semestre 1</SelectItem>
              <SelectItem value="2">Semestre 2</SelectItem>
            </SelectContent>
          </Select>
        )}

        {filter === "custom" && (
          <>
            <Input
              className="w-[150px]"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <Input className="w-[150px]" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            <Button
              variant="outline"
              onClick={() => setAppliedCustom({ from: customFrom, to: customTo })}
              disabled={!canApplyCustom}
            >
              Appliquer
            </Button>
          </>
        )}
        <Button
          onClick={handleExportReport}
          disabled={isLoading || isExporting || !data}
          className="min-w-[110px]"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Export..." : "Exporter"}
        </Button>
      </div>
      {filter === "custom" && hasInvalidCustomRange ? (
        <p className="text-xs text-red-700">La date de début doit être antérieure à la date de fin.</p>
      ) : null}
      <p className="text-right text-xs text-muted-foreground">
        Période active : <span className="font-medium text-foreground">{data?.period.label ?? "..."}</span>
      </p>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Analytiques"
        subtitle="Visualisations avancées et tendances"
        action={filtersAction}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard
              title={`Chiffre d'affaires (${data?.period.label ?? "Période"})`}
              value={formatCurrency(totalRevenue)}
              trend={{ value: Number(revenueDelta.toFixed(1)), label: "" }}
              icon={TrendingUp}
              variant="dark"
              index={0}
            />
            <StatsCard
              title={`Bénéfice brut (${data?.period.label ?? "Période"})`}
              value={formatCurrency(totalProfit)}
              trend={{ value: Number(profitDelta.toFixed(1)), label: "" }}
              icon={Wallet}
              variant={profitDelta >= 0 ? "success" : "danger"}
              index={1}
            />
            <StatsCard
              title="Taux de marge brut"
              value={formatPercentage(marginRate)}
              subtitle="Bénéfice brut / CA sur la période"
              icon={TrendingUp}
              variant={marginRate >= 20 ? "success" : "warning"}
              index={2}
            />
            <StatsCard
              title="Ventes clôturées"
              value={totalSales}
              subtitle="Nombre total de ventes sur la période"
              icon={ShoppingCart}
              index={3}
            />
          </>
        )}
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-1 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-[420px] rounded-[20px]" />
        </div>
      ) : (
        <AnalyticsCharts data={data} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mt-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Performance par Produit</CardTitle>
            <CardDescription>Détail complet — unités vendues, revenus et bénéfice</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4 pb-4">
                <p className="text-sm text-muted-foreground">
                  Classement des produits par performance commerciale sur la période active.
                </p>
                <Badge variant="secondary">{products.length} produits</Badge>
              </div>
            )}
            {!isLoading && (
              <>
                <Separator className="mb-4" />
                <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        #
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Produit
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Prix unitaire marché (FCFA)
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Unités vendues
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Revenus
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Bénéfice
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        % du CA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product, index) => (
                      <tr key={`${product.name}-${index}`} className="border-b transition-colors hover:bg-muted/30">
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <ProductRowAvatar image={product.image} />
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={product.name}>
                              {product.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">
                          {formatCurrency(product.price ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground">{product.units}</td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">
                          {formatCurrency(product.revenue)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-emerald-700">
                          {formatCurrency(product.margin ?? 0)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{
                                  width: `${productsTotalRevenue > 0 ? (product.revenue / productsTotalRevenue) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-muted-foreground">
                              {productsTotalRevenue > 0
                                ? ((product.revenue / productsTotalRevenue) * 100).toFixed(1)
                                : 0}
                              %
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
