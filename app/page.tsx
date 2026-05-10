import { redirect } from "next/navigation";
import { getCachedServerSession } from "@/lib/get-session";

export default async function HomePage() {
  const session = await getCachedServerSession();
  if (session) redirect("/dashboard");
  redirect("/login");
}
