"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AuthAtmosphere } from "@/components/auth/AuthAtmosphere";
import { DEFAULT_LOGO_URL } from "@/lib/app-settings";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public-settings");
      if (!res.ok) return { logoUrl: DEFAULT_LOGO_URL };
      return (await res.json()) as { logoUrl?: string };
    },
    staleTime: 60 * 1000,
  });
  const logoSrc = publicSettings?.logoUrl || DEFAULT_LOGO_URL;

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: typeof data.error === "string" ? data.error : "Une erreur est survenue.",
        });
        return;
      }
      toast({
        title: "Email envoyé",
        description: typeof data.message === "string" ? data.message : "Consultez votre boîte mail.",
      });
      setStep("otp");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = otp.replace(/\D/g, "");
    if (digits.length !== 6) {
      toast({
        variant: "destructive",
        title: "Code incomplet",
        description: "Saisissez les 6 chiffres reçus par email.",
      });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: digits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Vérification impossible",
          description: typeof data.error === "string" ? data.error : "Code incorrect ou expiré.",
        });
        return;
      }
      if (typeof data.resetToken !== "string" || !data.resetToken) {
        toast({ variant: "destructive", title: "Erreur", description: "Réponse serveur inattendue." });
        return;
      }
      setResetToken(data.resetToken);
      setStep("password");
      toast({ title: "Code accepté", description: "Choisissez votre nouveau mot de passe." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Mot de passe trop court",
        description: "Au moins 6 caractères sont requis.",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Confirmation",
        description: "Les deux mots de passe doivent être identiques.",
      });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, password, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Réinitialisation impossible",
          description: typeof data.error === "string" ? data.error : "Une erreur est survenue.",
        });
        return;
      }
      toast({
        title: "Mot de passe mis à jour",
        description: typeof data.message === "string" ? data.message : "Vous pouvez vous connecter.",
      });
      window.location.assign("/login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthAtmosphere>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
            className="mb-4"
          >
            <Image
              src={logoSrc}
              alt="Logo Rehoboth - Fleur de Dieu"
              width={140}
              height={140}
              priority
              className="h-28 w-28 rounded-full object-contain shadow-lg ring-2 ring-white/25"
            />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Mot de passe oublié</h1>
          <p className="mt-1 text-center text-sm text-white/75">
            {step === "email" && "Indiquez votre email pour recevoir un code à 6 chiffres."}
            {step === "otp" && "Saisissez le code reçu par email (valide 15 minutes)."}
            {step === "password" && "Définissez votre nouveau mot de passe."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/95 p-6 shadow-xl backdrop-blur-md">
          {step === "email" && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Adresse email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="directeur@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Recevoir le code"
                )}
              </Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp">Code à 6 chiffres</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center font-mono text-lg tracking-[0.35em]"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  "Vérifier le code"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-[#6B7280]"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                }}
              >
                Changer d’adresse email
              </Button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer le mot de passe"
                )}
              </Button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
        </div>
      </motion.div>
    </AuthAtmosphere>
  );
}
