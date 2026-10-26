import { redirect } from "next/navigation";
import { getCurrentUser, getEffectiveUser, userRole } from "@/lib/auth";
import DashboardShell from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const role = userRole(user);
  if (!role) redirect("/login");

  // 教师代理学生时，导航/工作空间/头像均按「被代理学生」身份渲染，
  // 与学生直接登录看到的界面完全一致（唯一增量是顶栏的「切回自己」提示条）。
  const effective = await getEffectiveUser();
  const isImpersonating =
    role === "TEACHER" && effective !== null && effective.id !== user.id;

  return (
    <DashboardShell
      user={{
        id: isImpersonating ? effective!.id : user.id,
        name: isImpersonating ? effective!.name : user.name,
        role: isImpersonating ? (userRole(effective!) ?? "STUDENT") : role,
        username: isImpersonating ? effective!.username : user.username,
      }}
      impersonatingStudent={
        isImpersonating ? { id: effective!.id, name: effective!.name } : null
      }
    >
      {children}
    </DashboardShell>
  );
}
