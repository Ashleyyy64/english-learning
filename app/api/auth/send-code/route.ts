import { NextResponse } from "next/server";
import { sendCode, type VerificationPurpose } from "@/lib/verification";
import { findUserByTarget } from "@/lib/auth";
import {
  parseJsonBody,
  getClientIp,
  assertSameOrigin,
  detectTarget,
} from "@/lib/validation";

const VALID_PURPOSES: VerificationPurpose[] = ["REGISTER", "LOGIN", "RESET_PASSWORD"];

/**
 * POST /api/auth/send-code
 * 发送短信/邮件验证码。用途：REGISTER 注册 / LOGIN 验证码登录 / RESET_PASSWORD 找回密码。
 * 内置：频率限流（60s 冷却 + 每小时 5 条 + 每天 10 条）+ IP 限流 + CSRF 来源校验。
 */
export async function POST(request: Request) {
  // CSRF 纵深防御：存在跨源 Origin 时拒绝
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "非法请求来源", code: "CSRF" }, { status: 403 });
  }

  const body = await parseJsonBody(request);
  const target = String(body?.target ?? "").trim();
  const purpose = String(body?.purpose ?? "REGISTER") as VerificationPurpose;

  if (!target) {
    return NextResponse.json({ error: "请填写邮箱或手机号" }, { status: 400 });
  }
  if (!VALID_PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: "验证码用途不合法" }, { status: 400 });
  }

  // 登录 / 找回密码场景：目标账号必须已注册（防枚举：统一返回模糊提示）
  if (purpose === "LOGIN" || purpose === "RESET_PASSWORD") {
    const user = await findUserByTarget(target);
    if (!user) {
      return NextResponse.json(
        { error: "如果该账号存在，验证码已发送" },
        { status: 200 },
      );
    }
  }

  // 注册场景：若邮箱/手机号已注册，提示用户直接登录
  if (purpose === "REGISTER") {
    const user = await findUserByTarget(target);
    if (user) {
      return NextResponse.json(
        { error: "该邮箱/手机号已被注册，请直接登录" },
        { status: 409 },
      );
    }
  }

  const ip = getClientIp(request);
  const result = await sendCode(target, purpose, ip);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error ?? "验证码发送失败" },
      { status: 429, headers: result.retryAfterMs ? { "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)) } : undefined },
    );
  }

  const type = detectTarget(target);
  return NextResponse.json({
    ok: true,
    targetType: type,
    // 开发环境兜底时回传验证码便于联调；生产环境恒为 undefined
    devCode: result.devCode,
  });
}
