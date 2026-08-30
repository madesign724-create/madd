import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { setSessionToken } from "@/lib/_core/auth";
import { consumePendingRoute } from "@/lib/pending-route";
import { completeSupabaseOAuthCallback } from "@/lib/supabase";

type CallbackStatus = "processing" | "error";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("يتم تأمين جلستك والعودة إلى حساب MADD…");

  useEffect(() => {
    let active = true;

    async function completeLogin() {
      try {
        const session = await completeSupabaseOAuthCallback();
        await setSessionToken(session.access_token);
        const pendingRoute = await consumePendingRoute();
        if (active) router.replace((pendingRoute ?? "/(tabs)") as never);
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "تعذر إكمال تسجيل الدخول. حاول مرة أخرى.");
      }
    }

    void completeLogin();
    return () => { active = false; };
  }, [router]);

  return (
    <ScreenContainer className="px-5">
      <View style={styles.content}>
        <AppHeader title="دخول MADD" subtitle="تأكيد الحساب" onBack={() => router.replace("/auth" as never)} />
        <View style={styles.card}>
          <MaterialIcons name={status === "error" ? "error-outline" : "verified-user"} size={37} color={status === "error" ? Brand.error : Brand.pine} />
          <Text style={styles.title}>{status === "error" ? "تعذر تسجيل الدخول" : "جارٍ تأكيد الدخول"}</Text>
          <Text style={styles.message}>{message}</Text>
          {status === "error" ? <PrimaryButton label="العودة إلى الدخول" onPress={() => router.replace("/auth" as never)} style={styles.action} /> : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center" },
  card: { alignItems: "center", borderWidth: 1, borderColor: "#665529", borderRadius: 25, backgroundColor: Brand.card, paddingHorizontal: 24, paddingVertical: 32 },
  title: { color: Brand.ink, fontSize: 21, fontWeight: "900", marginTop: 15, textAlign: "center", writingDirection: "rtl" },
  message: { color: Brand.muted, fontSize: 14, lineHeight: 22, marginTop: 10, textAlign: "center", writingDirection: "rtl" },
  action: { alignSelf: "stretch", marginTop: 22 },
});
