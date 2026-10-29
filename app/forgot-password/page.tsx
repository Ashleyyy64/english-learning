"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import AuthVisual from "@/components/auth-visual";
import SendCodeButton from "@/components/send-code-button";
import PasswordStrengthMeter from "@/components/password-strength";
import { detectTarget } from "@/lib/validation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [target, setTarget] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const targetValid = detectTarget(target) !== null;
  const isEmail = detectTarget(target) === "email";

  const goStep2 = () => {
    if (!targetValid) {
      setError("请输入正确的邮箱或手机号");
      return;
    }
    setError("");
    setStep(2);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "重置失败，请重试");
        return;
      }
      setSuccess("密码已重置，正在跳转登录…");
      setTimeout(() => router.push("/login"), 1200);
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
            <div className="eyebrow">找回密码</div>
            <h2>重设你的密码</h2>
            <p>{step === 1 ? "输入注册时使用的邮箱或手机号，我们将发送验证码。" : `验证码已发送至 ${target}，请输入验证码并设置新密码。`}</p>
          </div>

          <form onSubmit={submit} className="login-form">
            {step === 1 ? (
              <>
                <label>{isEmail ? "邮箱" : "邮箱 / 手机号"}
                  <div className="input-wrap">{isEmail ? <Mail size={17} /> : <Smartphone size={17} />}<input value={target} onChange={(e) => setTarget(e.target.value)} autoComplete="email" placeholder="请输入注册时的邮箱或手机号" required /></div>
                </label>
                {error && <div className="form-error">{error}</div>}
                <button className="primary-button" type="button" onClick={goStep2} disabled={!targetValid}>
                  下一步 <ArrowRight size={17} />
                </button>
              </>
            ) : (
              <>
                <button type="button" className="step-back" onClick={() => setStep(1)}>
                  <ArrowLeft size={14} /> 返回上一步
                </button>
                <label>验证码
                  <div className="code-row">
                    <div className="input-wrap"><KeyRound size={17} /><input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6 位验证码" required /></div>
                    <SendCodeButton target={target} purpose="RESET_PASSWORD" />
                  </div>
                </label>
                <label>新密码
                  <div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="至少 8 位，含字母和数字" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "隐藏密码" : "显示密码"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
                </label>
                <PasswordStrengthMeter password={password} />
                <label>确认新密码
                  <div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入新密码" required /></div>
                </label>
                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success"><ShieldCheck size={14} style={{ verticalAlign: "-2px" }} /> {success}</div>}
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "重置中…" : <>确认重置 <ArrowRight size={17} /></>}
                </button>
              </>
            )}
          </form>

          <p className="terms">想起密码了？<Link href="/login">返回登录</Link></p>
        </div>
        <div className="panel-bottom"><BookOpen size={15} /> 需要帮助？ <a href="#">联系学习顾问</a></div>
      </section>
    </main>
  );
}
