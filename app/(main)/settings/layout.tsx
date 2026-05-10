import { redirect } from "next/navigation";
import { getCachedServerSession } from "@/lib/get-session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getCachedServerSession();
  if (session?.user?.role !== "directeur") {
    redirect("/dashboard");
  }
  return <>{children}</>;
}
