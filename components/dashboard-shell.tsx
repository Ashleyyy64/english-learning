"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookA,
  BookOpen,
  BookX,
  Brain,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  Languages,
  LogOut,
  Menu,
  NotebookPen,
  Search,
  Settings,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";

type ShellUser = {
  id: string;
  name: string;
  role: "TEACHER" | "STUDENT";
  username: string;
};

type NavItem = {
  label: string;
  icon: React.ElementType;
  href?: string;
  badge?: string;
};

const teacherNav: NavItem[] = [
  { label: "工作台", icon: LayoutDashboard, href: "/dashboard/teacher" },
  { label: "学生管理", icon: Users, href: "/dashboard/teacher/students" },
  { label: "错题本", icon: BookX, href: "/dashboard/teacher/wrong-words" },
  { label: "词汇学习", icon: BookA, href: "/dashboard/student/vocabulary" },
  { label: "语法学习", icon: NotebookPen },
  { label: "阅读学习", icon: BookOpen },
];

const studentNav: NavItem[] = [
  { label: "工作台", icon: LayoutDashboard, href: "/dashboard/student" },
  { label: "背单词", icon: BookA, href: "/dashboard/student/vocabulary" },
  { label: "抗遗忘", icon: Brain, href: "/dashboard/student/memory" },
  { label: "错题本", icon: BookX, href: "/dashboard/student/wrong-words" },
  { label: "语法学习", icon: NotebookPen },
  { label: "阅读学习", icon: BookOpen },
  { label: "学习记录", icon: BarChart3 },
];

export default function DashboardShell({
  user,
  children,
  impersonatingStudent,
}: {
  user: ShellUser;
  children: React.ReactNode;
  impersonatingStudent?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [placeholder, setPlaceholder] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const nav = user.role === "TEACHER" ? teacherNav : studentNav;
  const isTeacher = user.role === "TEACHER";

  // 当前导航激活项：占位点击优先，其次按「最长路径前缀」匹配（学生管理优先于工作台）
  const matchedHref = nav
    .filter((n) => n.href && pathname.startsWith(n.href))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  const active = placeholder ?? matchedHref?.label ?? nav[0].label;

  const initial = (user.name || user.username).trim().charAt(0).toUpperCase() || "L";

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // 忽略登出请求异常，继续本地跳转
    }
    router.push("/login");
    router.refresh();
  };

  // 切回教师本人视角
  const switchBack = async () => {
    setSwitching(true);
    try {
      await fetch("/api/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: null }),
      });
    } catch {
      // 忽略异常，继续跳转
    }
    router.push("/dashboard/teacher/students");
    router.refresh();
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand-lockup"><div className="brand-mark"><Languages size={20} /></div><span>lingua</span></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="关闭菜单"><X size={20} /></button>
        </div>
        <div className="workspace-switcher">
          <div className="workspace-avatar">{initial}</div>
          <div>
            <strong>{isTeacher ? "教师工作空间" : `${user.name} 的学习空间`}</strong>
            <span>{isTeacher ? "教师" : "学生"}</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav className="main-nav">
          <span className="nav-label">学习空间</span>
          {nav.map((item) => {
            const isActive = active === item.label;
            const inner = (
              <>
                <item.icon size={18} />
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </>
            );
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => { setPlaceholder(null); setMenuOpen(false); }}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={item.label}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => { setPlaceholder(item.label); setMenuOpen(false); }}
                title="功能即将上线"
              >
                {inner}
              </button>
            );
          })}
          <span className="nav-label nav-label-spaced">更多</span>
          <button className="nav-item"><Target size={18} /><span>学习目标</span></button>
          <button className="nav-item"><Settings size={18} /><span>设置</span></button>
        </nav>
        {isTeacher && (
          <Link href="/dashboard/teacher/students" className="switch-student-card" style={{ textDecoration: "none" }}>
            <div className="switch-icon"><UserRound size={17} /></div>
            <div><strong>学生管理</strong><span>邀请或查看学生</span></div>
            <ChevronRight size={16} />
          </Link>
        )}
        <div className="sidebar-footer">
          <button className="nav-item"><CircleHelp size={18} /><span>帮助中心</span></button>
          <button className="profile-row" onClick={logout}>
            <div className="avatar small">{initial}</div>
            <div><strong>{user.name}</strong><span>{isTeacher ? "教师" : "学生"}</span></div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {menuOpen && <button className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-label="关闭侧栏" />}

      <section className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="打开菜单"><Menu size={21} /></button>
          <div className="breadcrumb"><span>学习空间</span><ChevronRight size={14} /><strong>{active}</strong></div>
          <div className="topbar-actions">
            {impersonatingStudent && (
              <div className="impersonate-banner">
                <span>正在以 <b>{impersonatingStudent.name}</b> 身份学习</span>
                <button onClick={switchBack} disabled={switching}>
                  {switching ? "切换中…" : "切回自己"}
                </button>
              </div>
            )}
            <button className="icon-button"><Search size={18} /></button>
            <button className="icon-button notification"><Bell size={18} /><i /></button>
            <div className="top-avatar">{initial}</div>
          </div>
        </header>
        <div className="content-wrap">
          {placeholder ? (
            <div className="empty-state">
              <div className="empty-icon"><BookA size={22} /></div>
              <h2>{placeholder}</h2>
              <p>这个功能正在准备中，很快就会和你见面。</p>
              <button className="primary-button small" onClick={() => setPlaceholder(null)}>返回工作台 <LayoutDashboard size={16} /></button>
            </div>
          ) : (
            children
          )}
        </div>
      </section>
    </main>
  );
}
