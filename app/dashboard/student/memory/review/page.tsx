import { redirect } from "next/navigation";
import { getEffectiveUser } from "@/lib/auth";
import MemoryReview from "@/components/memory-review";

export default async function MemoryReviewPage() {
  const user = await getEffectiveUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect("/dashboard/teacher/students");

  return <MemoryReview />;
}
