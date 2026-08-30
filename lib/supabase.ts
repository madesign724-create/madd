import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { createClient, type Session } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase authentication is not configured for MADD.");
}

const authStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    flowType: "pkce",
  },
});

function getCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("code");
  } catch {
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code;
    return typeof code === "string" ? code : null;
  }
}

/**
 * يكمل تبادل رمز PKCE العائد من Supabase. على الويب قد تكون مكتبة Supabase
 * قد استهلكت الرمز تلقائياً، لذلك نتحقق من الجلسة أولاً قبل طلب تبادل جديد.
 */
export async function completeSupabaseOAuthCallback(callbackUrl?: string | null): Promise<Session> {
  const existing = await supabase.auth.getSession();
  if (existing.data.session) return existing.data.session;

  const url = callbackUrl ?? (await Linking.getInitialURL());
  const code = url ? getCodeFromUrl(url) : null;
  if (!code) throw new Error("لم يكتمل رابط تأكيد الدخول.");

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error || !exchanged.data.session) {
    throw exchanged.error ?? new Error("تعذر إنشاء جلسة الحساب.");
  }
  return exchanged.data.session;
}

/** يكمل جلسة الاسترداد العائدة من رسالة «نسيت كلمة المرور». */
export async function completeSupabaseRecoveryCallback(callbackUrl?: string | null): Promise<Session> {
  return completeSupabaseOAuthCallback(callbackUrl);
}
