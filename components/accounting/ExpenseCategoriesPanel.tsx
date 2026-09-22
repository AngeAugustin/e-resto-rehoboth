"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { isDirectionRole } from "@/lib/roles";
import { isVersementCategoryName } from "@/lib/versement-category";
import type { IExpenseCategory } from "@/types";

export function ExpenseCategoriesPanel() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const isDirector = session?.user?.role === "directeur";
  const canManage = isDirectionRole(session?.user?.role);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<IExpenseCategory | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => (await fetch("/api/expense-categories")).json() as Promise<IExpenseCategory[]>,
  });

  const resetForm = () => {
    setName("");
    setEdit(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(edit ? `/api/expense-categories/${edit._id}` : "/api/expense-categories", {
      method: edit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
      return;
    }
    toast({ variant: "success", title: edit ? "Catégorie modifiée" : "Catégorie ajoutée" });
    qc.invalidateQueries({ queryKey: ["expense-categories"] });
    resetForm();
  };

  const startEdit = (category: IExpenseCategory) => {
    setEdit(category);
    setName(category.name);
  };

  return (
    <div className="max-w-lg space-y-3">
      {canManage && (
        <form className="flex gap-2" onSubmit={save}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={edit ? "Nom de la catégorie" : "Nouvelle catégorie"}
            required
          />
          <Button type="submit" disabled={saving}>{edit ? "Mettre à jour" : "Ajouter"}</Button>
          {edit ? (
            <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>Annuler</Button>
          ) : null}
        </form>
      )}
      <ul className="divide-y rounded-xl border">
        {(categories ?? []).map((c) => {
          const isSystem = isVersementCategoryName(c.name);
          return (
          <li key={c._id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
            <span className="min-w-0 truncate">
              {c.name}
              {isSystem ? <span className="ml-2 text-xs text-slate-400">(système)</span> : null}
            </span>
            {canManage && !isSystem && (
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Modifier</Button>
                {isDirector && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600"
                    onClick={async () => {
                      const res = await fetch(`/api/expense-categories/${c._id}`, { method: "DELETE" });
                      if (!res.ok) toast({ variant: "destructive", title: "Erreur", description: (await res.json()).error });
                      else {
                        if (edit?._id === c._id) resetForm();
                        qc.invalidateQueries({ queryKey: ["expense-categories"] });
                      }
                    }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </div>
  );
}
