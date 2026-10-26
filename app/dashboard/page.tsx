import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/student");
}
