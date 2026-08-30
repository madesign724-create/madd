import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("الإشعارات الداخلية للعملاء", () => {
  it("يحفظ إشعاراً دائماً لصاحب المشروع عند نشر تحديث المرحلة", () => {
    const schema = read("drizzle/schema.ts");
    const database = read("server/db.ts");
    const router = read("server/routers.ts");

    expect(schema).toContain('export const userNotifications = pgTable("user_notifications"');
    expect(schema).toContain('userNotificationKindEnum');
    expect(database).toContain('await transaction.insert(userNotifications).values');
    expect(database).toContain('userId: project[0].userId');
    expect(database).toContain('kind: input.notificationKind ?? "project_update"');
    expect(router).toContain('notifications: router({');
    expect(router).toContain('unreadCount: protectedProcedure.query');
  });

  it("يقصر عرض وقراءة الإشعارات على مالكها", () => {
    const database = read("server/db.ts");

    expect(database).toContain('eq(userNotifications.userId, userId)');
    expect(database).toContain('eq(projects.userId, userId)');
    expect(database).toContain('eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId)');
    expect(database).toContain('isNull(userNotifications.readAt)');
  });

  it("يعرض شاشة RTL مع فتح المشروع وتعليم الإشعار كمقروء", () => {
    const screen = read("app/notifications.tsx");
    const home = read("app/(tabs)/index.tsx");
    const rootLayout = read("app/_layout.tsx");

    expect(screen).toContain('trpc.notifications.list.useQuery');
    expect(screen).toContain('trpc.notifications.markRead.useMutation');
    expect(screen).toContain('trpc.notifications.markAllRead.useMutation');
    expect(screen).toContain('router.push(`/project/${notification.projectId}` as never)');
    expect(screen).toContain('writingDirection: "rtl"');
    expect(home).toContain('trpc.notifications.unreadCount.useQuery');
    expect(home).toContain('router.push("/notifications" as never)');
    expect(rootLayout).toContain('<Stack.Screen name="notifications"');
  });
});
