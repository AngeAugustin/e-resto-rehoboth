"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Plus, Users, Shield, UserCheck, Pencil, Trash2, Eye, EyeOff, Phone, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { PremiumTableShell, premiumTableSelectClass } from "@/components/shared/PremiumTableShell";
import {
  MobileCardList,
  MobileDataCard,
  MobileDataCardActions,
  MobileDataCardHeader,
  MobileDataCardMeta,
} from "@/components/shared/MobileDataCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDate, getInitials } from "@/lib/utils";
import type { IUser } from "@/types";

async function fetchUsers(): Promise<IUser[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch");
  const data = (await res.json()) as IUser[];
  return data.map((u) => ({ ...u, isActive: u.isActive !== false }));
}

interface UserForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  role: string;
}

function UserDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: IUser;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<UserForm>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    password: "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    role: user?.role ?? "gerant",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) setShowPassword(false);
  }, [open, user?._id]);

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: "",
        phone: user.phone ?? "",
        address: user.address ?? "",
        role: user.role,
      });
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const url = user ? `/api/users/${user._id}` : "/api/users";
    const method = user ? "PUT" : "POST";

    const body: Partial<UserForm> = { ...form };
    if (!body.password) delete body.password;

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ variant: "destructive", title: "Erreur", description: err.error });
      return;
    }

    toast({
      variant: "success",
      title: user ? "Utilisateur modifié" : "Utilisateur créé",
    });
    qc.invalidateQueries({ queryKey: ["users"] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? "Modifier l'utilisateur" : "Nouvel utilisateur"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-password">{user ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}</Label>
            <div className="relative">
              <Input
                id="user-password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!user}
                placeholder={user ? "Laisser vide pour ne pas changer" : "Min. 6 caractères"}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0701234567"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="directeur">Directeur</SelectItem>
                  <SelectItem value="directrice">Directrice</SelectItem>
                  <SelectItem value="gerant">Gérant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Adresse complète"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : user ? "Mettre à jour" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
  const { data: session, status } = useSession();
  const isDirector = session?.user?.role === "directeur";
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: ["directeur", "directrice"].includes(session?.user?.role ?? ""),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [editUser, setEditUser] = useState<IUser | undefined>();
  const [userToDelete, setUserToDelete] = useState<IUser | null>(null);
  const [userToggleConfirm, setUserToggleConfirm] = useState<{
    user: IUser;
    nextActive: boolean;
  } | null>(null);

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
    },
    onSuccess: () => {
      toast({ variant: "success", title: "Utilisateur supprimé" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const toggleUser = useMutation({
    mutationFn: async ({ id, nextActive }: { id: string; nextActive: boolean }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextActive ? "activate" : "deactivate" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Mise à jour impossible");
      }
      return body as IUser;
    },
    onSuccess: (_, { id, nextActive }) => {
      setUserToggleConfirm(null);
      qc.setQueryData<IUser[]>(["users"], (old) =>
        old?.map((u) => (String(u._id) === String(id) ? { ...u, isActive: nextActive } : u)) ?? old
      );
      toast({
        variant: "success",
        title: nextActive ? "Utilisateur réactivé" : "Utilisateur désactivé",
        description: nextActive
          ? "Le compte peut à nouveau se connecter à l'application."
          : "Le compte ne peut plus se connecter. Vous pouvez le réactiver à tout moment.",
      });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const totalUsers = users?.length ?? 0;
  const directionCount = users?.filter((u) => u.role === "directeur" || u.role === "directrice").length ?? 0;
  const managers = users?.filter((u) => u.role === "gerant").length ?? 0;
  const paginatedUsers = (users ?? []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.max(1, Math.ceil((users?.length ?? 0) / pageSize));

  const openCreate = () => { setEditUser(undefined); setDialogOpen(true); };
  const openEdit = (u: IUser) => { setEditUser(u); setDialogOpen(true); };

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  if (status === "loading") return <Skeleton className="h-96" />;
  if (!["directeur", "directrice"].includes(session?.user?.role ?? "")) {
    return <p className="text-center py-20 text-[#9CA3AF]">Accès réservé à la direction</p>;
  }

  return (
    <div>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérez les accès et les comptes"
        action={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nouvel utilisateur
          </Button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:gap-4 sm:mb-8 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatsCard title="Total utilisateurs" value={totalUsers} icon={Users} index={0} />
            <StatsCard title="Direction" value={directionCount} icon={Shield} variant="dark" index={1} />
            <StatsCard title="Gérants" value={managers} icon={UserCheck} index={2} />
          </>
        )}
      </div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="mb-3 flex justify-end">
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            Lignes par page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
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

        <PremiumTableShell
          title="Membres de l&apos;équipe"
          isLoading={isLoading}
          empty={!isLoading && (users?.length === 0)}
          emptyMessage="Aucun utilisateur"
          skeletonColSpan={7}
          mobileContent={
            <MobileCardList>
              {paginatedUsers.map((user) => {
                const roleLabel =
                  user.role === "directeur"
                    ? "Directeur"
                    : user.role === "directrice"
                      ? "Directrice"
                      : "Gérant";
                return (
                  <MobileDataCard key={user._id}>
                    <MobileDataCardHeader
                      title={`${user.firstName} ${user.lastName}`}
                      meta={user.email}
                      badge={
                        user.isActive ? (
                          <span className="inline-flex rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Désactivé
                          </span>
                        )
                      }
                    />
                    <MobileDataCardMeta
                      items={[
                        { label: "Rôle", value: roleLabel },
                        { label: "Téléphone", value: user.phone || "—" },
                        { label: "Inscription", value: formatDate(user.createdAt) },
                      ]}
                    />
                    <MobileDataCardActions>
                      {user._id !== session?.user?.id && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-xl text-xs"
                          disabled={toggleUser.isPending}
                          onClick={() =>
                            setUserToggleConfirm({
                              user,
                              nextActive: !user.isActive,
                            })
                          }
                        >
                          {user.isActive ? "Désactiver" : "Activer"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        onClick={() => openEdit(user)}
                        aria-label={`Modifier ${user.firstName} ${user.lastName}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isDirector && user._id !== session?.user?.id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl border-rose-200/60 text-rose-600"
                          onClick={() => setUserToDelete(user)}
                          aria-label={`Supprimer ${user.firstName} ${user.lastName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </MobileDataCardActions>
                  </MobileDataCard>
                );
              })}
            </MobileCardList>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-950/[0.025] text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <th className="whitespace-nowrap px-6 py-3.5 font-semibold">Utilisateur</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Email</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Rôle</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Téléphone</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Inscription</th>
                  <th className="whitespace-nowrap px-4 py-3.5 font-semibold">Statut</th>
                  <th className="whitespace-nowrap px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user._id}
                      className="group transition-colors duration-200 hover:bg-gradient-to-r hover:from-violet-500/[0.04] hover:via-transparent hover:to-cyan-500/[0.03]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-600/80 shadow-inner ring-1 ring-white/25">
                            <span className="text-xs font-bold tracking-tight text-white">
                              {getInitials(user.firstName, user.lastName)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {user.firstName} {user.lastName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-4 py-4">
                        <span className="block truncate font-medium text-slate-600">{user.email}</span>
                      </td>
                      <td className="px-4 py-4">
                        {user.role === "directeur" || user.role === "directrice" ? (
                          <span className="inline-flex items-center rounded-full border border-violet-200/60 bg-violet-500/12 px-2.5 py-0.5 text-xs font-semibold text-violet-800 backdrop-blur-[2px]">
                            {user.role === "directeur" ? "Directeur" : "Directrice"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-sky-200/60 bg-sky-500/12 px-2.5 py-0.5 text-xs font-semibold text-sky-900 backdrop-blur-[2px]">
                            Gérant
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {user.phone ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                            <Phone className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            {user.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/55 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-950/80">
                          <CalendarClock className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                          {formatDate(user.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {user.isActive ? (
                          <span className="inline-flex rounded-full border border-emerald-200/50 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-500/10 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Désactivé
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1 opacity-90 transition group-hover:opacity-100">
                          {user._id !== session?.user?.id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-xl border-slate-200/80 bg-white/80 text-xs shadow-sm backdrop-blur-sm"
                              disabled={toggleUser.isPending}
                              onClick={() =>
                                setUserToggleConfirm({
                                  user,
                                  nextActive: !user.isActive,
                                })
                              }
                            >
                              {user.isActive ? "Désactiver" : "Activer"}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 rounded-xl border-slate-200/80 bg-white/80 text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-violet-200 hover:bg-violet-500/8 hover:text-violet-900"
                            onClick={() => openEdit(user)}
                            aria-label={`Modifier ${user.firstName} ${user.lastName}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isDirector && user._id !== session?.user?.id && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl border-rose-200/60 bg-rose-500/[0.06] text-rose-600 shadow-sm backdrop-blur-sm transition hover:border-rose-300 hover:bg-rose-500/12 hover:text-rose-700"
                              onClick={() => setUserToDelete(user)}
                              aria-label={`Supprimer ${user.firstName} ${user.lastName}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </PremiumTableShell>
      </motion.div>

      <PaginationControls
        className="mt-6"
        currentPage={currentPage}
        pageSize={pageSize}
        totalItems={users?.length ?? 0}
        onPageChange={setCurrentPage}
      />

      <UserDialog open={dialogOpen} onClose={() => setDialogOpen(false)} user={editUser} />

      <Dialog
        open={!!userToggleConfirm}
        onOpenChange={(open) => {
          if (!open && !toggleUser.isPending) setUserToggleConfirm(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {userToggleConfirm?.nextActive ? "Réactiver l'utilisateur" : "Désactiver l'utilisateur"}
            </DialogTitle>
            <DialogDescription>
              {userToggleConfirm ? (
                userToggleConfirm.nextActive ? (
                  <>
                    Voulez-vous réactiver{" "}
                    <span className="font-medium text-[#0D0D0D]">
                      {userToggleConfirm.user.firstName} {userToggleConfirm.user.lastName}
                    </span>
                    ? Le compte pourra à nouveau se connecter.
                  </>
                ) : (
                  <>
                    Voulez-vous désactiver{" "}
                    <span className="font-medium text-[#0D0D0D]">
                      {userToggleConfirm.user.firstName} {userToggleConfirm.user.lastName}
                    </span>
                    ? Le compte ne pourra plus se connecter. Vous pourrez le réactiver à tout moment.
                  </>
                )
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={toggleUser.isPending}
              onClick={() => setUserToggleConfirm(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant={userToggleConfirm?.nextActive ? "default" : "destructive"}
              disabled={toggleUser.isPending || !userToggleConfirm}
              onClick={() => {
                if (!userToggleConfirm) return;
                toggleUser.mutate({
                  id: userToggleConfirm.user._id,
                  nextActive: userToggleConfirm.nextActive,
                });
              }}
            >
              {toggleUser.isPending
                ? "Enregistrement…"
                : userToggleConfirm?.nextActive
                  ? "Réactiver"
                  : "Désactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;utilisateur ?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-1">
                <p>
                  Vous allez supprimer définitivement le compte de{" "}
                  <span className="font-medium text-[#0D0D0D]">
                    {userToDelete?.firstName} {userToDelete?.lastName}
                  </span>
                  {userToDelete?.email && (
                    <>
                      {" "}
                      (<span className="break-all">{userToDelete.email}</span>)
                    </>
                  )}
                  .
                </p>
                <p className="text-[#B45309]">Cette action est irréversible.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUserToDelete(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteUser.isPending}
              onClick={() => {
                if (!userToDelete) return;
                deleteUser.mutate(userToDelete._id, {
                  onSuccess: () => setUserToDelete(null),
                });
              }}
            >
              {deleteUser.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
