import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, EmptyState } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { resolveAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";

export default function ServiceDetailScreen() {
  const router = useRouter();
  const { serviceId, projectId } = useLocalSearchParams<{ serviceId: string; projectId?: string }>();
  const id = Number(serviceId);
  const servicesQuery = trpc.catalog.services.useQuery();
  const nodesQuery = trpc.catalog.children.useQuery({ serviceId: id }, { enabled: Number.isFinite(id) });
  const service = (servicesQuery.data ?? []).find((item) => item.id === id);
  const nodes = nodesQuery.data ?? [];

  return (
    <ScreenContainer className="px-5">
      {nodesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : (
        <FlatList
          data={nodes}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          style={styles.flatList}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <><AppHeader title={service?.name || "تفاصيل الخدمة"} subtitle="اختر الفئة المناسبة لمشروعك" onBack={() => router.back()} /><View style={styles.hero}>
              {service?.imageUrl ? <Image source={{ uri: resolveAssetUrl(service.imageUrl) }} style={styles.heroImage} /> : <View style={styles.heroFallback}><MaterialIcons name="architecture" size={38} color={Brand.pine} /></View>}
              <View style={styles.heroShade} />
              <View style={styles.heroCopy}><Text style={styles.heroKicker}>تفاصيل تشبه رؤيتك</Text><Text style={styles.heroTitle}>{service?.name || "خدمة MADD"}</Text><Text numberOfLines={2} style={styles.heroDescription}>{service?.description || "ابدأ من الفئة المناسبة ثم استكشف المنتجات والاختيارات المتاحة."}</Text></View>
            </View></>
          }
          renderItem={({ item, index }) => (
            <Pressable onPress={() => router.push({ pathname: "/catalog/[nodeId]", params: { nodeId: String(item.id), serviceId: String(id), projectId } } as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.indexBadge}><Text style={styles.indexText}>{String(index + 1).padStart(2, "0")}</Text></View>
              <View style={styles.copy}><Text style={styles.title}>{item.name}</Text><Text numberOfLines={2} style={styles.description}>{item.description || "تابع لاكتشاف الخيارات المتاحة."}</Text></View>
              {item.imageUrl ? <Image source={{ uri: resolveAssetUrl(item.imageUrl) }} style={styles.nodeImage} /> : <View style={styles.nodeIcon}><MaterialIcons name="category" size={23} color={Brand.pine} /></View>}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="inventory-2" title="لا توجد فئات منشورة" description="يضيف فريق الإدارة فئات هذه الخدمة قريباً." />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  flatList: { },
  list: { paddingBottom: 28 },
  hero: { height: 190, marginBottom: 18, borderRadius: 23, overflow: "hidden", position: "relative", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#665529" },
  heroImage: { width: "100%", height: "100%", position: "absolute" },
  heroFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#211B10" },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(7,7,6,0.48)" },
  heroCopy: { flex: 1, alignSelf: "stretch", alignItems: "flex-end", justifyContent: "flex-end", padding: 19 },
  heroKicker: { alignSelf: "stretch", color: Brand.pine, fontSize: 11, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  heroTitle: { alignSelf: "stretch", color: "#FFF9EA", fontSize: 24, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginTop: 4 },
  heroDescription: { alignSelf: "stretch", color: "#E2D8BD", fontSize: 12, lineHeight: 18, writingDirection: "rtl", textAlign: "right", marginTop: 6, maxWidth: "87%" },
  card: { minHeight: 87, flexDirection: "row-reverse", alignItems: "center", backgroundColor: Brand.card, borderRadius: 19, borderWidth: 1, borderColor: Brand.line, padding: 12, marginBottom: 10, gap: 11 },
  nodeImage: { width: 58, height: 58, borderRadius: 14 },
  nodeIcon: { width: 58, height: 58, borderRadius: 14, backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5A4A25", alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, alignSelf: "stretch", alignItems: "flex-end", justifyContent: "center" },
  title: { alignSelf: "stretch", color: Brand.ink, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  description: { alignSelf: "stretch", color: Brand.muted, fontSize: 12, lineHeight: 18, marginTop: 4, writingDirection: "rtl", textAlign: "right" },
  indexBadge: { width: 27, alignItems: "center" },
  indexText: { color: Brand.pine, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, writingDirection: "ltr", textAlign: "center" },
  pressed: { opacity: 0.72 },
});
