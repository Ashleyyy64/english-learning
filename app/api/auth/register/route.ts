import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setAuthCookie, publicUser } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { signToken } from "@/lib/jwt";
import { verifyCode, clearCodes } from "@/lib/verification";
import {
  parseJsonBody,
  getClientIp,
  getClientUserAgent,
  assertSameOrigin,
  validateUsername,
  validateName,
  validateRole,
  validateEmail,
  validatePhone,
  validatePassword,
  normalizeEmail,
  normalizePhone,
} from "@/lib/validation";

/**
 * POST /api/auth/register
 * 注册：用户名 + 密码 + 姓名 + 角色 + 邮箱/手机号（至少一项）+ 验证码。
 */
export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "非法请求来源", code: "CSRF" }, { status: 403 });
  }

  const body = await parseJsonBody(request);
  if (!body) return NextResponse.json({ error: "请求格式错误" }, { status: 400 });

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const roleRaw = String(body.role ?? "");
  const emailRaw = String(body.email ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  const code = String(body.code ?? "").trim();

  // —— 参数校验 ——
  const usernameCheck = validateUsername(username);
  if (!usernameCheck.ok) return NextResponse.json({ error: usernameCheck.error }, { status: 400 });

  const nameCheck = validateName(name);
  if (!nameCheck.ok) return NextResponse.json({ error: nameCheck.error }, { status: 400 });

  const role = validateRole(roleRaw);
  if (!role) return NextResponse.json({ error: "请选择学生或教师身份" }, { status: 400 });

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) return NextResponse.json({ error: passwordCheck.error }, { status: 400 });

  // 邮箱 / 手机号至少提供一项，且格式合法
  const hasEmail = emailRaw.length > 0;
  const hasPhone = phoneRaw.length > 0;
  if (!hasEmail && !hasPhone) {
    return NextResponse.json({ error: "请填写邮箱或手机号（用于验证与找回密码）" }, { status: 400 });
  }

  let email: string | null = null;
  let phone: string | null = null;
  let verifyTarget = "";

  if (hasEmail) {
    const check = validateEmail(emailRaw);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    email = normalizeEmail(emailRaw);
    verifyTarget = email;
  }
  if (hasPhone) {
    const check = validatePhone(phoneRaw);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    phone = normalizePhone(phoneRaw);
    if (!verifyTarget) verifyTarget = phone;
  }

  // —— 验证码校验（优先校验邮箱，其次手机号）——
  if (!code) return NextResponse.json({ error: "请输入验证码" }, { status: 400 });
  const codeCheck = await verifyCode(verifyTarget, "REGISTER", code);
  if (!codeCheck.ok) return NextResponse.json({ error: codeCheck.error }, { status: 400 });

  // —— 唯一性校验 ——
  const [usernameExists, emailExists, phoneExists] = await Promise.all([
    prisma.user.findUnique({ where: { username } }),
    email ? prisma.user.findUnique({ where: { email } }) : Promise.resolve(null),
    phone ? prisma.user.findUnique({ where: { phone } }) : Promise.resolve(null),
  ]);

  if (usernameExists) return NextResponse.json({ error: "该账号已被使用，请换一个" }, { status: 409 });
  if (emailExists) return NextResponse.json({ error: "该邮箱已被注册，请直接登录" }, { status: 409 });
  if (phoneExists) return NextResponse.json({ error: "该手机号已被注册，请直接登录" }, { status: 409 });

  // —— 创建用户 ——
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      name,
      role,
      email,
      phone,
      emailVerified: !!email,
      phoneVerified: !!phone,
    },
  });

  // 清理已使用的验证码
  await clearCodes(verifyTarget, "REGISTER").catch(() => {});

  // —— 建立会话并签发登录态 ——
  const sessionId = await createSession({
    userId: user.id,
    rememberMe: false,
    userAgent: getClientUserAgent(request),
    ip: getClientIp(request),
  });
  const token = await signToken({ sub: user.id, role, sid: sessionId }, { expiresIn: "7d" });
  await setAuthCookie(token, false);

  return NextResponse.json({ user: publicUser(user) }, { status: 201 });
}
