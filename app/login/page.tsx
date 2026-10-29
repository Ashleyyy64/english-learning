"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import AuthVisual from "@/components/auth-visual";
import SendCodeButton from "@/components/send-code-button";
import OAuthButtons from "@/components/oauth-buttons";
import { detectTarget } from "@/lib/validation";

type Mode = "password" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("password");
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 读取 OAuth 回调等场景带来的错误提示（?error=...）
  useEffect(() => {
    const msg = new URLSearchParams(window.location.search).get("error");
    if (msg) setError(decodeURIComponent(msg));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload =
        mode === "password"
          ? { account, password, rememberMe }
          : { account, code, rememberMe };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const codeTargetValid = detectTarget(account) !== null;

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

          <div className="login-tabs" role="tablist" aria-label="登录方式">
            <button
              className={mode === "password" ? "active" : ""}
              onClick={() => setMode("password")}
              role="tab"
              aria-selected={mode === "password"}
            >
              <LockKeyhole size={16} /> 密码登录
            </button>
            <button
              className={mode === "code" ? "active" : ""}
              onClick={() => setMode("code")}
              role="tab"
              aria-selected={mode === "code"}
            >
              <KeyRound size={16} /> 验证码登录
            </button>
          </div>

          <form onSubmit={submit} className="login-form">
            <label>{mode === "code" ? "邮箱 / 手机号" : "账号 / 邮箱 / 手机号"}
              <div className="input-wrap"><UserRound size={17} /><input value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="username" placeholder={mode === "code" ? "请输入已绑定的邮箱或手机号" : "请输入账号、邮箱或手机号"} required /></div>
            </label>

            {mode === "password" ? (
              <label>密码
                <div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="请输入密码" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
              </label>
            ) : (
              <label>验证码
                <div className="code-row">
                  <div className="input-wrap"><KeyRound size={17} /><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 位验证码" required /></div>
                  <SendCodeButton target={account} purpose="LOGIN" disabled={!codeTargetValid} />
                </div>
              </label>
            )}

            {mode === "password" && (
              <div className="checkbox-row">
                <label className="checkbox">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  记住我
                </label>
                <Link href="/forgot-password" className="forgot-link">忘记密码？</Link>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "登录中…" : <>进入学习空间 <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="login-divider"><span>或使用以下方式登录</span></div>
          <OAuthButtons />

          <p className="terms">还没有账号？<Link href="/register">立即注册</Link> · 登录即表示你同意 <a href="#">服务条款</a> 与 <a href="#">隐私政策</a></p>
        </div>
        <div className="panel-bottom"><BookOpen size={15} /> 需要帮助？ <a href="#">联系学习顾问</a></div>
      </section>
    </main>
  );
}
