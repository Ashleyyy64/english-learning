import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findUserByTarget, hashPassword } from "@/lib/auth";
import { revokeAllSessions } from "@/lib/session";
import { verifyCode, clearCodes } from "@/lib/verification";
import {
  parseJsonBody,
  assertSameOrigin,
  detectTarget,
  validatePassword,
  normalizeEmail,
  normalizePhone,
} from "@/lib/validation";

/**
 * POST /api/auth/reset-password
 * 找回密码第二步：验证码校验通过后重设密码，并吊销该账号全部会话（安全）。
 */
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "非法请求来源", code: "CSRF" }, { status: 403 });
  }

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const target = String(body.target ?? "").trim();
  const code = String(body.code ?? "").trim();
  const password = String(body.password ?? "");

  if (!detectTarget(target)) {
    return NextResponse.json({ error: "请输入正确的邮箱或手机号" }, { status: 400 });
  }

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 });
  }

  // 校验验证码（失败会累计尝试次数）
  const codeCheck = await verifyCode(target, "RESET_PASSWORD", code);
  if (!codeCheck.ok) {
    return NextResponse.json({ error: codeCheck.error }, { status: 400 });
  }

  const user = await findUserByTarget(target);
  if (!user) {
    return NextResponse.json({ error: "账号不存在，请先注册" }, { status: 404 });
  }

  // 规范化目标并更新密码
  const type = detectTarget(target);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      ...(type === "email" ? { emailVerified: true } : { phoneVerified: true }),
      failedAttempts: 0,
      lockedUntil: null,
      status: "ACTIVE",
    },
  });

  // 重置密码后吊销所有会话，强制重新登录
  await revokeAllSessions(user.id);
  await clearCodes(type === "email" ? normalizeEmail(target) : normalizePhone(target), "RESET_PASSWORD").catch(() => {});

  return NextResponse.json({ ok: true, message: "密码已重置，请使用新密码登录" });
}
