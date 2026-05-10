import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Une seule résolution de session par requête RSC (évite les appels répétés
 * quand plusieurs layouts imbriqués appellent getServerSession).
 */
export const getCachedServerSession = cache(() => getServerSession(authOptions));
