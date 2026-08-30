import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, EmptyState, PrimaryButton, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { startOAuthLogin } from "@/constants/oauth";
import { savePendingRoute } from "@/lib/pending-route";

export default function ProjectsScreen() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated });
  const projects = projectsQuery.data ?? [];
  const continueToProjects = async () => { await savePendingRoute("/(tabs)/projects"); await startOAuthLogin(); };
  if (loading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-5"><FlatList data={[]} keyExtractor={() => "guest"} renderItem={() => null} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={<><AppHeader title="مشاريعي" subtitle="سجّل الدخول لحفظ مشروعك" /><EmptyState icon="lock-outline" title="مشروعك يبدأ بحسابك" description="تصفح الخدمات كزائر، ثم سجّل الدخول عندما تريد حفظ مشروع أو اختيار منتج." action={<PrimaryButton label="تسجيل الدخول" onPress={() => void continueToProjects()} />} /></>} />;</ScreenContainer>;
  if (projectsQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  return <ScreenContainer className="px-5"><FlatList data={projects} keyExtractor={(item) => String(item.id)} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={<><AppHeader title="مشاريعي" subtitle="تابع التفاصيل مرحلةً بمرحلة" />{projects.length > 0 ? <View style={styles.intro}><Text style={styles.kicker}>مساحة العمل الخاصة بك</Text><Text style={styles.introTitle}>كل مشروع، من الرؤية إلى الإنجاز.</Text></View> : null}</>} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: "/project/[projectId]", params: { projectId: String(item.id) } } as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}><View style={styles.cardTop}><StatusPill status={item.status} /><View style={styles.projectIcon}><MaterialIcons name="home-work" size={22} color={Brand.pine} /></View></View><Text style={styles.projectTitle}>{item.title}</Text><Text style={styles.projectMeta}>{[item.propertyType, item.city].filter(Boolean).join(" · ") || "تفاصيل المشروع بانتظار الإكمال"}</Text><View style={styles.cardRule} /><View style={styles.cardFooter}><Text style={styles.openText}>فتح مساحة المشروع</Text><MaterialIcons name="arrow-back" size={16} color={Brand.pine} /></View></Pressable>} ListEmptyComponent={<EmptyState icon="folder-open" title="لا توجد مشاريع بعد" description="أنشئ مسودة بسيطة، ثم اختر الخدمات والمنتجات التي تناسبك." action={<PrimaryButton label="إنشاء مشروع" onPress={() => router.push("/create-project" as never)} />} />} ListFooterComponent={projects.length > 0 ? <PrimaryButton label="إنشاء مشروع جديد" onPress={() => router.push("/create-project" as never)} style={styles.newButton} /> : null} /></ScreenContainer>;
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 28 },
  intro: { alignItems: "flex-end", paddingBottom: 17, marginBottom: 6 },
  kicker: { color: Brand.pine, fontSize: 11, fontWeight: "900", writingDirection: "rtl" },
  introTitle: { color: Brand.ink, fontSize: 23, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  card: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 22, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  projectIcon: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: "#645126", backgroundColor: "#211B10", alignItems: "center", justifyContent: "center" },
  projectTitle: { color: Brand.ink, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 15 },
  projectMeta: { color: Brand.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  cardRule: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.line, marginTop: 15 },
  cardFooter: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 12 },
  openText: { color: Brand.pine, fontSize: 12, fontWeight: "900", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
  newButton: { marginTop: 5 },
});
