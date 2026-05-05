"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TopProductsDonut } from "@/components/shared/TopProductsDonut";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { DashboardStats, ISale } from "@/types";
import { formatSaleTablesLine } from "@/lib/sale-tables";
import { AlertTriangle, CheckCircle, Clock, Image as ImageIcon, XCircle } from "lucide-react";

const SALES_LINE_COLOR = "#0F7669";

const SalesTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#E5E5E5] bg-white p-3 text-xs shadow-lg">
        <p className="mb-1 text-[#6B7280]">{label}</p>
        <p className="text-sm font-semibold text-[#0D0D0D]">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

function formatYAxisRevenue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `${v}`;
}

/** Hauteur commune des zones graphique (Ventes 7j + Top produits) */
const CHART_HEIGHT = 280;

export default function DashboardCharts({ data }: { data: DashboardStats }) {
  const lowStockProducts = data.lowStockProducts ?? [];

  return (
    <>
      <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-[13fr_7fr]">
        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="space-y-1.5 pb-3">
              <CardTitle className="text-lg font-bold tracking-tight text-[#0D0D0D]">
                Ventes — 7 derniers jours
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed text-[#6B7280]">
                Évolution du chiffre d&apos;affaires jour après jour sur la semaine glissante
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-5">
              <div className="min-h-0 w-full" style={{ height: CHART_HEIGHT }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.weeklyRevenue}
                    margin={{ top: 8, right: 8, bottom: 36, left: 0 }}
                  >
                    <CartesianGrid
                      stroke="#ECECED"
                      strokeWidth={1}
                      vertical={false}
                      horizontal
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      tickLine={false}
                      axisLine={false}
                      dy={6}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6B7280" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={formatYAxisRevenue}
                      domain={[0, "auto"]}
                    />
                    <Tooltip content={<SalesTooltip />} cursor={{ stroke: "#E5E5E5", strokeWidth: 1 }} />
                    <Line
                      type="natural"
                      dataKey="revenue"
                      name="Chiffre d'affaires"
                      stroke={SALES_LINE_COLOR}
                      strokeWidth={2.75}
                      dot={false}
                      activeDot={false}
                      isAnimationActive
                    />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      iconType="square"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) => (
                        <span className="text-xs font-medium text-[#6B7280]">{value}</span>
                      )}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          className="min-w-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">Top 5 produits</CardTitle>
              <CardDescription className="text-xs leading-snug">
                Répartition des quantités vendues (unités)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="min-h-0" style={{ height: CHART_HEIGHT }}>
                <TopProductsDonut products={data.topProducts ?? []} />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12fr_8fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventes récentes</CardTitle>
              <CardDescription className="text-xs leading-snug">
                Les 5 dernières commandes enregistrées, tous statuts confondus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentSales?.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">Aucune vente récente</p>
              ) : (
                <div className="space-y-2">
                  {data.recentSales?.map((sale: ISale) => {
                    const waitress = sale.waitress as { firstName: string; lastName: string };
                    const tablesLine = formatSaleTablesLine(sale);
                    const saleId = typeof sale._id === "string" ? sale._id : String(sale._id);
                    return (
                      <Link
                        key={saleId}
                        href={`/sales/${saleId}`}
                        className="flex items-center justify-between rounded-lg p-3 text-left transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D0D0D] focus-visible:ring-offset-2"
                        aria-label={`Voir la vente — ${tablesLine}`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5]">
                            {sale.status === "COMPLETED" ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : sale.status === "CANCELLED" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#0D0D0D]">
                              {tablesLine} — {waitress?.firstName} {waitress?.lastName}
                            </p>
                            <p className="text-xs text-[#9CA3AF]">{formatDateTime(sale.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 pl-2">
                          <Badge
                            variant={
                              sale.status === "COMPLETED"
                                ? "success"
                                : sale.status === "CANCELLED"
                                  ? "destructive"
                                  : "pending"
                            }
                          >
                            {sale.status === "COMPLETED"
                              ? "Clôturée"
                              : sale.status === "CANCELLED"
                                ? "Annulée"
                                : "En attente"}
                          </Badge>
                          <span className="text-sm font-semibold tabular-nums text-[#0D0D0D]">
                            {formatCurrency(sale.totalAmount)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.46 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produits en stock faible</CardTitle>
              <CardDescription>Priorité de réapprovisionnement (stock &lt; 5)</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#9CA3AF]">Aucun produit en stock faible</p>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.id}`}
                      className="flex items-center justify-between rounded-lg border border-[#F1F3F5] p-2.5 transition-colors hover:bg-[#FAFAFA]"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-[#F5F5F5]">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-[#9CA3AF]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#0D0D0D]">{product.name}</p>
                          <p className="text-xs text-[#9CA3AF]">Prix: {formatCurrency(product.marketSellingPrice)}</p>
                        </div>
                      </div>
                      <Badge variant={product.stock <= 0 ? "destructive" : "warning"} className="shrink-0">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {product.stock} unités
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
