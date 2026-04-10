"use client";

import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductThumb({
  imageUrl,
  name,
  sizeClass,
  variant = "light",
}: {
  imageUrl?: string;
  name: string;
  sizeClass: string;
  variant?: "light" | "dark";
}) {
  const [broken, setBroken] = useState(false);
  const showImg = Boolean(imageUrl) && !broken;

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden rounded-lg flex items-center justify-center",
        sizeClass,
        variant === "dark" ? "bg-white/10 ring-1 ring-white/15" : "bg-[#F5F5F5]"
      )}
    >
      {showImg ? (
        <img
          src={imageUrl!}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <ImageIcon
          className={cn(
            "w-[40%] h-[40%] min-w-[1.1rem] min-h-[1.1rem] max-w-7 max-h-7",
            variant === "dark" ? "text-white/35" : "text-[#D1D5DB]"
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
