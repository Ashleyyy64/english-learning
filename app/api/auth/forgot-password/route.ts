import { NextResponse } from "next/server";
import { sendCode } from "@/lib/verification";
import { findUserByTarget } from "@/lib/auth";
import {
  parseJsonBody,
  getClientIp,
  assertSameOrigin,
  detectTarget,
} from "@/lib/validation";

/**
 * POST /api/auth/forgot-password
 * 找回密码第一步：向已注册的邮箱/手机号发送验证码。
 * 防枚举：无论账号是否存在，统一返回相同提示。
 */
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "非法请求来源", code: "CSRF" }, { status: 403 });
  }

  const body = await parseJsonBody(request);
  const target = String(body?.target ?? "").trim();

  if (!target || !detectTarget(target)) {
    return NextResponse.json({ error: "请输入正确的邮箱或手机号" }, { status: 400 });
  }

  const user = await findUserByTarget(target);
  if (user) {
    await sendCode(target, "RESET_PASSWORD", getClientIp(request));
  }

  // 统一返回，不泄露账号是否存在
  return NextResponse.json({ ok: true, message: "如果该账号存在，验证码已发送" });
}
