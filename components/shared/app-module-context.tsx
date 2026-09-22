"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  type AppModuleId,
  moduleFromPathname,
  moduleHomeHref,
  visibleModules,
} from "@/lib/nav";

const STORAGE_KEY = "e-stock-app-module";

type AppModuleContextValue = {
  moduleId: AppModuleId;
  hydrated: boolean;
  setModuleId: (id: AppModuleId, options?: { navigate?: boolean }) => void;
};

const AppModuleContext = createContext<AppModuleContextValue | null>(null);

export function useAppModule(): AppModuleContextValue {
  const ctx = useContext(AppModuleContext);
  if (!ctx) {
    throw new Error("useAppModule must be used within AppModuleProvider");
  }
  return ctx;
}

function readStoredModule(): AppModuleId | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (
      value === "immobilisations" ||
      value === "bar" ||
      value === "cuisine" ||
      value === "paie" ||
      value === "administration"
    ) {
      return value;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AppModuleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const [moduleId, setModuleState] = useState<AppModuleId>(
    () => moduleFromPathname(pathname) ?? "bar"
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!role) return;
    const allowedModules = visibleModules(role);
    const fromPath = moduleFromPathname(pathname);
    if (fromPath && !allowedModules.some((m) => m.id === fromPath)) {
      router.replace(moduleHomeHref("bar", role));
      return;
    }
    if (fromPath) {
      setModuleState((prev) => {
        if (prev === fromPath) return prev;
        try {
          localStorage.setItem(STORAGE_KEY, fromPath);
        } catch {
          /* ignore */
        }
        return fromPath;
      });
    } else {
      const stored = readStoredModule();
      if (stored && allowedModules.some((m) => m.id === stored)) {
        setModuleState(stored);
      }
    }
    setHydrated(true);
  }, [pathname, role, router]);

  const setModuleId = useCallback(
    (id: AppModuleId, options?: { navigate?: boolean }) => {
      const allowed = visibleModules(role).some((m) => m.id === id);
      if (!allowed) return;

      setModuleState(id);
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
      if (options?.navigate === false) return;
      const current = moduleFromPathname(pathname);
      if (current === id) return;
      if (current == null) return;
      router.push(moduleHomeHref(id, role));
    },
    [pathname, role, router]
  );

  const value = useMemo(
    () => ({ moduleId, hydrated, setModuleId }),
    [moduleId, hydrated, setModuleId]
  );

  return <AppModuleContext.Provider value={value}>{children}</AppModuleContext.Provider>;
}
