import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server/auth-cookie";

export default async function AdminRootPage() {
  const session = await getServerSession();

  if (!session || session.user.role !== "ADMIN" || session.user.isDisabled) {
    redirect("/login");
  }

  redirect("/dashboard");
}
