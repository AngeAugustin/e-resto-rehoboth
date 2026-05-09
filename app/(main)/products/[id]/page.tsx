"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, TruckIcon, ShoppingCart, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { premiumTableSelectClass } from "@/components/shared/PremiumTableShell";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ISale } from "@/types";
import { formatSaleTablesLine } from "@/lib/sale-tables";

interface ProductDetail {
  product: {
    _id: string;
    name: string;
    image?: string;
    marketSellingPrice: number;
    quantiteStandardPack?: number;
    prixCasier?: number;
    stock: number;
  };
  supplies: Array<{
    _id: string;
    lotSize: number;
    lotPrice: number;
    numberOfLots: number;
    totalUnits: number;
    totalCost: number;
    marketSellingPrice: number;
    createdBy: { firstName: string; lastName: string };
    createdAt: string;
  }>;
  sales: ISale[];
  stock: number;
}

async function fetchProductDetail(id: string): Promise<ProductDetail> {
  const res = await fetch(`/api/products/${id}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetchProductDetail(id),
  });

  const supplies = data?.supplies ?? [];
  const sales = data?.sales ?? [];

  const [supplyPage, setSupplyPage] = useState(1);
  const [supplyPageSize, setSupplyPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);

  const supplyTotalPages = Math.max(1, Math.ceil(supplies.length / supplyPageSize));
  const salesTotalPages = Math.max(1, Math.ceil(sales.length / salesPageSize));

  useEffect(() => {
    setSupplyPage(1);
    setSalesPage(1);
  }, [id]);

  useEffect(() => {
    if (supplyPage > supplyTotalPages) setSupplyPage(supplyTotalPages);
  }, [supplyPage, supplyTotalPages]);

  useEffect(() => {
    if (salesPage > salesTotalPages) setSalesPage(salesTotalPages);
  }, [salesPage, salesTotalPages]);

  useEffect(() => {
    setSupplyPage(1);
  }, [supplyPageSize]);

  useEffect(() => {
    setSalesPage(1);
  }, [salesPageSize]);

  const paginatedSupplies = supplies.slice((supplyPage - 1) * supplyPageSize, supplyPage * supplyPageSize);
  const paginatedSales = sales.slice((salesPage - 1) * salesPageSize, salesPage * salesPageSize);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-44 w-full rounded-xl sm:h-48" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) return <p className="text-center py-20 text-[#9CA3AF]">Produit introuvable</p>;

  const { product } = data;

  const displayPrice =
    product.marketSellingPrice != null && Number.isFinite(product.marketSellingPrice)
      ? product.marketSellingPrice
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <p className="text-sm text-[#6B7280]">Détails du produit</p>
      </div>

      {/* Bandeau produit — pleine largeur, disposition horizontale sur tablette et plus */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-[#E5E5E5] shadow-sm">
          <CardContent className="p-0">
            <div className="flex flex-col gap-6 p-5 sm:p-6 md:flex-row md:items-center md:gap-4 lg:gap-5 lg:p-8">
              <div className="mx-auto flex h-36 w-36 shrink-0 overflow-hidden rounded-2xl bg-[#F5F5F5] sm:h-40 sm:w-40 md:mx-0 md:h-44 md:w-44">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-14 w-14 text-[#D1D5DB]" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-4 text-center md:text-left">
                <div>
                  <h1 className="text-balance text-xl font-bold tracking-tight text-[#0D0D0D] sm:text-2xl">
                    {product.name}
                  </h1>
                  <p className="mt-1 text-2xl font-bold text-[#0D0D0D] sm:text-3xl">{formatCurrency(displayPrice)}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">Prix de vente unitaire marché (fiche produit)</p>
                  {(product.quantiteStandardPack != null &&
                    Number.isInteger(product.quantiteStandardPack) &&
                    product.quantiteStandardPack >= 1) ||
                  (product.prixCasier != null && Number.isFinite(product.prixCasier)) ? (
                    <p className="mt-2 text-sm text-[#6B7280]">
                      {product.quantiteStandardPack != null &&
                      Number.isInteger(product.quantiteStandardPack) &&
                      product.quantiteStandardPack >= 1 ? (
                        <>
                          <span className="font-medium text-[#374151]">Quantité standard pack :</span>{" "}
                          {product.quantiteStandardPack} unité{product.quantiteStandardPack > 1 ? "s" : ""} / casier
                        </>
                      ) : null}
                      {product.quantiteStandardPack != null &&
                      product.quantiteStandardPack >= 1 &&
                      product.prixCasier != null &&
                      Number.isFinite(product.prixCasier) ? (
                        <span className="mx-1.5 text-[#D1D5DB]">·</span>
                      ) : null}
                      {product.prixCasier != null && Number.isFinite(product.prixCasier) ? (
                        <>
                          <span className="font-medium text-[#374151]">Prix casier :</span>{" "}
                          {formatCurrency(product.prixCasier)}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-4 border-t border-[#E5E5E5] pt-5 md:w-72 md:border-l md:border-t-0 md:pl-4 md:pt-0 lg:w-80 lg:pl-5">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3">
                  <span className="text-sm font-medium text-[#6B7280]">Stock actuel</span>
                  <Badge
                    variant={product.stock === 0 ? "destructive" : product.stock < 5 ? "warning" : "success"}
                    className="shrink-0 px-3 text-sm"
                  >
                    {product.stock} unités
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#F5F5F5] p-3 text-center">
                    <p className="text-lg font-bold text-[#0D0D0D]">{supplies.length}</p>
                    <p className="text-xs text-[#6B7280]">Approvisionnements</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F5F5] p-3 text-center">
                    <p className="text-lg font-bold text-[#0D0D0D]">{sales.length}</p>
                    <p className="text-xs text-[#6B7280]">Ventes</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="space-y-6">
          {/* Supply History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TruckIcon className="w-4 h-4" />
                  Historique des approvisionnements
                  <Badge variant="secondary">{supplies.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {supplies.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] py-4 text-center">
                    Aucun approvisionnement enregistré
                  </p>
                ) : (
                  <>
                    <div className="mb-3 flex justify-end">
                      <label className="inline-flex items-center gap-2 text-xs text-[#6B7280]">
                        Lignes par page
                        <select
                          value={supplyPageSize}
                          onChange={(e) =>
                            setSupplyPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                          }
                          className={premiumTableSelectClass}
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#F5F5F5]">
                            <th className="text-left py-2 px-2 text-xs font-medium text-[#9CA3AF]">Date</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Lots</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Unités</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Coût total</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Prix vente</th>
                            <th className="text-left py-2 px-2 text-xs font-medium text-[#9CA3AF]">Par</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSupplies.map((supply) => (
                            <tr key={supply._id} className="border-b border-[#FAFAFA] hover:bg-[#FAFAFA]">
                              <td className="py-2.5 px-2 text-[#374151]">{formatDate(supply.createdAt)}</td>
                              <td className="py-2.5 px-2 text-right text-[#374151]">
                                {supply.numberOfLots} × {supply.lotSize}
                              </td>
                              <td className="py-2.5 px-2 text-right font-medium text-[#0D0D0D]">
                                {supply.totalUnits}
                              </td>
                              <td className="py-2.5 px-2 text-right text-[#374151]">
                                {formatCurrency(supply.totalCost)}
                              </td>
                              <td className="py-2.5 px-2 text-right text-[#374151]">
                                {formatCurrency(supply.marketSellingPrice)}
                              </td>
                              <td className="py-2.5 px-2 text-[#6B7280] text-xs">
                                {supply.createdBy?.firstName} {supply.createdBy?.lastName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControls
                      className="mt-4"
                      currentPage={supplyPage}
                      pageSize={supplyPageSize}
                      totalItems={supplies.length}
                      onPageChange={setSupplyPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Sales History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Historique des ventes
                  <Badge variant="secondary">{sales.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sales.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] py-4 text-center">
                    Aucune vente enregistrée
                  </p>
                ) : (
                  <>
                    <div className="mb-3 flex justify-end">
                      <label className="inline-flex items-center gap-2 text-xs text-[#6B7280]">
                        Lignes par page
                        <select
                          value={salesPageSize}
                          onChange={(e) =>
                            setSalesPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                          }
                          className={premiumTableSelectClass}
                        >
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#F5F5F5]">
                            <th className="text-left py-2 px-2 text-xs font-medium text-[#9CA3AF]">Date</th>
                            <th className="text-left py-2 px-2 text-xs font-medium text-[#9CA3AF]">Table</th>
                            <th className="text-left py-2 px-2 text-xs font-medium text-[#9CA3AF]">Serveuse</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Qté</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Total</th>
                            <th className="text-right py-2 px-2 text-xs font-medium text-[#9CA3AF]">Marge</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedSales.map((sale) => {
                            const lineProductId = (line: (typeof sale.items)[0]) => {
                              const raw = line.product;
                              if (typeof raw === "string") return raw;
                              if (raw && typeof raw === "object" && "_id" in raw)
                                return String((raw as { _id: string })._id);
                              return "";
                            };
                            const item = sale.items.find((line) => lineProductId(line) === String(id));
                            const lineMargin =
                              item?.unitCost != null
                                ? (item.total ?? 0) - item.unitCost * (item.quantity ?? 0)
                                : null;
                            const waitress = sale.waitress as { firstName?: string; lastName?: string };
                            return (
                              <tr key={sale._id} className="border-b border-[#FAFAFA] hover:bg-[#FAFAFA]">
                                <td className="py-2.5 px-2 text-[#374151]">{formatDate(sale.createdAt)}</td>
                                <td className="py-2.5 px-2 text-[#374151] max-w-[160px] truncate" title={formatSaleTablesLine(sale)}>
                                  {formatSaleTablesLine(sale)}
                                </td>
                                <td className="py-2.5 px-2 text-[#374151]">
                                  {waitress?.firstName} {waitress?.lastName}
                                </td>
                                <td className="py-2.5 px-2 text-right font-medium text-[#0D0D0D]">
                                  {item?.quantity}
                                </td>
                                <td className="py-2.5 px-2 text-right text-[#374151]">
                                  {formatCurrency(item?.total ?? 0)}
                                </td>
                                <td className="py-2.5 px-2 text-right text-[#374151]">
                                  {lineMargin != null ? formatCurrency(lineMargin) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControls
                      className="mt-4"
                      currentPage={salesPage}
                      pageSize={salesPageSize}
                      totalItems={sales.length}
                      onPageChange={setSalesPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
      </div>
    </div>
  );
}
