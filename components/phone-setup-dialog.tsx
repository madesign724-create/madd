import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { Brand, PrimaryButton } from "@/components/app-ui";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

/**
 * يحافظ على شاشة العميل الحالية ويطلب رقم التواصل مرة واحدة فقط بعد الدخول.
 * إغلاق النافذة غير متاح قبل الحفظ لأن الرقم شرط لإنشاء المشاريع والتواصل بشأنها.
 */
export function PhoneSetupDialog() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const profileQuery = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  const [phone, setPhone] = useState("");
  const saveMutation = trpc.profile.save.useMutation({
    onSuccess: async () => {
      await utils.profile.get.invalidate();
    },
    onError: (error) => Alert.alert("تعذر حفظ الرقم", error.message || "حاول مرة أخرى."),
  });

  useEffect(() => {
    setPhone(profileQuery.data?.phone || "");
  }, [profileQuery.data?.phone]);

  const needsPhone = isAuthenticated && !profileQuery.isLoading && !profileQuery.data?.phone?.trim();
  const savePhone = () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      Alert.alert("رقم الجوال مطلوب", "أضف رقم جوالك لنحفظ مشروعك ونتواصل معك بشأنه.");
      return;
    }
    saveMutation.mutate({
      fullName: profileQuery.data?.fullName || user?.name || undefined,
      phone: normalizedPhone,
    });
  };

  return (
    <Modal visible={needsPhone} transparent animationType="fade" onRequestClose={() => undefined} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}><MaterialIcons name="phone-iphone" size={28} color={Brand.pine} /></View>
          <Text style={styles.kicker}>حساب MADD</Text>
          <Text style={styles.title}>أضف رقم جوالك للمتابعة</Text>
          <Text style={styles.description}>هذه خطوة سريعة لمرة واحدة فقط. ستبقى في نفس الصفحة، ولن تفقد أي مشروع أو اختيار بدأت به.</Text>
          <Text style={styles.label}>رقم الجوال *</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="أضف رقم جوالك للتواصل"
            placeholderTextColor="#827762"
            keyboardType="phone-pad"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={savePhone}
            textAlign="right"
            style={styles.input}
          />
          <PrimaryButton label="حفظ والمتابعة" loading={saveMutation.isPending} onPress={savePhone} style={styles.action} />
          <Text style={styles.note}>لا نطلب رمز تحقق عبر الرسائل.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0, 0, 0, 0.76)" },
  card: { borderRadius: 25, borderWidth: 1, borderColor: "#6C572A", backgroundColor: Brand.card, padding: 22, elevation: 10 },
  iconWrap: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", alignSelf: "center", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#6C572A" },
  kicker: { color: Brand.pine, fontSize: 11, fontWeight: "900", textAlign: "center", writingDirection: "rtl", marginTop: 14 },
  title: { color: Brand.ink, fontSize: 21, fontWeight: "900", textAlign: "center", writingDirection: "rtl", marginTop: 5 },
  description: { color: Brand.muted, fontSize: 13, lineHeight: 21, textAlign: "center", writingDirection: "rtl", marginTop: 8 },
  label: { color: Brand.ink, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 20, marginBottom: 7 },
  input: { minHeight: 52, borderRadius: 14, backgroundColor: "#11110F", borderColor: "#4C4025", borderWidth: 1, color: Brand.ink, fontSize: 15, paddingHorizontal: 14, writingDirection: "rtl" },
  action: { marginTop: 16 },
  note: { color: Brand.muted, fontSize: 11, textAlign: "center", writingDirection: "rtl", marginTop: 12 },
});
