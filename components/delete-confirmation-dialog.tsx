import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Brand, PrimaryButton, SecondaryButton } from "@/components/app-ui";

type DeleteConfirmationDialogProps = {
  visible: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** نافذة تأكيد مرئية موحدة للحذف، تعمل أيضاً عند فتح التطبيق عبر المتصفح. */
export function DeleteConfirmationDialog({
  visible,
  title,
  description,
  confirmLabel,
  loading = false,
  onCancel,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="إغلاق تأكيد الحذف" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.iconWrap}>
            <MaterialIcons name="delete-outline" size={28} color={Brand.error} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.actions}>
            <SecondaryButton label="إلغاء" disabled={loading} onPress={onCancel} style={styles.action} />
            <PrimaryButton label={confirmLabel} loading={loading} onPress={onConfirm} style={styles.action} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.7)" },
  dialog: { width: "100%", maxWidth: 410, borderRadius: 24, borderWidth: 1, borderColor: "#8B4540", padding: 20, backgroundColor: Brand.card },
  iconWrap: { width: 54, height: 54, alignItems: "center", justifyContent: "center", alignSelf: "center", borderRadius: 27, borderWidth: 1, borderColor: "#8B4540", backgroundColor: "#2B1717", marginBottom: 13 },
  title: { color: Brand.ink, fontSize: 18, fontWeight: "900", textAlign: "center", writingDirection: "rtl" },
  description: { color: Brand.muted, fontSize: 13, lineHeight: 20, textAlign: "center", writingDirection: "rtl", marginTop: 9 },
  actions: { flexDirection: "row-reverse", gap: 10, marginTop: 20 },
  action: { flex: 1 },
});
