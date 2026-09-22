"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Building2, CookingPot, Eye, Lock, Package, ShoppingCart, TruckIcon, Wallet, Banknote, Landmark } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import type { IExercice } from "@/types";

type ConsultationPayload = {
  exercice: IExercice;
  readOnly: boolean;
  summary: {
    openingBalance: number;
    salesRevenue: number;
    salesCount: number;
    salesCompleted: number;
    salesPending: number;
    suppliesCost: number;
    suppliesUnits: number;
    suppliesCount: number;
    expensesTotal: number;
    expensesCount: number;
    payrollTotal: number;
    payrollCount: number;
    kitchenRevenue: number;
    kitchenCount: number;
    cashSessionsCount: number;
    immobilisationsCount: number;
    immobilisationsAmount: number;
    stockProductsCount: number;
  };
  sales: Array<{
    _id: string;
    createdAt: string;
    status: string;
    totalAmount: number;
    waitress: string;
    itemsCount: number;
  }>;
  supplies: Array<{
    _id: string;
    createdAt: string;
    product: string;
    totalUnits: number;
    totalCost: number;
  }>;
  expenses: Array<{
    _id: string;
    date: string;
    label: string;
    amount: number;
    category: string;
    paymentMethod: string;
  }>;
  payroll: Array<{
    _id: string;
    paidAt: string;
    amount: number;
    beneficiaryType: string;
    beneficiary: string;
    isPaid: boolean;
  }>;
  kitchenOrders: Array<{
    _id: string;
    createdAt: string;
    status: string;
    totalAmount: number;
    cook: string;
    plate: number | string;
  }>;
  cashSessions: Array<{
    _id: string;
    name: string;
    kind: string;
    status: string;
    sessionDate: string;
    openingFloat: number;
    closedAt?: string;
  }>;
  immobilisations: Array<{
    _id: string;
    name: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    createdAt: string;
  }>;
  stock: Array<{ productId: string; name: string; stock: number }>;
  limits: { list: number };
};

