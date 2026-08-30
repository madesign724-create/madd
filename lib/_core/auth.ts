import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

function hasWebStorage() {
  return Platform.OS === "web" && typeof window !== "undefined";
}

export async function getSessionToken(): Promise<string | null> {
  try {
    if (hasWebStorage()) return window.localStorage.getItem(SESSION_TOKEN_KEY);
    return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  if (hasWebStorage()) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (hasWebStorage()) {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // إخفاق التنظيف المحلي لا يغيّر نتيجة تسجيل الخروج في Supabase.
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    const info = hasWebStorage()
      ? window.localStorage.getItem(USER_INFO_KEY)
      : await SecureStore.getItemAsync(USER_INFO_KEY);
    return info ? (JSON.parse(info) as User) : null;
  } catch {
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    const value = JSON.stringify(user);
    if (hasWebStorage()) {
      window.localStorage.setItem(USER_INFO_KEY, value);
      return;
    }
    await SecureStore.setItemAsync(USER_INFO_KEY, value);
  } catch {
    // بيانات الحساب مخبأة لتسريع الواجهة فقط؛ مصدر الحقيقة هو Supabase والخادم.
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (hasWebStorage()) {
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch {
    // لا نعيد إظهار جلسة محلية عند تعذر حذف ذاكرة التخزين المساعدة.
  }
}
