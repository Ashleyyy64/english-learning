"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Languages,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import AuthVisual from "@/components/auth-visual";

export default function LoginPage() {
  const router = useRouter();
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败，请重试");
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
            <div className="eyebrow">欢迎回来</div>
            <h2>开启今天的学习</h2>
            <p>登录你的 Lingua 空间，继续保持成长。</p>
          </div>

          <form onSubmit={submit} className="login-form">
            <label>账号
              <div className="input-wrap"><UserRound size={17} /><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="请输入账号" required /></div>
            </label>
            <label>密码
              <div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="请输入密码" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "登录中…" : <>进入学习空间 <ArrowRight size={17} /></>}
            </button>
          </form>

          <p className="terms">还没有账号？<Link href="/register">立即注册</Link> · 登录即表示你同意 <a href="#">服务条款</a> 与 <a href="#">隐私政策</a></p>
        </div>
        <div className="panel-bottom"><BookOpen size={15} /> 需要帮助？ <a href="#">联系学习顾问</a></div>
      </section>
    </main>
  );
}