const SECTIONS = [
  { id: "sales", label: "Ventes" },
  { id: "supplies", label: "Appro." },
  { id: "stock", label: "Stock" },
  { id: "cash", label: "Caisse" },
  { id: "kitchen", label: "Cuisine" },
  { id: "expenses", label: "Dépenses" },
  { id: "payroll", label: "Paie" },
  { id: "immo", label: "Immo." },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function statusBadge(status: string) {
  if (status === "COMPLETED" || status === "CLOSED") {
    return <Badge variant="success">{status === "CLOSED" ? "Clôturée" : "Terminée"}</Badge>;
  }
  if (status === "PENDING" || status === "OPEN") {
    return <Badge variant="pending">{status === "OPEN" ? "Ouverte" : "En attente"}</Badge>;
  }
  if (status === "CANCELLED") return <Badge variant="destructive">Annulée</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

function Empty({ label }: { label: string }) {
  return <p className="px-4 py-10 text-center text-sm text-[#9CA3AF]">{label}</p>;
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E5E5E5] bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left text-[#6B7280]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-[#F3F4F6] last:border-0">
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-[#0D0D0D]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ExerciceConsultationPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { data: session, status: authStatus } = useSession();
  const can = ["directeur", "directrice"].includes(session?.user?.role ?? "");
  const [section, setSection] = useState<SectionId>("sales");

  const { data, isLoading, error } = useQuery({
    queryKey: ["exercice-consultation", id],
    queryFn: async () => {
      const res = await fetch(`/api/exercices/${id}/consultation`);
      if (!res.ok) throw new Error((await res.json()).error ?? "consultation");
      return res.json() as Promise<ConsultationPayload>;
    },
    enabled: can && Boolean(id),
  });

  if (authStatus === "loading" || isLoading) return <Skeleton className="h-96" />;
  if (!can) return <p className="py-20 text-center text-[#9CA3AF]">Accès réservé à la direction.</p>;
  if (error || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#9CA3AF]">Exercice introuvable.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/accounting/exercices">Retour aux exercices</Link>
        </Button>
      </div>
    );
  }

  const { exercice, summary, readOnly } = data;

  return (
    <div>
      <PageHeader
        title={exercice.name}
        subtitle={
          readOnly
            ? `Consultation en lecture seule — clôturé le ${exercice.closedAt ? formatDate(exercice.closedAt) : "—"}`
            : `Exercice actif — ouvert le ${formatDate(exercice.startedAt)}`
        }
        action={
          <Button asChild variant="outline">
            <Link href="/accounting/exercices">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        }
      />

      <div
        className={cn(
          "mb-6 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm",
          readOnly ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"
        )}
      >
        {readOnly ? <Lock className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
        <span>
          {readOnly
            ? "Mode lecture seule : aucune modification possible sur cet exercice."
            : "Cet exercice est actif. Les données ci-dessous sont celles du travail en cours."}
        </span>
        {readOnly ? <Badge variant="warning">Clôturé</Badge> : <Badge variant="success">Actif</Badge>}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Solde d’ouverture" value={formatCurrency(summary.openingBalance)} icon={Wallet} index={0} />
        <StatsCard
          title="CA ventes"
          value={formatCurrency(summary.salesRevenue)}
          subtitle={`${summary.salesCompleted} ventes terminées`}
          icon={ShoppingCart}
          index={1}
        />
        <StatsCard
          title="Approvisionnements"
          value={formatCurrency(summary.suppliesCost)}
          subtitle={`${summary.suppliesUnits} unités`}
          icon={TruckIcon}
          index={2}
        />
        <StatsCard
          title="Dépenses"
          value={formatCurrency(summary.expensesTotal)}
          subtitle={`${summary.expensesCount} écritures`}
          icon={Landmark}
          index={3}
        />
        <StatsCard
          title="Paie"
          value={formatCurrency(summary.payrollTotal)}
          subtitle={`${summary.payrollCount} fiches`}
          icon={Banknote}
          index={4}
        />
        <StatsCard
          title="Cuisine"
          value={formatCurrency(summary.kitchenRevenue)}
          subtitle={`${summary.kitchenCount} commandes`}
          icon={CookingPot}
          index={5}
        />
        <StatsCard
          title="Immobilisations"
          value={formatCurrency(summary.immobilisationsAmount)}
          subtitle={`${summary.immobilisationsCount} biens`}
          icon={Building2}
          index={6}
        />
        <StatsCard
          title="Produits en stock"
          value={String(summary.stockProductsCount)}
          subtitle={`${summary.cashSessionsCount} sessions caisse`}
          icon={Package}
          index={7}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm",
              section === s.id
                ? "bg-primary text-primary-foreground"
                : "bg-[#F5F5F5] text-[#6B7280] hover:bg-[#E5E5E5] hover:text-[#0D0D0D]"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "sales" && (
        data.sales.length === 0 ? (
          <Empty label="Aucune vente sur cet exercice." />
        ) : (
          <DataTable
            headers={["Date", "Serveuse", "Articles", "Montant", "Statut"]}
            rows={data.sales.map((row) => [
              formatDateTime(row.createdAt),
              row.waitress,
              String(row.itemsCount),
              formatCurrency(row.totalAmount),
              statusBadge(row.status),
            ])}
          />
        )
      )}

      {section === "supplies" && (
        data.supplies.length === 0 ? (
          <Empty label="Aucun approvisionnement sur cet exercice." />
        ) : (
          <DataTable
            headers={["Date", "Produit", "Unités", "Coût"]}
            rows={data.supplies.map((row) => [
              formatDateTime(row.createdAt),
              row.product,
              String(row.totalUnits),
              formatCurrency(row.totalCost),
            ])}
          />
        )
      )}

      {section === "stock" && (
        data.stock.length === 0 ? (
          <Empty label="Aucun mouvement de stock sur cet exercice." />
        ) : (
          <DataTable
            headers={["Produit", "Quantité"]}
            rows={data.stock.map((row) => [row.name, String(row.stock)])}
          />
        )
      )}

      {section === "cash" && (
        data.cashSessions.length === 0 ? (
          <Empty label="Aucune session de caisse sur cet exercice." />
        ) : (
          <DataTable
            headers={["Session", "Type", "Date", "Fond", "Statut"]}
            rows={data.cashSessions.map((row) => [
              row.name,
              row.kind === "KITCHEN" ? "Cuisine" : "Bar",
              formatDate(row.sessionDate),
              formatCurrency(row.openingFloat),
              statusBadge(row.status),
            ])}
          />
        )
      )}

      {section === "kitchen" && (
        data.kitchenOrders.length === 0 ? (
          <Empty label="Aucune commande cuisine sur cet exercice." />
        ) : (
          <DataTable
            headers={["Date", "Cuisinière", "Plaque", "Montant", "Statut"]}
            rows={data.kitchenOrders.map((row) => [
              formatDateTime(row.createdAt),
              row.cook,
              String(row.plate),
              formatCurrency(row.totalAmount),
              statusBadge(row.status),
            ])}
          />
        )
      )}

      {section === "expenses" && (
        data.expenses.length === 0 ? (
          <Empty label="Aucune dépense sur cet exercice." />
        ) : (
          <DataTable
            headers={["Date", "Libellé", "Catégorie", "Paiement", "Montant"]}
            rows={data.expenses.map((row) => [
              formatDate(row.date),
              row.label,
              row.category,
              row.paymentMethod,
              formatCurrency(row.amount),
            ])}
          />
        )
      )}

      {section === "payroll" && (
        data.payroll.length === 0 ? (
          <Empty label="Aucune paie sur cet exercice." />
        ) : (
          <DataTable
            headers={["Date", "Bénéficiaire", "Type", "Montant", "Payé"]}
            rows={data.payroll.map((row) => [
              formatDate(row.paidAt),
              row.beneficiary,
              row.beneficiaryType,
              formatCurrency(row.amount),
              row.isPaid ? <Badge variant="success">Oui</Badge> : <Badge variant="secondary">Non</Badge>,
            ])}
          />
        )
      )}

      {section === "immo" && (
        data.immobilisations.length === 0 ? (
          <Empty label="Aucune immobilisation sur cet exercice." />
        ) : (
          <DataTable
            headers={["Nom", "Montant", "Versé", "Reste"]}
            rows={data.immobilisations.map((row) => [
              row.name,
              formatCurrency(row.amount),
              formatCurrency(row.paidAmount),
              formatCurrency(row.remainingAmount),
            ])}
          />
        )
      )}

      <p className="mt-4 text-xs text-[#9CA3AF]">
        Affichage limité aux {data.limits.list} dernières écritures par section.
      </p>
    </div>
  );
}
