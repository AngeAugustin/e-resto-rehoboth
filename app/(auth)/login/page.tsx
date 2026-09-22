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
import { AuthAtmosphere } from "@/components/auth/AuthAtmosphere";

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
    <AuthAtmosphere>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
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
          <h1 className="px-1 text-xl font-bold leading-snug text-white sm:text-2xl">{solutionName}</h1>
          <p className="mt-1 text-sm text-white/75">Connectez-vous à votre espace</p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/95 p-5 shadow-xl backdrop-blur-md sm:p-6">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] transition-colors hover:text-[#6B7280]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>

            <div className="flex justify-center pt-1">
              <Link
                href="/mot-de-passe-oublie"
                className="text-sm text-[#6B7280] transition-colors hover:text-primary"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-white/65">
          Contactez votre administrateur pour obtenir vos accès.
        </p>
      </motion.div>
    </AuthAtmosphere>
  );
}
