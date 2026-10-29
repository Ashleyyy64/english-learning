/**
 * 参数校验与密码强度策略（单一事实来源，前端与后端共用同一套规则）。
 * 所有校验函数不抛异常，返回结构化结果，由 API 层统一转为错误响应。
 */

// ===== 基础规则 =====

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/; // 仅字母数字下划线，避免注入/混淆

export const NAME_MIN = 1;
export const NAME_MAX = 50;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// 中国大陆手机号（11 位，1 开头），支持 +86 前缀
export const PHONE_REGEX = /^(?:\+?86)?1[3-9]\d{9}$/;

// 常见弱密码黑名单（小写比对）
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "password1",
  "11111111", "00000000", "88888888", "66666666", "qwertyui",
  "abc12345", "123456789a", "iloveyou1", "admin1234", "letmein1",
]);

// ===== 校验结果类型 =====

export interface FieldResult {
  ok: boolean;
  error?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4; // 0 弱 → 4 强
  label: "太弱" | "较弱" | "一般" | "较强" | "很强";
  valid: boolean;
  message?: string;
  checks: {
    length: boolean;
    lower: boolean;
    upper: boolean;
    digit: boolean;
    symbol: boolean;
    notCommon: boolean;
  };
}

// ===== 字段校验 =====

export function validateEmail(raw: unknown): FieldResult {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "请填写邮箱" };
  if (email.length > 254) return { ok: false, error: "邮箱地址过长" };
  if (!EMAIL_REGEX.test(email)) return { ok: false, error: "邮箱格式不正确" };
  return { ok: true };
}

export function validatePhone(raw: unknown): FieldResult {
  const phone = String(raw ?? "").trim().replace(/\s/g, "");
  if (!phone) return { ok: false, error: "请填写手机号" };
  if (!PHONE_REGEX.test(phone)) return { ok: false, error: "手机号格式不正确" };
  return { ok: true };
}

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** 规范化手机号：去掉 +86/86 前缀与空格，统一为 11 位数字 */
export function normalizePhone(raw: unknown): string {
  let phone = String(raw ?? "").trim().replace(/\s/g, "");
  if (phone.startsWith("+86")) phone = phone.slice(3);
  else if (phone.startsWith("86") && phone.length === 13) phone = phone.slice(2);
  return phone;
}

/** 判断目标是邮箱还是手机号，返回类型；两者都不是返回 null */
export function detectTarget(raw: unknown): "email" | "phone" | null {
  const value = String(raw ?? "").trim();
  if (EMAIL_REGEX.test(value)) return "email";
  if (PHONE_REGEX.test(value.replace(/\s/g, ""))) return "phone";
  return null;
}

export function validateUsername(raw: unknown): FieldResult {
  const username = String(raw ?? "").trim();
  if (!username) return { ok: false, error: "请填写账号" };
  if (username.length < USERNAME_MIN) return { ok: false, error: `账号至少 ${USERNAME_MIN} 个字符` };
  if (username.length > USERNAME_MAX) return { ok: false, error: `账号最多 ${USERNAME_MAX} 个字符` };
  if (!USERNAME_REGEX.test(username)) return { ok: false, error: "账号仅支持字母、数字和下划线" };
  return { ok: true };
}

export function validateName(raw: unknown): FieldResult {
  const name = String(raw ?? "").trim();
  if (!name) return { ok: false, error: "请填写姓名或昵称" };
  if (name.length < NAME_MIN) return { ok: false, error: "姓名或昵称不能为空" };
  if (name.length > NAME_MAX) return { ok: false, error: `姓名或昵称最多 ${NAME_MAX} 个字符` };
  return { ok: true };
}

export function validateRole(raw: unknown): "TEACHER" | "STUDENT" | null {
  return raw === "STUDENT" ? "STUDENT" : raw === "TEACHER" ? "TEACHER" : null;
}

// ===== 密码强度 =====

export function passwordStrength(password: string): PasswordStrength {
  const checks = {
    length: password.length >= PASSWORD_MIN,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.has(password.toLowerCase()),
  };

  const categories = [checks.lower, checks.upper, checks.digit, checks.symbol].filter(Boolean).length;

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (checks.length) {
    // 基础分：长度 + 字符种类
    if (password.length >= 12) score += 2;
    else if (password.length >= 10) score += 1;
    if (categories >= 3) score += 2;
    else if (categories === 2) score += 1;
    // 黑名单命中直接降到 0
    if (!checks.notCommon) score = 0;
    score = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  }

  const labelMap: Record<number, PasswordStrength["label"]> = {
    0: "太弱", 1: "较弱", 2: "一般", 3: "较强", 4: "很强",
  };

  let valid = false;
  let message: string | undefined;
  if (!checks.length) {
    message = `密码至少 ${PASSWORD_MIN} 位`;
  } else if (!checks.notCommon) {
    message = "密码过于常见，请换一个更复杂的";
  } else if (categories < 2) {
    valid = false;
    message = "密码需同时包含字母和数字";
  } else {
    valid = true;
  }

  return { score, label: labelMap[score], valid, message, checks };
}

/** 校验密码：同时检查长度与强度，返回结果 */
export function validatePassword(password: string): FieldResult & { strength?: PasswordStrength } {
  if (!password) return { ok: false, error: "请填写密码" };
  if (password.length < PASSWORD_MIN) return { ok: false, error: `密码至少 ${PASSWORD_MIN} 位` };
  if (password.length > PASSWORD_MAX) return { ok: false, error: `密码最多 ${PASSWORD_MAX} 位` };
  const strength = passwordStrength(password);
  if (!strength.valid) {
    return { ok: false, error: strength.message ?? "密码强度不足", strength };
  }
  return { ok: true, strength };
}

// ===== 通用工具 =====

/** 安全解析 JSON body，失败返回 null */
export async function parseJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 提取客户端 IP（优先 x-forwarded-for，Nginx 反代时取真实来源） */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** 提取 User-Agent */
export function getClientUserAgent(request: Request): string | null {
  return request.headers.get("user-agent");
}

/** 校验请求来源，作为 CSRF 的纵深防御（存在 Origin/Referer 且跨源时拒绝） */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // 无 Origin 的场景（同源导航/老客户端）放行
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("host");
    return originUrl.host === host;
  } catch {
    return false;
  }
}
