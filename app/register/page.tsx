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
  KeyRound,
  Languages,
  LockKeyhole,
  Mail,
  Smartphone,
  UserRound,
} from "lucide-react";
import AuthVisual from "@/components/auth-visual";
import SendCodeButton from "@/components/send-code-button";
import PasswordStrengthMeter from "@/components/password-strength";
import OAuthButtons from "@/components/oauth-buttons";
import { detectTarget } from "@/lib/validation";

type Role = "TEACHER" | "STUDENT";
type Contact = "email" | "phone";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("STUDENT");
  const [contact, setContact] = useState<Contact>("email");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const contactValue = contact === "email" ? email : phone;
  const contactValid = detectTarget(contactValue) === contact;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          name,
          role,
          email: contact === "email" ? email : "",
          phone: contact === "phone" ? phone : "",
          code,
        }),
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
              <div className="input-wrap"><UserRound size={17} /><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="字母、数字或下划线，至少 3 位" required /></div>
            </label>
            <label>密码
              <div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="至少 8 位，含字母和数字" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>
            <PasswordStrengthMeter password={password} />

            <div className="role-tabs" role="tablist" aria-label="验证方式">
              <button className={contact === "email" ? "active" : ""} onClick={() => setContact("email")} role="tab" aria-selected={contact === "email"}>
                <Mail size={16} /> 邮箱注册
              </button>
              <button className={contact === "phone" ? "active" : ""} onClick={() => setContact("phone")} role="tab" aria-selected={contact === "phone"}>
                <Smartphone size={16} /> 手机号注册
              </button>
            </div>

            {contact === "email" ? (
              <label>邮箱
                <div className="input-wrap"><Mail size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="用于登录与找回密码" required /></div>
              </label>
            ) : (
              <label>手机号
                <div className="input-wrap"><Smartphone size={17} /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 13))} autoComplete="tel" placeholder="用于登录与找回密码" required /></div>
              </label>
            )}

            <label>验证码
              <div className="code-row">
                <div className="input-wrap"><KeyRound size={17} /><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 位验证码" required /></div>
                <SendCodeButton target={contactValue} purpose="REGISTER" disabled={!contactValid} />
              </div>
            </label>

            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? "注册中…" : <>创建账号 <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="login-divider"><span>或使用以下方式注册</span></div>
          <OAuthButtons />

          <p className="terms">已有账号？<Link href="/login">直接登录</Link> · 注册即表示你同意 <a href="#">服务条款</a> 与 <a href="#">隐私政策</a></p>
        </div>
        <div className="panel-bottom"><BookOpen size={15} /> 需要帮助？ <a href="#">联系学习顾问</a></div>
      </section>
    </main>
  );
}
