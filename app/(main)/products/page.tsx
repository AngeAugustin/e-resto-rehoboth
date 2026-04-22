"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Package,
  TrendingDown,
  AlertTriangle,
  Search,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES } from "@/lib/product-categories";

interface ProductWithStock {
  _id: string;
  name: string;
  category?: string;
  image?: string;
  sellingPrice: number;
  stock: number;
}

interface ProductImportPreviewRow {
  rowNumber: number;
  name: string;
  category: string | null;
  sellingPrice: number | null;
  image: string;
  valid: boolean;
  error?: string;
}

interface ProductImportPreviewResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ProductImportPreviewRow[];
}

async function fetchProducts(): Promise<ProductWithStock[]> {
  const res = await fetch("/api/products/stock");
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

interface ProductFormData {
  name: string;
  category: string;
  image: string;
  sellingPrice: string;
}

function ProductFormDialog({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product?: ProductWithStock;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProductFormData>({
    name: "",
    category: DEFAULT_PRODUCT_CATEGORY,
    image: "",
    sellingPrice: "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: product?.name ?? "",
      category: product?.category ?? DEFAULT_PRODUCT_CATEGORY,
      image: product?.image ?? "",
      sellingPrice: product?.sellingPrice?.toString() ?? "",
    });
    setImageFile(null);
    setPreviewUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open, product]);

  const revokePreview = (url: string | null) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        variant: "destructive",
        title: "Fichier trop volumineux",
        description: "L’image ne doit pas dépasser 5 Mo.",
      });
      e.target.value = "";
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Format invalide",
        description: "Utilisez JPEG, PNG, WebP ou GIF.",
      });
      e.target.value = "";
      return;
    }
    setImageFile(file);
    setPreviewUrl((prev) => {
      revokePreview(prev);
      return URL.createObjectURL(file);
    });
  };

  const clearImage = () => {
    setImageFile(null);
    setPreviewUrl((prev) => {
      revokePreview(prev);
      return null;
    });
    setForm((f) => ({ ...f, image: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let imageUrl = form.image;
    if (imageFile) {
      const fd = new FormData();
      fd.append("file", imageFile);
      const up = await fetch("/api/products/upload-image", { method: "POST", body: fd });
      if (!up.ok) {
        setIsSubmitting(false);
        const err = await up.json().catch(() => ({}));
        toast({ variant: "destructive", title: "Échec de l’upload", description: err.error ?? "Réessayez." });
        return;
      }
      const { url } = await up.json();
      imageUrl = url;
    }

    const url = product ? `/api/products/${product._id}` : "/api/products";
    const method = product ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        category: form.category,
        image: imageUrl,
        sellingPrice: parseFloat(form.sellingPrice),
      }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: err.error });
      return;
    }

    toast({
      variant: "success",
      title: product ? "Produit modifié" : "Produit créé",
      description: `${form.name} a été ${product ? "mis à jour" : "ajouté"} avec succès.`,
    });

    qc.invalidateQueries({ queryKey: ["products"] });
    onClose();
  };

  const displaySrc = previewUrl ?? (form.image ? form.image : null);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nom du produit</Label>
            <Input
              placeholder="Ex: Coca-Cola 33cl"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Image du produit</Label>
            <div className="flex flex-col gap-3">
              <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]">
                {displaySrc ? (
                  <img src={displaySrc} alt="Aperçu" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-[#9CA3AF]">Aucune image</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  id="product-image-input"
                  onChange={handleImagePick}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="w-4 h-4" />
                  Choisir une image
                </Button>
                {(imageFile || form.image) && (
                  <Button type="button" variant="ghost" size="sm" className="text-[#6B7280]" onClick={clearImage}>
                    Retirer l’image
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-[#9CA3AF]">JPEG, PNG, WebP ou GIF — max. 5 Mo</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Prix de vente unitaire (FCFA)</Label>
            <Input
              type="number"
              placeholder="1500"
              value={form.sellingPrice}
              onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
              required
              min={0}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : product ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductImportDialog({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductImportPreviewResult | null>(null);
  const [previewRows, setPreviewRows] = useState<ProductImportPreviewRow[]>([]);
  const [failedImageRows, setFailedImageRows] = useState<Set<number>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const validateImportRow = (row: ProductImportPreviewRow): ProductImportPreviewRow => {
    const errors: string[] = [];
    if (!row.name.trim()) errors.push("Nom manquant");
    if (!row.category || !PRODUCT_CATEGORIES.includes(row.category as (typeof PRODUCT_CATEGORIES)[number])) {
      errors.push("Catégorie invalide");
    }
    if (row.sellingPrice === null || !Number.isFinite(row.sellingPrice) || row.sellingPrice < 0) {
      errors.push("Prix invalide");
    }

    return {
      ...row,
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join(" · ") : undefined,
    };
  };

  const previewValidRows = previewRows.filter((row) => row.valid).length;
  const previewInvalidRows = previewRows.length - previewValidRows;

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setPreviewRows([]);
      setFailedImageRows(new Set());
      setIsAnalyzing(false);
      setIsImporting(false);
    }
  }, [open]);

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/products/import/preview", {
      method: "POST",
      body: fd,
    });
    setIsAnalyzing(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        variant: "destructive",
        title: "Analyse impossible",
        description: err.error ?? "Vérifiez le format du fichier.",
      });
      return;
    }

    const payload = (await res.json()) as ProductImportPreviewResult;
    setPreview(payload);
    setPreviewRows(payload.rows.map(validateImportRow));
    setFailedImageRows(new Set());
  };

  const handleCommitImport = async () => {
    if (!preview) return;
    const validRows = previewRows
      .filter((row) => row.valid && row.category && row.sellingPrice !== null)
      .map((row) => ({
        name: row.name,
        category: row.category as string,
        sellingPrice: row.sellingPrice as number,
        image: row.image,
      }));

    if (validRows.length === 0) {
      toast({
        variant: "destructive",
        title: "Aucune ligne valide",
        description: "Corrigez le fichier puis réessayez.",
      });
      return;
    }

    setIsImporting(true);
    const res = await fetch("/api/products/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: validRows }),
    });
    setIsImporting(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({
        variant: "destructive",
        title: "Import échoué",
        description: err.error ?? "Impossible de créer les produits.",
      });
      return;
    }

    const result = (await res.json()) as { importedCount: number; skippedCount: number };
    toast({
      variant: "success",
      title: "Import terminé",
      description: `${result.importedCount} produit(s) importé(s), ${result.skippedCount} ignoré(s).`,
    });
    onImported();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des produits</DialogTitle>
          <DialogDescription>
            Importez un fichier Excel ou PDF contenant les colonnes Produit, Catégorie, Prix vente et
            éventuellement Lien image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Input
              type="file"
              accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                setPreview(null);
              }}
            />
            <Button type="button" variant="outline" onClick={handleAnalyze} disabled={!file || isAnalyzing}>
              <FileSpreadsheet className="w-4 h-4" />
              {isAnalyzing ? "Analyse..." : "Prévisualiser"}
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border border-[#E5E5E5] overflow-hidden">
              <div className="flex flex-wrap gap-3 items-center justify-between px-4 py-3 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <p className="text-sm text-[#374151]">
                  Fichier: <span className="font-medium">{preview.fileName}</span>
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-[#6B7280]">{previewRows.length} ligne(s)</span>
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {previewValidRows} valides
                  </span>
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {previewInvalidRows} invalides
                  </span>
                </div>
              </div>

              <div className="overflow-auto max-h-[50vh]">
                <table className="w-full text-sm">
                  <thead className="bg-white sticky top-0 z-10">
                    <tr className="border-b border-[#E5E5E5]">
                      <th className="text-left px-3 py-2 w-20">Aperçu</th>
                      <th className="text-left px-3 py-2 w-16">Ligne</th>
                      <th className="text-left px-3 py-2">Produit</th>
                      <th className="text-left px-3 py-2">Catégorie</th>
                      <th className="text-right px-3 py-2 w-32">Prix vente</th>
                      <th className="text-left px-3 py-2">Lien image</th>
                      <th className="text-left px-3 py-2 w-48">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => (
                      <tr key={`${row.rowNumber}-${row.name}`} className="border-b border-[#F3F4F6]">
                        <td className="px-3 py-2">
                          {row.image && !failedImageRows.has(row.rowNumber) ? (
                            <img
                              src={`/api/products/import/image-proxy?url=${encodeURIComponent(row.image)}`}
                              alt={row.name || "Image boisson"}
                              className="h-9 w-9 rounded-full object-cover border border-[#E5E5E5] bg-white"
                              onError={() => {
                                setFailedImageRows((prev) => new Set(prev).add(row.rowNumber));
                              }}
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full border border-[#E5E5E5] bg-[#F5F5F5] flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-[#9CA3AF]" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[#6B7280]">
                          <span>{row.rowNumber}</span>
                        </td>
                        <td className="px-3 py-2">{row.name || "-"}</td>
                        <td className="px-3 py-2 min-w-[180px]">
                          {row.category && PRODUCT_CATEGORIES.includes(row.category as (typeof PRODUCT_CATEGORIES)[number]) ? (
                            row.category
                          ) : (
                            <Select
                              value={row.category ?? "__none__"}
                              onValueChange={(value) => {
                                if (value === "__none__") return;
                                setPreviewRows((prev) =>
                                  prev.map((r, rIdx) =>
                                    rIdx === idx ? validateImportRow({ ...r, category: value }) : r
                                  )
                                );
                              }}
                            >
                              <SelectTrigger className="h-8 bg-white">
                                <SelectValue placeholder="Corriger la catégorie" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCT_CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {row.sellingPrice !== null ? row.sellingPrice.toLocaleString("fr-FR") : "-"}
                        </td>
                        <td className="px-3 py-2 max-w-[300px] truncate text-[#6B7280]" title={row.image}>
                          {row.image || "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.valid ? (
                            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Prêt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium" title={row.error}>
                              <XCircle className="w-3.5 h-3.5" />
                              {row.error ?? "Invalide"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 mt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleCommitImport}
            disabled={!preview || previewValidRows === 0 || isImporting}
          >
            <Upload className="w-4 h-4" />
            {isImporting ? "Import en cours..." : "Valider l'importation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const { data: session } = useSession();
  const isDirector = session?.user?.role === "directeur";
  const qc = useQueryClient();
  const PAGE_SIZE = 20;

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priceMinFilter, setPriceMinFilter] = useState("");
  const [priceMaxFilter, setPriceMaxFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<ProductWithStock | undefined>();
  const [productToDelete, setProductToDelete] = useState<ProductWithStock | null>(null);

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Produit supprimé" });
      qc.invalidateQueries({ queryKey: ["products"] });
      setProductToDelete(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const minPrice = priceMinFilter.trim() === "" ? null : Number(priceMinFilter);
  const maxPrice = priceMaxFilter.trim() === "" ? null : Number(priceMaxFilter);

  const filtered =
    products?.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "ALL" ? true : p.category === categoryFilter;
      const matchesMin = minPrice === null || Number.isNaN(minPrice) ? true : p.sellingPrice >= minPrice;
      const matchesMax = maxPrice === null || Number.isNaN(maxPrice) ? true : p.sellingPrice <= maxPrice;
      return matchesSearch && matchesCategory && matchesMin && matchesMax;
    }) ?? [];
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, priceMinFilter, priceMaxFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const totalProducts = products?.length ?? 0;
  const totalStock = products?.reduce((s, p) => s + p.stock, 0) ?? 0;
  const lowStockCount = products?.filter((p) => p.stock < 5).length ?? 0;
  const outOfStock = products?.filter((p) => p.stock === 0).length ?? 0;

  const openCreate = () => { setEditProduct(undefined); setDialogOpen(true); };
  const openEdit = (p: ProductWithStock) => { setEditProduct(p); setDialogOpen(true); };

  return (
    <div>
      <PageHeader
        title="Produits"
        subtitle="Gérez votre catalogue de produits"
        action={
          isDirector ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4" />
                Importer
              </Button>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Nouveau produit
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard title="Total produits" value={totalProducts} icon={Package} index={0} />
            <StatsCard title="Unités en stock" value={totalStock} icon={TrendingDown} index={1} />
            <StatsCard title="Stock faible" value={lowStockCount} icon={AlertTriangle} variant={lowStockCount > 0 ? "warning" : "default"} index={2} />
            <StatsCard title="Rupture de stock" value={outOfStock} icon={AlertTriangle} variant={outOfStock > 0 ? "danger" : "default"} index={3} />
          </>
        )}
      </div>

      {/* Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <Input
            placeholder="Rechercher un produit..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrer par catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Toutes les catégories</SelectItem>
            {PRODUCT_CATEGORIES.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Prix min"
            value={priceMinFilter}
            onChange={(e) => setPriceMinFilter(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            placeholder="Prix max"
            value={priceMaxFilter}
            onChange={(e) => setPriceMaxFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-[#E5E5E5] mx-auto mb-3" />
          <p className="text-[#9CA3AF]">Aucun produit trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <AnimatePresence>
            {paginated.map((product, i) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden hover:shadow-md transition-all duration-200 group"
              >
                {/* Product Image */}
                <Link href={`/products/${product._id}`}>
                  <div className="aspect-square bg-[#F5F5F5] flex items-center justify-center relative overflow-hidden">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-[#D1D5DB]" />
                    )}
                    {product.category && (
                      <div className="absolute top-2 right-2">
                        <Badge
                          variant="secondary"
                          className="max-w-[130px] truncate bg-white/95 text-[#374151] border border-[#E5E5E5]"
                          title={product.category}
                        >
                          {product.category}
                        </Badge>
                      </div>
                    )}
                    {product.stock === 0 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Badge variant="destructive">Rupture</Badge>
                      </div>
                    )}
                  </div>
                </Link>

                {/* Product Info */}
                <div className="p-3">
                  <Link href={`/products/${product._id}`}>
                    <p className="font-medium text-sm text-[#0D0D0D] truncate hover:text-[#374151] transition-colors">
                      {product.name}
                    </p>
                  </Link>
                  <p className="text-xs font-semibold text-[#0D0D0D] mt-0.5">
                    {formatCurrency(product.sellingPrice)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <Badge
                      variant={
                        product.stock === 0 ? "destructive" : product.stock < 5 ? "warning" : "success"
                      }
                    >
                      {product.stock} unités
                    </Badge>
                    {isDirector && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(product)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setProductToDelete(product)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={filtered.length}
        onPageChange={setCurrentPage}
      />

      <ProductFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={editProduct}
      />
      <ProductImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ["products"] })}
      />

      <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le produit</DialogTitle>
            <DialogDescription>
              {productToDelete ? (
                <>
                  Voulez-vous vraiment supprimer « {productToDelete.name} » ? Cette action est
                  irréversible.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setProductToDelete(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={() => productToDelete && deleteProduct.mutate(productToDelete._id)}
            >
              {deleteProduct.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
