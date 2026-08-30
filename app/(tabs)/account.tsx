import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader, Brand, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, loading, logout } = useAuth();
  const profileQuery = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const adminQuery = trpc.admin.me.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const saveMutation = trpc.profile.save.useMutation({ onSuccess: () => { void utils.profile.get.invalidate(); Alert.alert("تم الحفظ", "حُدّثت بيانات حسابك."); } });
  useEffect(() => {
    if (!profileQuery.data) return;
    setName(profileQuery.data.fullName || "");
    setPhone(profileQuery.data.phone || "");
  }, [profileQuery.data?.fullName, profileQuery.data?.phone]);
  if (loading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-5"><ScrollView showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><AppHeader title="حسابي" /><View style={styles.guestCard}><View style={styles.avatar}><MaterialIcons name="person-outline" size={32} color={Brand.pine} /></View><Text style={styles.guestKicker}>حساب MADD</Text><Text style={styles.guestTitle}>أهلاً بك في مساحة تفاصيلك.</Text><Text style={styles.guestText}>التصفح متاح للجميع. نحتاج حسابك فقط لحفظ مشروعك ومتابعة طلبك.</Text><PrimaryButton label="إنشاء حساب أو تسجيل الدخول" onPress={() => router.push("/auth" as never)} style={styles.action} /><SecondaryButton label="سياسة الخصوصية" onPress={() => router.push("/privacy" as never)} style={styles.policy} /></View></ScrollView></ScreenContainer>;
  const displayedName = profileQuery.data?.fullName || user?.name || "عميل MADD";
  const saveProfile = () => {
    if (!phone.trim()) { Alert.alert("رقم الجوال مطلوب", "أضف رقم جوالك أولاً حتى تتمكن من إنشاء مشروع جديد."); return; }
    saveMutation.mutate({ fullName: name.trim() || undefined, phone: phone.trim() });
  };
  return <ScreenContainer className="px-5"><ScrollView showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><AppHeader title="حسابي" subtitle="بياناتك ومساحة عملك" /><View style={styles.profileCard}><View style={styles.profileAccent} /><View style={styles.avatar}><Text style={styles.avatarLetter}>{displayedName.charAt(0)}</Text></View><Text style={styles.name}>{displayedName}</Text><Text style={styles.email}>{user?.email || "حساب مسجل"}</Text>{adminQuery.data?.isAdmin ? <View style={styles.adminBadge}><MaterialIcons name="verified-user" size={13} color="#0C0C0C" /><Text style={styles.adminBadgeText}>حساب إداري</Text></View> : null}</View><View style={styles.phoneRequirement}><MaterialIcons name="phone-iphone" size={19} color={Brand.pine} /><View style={styles.phoneRequirementCopy}><Text style={styles.phoneRequirementTitle}>رقم الجوال مطلوب لإنشاء مشروع جديد</Text><Text style={styles.phoneRequirementText}>لا نطلب رمز تحقق؛ فقط احفظ رقماً صالحاً للتواصل معك حول مشروعك.</Text></View></View><View style={styles.formCard}><Text style={styles.formTitle}>معلومات التواصل</Text><Field label="الاسم" placeholder={displayedName} value={name} onChangeText={setName} /><Field label="رقم الجوال *" placeholder="أضف رقم جوالك للتواصل" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View><PrimaryButton label="حفظ البيانات" loading={saveMutation.isPending} onPress={saveProfile} style={styles.action} />{adminQuery.data?.isAdmin ? <SecondaryButton label="فتح لوحة الإدارة" onPress={() => router.push("/admin" as never)} style={styles.admin} /> : null}<SecondaryButton label="سياسة الخصوصية" onPress={() => router.push("/privacy" as never)} style={styles.policy} /><SecondaryButton label="طلب حذف الحساب" onPress={() => router.push("/delete-account" as never)} style={styles.policy} /><SecondaryButton label="استخدام حساب مختلف" onPress={() => router.push("/auth" as never)} style={styles.switchAccount} /><Pressable onPress={() => void logout()} style={({ pressed }) => [styles.logout, pressed && styles.pressed]}><MaterialIcons name="logout" color={Brand.error} size={18} /><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable></ScrollView></ScreenContainer>;
}

function Field({ label, placeholder, value, onChangeText, keyboardType }: { label: string; placeholder: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "phone-pad" }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput placeholder={placeholder} placeholderTextColor="#827762" value={value} keyboardType={keyboardType} onChangeText={onChangeText} style={styles.input} textAlign="right" /></View>;
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 28 },
  guestCard: { alignItems: "center", padding: 27, borderRadius: 25, borderWidth: 1, borderColor: "#665529", backgroundColor: Brand.card, marginTop: 20 },
  profileCard: { alignItems: "center", overflow: "hidden", padding: 23, borderRadius: 25, borderWidth: 1, borderColor: "#665529", backgroundColor: Brand.card, marginBottom: 18, position: "relative" },
  profileAccent: { position: "absolute", width: 260, height: 80, borderRadius: 130, backgroundColor: "#332911", opacity: 0.8, top: -46 },
  avatar: { width: 68, height: 68, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#211B10", borderWidth: 1, borderColor: Brand.pine, zIndex: 1 },
  avatarLetter: { color: Brand.pine, fontSize: 25, fontWeight: "900", writingDirection: "rtl" },
  guestKicker: { color: Brand.pine, fontSize: 11, fontWeight: "900", marginTop: 15, writingDirection: "rtl" },
  guestTitle: { color: Brand.ink, fontSize: 21, fontWeight: "900", marginTop: 5, writingDirection: "rtl" },
  guestText: { color: Brand.muted, fontSize: 14, lineHeight: 22, textAlign: "center", marginTop: 8, writingDirection: "rtl" },
  name: { color: Brand.ink, fontSize: 19, fontWeight: "900", marginTop: 12, writingDirection: "rtl" },
  email: { color: Brand.muted, fontSize: 12, marginTop: 5 },
  adminBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 5, backgroundColor: Brand.pine, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 12 },
  adminBadgeText: { color: "#0C0C0C", fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  formCard: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 21, padding: 16 },
  phoneRequirement: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: "#665529", backgroundColor: "#211B10", borderRadius: 17, padding: 13, marginBottom: 14 },
  phoneRequirementCopy: { flex: 1, alignItems: "flex-end" },
  phoneRequirementTitle: { color: Brand.ink, fontSize: 12, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  phoneRequirementText: { color: Brand.muted, fontSize: 11, lineHeight: 17, writingDirection: "rtl", textAlign: "right", marginTop: 3 },
  formTitle: { color: Brand.ink, fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 15 },
  field: { marginBottom: 14 },
  label: { color: Brand.ink, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 7 },
  input: { minHeight: 51, borderRadius: 13, backgroundColor: "#11110F", borderColor: "#4C4025", borderWidth: 1, color: Brand.ink, fontSize: 14, paddingHorizontal: 13, writingDirection: "rtl" },
  action: { marginTop: 18 },
  policy: { marginTop: 11 },
  admin: { marginTop: 11 },
  switchAccount: { marginTop: 11 },
  logout: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 50, borderWidth: 1, borderColor: "#74453C", backgroundColor: "#241717", borderRadius: 15, marginTop: 11 },
  logoutText: { color: Brand.error, fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
