import { createHash, createHmac } from "crypto";

/**
 * 短信发送模块（验证码短信）。
 *
 * 通过 SMS_PROVIDER 选择供应商：
 * - console：控制台打印验证码（开发/未配置兜底）
 * - tencent：腾讯云短信（国内常用，TC3-HMAC-SHA256 签名，无需额外 SDK）
 *
 * 其他供应商（阿里云等）可参照 SmsProvider 接口自行实现。
 */

export type SmsPurpose = "REGISTER" | "LOGIN" | "RESET_PASSWORD";

export interface SmsResult {
  sent: boolean;
  provider: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  send(to: string, code: string, purpose: SmsPurpose): Promise<SmsResult>;
}

const PURPOSE_LABEL: Record<SmsPurpose, string> = {
  REGISTER: "注册",
  LOGIN: "登录",
  RESET_PASSWORD: "找回密码",
};

// ===== 控制台兜底（开发环境） =====
export class ConsoleSmsProvider implements SmsProvider {
  name = "console";
  async send(to: string, code: string, purpose: SmsPurpose): Promise<SmsResult> {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[sms:console] 手机号 ${to} 的验证码：${code}（${PURPOSE_LABEL[purpose]}）`);
    }
    return { sent: false, provider: "console" };
  }
}

// ===== 腾讯云短信（TC3-HMAC-SHA256 签名） =====
function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export class TencentSmsProvider implements SmsProvider {
  name = "tencent";

  private get config() {
    return {
      secretId: process.env.TENCENT_SMS_SECRET_ID || "",
      secretKey: process.env.TENCENT_SMS_SECRET_KEY || "",
      sdkAppId: process.env.TENCENT_SMS_SDK_APP_ID || "",
      signName: process.env.TENCENT_SMS_SIGN_NAME || "",
      templateId: process.env.TENCENT_SMS_TEMPLATE_ID || "",
      region: process.env.TENCENT_SMS_REGION || "ap-guangzhou",
    };
  }

  async send(to: string, code: string, purpose: SmsPurpose): Promise<SmsResult> {
    const cfg = this.config;
    if (!cfg.secretId || !cfg.secretKey || !cfg.sdkAppId || !cfg.signName || !cfg.templateId) {
      return { sent: false, provider: "tencent", error: "腾讯云短信未完整配置" };
    }

    // 腾讯云短信模板占位：{1}=验证码，{2}=用途，{3}=有效期
    const payload = JSON.stringify({
      PhoneNumberSet: [`+86${to}`],
      SmsSdkAppId: cfg.sdkAppId,
      SignName: cfg.signName,
      TemplateId: cfg.templateId,
      TemplateParamSet: [code, PURPOSE_LABEL[purpose], "10"],
    });

    const service = "sms";
    const host = "sms.tencentcloudapi.com";
    const action = "SendSms";
    const version = "2021-01-11";
    const algorithm = "TC3-HMAC-SHA256";
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    // 1. 拼接规范请求串
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
    const signedHeaders = "content-type;host;x-tc-action";
    const hashedPayload = sha256hex(payload);
    const canonicalRequest = ["POST", "/", "", canonicalHeaders, signedHeaders, hashedPayload].join("\n");

    // 2. 拼接待签名字符串
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = sha256hex(canonicalRequest);
    const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join("\n");

    // 3. 计算签名
    const secretDate = hmac(`TC3${cfg.secretKey}`, date);
    const secretService = hmac(secretDate, service);
    const secretSigning = hmac(secretService, "tc3_request");
    const signature = createHmac("sha256", secretSigning).update(stringToSign).digest("hex");

    // 4. 拼接 Authorization
    const authorization =
      `${algorithm} Credential=${cfg.secretId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    try {
      const res = await fetch(`https://${host}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json; charset=utf-8",
          Host: host,
          "X-TC-Action": action,
          "X-TC-Timestamp": String(timestamp),
          "X-TC-Version": version,
          "X-TC-Region": cfg.region,
        },
        body: payload,
      });

      const data = (await res.json().catch(() => ({}))) as {
        Response?: { Error?: { Code?: string; Message?: string }; SendStatusSet?: unknown[] };
      };
      const resp = data.Response;
      if (resp?.Error) {
        return { sent: false, provider: "tencent", error: `${resp.Error.Code}: ${resp.Error.Message}` };
      }
      const status = resp?.SendStatusSet?.[0] as { Code?: string; Message?: string } | undefined;
      if (status && status.Code !== "Ok") {
        return { sent: false, provider: "tencent", error: status.Message || status.Code };
      }
      return { sent: true, provider: "tencent" };
    } catch (error) {
      return { sent: false, provider: "tencent", error: error instanceof Error ? error.message : "发送失败" };
    }
  }
}

// ===== 供应商选择 =====
let provider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  if (provider) return provider;
  const kind = (process.env.SMS_PROVIDER || "console").toLowerCase();
  provider = kind === "tencent" ? new TencentSmsProvider() : new ConsoleSmsProvider();
  return provider;
}

/** 发送短信验证码 */
export async function sendVerificationSms(to: string, code: string, purpose: SmsPurpose): Promise<SmsResult> {
  return getSmsProvider().send(to, code, purpose);
}
