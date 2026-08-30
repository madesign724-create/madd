import { afterEach, describe, expect, it, vi } from "vitest";
import { isExpoPushToken, sendProjectUpdatePush } from "../server/push";

describe("Expo push token validation", () => {
  it("accepts both supported Expo push-token formats", () => {
    expect(isExpoPushToken("ExponentPushToken[example-device-token]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[another-device-token]")).toBe(true);
  });

  it("rejects malformed or unrelated device identifiers", () => {
    expect(isExpoPushToken("fcm-token-only")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("يرسل نوع الإشعار المنظم وبيانات البطاقة داخل التطبيق", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: [{}] }) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendProjectUpdatePush({
      tokens: ["ExponentPushToken[example-device-token]"],
      projectId: 42,
      projectTitle: "فيلا النخيل",
      updateTitle: "تم تسعير المشروع",
      progressPercent: 10,
      note: "عرض التسعير جاهز للمراجعة.",
      notificationKind: "pricing_ready",
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const requestBody = typeof request?.body === "string" ? request.body : "[]";
    const messages = JSON.parse(requestBody) as Array<{ data: Record<string, unknown> }>;
    expect(result).toEqual({ attempted: 1, accepted: 1 });
    expect(messages[0]?.data).toMatchObject({
      url: "/project/42",
      projectId: 42,
      notificationKind: "pricing_ready",
      title: "تم تسعير المشروع",
      body: "عرض التسعير جاهز للمراجعة.",
    });
  });
});
