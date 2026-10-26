"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  Languages,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import AuthVisual from "@/components/auth-visual";

type Role = "TEACHER" | "STUDENT";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败，请重试");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <AuthVisual />
      <section className="login-panel">
        <div className="login-content">
          <div className="mobile-brand brand-lockup">
            <div className="brand-mark"><Languages size={20} /></div>
            <span>lingua</span>
          </div>
          <div className="login-heading">
            <div className="eyebrow">创建账号</div>
            <h2>加入 Lingua 空间</h2>
            <p>注册后即可开始学习，或与老师建立连接。</p>
          </div>

          <div className="role-tabs" role="tablist" aria-label="选择身份">
            <button className={role === "STUDENT" ? "active" : ""} onClick={() => setRole("STUDENT")} role="tab" aria-selected={role === "STUDENT"}>
              <UserRound size={17} /> 我是学生
            </button>
            <button className={role === "TEACHER" ? "active" : ""} onClick={() => setRole("TEACHER")} role="tab" aria-selected={role === "TEACHER"}>
              <GraduationCap size={18} /> 我是教师
            </button>
          </div>

          <form onSubmit={submit} className="login-form">
            <label>姓名 / 昵称
              <div className="input-wrap"><UserRound size={17} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：林老师" required /></div>
            </label>
            <label>账号
              <div className="input-wrap"><UserRound size={17} /><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="用于登录的账号" required /></div>
            </label>
            <label>密码
              <div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="至少 6 位" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "注册中…" : <>创建账号 <ArrowRight size={17} /></>}
            </button>
          </form>

          <p className="terms">已有账号？<Link href="/login">直接登录</Link> · 注册即表示你同意 <a href="#">服务条款</a> 与 <a href="#">隐私政策</a></p>
        </div>
        <div className="panel-bottom"><BookOpen size={15} /> 需要帮助？ <a href="#">联系学习顾问</a></div>
      </section>
    </main>
  );
}
