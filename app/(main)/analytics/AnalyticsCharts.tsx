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
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { AnalyticsData } from "@/types";

const PRIMARY_COLOR = "hsl(var(--primary))";

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-3 shadow-lg text-xs">
        <p className="font-medium text-[#374151] mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}:{" "}
            {typeof p.value === "number" && p.name === "Revenus" ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Évolution du Chiffre d&apos;Affaires</CardTitle>
            <CardDescription>30 derniers jours — revenus journaliers et nombre de ventes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.revenueEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  yAxisId="revenue"
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="sales"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name="Revenus"
                  stroke={PRIMARY_COLOR}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: PRIMARY_COLOR }}
                />
                <Line
                  yAxisId="sales"
                  type="monotone"
                  dataKey="sales"
                  name="Ventes"
                  stroke="#9CA3AF"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Revenus et marge par produit</CardTitle>
            <CardDescription>CA et marge cumulés (marge = CA − coût selon les lignes de vente)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.productRevenue.slice(0, 10)} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F5" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#374151" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "Revenus" ? "Revenus" : "Marge",
                  ]}
                  contentStyle={{ borderRadius: "8px", border: "1px solid #E5E5E5", fontSize: "12px" }}
                />
                <Legend />
                <Bar dataKey="revenue" fill={PRIMARY_COLOR} radius={[4, 4, 0, 0]} name="Revenus" />
                <Bar dataKey="margin" fill="#15803d" radius={[4, 4, 0, 0]} name="Marge" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
