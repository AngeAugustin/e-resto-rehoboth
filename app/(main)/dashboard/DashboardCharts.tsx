"use client";

import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { DashboardStats, ISale } from "@/types";
import { CheckCircle, Clock } from "lucide-react";

const CustomTooltip = ({
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
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-3 shadow-lg">
        <p className="text-xs text-[#6B7280] mb-1">{label}</p>
        <p className="text-sm font-semibold text-[#0D0D0D]">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
};

export default function DashboardCharts({ data }: { data: DashboardStats }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ventes — 7 derniers jours</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.weeklyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0D0D0D"
                    strokeWidth={2}
                    dot={{ fill: "#0D0D0D", r: 3 }}
                    activeDot={{ r: 5, fill: "#0D0D0D" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top 5 Produits</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: "#374151" }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} unités`, "Vendus"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E5E5",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="sold" fill="#0D0D0D" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventes récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentSales?.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] text-center py-8">Aucune vente récente</p>
            ) : (
              <div className="space-y-2">
                {data.recentSales?.map((sale: ISale) => {
                  const waitress = sale.waitress as { firstName: string; lastName: string };
                  const table = sale.table as { number: number; name?: string };
                  return (
                    <div
                      key={sale._id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-[#FAFAFA] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                          {sale.status === "COMPLETED" ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#0D0D0D]">
                            Table {table?.number} — {waitress?.firstName} {waitress?.lastName}
                          </p>
                          <p className="text-xs text-[#9CA3AF]">{formatDateTime(sale.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={sale.status === "COMPLETED" ? "success" : "pending"}>
                          {sale.status === "COMPLETED" ? "Clôturée" : "En attente"}
                        </Badge>
                        <span className="text-sm font-semibold text-[#0D0D0D]">
                          {formatCurrency(sale.totalAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
