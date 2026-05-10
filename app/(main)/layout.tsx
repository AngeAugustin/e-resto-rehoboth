import { redirect } from "next/navigation";
import { getCachedServerSession } from "@/lib/get-session";
import { AppShell } from "@/components/shared/app-shell";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getCachedServerSession();
  if (!session) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
