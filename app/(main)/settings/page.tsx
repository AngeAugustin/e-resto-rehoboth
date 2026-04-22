"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings2, Palette, BellRing, Save, Plus, Check, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  applyPrimaryColorToDocument,
  DEFAULT_LOGO_URL,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SOLUTION_NAME,
  normalizeHexColor,
  PRIMARY_COLOR_PALETTE,
} from "@/lib/app-settings";
import { cn } from "@/lib/utils";

type SettingsResponse = {
  primaryColor: string;
  logoUrl: string;
  solutionName: string;
  lowStockAlertEmails: string[];
};

type SettingsTab = "customization" | "alerts";
type AlertEmailField = {
  id: string;
  value: string;
  isValidated: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createAlertEmailField(value = "", isValidated = false): AlertEmailField {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    value,
    isValidated,
  };
}

async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch("/api/settings");
  if (!res.ok) throw new Error("Impossible de charger les paramètres");
  return res.json();
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>("customization");
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [hexDraft, setHexDraft] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [appliedColor, setAppliedColor] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [savedColor, setSavedColor] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(DEFAULT_LOGO_URL);
  const [solutionName, setSolutionName] = useState(DEFAULT_SOLUTION_NAME);
  const [solutionNameDraft, setSolutionNameDraft] = useState(DEFAULT_SOLUTION_NAME);
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [alertEmailFields, setAlertEmailFields] = useState<AlertEmailField[]>([createAlertEmailField()]);

  const { data, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchSettings,
  });

  useEffect(() => {
    if (!data) return;
    if (settingsInitialized) return;

    setSelectedColor(data.primaryColor);
    setHexDraft(data.primaryColor);
    setAppliedColor(data.primaryColor);
    setSavedColor(data.primaryColor);
    setCurrentLogoUrl(data.logoUrl || DEFAULT_LOGO_URL);
    setSolutionName(data.solutionName);
    setSolutionNameDraft(data.solutionName);
    setAlertEmailFields(
      data.lowStockAlertEmails.length > 0
        ? data.lowStockAlertEmails.map((email) => createAlertEmailField(email, true))
        : [createAlertEmailField()]
    );
    applyPrimaryColorToDocument(data.primaryColor);
    setSettingsInitialized(true);
  }, [data, settingsInitialized]);

  const saveColorMutation = useMutation({
    mutationFn: async (primaryColor: string) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Impossible de sauvegarder la couleur");
      }
      return (await res.json()) as SettingsResponse;
    },
    onSuccess: (payload) => {
      qc.setQueryData(["app-settings"], payload);
      applyPrimaryColorToDocument(payload.primaryColor);
      setSelectedColor(payload.primaryColor);
      setAppliedColor(payload.primaryColor);
      setSavedColor(payload.primaryColor);
      toast({ variant: "success", title: "Couleur principale mise à jour" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const saveAlertsMutation = useMutation({
    mutationFn: async (emails: string[]) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockAlertEmails: emails }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Impossible de sauvegarder les alertes");
      }
      return (await res.json()) as SettingsResponse;
    },
    onSuccess: (payload) => {
      qc.setQueryData(["app-settings"], payload);
      setAlertEmailFields(
        payload.lowStockAlertEmails.length > 0
          ? payload.lowStockAlertEmails.map((email) => createAlertEmailField(email, true))
          : [createAlertEmailField()]
      );
      toast({ variant: "success", title: "Destinataires des alertes mis à jour" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Impossible d'uploader le logo");
      }
      return (await res.json()) as { logoUrl: string };
    },
    onSuccess: ({ logoUrl }) => {
      setCurrentLogoUrl(logoUrl);
      qc.setQueryData<SettingsResponse | undefined>(["app-settings"], (previous) =>
        previous ? { ...previous, logoUrl } : previous
      );
      toast({ variant: "success", title: "Logo mis à jour" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const saveSolutionNameMutation = useMutation({
    mutationFn: async (nextName: string) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solutionName: nextName }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Impossible de sauvegarder le nom");
      }
      return (await res.json()) as SettingsResponse;
    },
    onSuccess: (payload) => {
      qc.setQueryData(["app-settings"], payload);
      setSolutionName(payload.solutionName);
      setSolutionNameDraft(payload.solutionName);
      toast({ variant: "success", title: "Nom de la solution mis à jour" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    },
  });

  const validatedEmails = useMemo(() => {
    const normalized = alertEmailFields
      .filter((entry) => entry.isValidated && entry.value.trim())
      .map((entry) => entry.value.trim().toLowerCase());
    return Array.from(new Set(normalized));
  }, [alertEmailFields]);
  const hasUnvalidatedFilledEmail = useMemo(
    () => alertEmailFields.some((entry) => entry.value.trim() && !entry.isValidated),
    [alertEmailFields]
  );
  const canManageAlerts = session?.user?.role === "directeur";
  const canApplyColor = selectedColor !== appliedColor;
  const hasUnsavedColor = selectedColor !== savedColor;
  const canSaveSolutionName =
    canManageAlerts && solutionNameDraft.trim().length > 0 && solutionNameDraft.trim() !== solutionName;

  const addAlertEmailField = () => {
    setAlertEmailFields((prev) => [...prev, createAlertEmailField()]);
  };

  const updateAlertEmailField = (id: string, value: string) => {
    setAlertEmailFields((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, value, isValidated: false } : entry))
    );
  };

  const validateAlertEmailField = (id: string) => {
    const target = alertEmailFields.find((entry) => entry.id === id);
    if (!target) return;

    const cleaned = target.value.trim().toLowerCase();
    if (!cleaned) {
      toast({ variant: "destructive", title: "Erreur", description: "Saisissez une adresse email." });
      return;
    }
    if (!EMAIL_REGEX.test(cleaned)) {
      toast({ variant: "destructive", title: "Erreur", description: "Adresse email invalide." });
      return;
    }

    const duplicated = alertEmailFields.some(
      (entry) => entry.id !== id && entry.isValidated && entry.value.trim().toLowerCase() === cleaned
    );
    if (duplicated) {
      toast({ variant: "destructive", title: "Erreur", description: "Cette adresse est déjà ajoutée." });
      return;
    }

    setAlertEmailFields((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, value: cleaned, isValidated: true } : entry))
    );
  };

  const deleteAlertEmailField = (id: string) => {
    setAlertEmailFields((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      return next.length > 0 ? next : [createAlertEmailField()];
    });
  };

  const applyHexDraftToSelection = () => {
    const normalized = normalizeHexColor(hexDraft);
    if (!normalized) {
      toast({
        variant: "destructive",
        title: "Couleur invalide",
        description: "Utilisez un code hexadécimal valide, par exemple #4472C4.",
      });
      setHexDraft(selectedColor);
      return;
    }
    setSelectedColor(normalized);
    setHexDraft(normalized);
  };

  return (
    <div>
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez l'application et configurez les alertes de stock"
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={activeTab === "customization" ? "default" : "outline"}
              onClick={() => setActiveTab("customization")}
            >
              <Palette className="w-4 h-4" />
              Personnalisation
            </Button>
            <Button
              type="button"
              variant={activeTab === "alerts" ? "default" : "outline"}
              onClick={() => setActiveTab("alerts")}
            >
              <BellRing className="w-4 h-4" />
              Alertes
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeTab === "customization" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Logo de l&apos;application
              </CardTitle>
              <CardDescription>
                Visualisez votre logo actuel et uploadez-en un nouveau.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-[#E5E5E5] bg-[#FCFCFC] p-4 space-y-2">
                <p className="text-sm font-semibold text-[#0D0D0D]">Nom de la solution</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={solutionNameDraft}
                    onChange={(e) => setSolutionNameDraft(e.target.value)}
                    placeholder="Nom de la solution"
                    disabled={!canManageAlerts || saveSolutionNameMutation.isPending}
                    maxLength={80}
                  />
                  <Button
                    type="button"
                    onClick={() => saveSolutionNameMutation.mutate(solutionNameDraft)}
                    disabled={!canSaveSolutionName || saveSolutionNameMutation.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {saveSolutionNameMutation.isPending ? "Enregistrement..." : "Enregistrer le nom"}
                  </Button>
                </div>
                <p className="text-xs text-[#9CA3AF]">
                  Ce nom sera affiché sur les écrans de connexion et dans le menu latéral.
                </p>
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-[#FCFCFC] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#0D0D0D]">Logo actuel</p>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Uploadez un nouveau logo (PNG, JPG, WEBP - max 3MB).
                    </p>
                  </div>
                  <label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={!canManageAlerts || uploadLogoMutation.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        uploadLogoMutation.mutate(file);
                        e.currentTarget.value = "";
                      }}
                    />
                    <span
                      className={cn(
                        "inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-[#E5E5E5] bg-white px-4 text-sm font-medium text-[#0D0D0D] transition-colors hover:bg-[#F5F5F5]",
                        (!canManageAlerts || uploadLogoMutation.isPending) &&
                          "cursor-not-allowed opacity-50 hover:bg-white"
                      )}
                    >
                      {uploadLogoMutation.isPending ? "Upload en cours..." : "Uploader un logo"}
                    </span>
                  </label>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="rounded-full border border-[#E5E5E5] bg-white p-2">
                    <Image
                      src={currentLogoUrl}
                      alt="Logo actuel"
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Couleur principale
              </CardTitle>
              <CardDescription>
                Choisissez la couleur principale utilisée pour les actions principales de l'application.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {PRIMARY_COLOR_PALETTE.map((color) => {
                  const isSelected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "h-10 w-10 shrink-0 rounded-full border-2 transition-all",
                        isSelected
                          ? "border-[#0D0D0D] ring-2 ring-[#0D0D0D]/15"
                          : "border-white/70 hover:border-[#D1D5DB]"
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Choisir ${color}`}
                      onClick={() => {
                        setSelectedColor(color);
                        setHexDraft(color);
                      }}
                    />
                  );
                })}
              </div>

              <div className="rounded-xl border border-[#E5E5E5] bg-[#FCFCFC] p-3">
                <p className="text-xs font-medium text-[#6B7280] mb-3">Couleur personnalisée</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <label className="relative block h-10 w-10 overflow-hidden rounded-full border border-[#E5E5E5] bg-white">
                      <input
                        type="color"
                        value={normalizeHexColor(hexDraft) ?? selectedColor}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        onChange={(e) => {
                          const value = normalizeHexColor(e.target.value) ?? selectedColor;
                          setSelectedColor(value);
                          setHexDraft(value);
                        }}
                        aria-label="Choisir une couleur personnalisée"
                      />
                      <span
                        className="block h-full w-full rounded-full"
                        style={{ backgroundColor: normalizeHexColor(hexDraft) ?? selectedColor }}
                      />
                    </label>
                    <span className="text-xs text-[#6B7280]">Choisir librement</span>
                  </div>

                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={hexDraft}
                      onChange={(e) => setHexDraft(e.target.value)}
                      onBlur={applyHexDraftToSelection}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyHexDraftToSelection();
                        }
                      }}
                      placeholder="#4472C4"
                      className="max-w-[180px] bg-white"
                    />
                    <Button type="button" variant="outline" onClick={applyHexDraftToSelection}>
                      Valider
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="text-sm text-[#6B7280]">
                  Couleur sélectionnée: <span className="font-medium text-[#0D0D0D]">{selectedColor}</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    applyPrimaryColorToDocument(selectedColor);
                    setAppliedColor(selectedColor);
                  }}
                  disabled={isLoading || !canApplyColor}
                >
                  Appliquer
                </Button>
                <Button
                  type="button"
                  onClick={() => saveColorMutation.mutate(selectedColor)}
                  disabled={isLoading || saveColorMutation.isPending || !hasUnsavedColor}
                >
                  <Save className="w-4 h-4" />
                  {saveColorMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Couleur appliquée actuellement: {appliedColor}. Cliquez sur Enregistrer pour la rendre
                définitive.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Destinataires email des alertes de stock bas</CardTitle>
              <CardDescription>
                Entrez les adresses email qui recevront les notifications quand un produit passe en stock bas.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={addAlertEmailField} disabled={!canManageAlerts}>
              <Plus className="w-4 h-4" />
              Ajouter un email
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {alertEmailFields.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={entry.value}
                    placeholder="exemple@domaine.com"
                    disabled={!canManageAlerts}
                    onChange={(e) => updateAlertEmailField(entry.id, e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Valider"
                    aria-label={`Valider l'email ${index + 1}`}
                    disabled={!canManageAlerts}
                    onClick={() => validateAlertEmailField(entry.id)}
                  >
                    <Check className={cn("w-4 h-4", entry.isValidated && "text-green-600")} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Supprimer"
                    aria-label={`Supprimer l'email ${index + 1}`}
                    disabled={!canManageAlerts}
                    onClick={() => deleteAlertEmailField(entry.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-[#9CA3AF]">
                {validatedEmails.length} adresse{validatedEmails.length > 1 ? "s" : ""} validée
                {validatedEmails.length > 1 ? "s" : ""}.
              </p>
            </div>

            {!canManageAlerts && (
              <p className="text-sm text-[#B45309]">
                Seul un utilisateur Directeur peut modifier la liste des destinataires.
              </p>
            )}

            <Button
              type="button"
              onClick={() => saveAlertsMutation.mutate(validatedEmails)}
              disabled={!canManageAlerts || saveAlertsMutation.isPending || hasUnvalidatedFilledEmail}
            >
              <Save className="w-4 h-4" />
              {saveAlertsMutation.isPending ? "Enregistrement..." : "Enregistrer les alertes"}
            </Button>
            {hasUnvalidatedFilledEmail && (
              <p className="text-xs text-[#B45309]">
                Validez chaque email avec l&apos;icône de validation avant d&apos;enregistrer.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
