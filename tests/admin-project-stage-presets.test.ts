import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/admin.tsx", "utf8");
const clientProjectSource = readFileSync("app/project/[projectId].tsx", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const rootLayoutSource = readFileSync("app/_layout.tsx", "utf8");

describe("اختصارات مراحل المشروع الإدارية", () => {
  it("يوفر تحديثات جاهزة للتسعير واعتماد العرض والتنفيذ والانتهاء", () => {
    expect(source).toContain('label: "تم التسعير"');
    expect(source).toContain('label: "تم اعتماد التسعير"');
    expect(source).toContain('label: "بدء التنفيذ"');
    expect(source).toContain('label: "تم الانتهاء"');
  });

  it("يعبئ الحالة والنسبة والعنوان تلقائياً مع إبقاء الحقول قابلة للتعديل", () => {
    expect(source).toContain("const applyProjectUpdatePreset");
    expect(source).toContain("setProgress(String(preset.progress))");
    expect(source).toContain("setTitle(preset.title)");
    expect(source).toContain("setNote(preset.note)");
    expect(source).toContain("اختر تحديثاً سريعاً لتعبئة البيانات تلقائياً");
  });

  it("يعرض للعميل عنوان التحديث وملاحظته ونسبة الإنجاز في سجل مراحل المشروع", () => {
    expect(clientProjectSource).toContain("تحديثات فريق MADD");
    expect(clientProjectSource).toContain("update.title");
    expect(clientProjectSource).toContain("update.note");
    expect(clientProjectSource).toContain("update.progressPercent");
  });

  it("يربط اختصاري التسعير والانتهاء فقط بإشعار عميل منظم", () => {
    expect(source).toContain('notificationKind: "pricing_ready"');
    expect(source).toContain('notificationKind: "project_completed"');
    expect(source).toContain("setNotificationKind(preset.notificationKind ?? null)");
    expect(source).toContain("notificationKind: notificationKind ?? undefined");
    expect(routerSource).toContain('notificationKind: z.enum(["pricing_ready", "project_completed"]).nullable().optional()');
    expect(routerSource).toContain('input.notificationKind === "pricing_ready" && input.status !== "under_review"');
    expect(routerSource).toContain('input.notificationKind === "project_completed" && (input.status !== "completed" || input.progressPercent !== 100)');
  });

  it("يعرض بطاقة مرئية في الواجهة المفتوحة مع زر لعرض المشروع", () => {
    expect(rootLayoutSource).toContain("Notifications.addNotificationReceivedListener");
    expect(rootLayoutSource).toContain('kind !== "pricing_ready" && kind !== "project_completed"');
    expect(rootLayoutSource).toContain("عرض المشروع");
    expect(rootLayoutSource).toContain("router.push(`/project/${foregroundNotification.projectId}` as never)");
  });
});
