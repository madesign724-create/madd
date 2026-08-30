import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader, Brand, EmptyState, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

function notificationVisual(kind: "project_update" | "pricing_ready" | "project_completed") {
  if (kind === "pricing_ready") return { icon: "request-quote" as const, label: "التسعير جاهز", color: Brand.warning };
  if (kind === "project_completed") return { icon: "workspace-premium" as const, label: "تم الانتهاء", color: Brand.success };
  return { icon: "update" as const, label: "تحديث مشروع", color: Brand.pine };
}

function formatNotificationDate(value: Date | string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const notificationsQuery = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.notifications.list.invalidate(), utils.notifications.unreadCount.invalidate()]);
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.notifications.list.invalidate(), utils.notifications.unreadCount.invalidate()]);
    },
  });
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const openNotification = (notification: (typeof notifications)[number]) => {
    if (!notification.readAt) markRead.mutate({ notificationId: notification.id });
    router.push(`/project/${notification.projectId}` as never);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.guestContent}>
          <AppHeader title="إشعاراتي" onBack={() => router.back()} />
          <EmptyState
            icon="notifications-none"
            title="سجّل الدخول لرؤية إشعاراتك"
            description="ستظهر هنا تحديثات مشروعك والتنبيهات التي تلقيتها من فريق MADD."
            action={<PrimaryButton label="تسجيل الدخول" onPress={() => router.push("/auth" as never)} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshing={notificationsQuery.isFetching}
        onRefresh={() => void notificationsQuery.refetch()}
        ListHeaderComponent={
          <View>
            <AppHeader title="إشعاراتي" subtitle="تحديثات مشروعاتك من فريق MADD" onBack={() => router.back()} />
            <View style={styles.introRow}>
              <View style={styles.introCopy}>
                <Text style={styles.introTitle}>كل ما يخص مشروعك في مكان واحد</Text>
                <Text style={styles.introText}>{unreadCount ? `لديك ${unreadCount} إشعار غير مقروء.` : "أنت على اطلاع بآخر تحديثات مشروعاتك."}</Text>
              </View>
              <View style={styles.introIcon}><MaterialIcons name="notifications-active" size={23} color={Brand.pine} /></View>
            </View>
            {unreadCount > 0 ? (
              <SecondaryButton label="تعليم الكل كمقروء" loading={markAllRead.isPending} disabled={markAllRead.isPending} onPress={() => markAllRead.mutate()} style={styles.markAllButton} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !notificationsQuery.isLoading ? (
            <EmptyState icon="notifications-none" title="لا توجد إشعارات بعد" description="عندما ينشر فريق MADD تحديثاً على أحد مشروعاتك، سيظهر هنا حتى لا يفوتك أي تفصيل." />
          ) : null
        }
        renderItem={({ item }) => {
          const visual = notificationVisual(item.kind);
          const isUnread = !item.readAt;
          return (
            <Pressable onPress={() => openNotification(item)} style={({ pressed }) => [styles.notificationCard, isUnread && styles.unreadCard, pressed && styles.pressed]}>
              <View style={[styles.notificationIcon, { borderColor: visual.color }]}>
                <MaterialIcons name={visual.icon} size={22} color={visual.color} />
              </View>
              <View style={styles.notificationCopy}>
                <View style={styles.notificationTop}>
                  <Text style={[styles.kindLabel, { color: visual.color }]}>{visual.label}</Text>
                  {isUnread ? <View style={styles.unreadDot} accessibilityLabel="إشعار غير مقروء" /> : null}
                </View>
                <Text style={styles.notificationTitle}>{item.title}</Text>
                {item.body ? <Text numberOfLines={2} style={styles.notificationBody}>{item.body}</Text> : null}
                <Text style={styles.projectText}>المشروع: {item.projectTitle}</Text>
                <Text style={styles.dateText}>{formatNotificationDate(item.createdAt)}</Text>
              </View>
              <MaterialIcons name="arrow-back" size={19} color={Brand.pine} style={styles.openIcon} />
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.canvas },
  guestContent: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34 },
  introRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, backgroundColor: "#17150D", borderWidth: 1, borderColor: "#665529", marginBottom: 11 },
  introCopy: { flex: 1, alignItems: "flex-end" },
  introIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#765F2D" },
  introTitle: { color: Brand.ink, fontSize: 14, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  introText: { color: Brand.muted, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  markAllButton: { minHeight: 45, marginBottom: 13 },
  notificationCard: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 11, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 18, padding: 14, marginBottom: 9 },
  unreadCard: { borderColor: "#806B35", backgroundColor: "#1B180F" },
  notificationIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#12120F", borderWidth: 1 },
  notificationCopy: { flex: 1, alignItems: "flex-end" },
  notificationTop: { alignSelf: "stretch", flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 8 },
  kindLabel: { fontSize: 10, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.pine },
  notificationTitle: { alignSelf: "stretch", color: Brand.ink, fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 7 },
  notificationBody: { alignSelf: "stretch", color: Brand.muted, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  projectText: { alignSelf: "stretch", color: Brand.pine, fontSize: 11, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  dateText: { alignSelf: "stretch", color: "#8C816B", fontSize: 10, textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  openIcon: { marginTop: 12 },
  pressed: { opacity: 0.7 },
});
