import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader, Brand, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";

const supportEmail = "madesign724@gmail.com";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const openRequest = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      Alert.alert("أدخل البريد المسجل", "اكتب البريد الإلكتروني المرتبط بحساب MADD حتى نتمكن من التحقق من ملكية الطلب.");
      return;
    }
    const subject = "طلب حذف حساب MADD";
    const body = `أرغب في حذف حساب MADD والبيانات المرتبطة به.\n\nالبريد المسجل: ${normalizedEmail}\n\nأؤكد أنني صاحب الحساب.`;
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("تعذر فتح البريد", `أرسل طلبك يدوياً إلى ${supportEmail} من البريد المسجل في حسابك.`);
    }
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardShouldPersistTaps="handled">
        <AppHeader title="طلب حذف الحساب" subtitle="إدارة بياناتك" onBack={() => router.back()} />
        <View style={styles.card}>
          <Text style={styles.title}>هل تريد حذف حسابك؟</Text>
          <Text style={styles.body}>سنرسل طلبك إلى فريق MADD للتحقق من ملكية الحساب ثم حذف الحساب والبيانات المرتبطة به خلال 30 يوماً، ما لم يلزم الاحتفاظ بجزء من السجلات بموجب القانون.</Text>
          <Text style={styles.label}>البريد الإلكتروني المسجل</Text>
          <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="name@example.com" placeholderTextColor="#827762" style={styles.input} textAlign="left" />
          <PrimaryButton label="فتح رسالة طلب الحذف" onPress={openRequest} style={styles.action} />
          <SecondaryButton label="العودة إلى سياسة الخصوصية" onPress={() => router.replace("/privacy" as never)} style={styles.actionSecondary} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 },
  card: { backgroundColor: Brand.card, borderColor: "#665529", borderWidth: 1, borderRadius: 22, padding: 18 },
  title: { color: Brand.ink, fontSize: 20, fontWeight: "900", textAlign: "right", writingDirection: "rtl", alignSelf: "stretch" },
  body: { color: Brand.muted, fontSize: 13, lineHeight: 21, textAlign: "right", writingDirection: "rtl", alignSelf: "stretch", marginTop: 9 },
  label: { color: Brand.ink, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl", alignSelf: "stretch", marginTop: 18, marginBottom: 7 },
  input: { minHeight: 51, borderRadius: 13, backgroundColor: "#11110F", borderColor: "#4C4025", borderWidth: 1, color: Brand.ink, fontSize: 14, paddingHorizontal: 13, writingDirection: "ltr" },
  action: { marginTop: 15 },
  actionSecondary: { marginTop: 10 },
});
