import { describe, expect, it } from "vitest";

const supabaseUrl = "https://ddfpymanvyvjjnqcvsuw.supabase.co";
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

describe("إعداد مصادقة Supabase", () => {
  it("يصل إلى إعدادات المصادقة بالمفتاح العام ويثبت تفعيل Google", async () => {
    expect(anonKey, "يلزم ضبط EXPO_PUBLIC_SUPABASE_ANON_KEY").toBeTruthy();

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey!, Authorization: `Bearer ${anonKey!}` },
    });

    expect(response.ok).toBe(true);
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    expect(settings.external?.google, "يلزم تفعيل Google في Supabase Auth").toBe(true);
  });
});
