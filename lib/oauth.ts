import { randomBytes } from "crypto";

/**
 * 第三方登录（OAuth2）抽象层。
 *
 * 内置：
 * - 微信（微信开放平台「网站应用」扫码登录，国内场景常用）
 * - GitHub（通用 OAuth2 示例，易于注册与本地测试）
 *
 * 新增供应商：实现 OAuthProvider 接口并在 providers 里注册即可。
 * 未配置对应环境变量时，接口会返回明确的「未配置」错误。
 */

export type OAuthProviderName = "wechat" | "github";

export interface OAuthProfile {
  providerAccountId: string; // openid / 数字 id
  nickname: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string | null;
  /** access token 过期时间（绝对） */
  expiresAt: Date | null;
}

export interface OAuthProvider {
  name: OAuthProviderName;
  /** 构造授权跳转地址（含 state 防 CSRF） */
  authorizeUrl(state: string): string | null; // null 表示未配置
  /** 用授权码换取 access_token + 用户资料 */
  exchange(code: string): Promise<OAuthProfile | null>;
}

function getAppBaseUrl(): string {
  // 回调地址拼接基础，生产务必通过环境变量指定
  return process.env.APP_BASE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
}

// ===== 微信（开放平台网站应用扫码登录） =====
const WechatProvider: OAuthProvider = {
  name: "wechat",
  authorizeUrl(state) {
    const appId = process.env.WECHAT_APP_ID;
    const redirect = process.env.WECHAT_REDIRECT_URI || `${getAppBaseUrl()}/api/auth/oauth/wechat/callback`;
    if (!appId) return null;
    const params = new URLSearchParams({
      appid: appId,
      redirect_uri: redirect,
      response_type: "code",
      scope: "snsapi_login",
      state,
    });
    return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`;
  },
  async exchange(code) {
    const appId = process.env.WECHAT_APP_ID;
    const secret = process.env.WECHAT_APP_SECRET;
    if (!appId || !secret) return null;

    const tokenParams = new URLSearchParams({
      appid: appId,
      secret,
      code,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch(
      `https://api.weixin.qq.com/sns/oauth2/access_token?${tokenParams.toString()}`,
    );
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      openid?: string;
      errcode?: number;
    };
    if (!tokenData.access_token || !tokenData.openid) {
      console.error("[oauth:wechat] access_token 获取失败", tokenData.errcode);
      return null;
    }

    const infoRes = await fetch(
      `https://api.weixin.qq.com/sns/userinfo?access_token=${tokenData.access_token}&openid=${tokenData.openid}`,
    );
    const info = (await infoRes.json()) as { nickname?: string; headimgurl?: string };

    return {
      providerAccountId: tokenData.openid,
      nickname: info.nickname || "微信用户",
      avatar: info.headimgurl || null,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
    };
  },
};

// ===== GitHub（通用 OAuth2 示例） =====
const GithubProvider: OAuthProvider = {
  name: "github",
  authorizeUrl(state) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirect = process.env.GITHUB_REDIRECT_URI || `${getAppBaseUrl()}/api/auth/oauth/github/callback`;
    if (!clientId) return null;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      scope: "read:user user:email",
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  },
  async exchange(code) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const secret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !secret) return null;

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: secret,
        code,
        redirect_uri: process.env.GITHUB_REDIRECT_URI,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      console.error("[oauth:github] access_token 获取失败", tokenData.error);
      return null;
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "lingua" },
    });
    const user = (await userRes.json()) as {
      id?: number;
      login?: string;
      name?: string | null;
      avatar_url?: string;
    };

    return {
      providerAccountId: String(user.id ?? user.login ?? "unknown"),
      nickname: user.name || user.login || "GitHub 用户",
      avatar: user.avatar_url || null,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      expiresAt: null,
    };
  },
};

const providers: Record<OAuthProviderName, OAuthProvider> = {
  wechat: WechatProvider,
  github: GithubProvider,
};

export function getOAuthProvider(name: string): OAuthProvider | null {
  const key = name.toLowerCase() as OAuthProviderName;
  return providers[key] ?? null;
}

export function isOAuthConfigured(name: OAuthProviderName): boolean {
  const provider = providers[name];
  if (!provider) return false;
  return provider.authorizeUrl("probe") !== null;
}

export function generateOAuthState(): string {
  return randomBytes(24).toString("hex");
}

/** 跳转到第三方授权页；未配置时返回 null */
export function redirectToAuthorize(providerName: string, state: string): string | null {
  const provider = getOAuthProvider(providerName);
  if (!provider) return null;
  return provider.authorizeUrl(state);
}

export async function exchangeOAuthCode(
  providerName: string,
  code: string,
): Promise<{ provider: OAuthProviderName; profile: OAuthProfile } | null> {
  const provider = getOAuthProvider(providerName);
  if (!provider) return null;
  const profile = await provider.exchange(code);
  if (!profile) return null;
  return { provider: provider.name, profile };
}
