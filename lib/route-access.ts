const GERANT_FORBIDDEN_PREFIXES = [
  "/cooks",
  "/kitchen-waitresses",
  "/accounting",
  "/payroll",
  "/expenses",
  "/immobilisations",
  "/users",
  "/settings",
  "/guide",
] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPathAllowedForRole(pathname: string, role: string): boolean {
  if (role !== "gerant") return true;
  return !GERANT_FORBIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function defaultHomeHrefForRole(role: string): string {
  if (role === "gerant") return "/dashboard";
  return "/dashboard";
}
