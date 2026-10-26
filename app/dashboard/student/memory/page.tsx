import { redirect } from "next/navigation";
import { getEffectiveUser } from "@/lib/auth";
import MemoryHome from "@/components/memory-home";

export default async function MemoryPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  return <MemoryHome />;
}
