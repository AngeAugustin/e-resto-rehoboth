"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { DEFAULT_LOGO_URL, DEFAULT_SOLUTION_NAME } from "@/lib/app-settings";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      router.refresh();
    }
  }, [status, router]);

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/public-settings");
      if (!res.ok) return { logoUrl: DEFAULT_LOGO_URL, solutionName: DEFAULT_SOLUTION_NAME };
      return (await res.json()) as { logoUrl?: string; solutionName?: string };
    },
    staleTime: 60 * 1000,
  });
  const logoSrc = publicSettings?.logoUrl || DEFAULT_LOGO_URL;
  const solutionName = publicSettings?.solutionName || DEFAULT_SOLUTION_NAME;

  if (status === "loading" || status === "authenticated") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Email ou mot de passe incorrect.",
      });
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
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
              className="h-28 w-28 rounded-full object-contain"
            />
          </motion.div>
          <h1 className="text-2xl font-bold text-primary">{solutionName}</h1>
          <p className="text-sm text-[#6B7280] mt-1">Connectez-vous à votre espace</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>

            <div className="flex justify-center pt-1">
              <Link
                href="/mot-de-passe-oublie"
                className="text-sm text-[#6B7280] hover:text-primary transition-colors"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          Contactez votre administrateur pour obtenir vos accès.
        </p>
      </motion.div>
    </div>
  );
}
