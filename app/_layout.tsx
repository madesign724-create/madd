import { Platform, Pressable, StyleSheet, Text, View, I18nManager } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { useAuth } from "@/hooks/use-auth";
import { PhoneSetupDialog } from "@/components/phone-setup-dialog";
import { Brand } from "@/components/app-ui";

// فرض اتجاه اليمين لليسار دائماً
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// استدعاء ملف CSS فقط على الويب
if (Platform.OS === "web") {
  require("@/global.css");
}

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };
type ProjectNotificationKind = "pricing_ready" | "project_completed";
type ForpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63 = { kind: ProjectNotificationKind; projectId: number; title: string; body: string };

// تفعيل معالج الإشعارات فقط خارج بيئة Expo Go لتجنب استثناءات SDK 54
const isExpoGo = Constants.appOwnership === "expo";
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function NotificationCoordinator() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const registerToken = trpc.devices.registerPushToken.useMutation();
  const insets = useSafeAreaInsets();
  const [foregroundNotification, setForegroundNotification] = useState<ForpZEAWYtiB6bJ16NuLbGCc6CZ6jJdKfb63 | null>(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web" || isExpoGo) return;
    let active = true;
    async function registerForProjectUpdates() {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("project-updates", {
            name: "تحديثات المشروعات",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 180, 250],
            lightColor: "#1F5B4E",
          });
        }
        const current = await Notifications.getPermissionsAsync();
        const finalStatus = current.status === "granted" ? current.status : (await Notifications.requestPermissionsAsync()).status;
        if (finalStatus !== "granted") return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) return;
        const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (active && (Platform.OS === "ios" || Platform.OS === "android")) registerToken.mutate({ expoPushToken, platform: Platform.OS });
      } catch (error) {
        console.warn("[Notifications] Device registration skipped:", error);
      }
    }
    void registerForProjectUpdates();
    return () => { active = false; };
  }, [isAuthenticated, registerToken]);

  useEffect(() => {
    if (Platform.OS === "web" || isExpoGo) return;
    const redirectToProject = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (typeof url === "string" && /^\/project\/\d+$/.test(url)) router.push(url as never);
    };
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse?.notification) redirectToProject(lastResponse.notification);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => redirectToProject(response.notification));
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === "web" || isExpoGo) {
      setForegroundNotification(null);
      return;
    }
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      const kind = data?.notificationKind;
      const projectId = data?.projectId;
      if ((kind !== "pricing_ready" && kind !== "project_completed") || typeof projectId !== "number") return;
      setForegroundNotification({
        kind,
        projectId,
        title: typeof data.title === "string" ? data.title : notification.request.content.title ?? "تحديث مشروع MADD",
        body: typeof data.body === "string" ? data.body : notification.request.content.body ?? "لديك تحديث جديد على مشروعك.",
      });
    });
    return () => subscription.remove();
  }, [isAuthenticated]);

  if (!foregroundNotification) return null;
  const handleOpenProject = () => {
    router.push(`/project/${foregroundNotification.projectId}` as never);
    setForegroundNotification(null);
  };
  const eyebrow = foregroundNotification.kind === "pricing_ready" ? "التسعير جاهز للمراجعة" : "اكتمل مشروعك";
  return (
    <View pointerEvents="box-none" style={[styles.notificationHost, { top: insets.top + 12 }]}>
      <View style={styles.notificationBanner} accessibilityLiveRegion="polite">
        <Text style={styles.notificationEyebrow}>{eyebrow}</Text>
        <Text style={styles.notificationTitle}>{foregroundNotification.title}</Text>
        <Text style={styles.notificationBody} numberOfLines={3}>{foregroundNotification.body}</Text>
        <View style={styles.notificationActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="إخفاء الإشعار" onPress={() => setForegroundNotification(null)} style={({ pressed }) => [styles.notificationDismiss, pressed && styles.notificationPressed]}><Text style={styles.notificationDismissText}>إخفاء</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="عرض المشروع" onPress={handleOpenProject} style={({ pressed }) => [styles.notificationOpen, pressed && styles.notificationPressed]}><Text style={styles.notificationOpenText}>عرض المشروع</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  const content = (
    <GestureHandlerRootView style={styles.rootView}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <NotificationCoordinator />
          <PhoneSetupDialog />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth/callback" />
            <Stack.Screen name="auth/reset-password" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="delete-account" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
        {content}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  rootView: {
    flex: 1,
    direction: "rtl",
  },
  notificationHost: { position: "absolute", left: 12, right: 12, zIndex: 100, elevation: 100 },
  notificationBanner: { backgroundColor: Brand.card, borderColor: Brand.pine, borderWidth: 1, borderRadius: 18, padding: 15, shadowColor: "#000", shadowOpacity: 0.36, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 12 },
  notificationEyebrow: { color: Brand.pine, fontSize: 11, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 4 },
  notificationTitle: { color: Brand.ink, fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl", lineHeight: 22 },
  notificationBody: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", lineHeight: 19, marginTop: 5 },
  notificationActions: { flexDirection: "row-reverse", gap: 8, marginTop: 13 },
  notificationOpen: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: Brand.pine, paddingHorizontal: 12 },
  notificationOpenText: { color: Brand.canvas, fontSize: 12, fontWeight: "900", writingDirection: "rtl" },
  notificationDismiss: { minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 11, borderColor: Brand.line, borderWidth: 1, paddingHorizontal: 14 },
  notificationDismissText: { color: Brand.ink, fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  notificationPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
});