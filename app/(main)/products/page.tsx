"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Package, TrendingDown, AlertTriangle, Search, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ProductWithStock {
  _id: string;
  name: string;
  image?: string;
  sellingPrice: number;
  stock: number;
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

export default function ProductsPage() {
  const { data: session } = useSession();
  const isDirector = session?.user?.role === "directeur";
  const qc = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
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

  const filtered = products?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

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
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Nouveau produit
            </Button>
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
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <Input
          placeholder="Rechercher un produit..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
            {filtered.map((product, i) => (
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

      <ProductFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={editProduct}
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
