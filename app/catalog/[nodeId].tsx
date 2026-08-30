import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, EmptyState } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { resolveAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";

type CatalogItem = { id: number; name: string; description: string | null; imageUrl?: string | null; kind: "node" | "product"; isAvailable?: boolean | null; selectionMode?: "multi" | "single" | "view_only"; breadcrumb?: string[] };

function normalizeSelectionMode(value: string | null | undefined): NonNullable<CatalogItem["selectionMode"]> {
  return value === "single" || value === "view_only" ? value : "multi";
}

export default function CatalogNodeScreen() {
  const router = useRouter();
  const { nodeId, serviceId, projectId } = useLocalSearchParams<{ nodeId: string; serviceId: string; projectId?: string }>();
  const id = Number(nodeId);
  const parentServiceId = Number(serviceId);
  const nodesQuery = trpc.catalog.children.useQuery({ serviceId: parentServiceId, parentId: id }, { enabled: Number.isFinite(id) && Number.isFinite(parentServiceId) });
  const productsQuery = trpc.catalog.products.useQuery({ catalogNodeId: id }, { enabled: Number.isFinite(id) });
  const items: CatalogItem[] = [
    ...(nodesQuery.data ?? []).map((item) => ({ id: item.id, name: item.name, description: item.description, imageUrl: item.imageUrl, kind: "node" as const })),
    ...(productsQuery.data ?? []).map((item) => ({ id: item.id, name: item.name, description: item.description, imageUrl: item.mainImageUrl, kind: "product" as const, isAvailable: item.isAvailable, selectionMode: normalizeSelectionMode(item.selectionMode), breadcrumb: item.breadcrumb })),
  ];
  const loading = nodesQuery.isLoading || productsQuery.isLoading;
  const selectionMode = normalizeSelectionMode(productsQuery.data?.[0]?.selectionMode);
  const selectionHint = selectionMode === "view_only" ? "هذه التقسيمة للعرض فقط" : selectionMode === "single" ? "اختر منتجاً واحداً فقط" : "يمكنك اختيار أكثر من منتج";

  return (
    <ScreenContainer className="px-5">
      {loading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          columnWrapperStyle={items.length > 1 ? styles.row : undefined}
          ListHeaderComponent={<View><AppHeader title="الكتالوج" subtitle={selectionHint} onBack={() => router.back()} />{selectionMode !== "multi" ? <View style={[styles.selectionNotice, selectionMode === "view_only" && styles.viewOnlyNotice]}><MaterialIcons name={selectionMode === "view_only" ? "visibility" : "radio-button-checked"} size={17} color={selectionMode === "view_only" ? Brand.muted : Brand.pine} /><Text style={[styles.selectionNoticeText, selectionMode === "view_only" && styles.viewOnlyNoticeText]}>{selectionMode === "view_only" ? "المنتجات هنا متاحة للتصفح فقط، ولا يمكن إضافتها إلى مشروع." : "اختر منتجاً واحداً فقط؛ سيستبدل اختيارك الجديد المنتج السابق من هذه التقسيمة."}</Text></View> : null}</View>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => item.kind === "node" ? router.push({ pathname: "/catalog/[nodeId]", params: { nodeId: String(item.id), serviceId, projectId } } as never) : router.push({ pathname: "/product/[productId]", params: { productId: String(item.id), projectId } } as never)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {item.imageUrl ? <Image source={{ uri: resolveAssetUrl(item.imageUrl) }} style={styles.image} /> : <View style={styles.imageFallback}><MaterialIcons name={item.kind === "node" ? "account-tree" : "chair"} size={30} color={item.kind === "node" ? Brand.pine : Brand.clay} /></View>}
              <View style={styles.shade} />
              {item.kind === "product" && item.isAvailable === false ? <View style={styles.unavailable}><Text style={styles.unavailableText}>غير متاح</Text></View> : item.kind === "product" && item.selectionMode === "view_only" ? <View style={styles.viewOnlyBadge}><Text style={styles.viewOnlyBadgeText}>للعرض فقط</Text></View> : null}
              <View style={styles.copy}>
                <View style={styles.kindRow}><Text style={styles.kind}>{item.kind === "node" ? "تصنيف" : "منتج"}</Text><MaterialIcons name="arrow-back" size={14} color={Brand.pine} /></View>
                <Text numberOfLines={2} style={styles.title}>{item.name}</Text>
                {item.kind === "product" && item.breadcrumb?.length ? <Text numberOfLines={3} style={styles.breadcrumb}>{[...item.breadcrumb, item.name].join(" ← ")}</Text> : <Text numberOfLines={1} style={styles.description}>{item.description || (item.kind === "node" ? "اكتشف التفاصيل" : "تفاصيل المنتج")}</Text>}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="search-off" title="لا توجد عناصر هنا بعد" description="سيظهر هذا القسم عند إضافة فئات أو منتجات إليه." />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 28, paddingTop: 2 },
  row: { justifyContent: "space-between" },
  card: { minHeight: 232, flex: 0.48, backgroundColor: Brand.card, borderRadius: 21, borderWidth: 1, borderColor: Brand.line, overflow: "hidden", marginBottom: 13, position: "relative" },
  image: { width: "100%", height: "100%", position: "absolute" },
  imageFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: "#211B10", alignItems: "center", justifyContent: "center" },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,8,8,0.48)" },
  unavailable: { position: "absolute", top: 10, right: 10, backgroundColor: "#351F1B", borderWidth: 1, borderColor: "#714239", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  unavailableText: { color: Brand.error, fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  viewOnlyBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "#24231F", borderWidth: 1, borderColor: Brand.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  viewOnlyBadgeText: { color: Brand.muted, fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  selectionNotice: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 8, backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5B4B29", borderRadius: 15, padding: 12, marginBottom: 14 },
  viewOnlyNotice: { backgroundColor: "#1C1C1A", borderColor: Brand.line },
  selectionNoticeText: { flex: 1, color: Brand.pine, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  viewOnlyNoticeText: { color: Brand.muted },
  copy: { flex: 1, justifyContent: "flex-end", padding: 13 },
  kindRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  kind: { color: Brand.pine, fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  title: { color: "#FFF9EA", fontSize: 16, fontWeight: "900", lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  description: { color: "#E1D5B8", fontSize: 10, marginTop: 4, textAlign: "right", writingDirection: "rtl" },
  breadcrumb: { color: "#E1D5B8", fontSize: 10, lineHeight: 15, marginTop: 5, textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
