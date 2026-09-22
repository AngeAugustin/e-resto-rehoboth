"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { LoginFireflies } from "@/components/auth/LoginFireflies";

/** Fond partagé des pages auth : image, filtre vert, lucioles. */
export function AuthAtmosphere({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <Image
        src="/images/login-bg.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgba(30, 74, 32, 0.82) 0%, rgba(20, 55, 28, 0.78) 45%, rgba(12, 40, 24, 0.88) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,28,16,0.45)_100%)]"
        aria-hidden
      />
      <LoginFireflies count={48} />
      <div className="relative z-10 w-full max-w-[400px]">{children}</div>
    </div>
  );
}
