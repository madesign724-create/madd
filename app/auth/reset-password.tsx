import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AppHeader, Brand, PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { setSessionToken } from "@/lib/_core/auth";
import { completeSupabaseRecoveryCallback, supabase } from "@/lib/supabase";

type ScreenStatus = "verifying" | "ready" | "error";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<ScreenStatus>("verifying");
  const [message, setMessage] = useState("يتم التحقق من رابط الاستعادة…");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyRecoveryLink() {
      try {
        const callbackUrl = Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : undefined;
        const session = await completeSupabaseRecoveryCallback(callbackUrl);
        await setSessionToken(session.access_token);
        if (!active) return;
        setStatus("ready");
        setMessage("تم تأكيد رابط الاستعادة. اختر كلمة مرور جديدة لحسابك.");
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "رابط الاستعادة غير صالح أو انتهت صلاحيته.");
      }
    }

    void verifyRecoveryLink();
    return () => { active = false; };
  }, []);

  const savePassword = async () => {
    if (password.length < 8) {
      Alert.alert("كلمة المرور قصيرة", "اكتب كلمة مرور لا تقل عن 8 أحرف.");
      return;
    }
    if (password !== confirmation) {
      Alert.alert("كلمتا المرور غير متطابقتين", "أعد كتابة كلمة المرور نفسها للتأكيد.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      Alert.alert("تم تحديث كلمة المرور", "يمكنك الآن متابعة استخدام حساب MADD بأمان.");
      router.replace("/(tabs)" as never);
    } catch (error) {
      Alert.alert("تعذر تحديث كلمة المرور", error instanceof Error ? error.message : "حاول مرة أخرى من الرابط المرسل إلى بريدك.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="px-5">
      <View style={styles.content}>
        <AppHeader title="استعادة كلمة المرور" subtitle="تأمين حساب MADD" onBack={() => router.replace("/auth" as never)} />
        <View style={styles.card}>
          <MaterialIcons name={status === "error" ? "error-outline" : "lock-reset"} size={38} color={status === "error" ? Brand.error : Brand.pine} />
          <Text style={styles.title}>{status === "error" ? "تعذر فتح رابط الاستعادة" : status === "verifying" ? "جارٍ التحقق" : "كلمة مرور جديدة"}</Text>
          <Text style={styles.message}>{message}</Text>
          {status === "ready" ? (
            <View style={styles.form}>
              <Text style={styles.fieldLabel}>كلمة المرور الجديدة</Text>
              <TextInput value={password} onChangeText={setPassword} placeholder="8 أحرف أو أكثر" placeholderTextColor="#827762" secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" style={styles.input} textAlign="left" returnKeyType="next" />
              <Text style={styles.fieldLabel}>تأكيد كلمة المرور</Text>
              <TextInput value={confirmation} onChangeText={setConfirmation} placeholder="أعد كتابة كلمة المرور" placeholderTextColor="#827762" secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType="newPassword" style={styles.input} textAlign="left" returnKeyType="done" onSubmitEditing={() => void savePassword()} />
              <PrimaryButton label="حفظ كلمة المرور الجديدة" loading={isSaving} disabled={isSaving} onPress={() => void savePassword()} />
            </View>
          ) : null}
          {status === "error" ? <Pressable onPress={() => router.replace("/auth" as never)} style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}><Text style={styles.returnText}>طلب رابط جديد</Text></Pressable> : null}
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
  form: { alignSelf: "stretch", marginTop: 22 },
  fieldLabel: { color: Brand.ink, fontSize: 12, fontWeight: "800", writingDirection: "rtl", textAlign: "right", marginBottom: 7 },
  input: { minHeight: 49, borderRadius: 12, backgroundColor: "#11110F", borderColor: "#4C4025", borderWidth: 1, color: Brand.ink, fontSize: 14, paddingHorizontal: 13, marginBottom: 13, writingDirection: "ltr" },
  returnButton: { marginTop: 20, paddingVertical: 5 },
  returnText: { color: Brand.pine, fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
