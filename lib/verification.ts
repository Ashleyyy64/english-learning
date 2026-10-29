import { prisma } from "./prisma";
import { generateNumericCode, hashCode } from "./crypto";
import { sendVerificationEmail } from "./mailer";
import { sendVerificationSms, type SmsPurpose } from "./sms";
import { rateLimit } from "./rate-limit";
import { detectTarget, normalizeEmail, normalizePhone } from "./validation";

/**
 * 验证码服务：生成 → 存储（仅哈希）→ 发送 → 校验 → 失效。
 *
 * 安全要点：
 * - 数据库只存 sha256(code + pepper) 哈希，不存明文。
 * - 每个验证码限时 10 分钟、最多 5 次错误尝试。
 * - 发送限流：同一目标 60s 冷却、每小时 5 条、每天 10 条；按 IP 每小时 10 条。
 */

export type VerificationPurpose = "REGISTER" | "LOGIN" | "RESET_PASSWORD";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟
const MAX_VERIFY_ATTEMPTS = 5;

const PURPOSE_LABEL: Record<VerificationPurpose, string> = {
  REGISTER: "注册",
  LOGIN: "登录",
  RESET_PASSWORD: "找回密码",
};

export interface SendCodeResult {
  ok: boolean;
  error?: string;
  // 开发环境未配置真实渠道时，返回 code 便于本地测试（生产不返回）
  devCode?: string;
  retryAfterMs?: number;
}

/** 发送验证码（自动识别邮箱/手机号），内部完成限流与防刷 */
export async function sendCode(
  targetRaw: string,
  purpose: VerificationPurpose,
  ip: string,
): Promise<SendCodeResult> {
  const type = detectTarget(targetRaw);
  if (!type) {
    return { ok: false, error: "请输入正确的邮箱或手机号" };
  }
  const target = type === "email" ? normalizeEmail(targetRaw) : normalizePhone(targetRaw);

  // —— 发送频率限制（按目标）——
  const cooldown = rateLimit(`code:target:${target}:${purpose}`, 1, 60_000);
  if (!cooldown.ok) {
    return { ok: false, error: "发送过于频繁，请稍后再试", retryAfterMs: cooldown.retryAfterMs };
  }
  const hourly = rateLimit(`code:hour:${target}`, 5, 60 * 60_000);
  if (!hourly.ok) {
    return { ok: false, error: "该账号今日验证码发送次数已达上限", retryAfterMs: hourly.retryAfterMs };
  }
  const daily = rateLimit(`code:day:${target}`, 10, 24 * 60 * 60_000);
  if (!daily.ok) {
    return { ok: false, error: "该账号今日验证码发送次数已达上限", retryAfterMs: daily.retryAfterMs };
  }

  // —— IP 维度限流 ——
  const ipLimit = rateLimit(`code:ip:${ip}`, 10, 60 * 60_000);
  if (!ipLimit.ok) {
    return { ok: false, error: "操作过于频繁，请稍后再试", retryAfterMs: ipLimit.retryAfterMs };
  }

  // —— 生成并存储 ——
  const code = generateNumericCode(6);
  await prisma.verificationCode.create({
    data: {
      target,
      codeHash: hashCode(code, target, purpose),
      purpose,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  // —— 发送 ——
  if (type === "email") {
    await sendVerificationEmail(target, code, PURPOSE_LABEL[purpose]);
  } else {
    await sendVerificationSms(target, code, purpose);
  }

  // 开发环境把 code 回传（仅当未走真实渠道时），生产环境绝不回传
  const devCode =
    process.env.NODE_ENV !== "production" &&
    ((type === "email" && !process.env.SMTP_HOST) ||
      (type === "phone" && (process.env.SMS_PROVIDER || "console") === "console"))
      ? code
      : undefined;

  return { ok: true, devCode };
}

export interface VerifyCodeResult {
  ok: boolean;
  error?: string;
}

/**
 * 校验验证码：比对哈希、检查过期与尝试次数。
 * 校验成功即标记 usedAt，防止重放；失败累计 attemptCount。
 */
export async function verifyCode(
  targetRaw: string,
  purpose: VerificationPurpose,
  code: string,
): Promise<VerifyCodeResult> {
  const type = detectTarget(targetRaw);
  if (!type) return { ok: false, error: "请输入正确的邮箱或手机号" };
  const target = type === "email" ? normalizeEmail(targetRaw) : normalizePhone(targetRaw);

  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "验证码为 6 位数字" };
  }

  // 取该目标+用途最近一条未使用的验证码
  const record = await prisma.verificationCode.findFirst({
    where: {
      target,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, error: "验证码已过期，请重新获取" };
  }

  if (record.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, error: "验证码错误次数过多，请重新获取" };
  }

  const match = record.codeHash === hashCode(code, target, purpose);
  if (!match) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attemptCount: { increment: 1 } },
    });
    const remaining = MAX_VERIFY_ATTEMPTS - (record.attemptCount + 1);
    return { ok: false, error: remaining > 0 ? `验证码错误，还可尝试 ${remaining} 次` : "验证码错误次数过多，请重新获取" };
  }

  // 校验通过，标记已使用
  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return { ok: true };
}

/** 校验通过后清理该目标该用途的历史验证码，避免表无限膨胀 */
export async function clearCodes(target: string, purpose: VerificationPurpose): Promise<void> {
  await prisma.verificationCode.deleteMany({ where: { target, purpose } });
}

export { normalizeEmail, normalizePhone };
