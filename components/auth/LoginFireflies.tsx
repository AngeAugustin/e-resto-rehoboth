"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Firefly = {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
};

function round(n: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function buildFireflies(count: number): Firefly[] {
  return Array.from({ length: count }, (_, id) => {
    const seed = (id + 1) * 9973;
    const rand = (n: number) => {
      const x = Math.sin(seed * (n + 1.7)) * 10000;
      return x - Math.floor(x);
    };
    return {
      id,
      left: `${round(rand(1) * 100)}%`,
      top: `${round(rand(2) * 100)}%`,
      size: round(4 + rand(3) * 6),
      delay: round(rand(4) * 6),
      duration: round(4 + rand(5) * 7),
      driftX: round((rand(6) - 0.5) * 90),
      driftY: round((rand(7) - 0.5) * 70),
    };
  });
}

/** Lucioles ambiantes — montées uniquement côté client pour éviter les mismatches SSR. */
export function LoginFireflies({ count = 48 }: { count?: number }) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const fireflies = useMemo(() => buildFireflies(count), [count]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (reduceMotion) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {fireflies.slice(0, 14).map((f) => (
          <span
            key={f.id}
            className="absolute rounded-full bg-[#D4F5A5]/70"
            style={{
              left: f.left,
              top: f.top,
              width: `${f.size}px`,
              height: `${f.size}px`,
              boxShadow: `0 0 ${round(f.size * 3)}px ${round(f.size)}px rgba(180, 255, 120, 0.35)`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {fireflies.map((f) => (
        <motion.span
          key={f.id}
          className="absolute rounded-full"
          style={{
            left: f.left,
            top: f.top,
            width: `${f.size}px`,
            height: `${f.size}px`,
            background:
              "radial-gradient(circle, rgba(230,255,180,0.95) 0%, rgba(140,220,80,0.55) 45%, transparent 70%)",
            boxShadow: `0 0 ${round(f.size * 4)}px ${round(f.size * 1.5)}px rgba(170, 255, 100, 0.45)`,
          }}
          animate={{
            opacity: [0.15, 0.95, 0.35, 1, 0.2],
            x: [0, f.driftX * 0.4, f.driftX, f.driftX * 0.2, 0],
            y: [0, f.driftY, f.driftY * -0.5, f.driftY * 0.3, 0],
            scale: [0.7, 1.15, 0.9, 1.2, 0.75],
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
