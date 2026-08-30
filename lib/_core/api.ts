import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  const sessionToken = await Auth.getSessionToken();
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;
  const response = await fetch(url, { ...options, headers, credentials: "include" });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText) as { error?: string; message?: string };
      throw new Error(errorJson.error ?? errorJson.message ?? `API call failed: ${response.statusText}`);
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error(`API call failed: ${response.statusText}`);
    }
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", { method: "POST" });
}

export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: {
      id: number;
      openId: string;
      name: string | null;
      email: string | null;
      loginMethod: string | null;
      lastSignedIn: string;
    } | null }>("/api/auth/me");
    return result.user;
  } catch {
    return null;
  }
}
