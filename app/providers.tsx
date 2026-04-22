"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { applyPrimaryColorToDocument } from "@/lib/app-settings";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = (await res.json()) as { primaryColor?: string };
        if (!isMounted || !data.primaryColor) return;
        applyPrimaryColorToDocument(data.primaryColor);
      } catch {
        // Paramètres indisponibles (ex: écran login) : on conserve les couleurs par défaut.
      }
    };

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
