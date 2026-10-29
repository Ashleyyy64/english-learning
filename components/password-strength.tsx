"use client";

import { passwordStrength } from "@/lib/validation";

/**
 * 密码强度指示条：4 段式 + 文案。
 * 与后端 lib/validation.ts 共用同一套强度算法，前后端口径一致。
 */
export default function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const strength = passwordStrength(password);
  const filled = strength.score; // 0~4

  return (
    <div className="password-meter">
      <div className="seg-track">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`seg ${i < filled ? `filled-${filled}` : ""}`}
          />
        ))}
      </div>
      <span className="meter-label" style={!strength.valid ? { color: "#c9574b" } : undefined}>
        {strength.label}
      </span>
    </div>
  );
}
