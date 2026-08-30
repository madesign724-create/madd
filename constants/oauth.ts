import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as ReactNative from "react-native";
import { completeSupabaseOAuthCallback, supabase } from "@/lib/supabase";
import { setSessionToken } from "@/lib/_core/auth";

const env = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: "madd",
};

export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  // If API_BASE_URL is set, use it
  if (API_BASE_URL) {
    return API_BASE_URL.replace(/\/$/, "");
  }

  // On web, derive from current hostname by replacing port 8081 with 3000
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // Fallback to empty (will use relative URL)
  return "";
}

export const SESSION_TOKEN_KEY = "madd-session-token";
export const USER_INFO_KEY = "madd-user-info";

/**
 * رابط العودة الآمن الخاص بحساب MADD. يجب إضافة رابط الويب الفعلي في إعدادات
 * Supabase، كما يجب إضافة madd://auth/callback عند تجهيز نسخة الهاتف النهائية.
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("تعذر تحديد رابط العودة للويب.");
    return `${window.location.origin}/auth/callback`;
  }
  return Linking.createURL("auth/callback", { scheme: env.deepLinkScheme });
};

/** رابط العودة المنفصل لرسائل استرداد كلمة المرور. */
export const getPasswordResetRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    if (typeof window === "undefined") throw new Error("تعذر تحديد رابط استرداد كلمة المرور.");
    return `${window.location.origin}/auth/reset-password`;
  }
  return Linking.createURL("auth/reset-password", { scheme: env.deepLinkScheme });
};

type OAuthLoginOptions = {
  chooseAccount?: boolean;
};

/**
 * بدء تسجيل Google من Supabase مباشرةً، بلا وسيط واجهة خارجي للتطبيق.
 */
export async function startOAuthLogin(options: OAuthLoginOptions = {}): Promise<string | null> {
  const redirectTo = getRedirectUri();
  const result = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: options.chooseAccount ? { prompt: "select_account" } : undefined,
      skipBrowserRedirect: ReactNative.Platform.OS !== "web",
    },
  });

  if (result.error || !result.data.url) {
    throw result.error ?? new Error("تعذر بدء تسجيل Google.");
  }

  if (ReactNative.Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.assign(result.data.url);
    }
    return null;
  }

  const response = await WebBrowser.openAuthSessionAsync(result.data.url, redirectTo);
  if (response.type !== "success") return null;
  const session = await completeSupabaseOAuthCallback(response.url);
  await setSessionToken(session.access_token);
  return response.url;
}
