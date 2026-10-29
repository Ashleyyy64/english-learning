import nodemailer, { type Transporter } from "nodemailer";

/**
 * 邮件发送模块（验证码邮件）。
 *
 * 生产：配置 SMTP 后发送真实邮件。
 * 开发/未配置：回退到控制台打印验证码（方便本地联调），并返回 sent:false。
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null; // 未配置 → 控制台兜底

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: String(SMTP_PORT) !== "587", // 465 为 SSL，587 为 STARTTLS
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface MailResult {
  sent: boolean; // 是否真正通过 SMTP 发送
  provider: "smtp" | "console";
}

/** 构造验证码邮件 HTML（品牌化模板） */
function verificationEmailHtml(code: string, purposeLabel: string): string {
  return `
  <div style="background:#f5f6f8;padding:40px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e9ebf0;">
      <div style="background:#18243b;padding:20px 28px;color:#fff;">
        <div style="font-size:18px;font-weight:700;letter-spacing:-0.5px;">lingua · 英语学习空间</div>
      </div>
      <div style="padding:32px 28px;">
        <div style="font-size:20px;font-weight:600;color:#1c2333;margin-bottom:10px;">${purposeLabel}验证码</div>
        <p style="color:#7b8498;font-size:14px;line-height:1.7;margin:0 0 24px;">你正在 ${purposeLabel}，请在 10 分钟内输入下方验证码（请勿泄露给他人）：</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;color:#e97845;background:#fdf3ee;border-radius:10px;padding:18px 10px;margin-bottom:24px;">${code}</div>
        <p style="color:#a0a7b3;font-size:12px;line-height:1.7;margin:0;">如果这不是你本人的操作，请忽略本邮件。验证码仅在 10 分钟内有效。</p>
      </div>
    </div>
  </div>`;
}

/**
 * 发送验证码邮件。
 * @returns sent=false 表示未配置 SMTP，已在服务端控制台打印验证码（仅限开发环境）。
 */
export async function sendVerificationEmail(
  to: string,
  code: string,
  purposeLabel: string,
): Promise<MailResult> {
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log(`[mailer:console] 收件人 ${to} 的验证码：${code}（${purposeLabel}）`);
    }
    return { sent: false, provider: "console" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@lingua.local";
  await t.sendMail({
    from,
    to,
    subject: `【lingua】${purposeLabel}验证码：${code}`,
    text: `你的${purposeLabel}验证码是 ${code}，10 分钟内有效。请勿泄露给他人。`,
    html: verificationEmailHtml(code, purposeLabel),
  });
  return { sent: true, provider: "smtp" };
}
