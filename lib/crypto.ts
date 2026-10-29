import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * 对称加密工具：用于加密存储第三方登录的 accessToken / refreshToken，
 * 以及生成验证码的加盐哈希。
 *
 * 密钥来源：OAUTH_ENCRYPTION_KEY，缺省回退 JWT_SECRET（保证零配置可用）。
 */

const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const raw = process.env.OAUTH_ENCRYPTION_KEY || process.env.JWT_SECRET || "lingua-dev-secret";
  // 用 sha256 把任意长度密钥规整为 32 字节
  return createHash("sha256").update(raw).digest();
}

/** AES-256-GCM 加密，返回 base64(iv).base64(tag).base64(cipher) */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
}

/** 解密 encryptSecret 的输出，失败返回 null（不抛异常） */
export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = getEncryptionKey();
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * 生成「目标 + 用途 + 明文」的加盐哈希，用于安全存储验证码（不存明文）。
 * 加盐通过 pepper 使离线暴力破解（穷举 6 位数字）失效。
 */
export function hashCode(code: string, target: string, purpose: string): string {
  const pepper = process.env.CODES_PEPPER || process.env.JWT_SECRET || "lingua-dev-secret";
  return createHash("sha256").update(`${code}:${target}:${purpose}:${pepper}`).digest("hex");
}

/** 生成安全的随机令牌（用于验证码 / 会话等），默认 32 字节 hex */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** 生成 6 位数字验证码 */
export function generateNumericCode(length = 6): string {
  if (length <= 0) throw new Error("code length must be positive");
  const max = 10 ** length;
  // 用加密随机数避免可预测
  let code = "";
  while (code.length < length) {
    const buf = randomBytes(length);
    for (let i = 0; i < buf.length && code.length < length; i++) {
      // 拒绝模偏差：仅接受 < 250 的字节映射到 0-9
      if (buf[i] < 250) code += String(buf[i] % 10);
    }
  }
  return code;
}
