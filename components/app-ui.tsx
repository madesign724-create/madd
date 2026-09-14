import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export const Brand = {
  pine: "#C7A34A",
  ink: "#F5F0E5",
  muted: "#B8AF9A",
  clay: "#A77D2B",
  canvas: "#0C0C0C",
  card: "#171717",
  line: "#3A3326",
  paleGreen: "#292517",
  paleClay: "#241D14",
  success: "#88B78B",
  warning: "#D6B55B",
  error: "#E07A6A",
};

export function AppHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {right != null && typeof right !== "string" ? right : null}
        {typeof right === "string" && right.length > 0 ? (
          <Text style={styles.headerSubtitle}>{right}</Text>
        ) : null}
      </View>
      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && typeof subtitle === "string" && subtitle.trim().length > 0 ? (
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.headerSide}>
        {Boolean(onBack) && (
          <Pressable
            accessibilityLabel="رجوع"
            onPress={onBack}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <MaterialIcons name="arrow-forward" size={22} color={Brand.ink} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function PrimaryButton({ label, onPress, loading = false, disabled = false, style }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.disabled, pressed && styles.primaryPressed, style]}
    >
      {loading ? <ActivityIndicator color="#0C0C0C" /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, loading = false, disabled = false, style }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, (disabled || loading) && styles.disabled, pressed && styles.pressed, style]}>
      {loading ? <ActivityIndicator color={Brand.pine} /> : <Text style={styles.secondaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: keyof typeof MaterialIcons.glyphMap; title: string; description: string; action?: ReactNode }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><MaterialIcons name={icon} size={28} color={Brand.pine} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; background: string }> = {
    draft: { label: "مسودة", color: Brand.warning, background: "#2B2519" },
    submitted: { label: "تم الإرسال", color: Brand.pine, background: Brand.paleGreen },
    under_review: { label: "قيد المراجعة", color: Brand.pine, background: Brand.paleGreen },
    locked: { label: "مقفل للمراجعة", color: Brand.pine, background: Brand.paleGreen },
    in_progress: { label: "قيد التنفيذ", color: Brand.pine, background: Brand.paleGreen },
    completed: { label: "مكتمل", color: Brand.success, background: "#203125" },
    cancelled: { label: "ملغى", color: "#E07A6A", background: "#351F1B" },
  };
  const current = map[status] ?? { label: status, color: Brand.muted, background: "#EEF0ED" };
  return <View style={[styles.statusPill, { backgroundColor: current.background }]}><Text style={[styles.statusText, { color: current.color }]}>{current.label}</Text></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row-reverse", alignItems: "center", minHeight: 58, marginBottom: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line },
  headerSide: { width: 44, alignItems: "center" },
  headerTitleWrap: { flex: 1, alignItems: "center" },
  headerTitle: { color: Brand.ink, fontSize: 19, fontWeight: "800", writingDirection: "rtl", textAlign: "center", letterSpacing: 0.1 },
  headerSubtitle: { color: Brand.muted, fontSize: 11, marginTop: 3, writingDirection: "rtl", textAlign: "center" },
  iconButton: { width: 40, height: 40, borderWidth: 1, borderColor: "#5B4B29", borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#11110F" },
  primaryButton: { minHeight: 54, backgroundColor: Brand.pine, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, borderWidth: 1, borderColor: "#E1C36D", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryButtonText: { color: "#0C0C0C", fontSize: 16, fontWeight: "900", writingDirection: "rtl" },
  secondaryButton: { minHeight: 52, borderWidth: 1, borderColor: "#6C572A", borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, backgroundColor: "#12120F" },
  secondaryButtonText: { color: Brand.pine, fontSize: 15, fontWeight: "700", writingDirection: "rtl" },
  primaryPressed: { transform: [{ scale: 0.97 }], opacity: 0.94 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.5 },
  emptyState: { alignItems: "center", backgroundColor: Brand.card, borderRadius: 22, padding: 28, borderWidth: 1, borderColor: "#5B4B29", marginTop: 20 },
  emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: "#211C12", borderWidth: 1, borderColor: "#6C572A", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: Brand.ink, fontSize: 17, fontWeight: "700", textAlign: "center", writingDirection: "rtl" },
  emptyDescription: { color: Brand.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, writingDirection: "rtl" },
  emptyAction: { alignSelf: "stretch", marginTop: 18 },
  statusPill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: "700", writingDirection: "rtl" },
});