import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserByOpenId: vi.fn(),
  getUserByNormalizedEmail: vi.fn(),
  linkUserToSupabaseIdentity: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("../server/db", () => mocks);
vi.mock("../server/_core/env", () => ({
  ENV: { supabaseUrl: "https://madd.example", supabaseAnonKey: "public-key" },
}));

import { sdk } from "../server/_core/sdk";

const previousUser = {
  id: 19,
  openId: "legacy-manus-id",
  name: "عميل سابق",
  email: "customer@example.com",
  loginMethod: "legacy",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function authenticatedRequest(token = "valid-session-token") {
  return { headers: { authorization: `Bearer ${token}` } } as never;
}

function googleUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "7a8422e1-4c4c-432e-909b-c1a6beb4951a",
    email: "Customer@Example.com",
    email_confirmed_at: "2026-08-22T00:00:00.000Z",
    app_metadata: { provider: "google", providers: ["google"] },
    user_metadata: { full_name: "Customer Name" },
    ...overrides,
  };
}

function emailUser(overrides: Record<string, unknown> = {}) {
  return googleUser({
    id: "b2a03262-6e4a-4e02-91c2-1a1f0fe117a7",
    app_metadata: { provider: "email", providers: ["email"] },
    identities: [{ provider: "email" }],
    ...overrides,
  });
}

describe("تحقق خادم MADD من جلسات Supabase", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("يرفض رمز Bearer غير الصالح قبل لمس بيانات المستخدم", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(sdk.authenticateRequest(authenticatedRequest())).rejects.toThrow("Invalid Supabase session");
    expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  });

  it("يرفض مزود هوية غير مدعوم حتى إن كان بريدها مؤكداً", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => googleUser({ app_metadata: { provider: "github", providers: ["github"] }, identities: [{ provider: "github" }] }) }));
    await expect(sdk.authenticateRequest(authenticatedRequest())).rejects.toThrow("Only Google or email sign-in is available");
    expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  });

  it("يربط الحساب المحلي السابق ببريد Google المؤكد مع الحفاظ على رقم المستخدم المحلي", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => googleUser() }));
    mocks.getUserByOpenId.mockResolvedValue(undefined);
    mocks.getUserByNormalizedEmail.mockResolvedValue(previousUser);
    mocks.linkUserToSupabaseIdentity.mockResolvedValue({ ...previousUser, openId: googleUser().id, loginMethod: "google" });

    const user = await sdk.authenticateRequest(authenticatedRequest());

    expect(mocks.getUserByNormalizedEmail).toHaveBeenCalledWith("customer@example.com");
    expect(mocks.linkUserToSupabaseIdentity).toHaveBeenCalledWith(expect.objectContaining({
      userId: previousUser.id,
      openId: googleUser().id,
      email: "customer@example.com",
    }));
    expect(user.id).toBe(previousUser.id);
    expect(user.openId).toBe(googleUser().id);
  });

  it("يقبل البريد الإلكتروني المؤكد ويربطه بالحساب المحلي السابق بأمان", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => emailUser() }));
    mocks.getUserByOpenId.mockResolvedValue(undefined);
    mocks.getUserByNormalizedEmail.mockResolvedValue(previousUser);
    mocks.linkUserToSupabaseIdentity.mockResolvedValue({ ...previousUser, openId: emailUser().id, loginMethod: "email" });

    const user = await sdk.authenticateRequest(authenticatedRequest());

    expect(mocks.getUserByNormalizedEmail).toHaveBeenCalledWith("customer@example.com");
    expect(mocks.linkUserToSupabaseIdentity).toHaveBeenCalledWith(expect.objectContaining({ userId: previousUser.id, openId: emailUser().id }));
    expect(user.openId).toBe(emailUser().id);
  });
});
