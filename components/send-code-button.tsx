"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 发送验证码按钮：内置 60 秒冷却倒计时、加载态、错误提示。
 * 复用同一份 /api/auth/send-code 接口，通过 purpose 区分场景。
 */

type Purpose = "REGISTER" | "LOGIN" | "RESET_PASSWORD";

interface Props {
  target: string; // 邮箱或手机号
  purpose: Purpose;
  disabled?: boolean; // 目标未通过本地校验时禁用
  onSent?: (devCode?: string) => void; // 开发环境回传验证码
}

export default function SendCodeButton({ target, purpose, disabled, onSent }: Props) {
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };

  const send = async () => {
    if (countdown > 0 || sending) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, purpose }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "验证码发送失败");
        return;
      }
      startCountdown();
      onSent?.(data.devCode);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        type="button"
        className="code-send"
        onClick={send}
        disabled={disabled || countdown > 0 || sending}
      >
        {countdown > 0 ? `${countdown}s 后重发` : sending ? "发送中…" : "获取验证码"}
      </button>
      {error && <span className="field-hint" style={{ color: "#c9574b" }}>{error}</span>}
    </div>
  );
}
