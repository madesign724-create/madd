import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader, Brand, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { getPasswordResetRedirectUri, getRedirectUri, startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { setSessionToken } from "@/lib/_core/auth";
import { supabase } from "@/lib/supabase";

export default function AuthScreen() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailMode, setEmailMode] = useState<"signIn" | "signUp">("signIn");
  const [isResetMode, setIsResetMode] = useState(false);

  const beginGoogleAuth = async () => {
    setIsStarting(true);
    try {
      if (isAuthenticated) await logout();
      await startOAuthLogin({ chooseAccount: true });
    } finally {
      setIsStarting(false);
    }
  };

  const submitEmailAuth = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      Alert.alert("البريد الإلكتروني غير صحيح", "اكتب بريداً إلكترونياً صحيحاً للمتابعة.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("كلمة المرور قصيرة", "اكتب كلمة مرور لا تقل عن 8 أحرف.");
      return;
    }

    setIsStarting(true);
    try {
      if (isAuthenticated) await logout();
      if (emailMode === "signUp") {
        const result = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: getRedirectUri() },
        });
        if (result.error) throw result.error;
        if (!result.data.session) {
          Alert.alert("تحقق من بريدك", "أرسلنا رابط تأكيد إلى بريدك الإلكتروني. افتحه لإكمال إنشاء الحساب.");
          return;
        }
        await setSessionToken(result.data.session.access_token);
      } else {
        const result = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (result.error || !result.data.session) throw result.error ?? new Error("تعذر إنشاء جلسة الحساب.");
        await setSessionToken(result.data.session.access_token);
      }
      router.replace("/(tabs)" as never);
    } catch (error) {
      Alert.alert(
        emailMode === "signUp" ? "تعذر إنشاء الحساب" : "تعذر تسجيل الدخول",
        error instanceof Error ? error.message : "تحقق من البريد وكلمة المرور ثم حاول مرة أخرى.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      Alert.alert("البريد الإلكتروني غير صحيح", "اكتب البريد الإلكتروني المرتبط بحسابك أولاً.");
      return;
    }

    setIsStarting(true);
    try {
      const result = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordResetRedirectUri(),
      });
      if (result.error) throw result.error;
      Alert.alert("تحقق من بريدك", "إذا كان البريد مرتبطاً بحساب MADD، ستصلك رسالة آمنة لإعادة تعيين كلمة المرور.");
      setIsResetMode(false);
    } catch (error) {
      Alert.alert("تعذر إرسال الرابط", error instanceof Error ? error.message : "حاول مرة أخرى بعد قليل.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <ScreenContainer className="px-5">
      <FlatList
        data={[]}
        keyExtractor={() => "auth"}
        renderItem={() => null}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <>
            <AppHeader title="دخول MADD" subtitle="حساب واحد لحفظ المشروعات ومتابعتها" onBack={() => router.back()} />
            <View style={styles.hero}>
              <View style={styles.iconWrap}><MaterialIcons name="account-circle" size={33} color={Brand.pine} /></View>
              <Text style={styles.title}>ابدأ بحساب MADD</Text>
              <Text style={styles.description}>سجّل عبر Google أو ببريدك الإلكتروني لحفظ المشروعات ومتابعة طلباتك بأمان.</Text>
            </View>
              <View style={styles.actions}>
                <View style={styles.emailCard}>
                  {isResetMode ? (
                    <>
                      <Text style={styles.resetTitle}>استعادة كلمة المرور</Text>
                      <Text style={styles.resetDescription}>اكتب بريدك وسنرسل لك رابطاً آمناً لإنشاء كلمة مرور جديدة.</Text>
                      <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                      <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor="#827762" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={styles.emailInput} textAlign="left" returnKeyType="done" onSubmitEditing={() => void requestPasswordReset()} />
                      <PrimaryButton label="إرسال رابط الاستعادة" loading={isStarting} disabled={isStarting} onPress={() => void requestPasswordReset()} />
                      <Pressable onPress={() => setIsResetMode(false)} style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}><Text style={styles.forgotText}>العودة لتسجيل الدخول</Text></Pressable>
                    </>
                  ) : (
                    <>
                      <View style={styles.modeSwitch}>
                        <Pressable onPress={() => setEmailMode("signIn")} style={({ pressed }) => [styles.modeButton, emailMode === "signIn" && styles.modeButtonActive, pressed && styles.pressed]}><Text style={[styles.modeText, emailMode === "signIn" && styles.modeTextActive]}>تسجيل الدخول</Text></Pressable>
                        <Pressable onPress={() => setEmailMode("signUp")} style={({ pressed }) => [styles.modeButton, emailMode === "signUp" && styles.modeButtonActive, pressed && styles.pressed]}><Text style={[styles.modeText, emailMode === "signUp" && styles.modeTextActive]}>إنشاء حساب</Text></Pressable>
                      </View>
                      <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                      <TextInput value={email} onChangeText={setEmail} placeholder="name@example.com" placeholderTextColor="#827762" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={styles.emailInput} textAlign="left" returnKeyType="next" />
                      <Text style={styles.fieldLabel}>كلمة المرور</Text>
                      <TextInput value={password} onChangeText={setPassword} placeholder="8 أحرف أو أكثر" placeholderTextColor="#827762" secureTextEntry autoCapitalize="none" autoCorrect={false} textContentType={emailMode === "signUp" ? "newPassword" : "password"} style={styles.emailInput} textAlign="left" returnKeyType="done" onSubmitEditing={() => void submitEmailAuth()} />
                      {emailMode === "signIn" ? <Pressable onPress={() => setIsResetMode(true)} style={({ pressed }) => [styles.forgotButton, pressed && styles.pressed]}><Text style={styles.forgotText}>نسيت كلمة المرور؟</Text></Pressable> : null}
                      <PrimaryButton label={emailMode === "signUp" ? "إنشاء حساب بالبريد" : "الدخول بالبريد"} loading={isStarting} disabled={isStarting} onPress={() => void submitEmailAuth()} />
                    </>
                  )}
                </View>
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>أو</Text><View style={styles.dividerLine} /></View>
              <SecondaryButton label={isAuthenticated ? "تبديل حساب Google" : "المتابعة مع Google"} loading={isStarting} disabled={isStarting} onPress={() => void beginGoogleAuth()} />
            </View>
            <View style={styles.helpCard}>
              <MaterialIcons name="info-outline" size={19} color={Brand.pine} />
              <Text style={styles.helpText}>عند إنشاء حساب بالبريد، افتح رسالة التأكيد المرسلة إلى بريدك. تبقى لوحة الإدارة مقصورة على المالك وفريقه المخوّل.</Text>
            </View>
            {isAuthenticated ? <SecondaryButton label="العودة إلى حسابي الحالي" onPress={() => router.replace("/account" as never)} style={styles.backAction} /> : null}
          </>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", paddingBottom: 28 },
  hero: { alignItems: "center", backgroundColor: Brand.card, borderWidth: 1, borderColor: "#665529", borderRadius: 25, paddingHorizontal: 23, paddingVertical: 29 },
  iconWrap: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: "#6C572A", backgroundColor: "#211B10" },
  title: { color: Brand.ink, fontSize: 22, fontWeight: "900", marginTop: 16, writingDirection: "rtl", textAlign: "center" },
  description: { color: Brand.muted, fontSize: 14, lineHeight: 22, marginTop: 9, writingDirection: "rtl", textAlign: "center" },
  actions: { gap: 11, marginTop: 20 },
  emailCard: { borderRadius: 19, borderWidth: 1, borderColor: "#4C4025", backgroundColor: "#16140F", padding: 14 },
  modeSwitch: { flexDirection: "row-reverse", borderWidth: 1, borderColor: "#4C4025", borderRadius: 12, padding: 3, marginBottom: 16 },
  modeButton: { flex: 1, alignItems: "center", borderRadius: 9, minHeight: 37, justifyContent: "center" },
  modeButtonActive: { backgroundColor: Brand.pine },
  modeText: { color: Brand.muted, fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  modeTextActive: { color: "#0C0C0C" },
  resetTitle: { color: Brand.ink, fontSize: 17, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginBottom: 5 },
  resetDescription: { color: Brand.muted, fontSize: 12, lineHeight: 19, writingDirection: "rtl", textAlign: "right", marginBottom: 16 },
  fieldLabel: { color: Brand.ink, fontSize: 12, fontWeight: "800", writingDirection: "rtl", textAlign: "right", marginBottom: 7 },
  emailInput: { minHeight: 49, borderRadius: 12, backgroundColor: "#11110F", borderColor: "#4C4025", borderWidth: 1, color: Brand.ink, fontSize: 14, paddingHorizontal: 13, marginBottom: 13, writingDirection: "ltr" },
  divider: { flexDirection: "row", alignItems: "center", gap: 9, marginVertical: 2 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#4C4025" },
  dividerText: { color: Brand.muted, fontSize: 11, writingDirection: "rtl" },
  forgotButton: { alignSelf: "flex-end", paddingVertical: 4, marginTop: -6, marginBottom: 10 },
  forgotText: { color: Brand.pine, fontSize: 12, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  helpCard: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, marginTop: 17, borderRadius: 17, borderWidth: 1, borderColor: "#4C4025", backgroundColor: "#16140F", padding: 14 },
  helpText: { flex: 1, color: Brand.muted, fontSize: 12, lineHeight: 19, writingDirection: "rtl", textAlign: "right" },
  backAction: { marginTop: 14 },
  pressed: { opacity: 0.72 },
});
