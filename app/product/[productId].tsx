import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, EmptyState, PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { resolveAssetUrl } from "@/lib/asset-url";
import { savePendingRoute } from "@/lib/pending-route";
import { trpc } from "@/lib/trpc";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { productId, projectId } = useLocalSearchParams<{ productId: string; projectId?: string }>();
  const id = Number(productId);
  const { isAuthenticated } = useAuth();
  const productQuery = trpc.catalog.product.useQuery({ productId: id }, { enabled: Number.isFinite(id) });
  const projectsQuery = trpc.projects.list.useQuery(undefined, { enabled: isAuthenticated && !projectId });
  const utils = trpc.useUtils();
  const addMutation = trpc.projects.addSelection.useMutation({
    onSuccess: (_, variables) => { void utils.projects.get.invalidate({ projectId: variables.projectId }); Alert.alert(product?.selectionMode === "single" ? "تم تحديث الاختيار" : "تمت الإضافة", product?.selectionMode === "single" ? "حُفظ المنتج الجديد واستُبدل أي اختيار سابق من هذه التقسيمة." : "حُفظ الاختيار داخل مشروعك."); router.replace({ pathname: "/project/[projectId]", params: { projectId: String(variables.projectId) } } as never); },
    onError: (error) => Alert.alert("تعذر حفظ الاختيار", error.message),
  });
  const product = productQuery.data;
  const draftProjects = (projectsQuery.data ?? []).filter((project) => project.status === "draft");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const addToProject = async (targetProjectId: number) => { if (product?.selectionMode === "view_only") { Alert.alert("للعرض فقط", "لا يمكن إضافة منتجات هذه التقسيمة إلى المشروع."); return; } if (!isAuthenticated) { await savePendingRoute(`/product/${productId}${projectId ? `?projectId=${projectId}` : ""}`); await startOAuthLogin(); return; } addMutation.mutate({ projectId: targetProjectId, productId: id }); };

  if (productQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  if (!product) return <ScreenContainer className="px-5"><ScrollView showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><AppHeader title="المنتج" onBack={() => router.back()} /><EmptyState icon="search-off" title="المنتج غير متاح" description="قد يكون المنتج أزيل أو لم يعد منشوراً." /></ScrollView></ScreenContainer>;
  const galleryImageUrls = product.imageUrls.map(resolveAssetUrl);

  const productAction = () => {
    if (product.selectionMode === "view_only") return <View style={styles.viewOnlyCard}><MaterialIcons name="visibility" size={21} color={Brand.muted} /><Text style={styles.viewOnlyText}>هذا المنتج للعرض فقط ولا يمكن إضافته إلى المشروع.</Text></View>;
    if (projectId && product.isAvailable) return <PrimaryButton label={product.selectionMode === "single" ? "اختيار هذا المنتج بدلاً من السابق" : "إضافة إلى هذا المشروع"} loading={addMutation.isPending} onPress={() => void addToProject(Number(projectId))} style={styles.action} />;
    if (!isAuthenticated) return <PrimaryButton label="سجّل الدخول لحفظ اختيارك" onPress={() => void addToProject(0)} style={styles.action} />;
    if (!product.isAvailable) return null;
    return <View style={styles.drafts}><Text style={styles.draftsTitle}>أضف إلى مشروع قائم</Text>{draftProjects.map((project) => <Pressable key={project.id} onPress={() => void addToProject(project.id)} style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]}><MaterialIcons name="home-work" size={20} color={Brand.pine} /><Text style={styles.draftName}>{project.title}</Text><MaterialIcons name="arrow-back" size={17} color={Brand.pine} /></Pressable>)}{!projectsQuery.isLoading && draftProjects.length === 0 ? <View style={styles.noDraft}><Text style={styles.noDraftText}>لا توجد مسودة مشروع يمكن إضافة هذا المنتج إليها.</Text><PrimaryButton label="أنشئ مشروعاً أولاً" onPress={() => router.push("/create-project" as never)} style={styles.createButton} /></View> : null}</View>;
  };

  return (
    <ScreenContainer className="px-5">
      <ScrollView showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <AppHeader title="تفاصيل المنتج" onBack={() => router.back()} />
        <View style={styles.hero}>{galleryImageUrls.length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} directionalLockEnabled nestedScrollEnabled={false} onMomentumScrollEnd={(event) => setActiveImageIndex(Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width))} scrollEventThrottle={16}><View style={styles.galleryTrack}>{galleryImageUrls.map((imageUrl, index) => <Image key={`${imageUrl}-${index}`} source={{ uri: imageUrl }} style={styles.image} accessibilityLabel={`صورة المنتج ${index + 1}`} />)}</View></ScrollView> : <View style={styles.imagePlaceholder}><MaterialIcons name="chair" size={54} color={Brand.clay} /></View>}<View pointerEvents="none" style={styles.imageShade} />{galleryImageUrls.length > 1 ? <View pointerEvents="none" style={styles.imageCounter}><MaterialIcons name="photo-library" size={14} color={Brand.paleGreen} /><Text style={styles.imageCounterText}>{activeImageIndex + 1} / {galleryImageUrls.length}</Text></View> : null}{!product.isAvailable ? <View pointerEvents="none" style={styles.unavailable}><Text style={styles.unavailableText}>غير متاح حالياً</Text></View> : null}</View>
        {galleryImageUrls.length > 1 ? <View style={styles.galleryDots}>{galleryImageUrls.map((imageUrl, index) => <View key={`dot-${imageUrl}-${index}`} style={[styles.galleryDot, activeImageIndex === index && styles.galleryDotActive]} />)}</View> : null}
        <View style={styles.detailsCard}><Text style={styles.kicker}>اختيار من كتالوج MADD</Text><Text style={styles.title}>{product.name}</Text>{product.productCode ? <Text style={styles.code}>رمز المنتج: {product.productCode}</Text> : null}{product.breadcrumb.length ? <View style={styles.breadcrumbRow}><MaterialIcons name="account-tree" size={15} color={Brand.pine} /><Text style={styles.breadcrumbText}>{[...product.breadcrumb, product.name].join(" ← ")}</Text></View> : null}<View style={styles.goldRule} /><Text style={styles.description}>{product.description || "لا توجد تفاصيل إضافية للمنتج في الوقت الحالي."}</Text><View style={styles.specRow}><View style={[styles.statusDot, { backgroundColor: !product.isAvailable ? Brand.error : product.selectionMode === "view_only" ? Brand.muted : Brand.success }]} /><Text style={styles.specText}>{!product.isAvailable ? "هذا المنتج غير متاح ضمن الاختيارات الآن" : product.selectionMode === "view_only" ? "للعرض فقط، ولا يمكن إضافته إلى مشروع" : product.selectionMode === "single" ? "اختيار واحد فقط؛ سيستبدل اختيارك السابق في هذه التقسيمة" : "متاح للاختيار ضمن مشروعك"}</Text></View></View>
        {productAction()}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 30 },
  hero: { height: 265, borderRadius: 25, overflow: "hidden", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#665529", position: "relative" },
  galleryTrack: { flexDirection: "row", height: "100%" },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundColor: "#211B10" },
  imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,9,6,0.1)" },
  imageCounter: { position: "absolute", bottom: 14, right: 14, flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 12, backgroundColor: "rgba(12,12,12,0.72)", paddingHorizontal: 9, paddingVertical: 6 },
  imageCounterText: { color: Brand.paleGreen, fontSize: 11, fontWeight: "800", writingDirection: "ltr" },
  galleryDots: { flexDirection: "row-reverse", alignSelf: "center", gap: 6, marginTop: 12 },
  galleryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.line },
  galleryDotActive: { width: 18, backgroundColor: Brand.pine },
  unavailable: { position: "absolute", top: 15, right: 15, backgroundColor: "#351F1B", borderWidth: 1, borderColor: "#714239", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  unavailableText: { color: Brand.error, fontSize: 11, fontWeight: "900", writingDirection: "rtl" },
  detailsCard: { backgroundColor: Brand.card, borderRadius: 22, borderWidth: 1, borderColor: Brand.line, padding: 18, marginTop: -22, marginHorizontal: 12, zIndex: 2 },
  kicker: { color: Brand.pine, fontSize: 10, fontWeight: "900", letterSpacing: 0.4, writingDirection: "rtl", textAlign: "right" },
  title: { color: Brand.ink, fontSize: 24, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  code: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  breadcrumbRow: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 6, marginTop: 10 },
  breadcrumbText: { flex: 1, color: Brand.pine, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  goldRule: { alignSelf: "flex-end", width: 38, height: 2, backgroundColor: Brand.pine, borderRadius: 2, marginVertical: 14 },
  description: { color: Brand.muted, fontSize: 14, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  specRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.line },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  specText: { color: Brand.ink, fontSize: 13, writingDirection: "rtl" },
  action: { marginTop: 20 },
  drafts: { marginTop: 21 },
  draftsTitle: { color: Brand.ink, fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 10 },
  draftCard: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 16, padding: 14, marginBottom: 9 },
  draftName: { flex: 1, color: Brand.ink, fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  noDraft: { alignItems: "center", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5B4B29", padding: 18, borderRadius: 18 },
  noDraftText: { color: Brand.muted, textAlign: "center", writingDirection: "rtl", lineHeight: 20 },
  createButton: { alignSelf: "stretch", marginTop: 12 },
  viewOnlyCard: { flexDirection: "row-reverse", alignItems: "center", gap: 9, marginTop: 20, padding: 14, backgroundColor: "#1C1C1A", borderWidth: 1, borderColor: Brand.line, borderRadius: 16 },
  viewOnlyText: { flex: 1, color: Brand.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
