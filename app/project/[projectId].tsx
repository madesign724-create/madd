import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, EmptyState, PrimaryButton, SecondaryButton, StatusPill } from "@/components/app-ui";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";

const formatUpdateDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });

export default function ProjectDetailScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const id = Number(projectId);
  const utils = trpc.useUtils();
  const projectQuery = trpc.projects.get.useQuery({ projectId: id }, { enabled: Number.isFinite(id) });
  const attachmentsQuery = trpc.attachments.list.useQuery({ projectId: id }, { enabled: Number.isFinite(id) });
  const [uploading, setUploading] = useState(false);
  const [deleteDraftVisible, setDeleteDraftVisible] = useState(false);
  const lockMutation = trpc.projects.lock.useMutation({
    onSuccess: (success) => {
      if (success) {
        void utils.projects.get.invalidate({ projectId: id });
        void utils.projects.list.invalidate();
        Alert.alert("تم إرسال المشروع", "قُفل المشروع للمراجعة من فريق MADD.");
      } else Alert.alert("تعذر الإرسال", "ربما تغيرت حالة المشروع. حدّث الصفحة وحاول مجدداً.");
    },
  });
  const removeSelectionMutation = trpc.projects.removeSelection.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        void utils.projects.get.invalidate({ projectId: id });
      } else {
        Alert.alert("تعذر حذف المنتج", "ربما لم يعد المشروع مسودة قابلة للتعديل.");
      }
    },
    onError: (error) => Alert.alert("تعذر حذف المنتج", error.message),
  });
  const deleteDraftMutation = trpc.projects.deleteDraft.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        Alert.alert("تعذر حذف المسودة", "ربما أُرسل المشروع أو لم يعد متاحاً للتعديل.");
        return;
      }
      setDeleteDraftVisible(false);
      void utils.projects.list.invalidate();
      Alert.alert("تم حذف المسودة", "حُذف المشروع واختياراته ومرفقاته قبل الإرسال.");
      router.replace("/(tabs)/projects" as never);
    },
    onError: (error) => Alert.alert("تعذر حذف المسودة", error.message),
  });
  const uploadMutation = trpc.attachments.upload.useMutation({
    onSuccess: () => {
      void attachmentsQuery.refetch();
      Alert.alert("تم رفع الملف", "أُضيف المرفق إلى مشروعك.");
    },
  });

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf"], copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > 10 * 1024 * 1024) {
        Alert.alert("الملف كبير", "الحد الأقصى للمرفق هو 10 ميغابايت.");
        return;
      }
      setUploading(true);
      const base64 = Platform.OS === "web" && asset.base64 ? asset.base64 : await new File(String(asset.uri)).base64();
      await uploadMutation.mutateAsync({ projectId: id, fileName: asset.name, mimeType: asset.mimeType || undefined, dataBase64: base64 });
    } catch (error) {
      Alert.alert("تعذر رفع الملف", error instanceof Error ? error.message : "يرجى المحاولة لاحقاً.");
    } finally {
      setUploading(false);
    }
  };

  if (projectQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  const project = projectQuery.data;
  if (!project) return <ScreenContainer className="px-5"><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled"><AppHeader title="المشروع" onBack={() => router.back()} /><EmptyState icon="folder-off" title="المشروع غير متاح" description="لا تملك صلاحية الوصول إلى هذا المشروع أو أنه لم يعد موجوداً." /></ScrollView></ScreenContainer>;

  const editable = project.status === "draft";
  const attachments = attachmentsQuery.data ?? [];

  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <AppHeader title={project.title} subtitle="مركز مشروعك" onBack={() => router.back()} />
        <View style={styles.summary}>
          <View style={styles.summaryTop}><StatusPill status={project.status} /><MaterialIcons name="home-work" color={Brand.pine} size={27} /></View>
          <Text style={styles.summaryTitle}>{project.title}</Text>
          <Text style={styles.summaryText}>{[project.propertyType, project.city, project.areaSqm ? `${project.areaSqm} م²` : null].filter(Boolean).join(" · ") || "أكمل التفاصيل والاختيارات حسب احتياجك"}</Text>
          {!editable ? <View style={styles.progressBlock}><View style={styles.progressHead}><Text style={styles.progressLabel}>نسبة إنجاز المشروع</Text><Text style={styles.progressNumber}>{project.progressPercent}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${project.progressPercent}%` }]} /></View></View> : null}
        </View>

        {!editable ? <><SectionHeader icon="timeline" title="تحديثات فريق MADD" />{project.updates.length > 0 ? <View style={styles.timeline}>{project.updates.map((update, index) => <View key={update.id} style={styles.timelineItem}><View style={styles.timelineRail}><View style={[styles.timelineDot, update.status === "completed" && styles.timelineDotComplete]} />{index < project.updates.length - 1 ? <View style={styles.timelineLine} /> : null}</View><View style={styles.timelineCard}><View style={styles.updateTop}><StatusPill status={update.status} /><Text style={styles.updateDate}>{formatUpdateDate(update.createdAt)}</Text></View><Text style={styles.updateTitle}>{update.title}</Text>{update.note ? <Text style={styles.updateNote}>{update.note}</Text> : null}{update.images.length > 0 ? <ScrollView horizontal directionalLockEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageImages}>{update.images.map((image) => <Image key={image.id} source={{ uri: image.imageUrl }} style={styles.stageImage} resizeMode="cover" accessibilityLabel={`صورة من مرحلة ${update.title}`} />)}</ScrollView> : null}<Text style={styles.updateProgress}>نسبة الإنجاز بعد التحديث: {update.progressPercent}%</Text></View></View>)}</View> : <View style={styles.emptyTimeline}><MaterialIcons name="notifications-none" color={Brand.muted} size={22} /><Text style={styles.emptyTimelineText}>ستظهر هنا التحديثات التفصيلية فور بدء الفريق بالمراجعة.</Text></View>}</> : null}

        <SectionHeader icon="design-services" title={`الخدمات المختارة (${project.selectedServices.length})`} />
        {project.selectedServices.length > 0 ? project.selectedServices.map((service) => <View key={service.id}><View style={styles.rowCard}><MaterialIcons name="construction" color={Brand.pine} size={21} /><Text style={styles.rowTitle}>{service.name}</Text></View>{editable ? <SecondaryButton label={`تعديل منتجات ${service.name}`} onPress={() => router.push({ pathname: "/service/[serviceId]", params: { serviceId: String(service.serviceId), projectId: String(id) } } as never)} style={styles.serviceEditButton} /> : null}</View>) : <Text style={styles.helper}>لا توجد خدمات مختارة للمشروع بعد.</Text>}

        <SectionHeader icon="checklist" title={`اختياراتك (${project.selections.length})`} />
        {project.selections.length > 0 ? project.selections.map((selection) => <View key={selection.id} style={styles.rowCard}><MaterialIcons name="check-circle" color={Brand.success} size={21} /><View style={styles.selectionCopy}><Text style={styles.rowTitle}>{selection.productName} <Text style={styles.quantity}>× {selection.quantity}</Text></Text>{selection.breadcrumb?.length ? <Text style={styles.breadcrumb}>{[...selection.breadcrumb, selection.productName].join(" ← ")}</Text> : null}{selection.productCode ? <Text style={styles.small}>{selection.productCode}</Text> : null}</View>{editable ? <Pressable accessibilityRole="button" accessibilityLabel={`حذف ${selection.productName} من المشروع`} onPress={() => Alert.alert("حذف المنتج", `هل تريد إزالة «${selection.productName}» من هذه المسودة؟`, [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => removeSelectionMutation.mutate({ projectId: id, productId: selection.productId }) }])} style={({ pressed }) => [styles.removeSelectionButton, pressed && styles.actionPressed]}><MaterialIcons name="delete-outline" color={Brand.error} size={21} /></Pressable> : null}</View>) : <Text style={styles.helper}>لم تُضف منتجات إلى مشروعك بعد.</Text>}

        <SectionHeader icon="attach-file" title={`المرفقات (${attachments.length})`} />
        {attachmentsQuery.isLoading ? <ActivityIndicator color={Brand.pine} /> : attachments.map((attachment) => <View key={attachment.id} style={styles.rowCard}><MaterialIcons name="description" color={Brand.clay} size={21} /><View style={styles.selectionCopy}><Text numberOfLines={1} style={styles.rowTitle}>{attachment.fileName}</Text><Text style={styles.small}>{attachment.mimeType || "مرفق"}</Text></View></View>)}
        {editable ? <SecondaryButton label={uploading ? "جاري رفع المرفق..." : "إرفاق مخطط أو صورة"} onPress={() => void pickAttachment()} style={styles.sectionButton} /> : null}
        {editable ? <><View style={styles.lockCard}><Text style={styles.lockTitle}>جاهز لمراجعة الفريق؟</Text><Text style={styles.lockText}>عند الإرسال سيُقفل المشروع، ويبدأ فريق MADD مراجعته معك.</Text><PrimaryButton label="إرسال المشروع للمراجعة" loading={lockMutation.isPending} disabled={project.selectedServices.length === 0} onPress={() => Alert.alert("تأكيد الإرسال", "لن تتمكن من تعديل الاختيارات بعد الإرسال.", [{ text: "عودة", style: "cancel" }, { text: "إرسال الآن", style: "destructive", onPress: () => lockMutation.mutate({ projectId: id }) }])} style={styles.lockButton} /></View><View style={styles.deleteDraftCard}><Text style={styles.deleteDraftTitle}>إلغاء المشروع المسودة</Text><Text style={styles.deleteDraftText}>يمكنك حذفه نهائياً قبل الإرسال، مع جميع المنتجات والمرفقات التي أضفتها.</Text><Pressable accessibilityRole="button" onPress={() => setDeleteDraftVisible(true)} style={({ pressed }) => [styles.deleteDraftButton, pressed && styles.actionPressed]}><MaterialIcons name="delete-outline" color={Brand.error} size={20} /><Text style={styles.deleteDraftButtonText}>حذف المشروع بالكامل</Text></Pressable></View></> : <View style={styles.lockedCard}><MaterialIcons name="notifications-active" color={Brand.pine} size={22} /><Text style={styles.lockedText}>ستتلقى إشعاراً على جهازك كلما سجّل الفريق تحديثاً جديداً لهذا المشروع.</Text></View>}
      </ScrollView>
      <DeleteConfirmationDialog visible={deleteDraftVisible} title="حذف المشروع المسودة؟" description="سيُحذف المشروع وجميع اختيارات المنتجات والمرفقات نهائياً. لا يمكن استعادته بعد ذلك." confirmLabel="حذف المسودة" loading={deleteDraftMutation.isPending} onCancel={() => setDeleteDraftVisible(false)} onConfirm={() => deleteDraftMutation.mutate({ projectId: id })} />
    </ScreenContainer>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof MaterialIcons.glyphMap; title: string }) {
  return <View style={styles.sectionHeader}><MaterialIcons name={icon} size={20} color={Brand.pine} /><Text style={styles.sectionTitle}>{title}</Text></View>;
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 30 },
  summary: { backgroundColor: Brand.card, padding: 18, borderRadius: 23, borderWidth: 1, borderColor: "#665529" },
  summaryTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTitle: { color: Brand.ink, fontSize: 22, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 14 },
  summaryText: { color: Brand.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  progressBlock: { marginTop: 18, paddingTop: 15, borderTopWidth: 1, borderTopColor: Brand.line },
  progressHead: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progressLabel: { color: Brand.ink, fontSize: 13, fontWeight: "700", writingDirection: "rtl" },
  progressNumber: { color: Brand.success, fontSize: 18, fontWeight: "800" },
  progressTrack: { height: 8, backgroundColor: "#302A1F", borderRadius: 5, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: Brand.pine, borderRadius: 5 },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 8, marginTop: 27, marginBottom: 11 },
  sectionTitle: { color: Brand.ink, fontSize: 17, fontWeight: "900", writingDirection: "rtl" },
  timeline: { paddingRight: 2 },
  timelineItem: { flexDirection: "row-reverse", alignItems: "stretch" },
  timelineRail: { width: 31, alignItems: "center" },
  timelineDot: { marginTop: 17, width: 13, height: 13, borderRadius: 7, borderWidth: 3, borderColor: Brand.card, backgroundColor: Brand.pine, zIndex: 1 },
  timelineDotComplete: { backgroundColor: Brand.success },
  timelineLine: { position: "absolute", top: 30, bottom: -1, width: 1, backgroundColor: "#67562C" },
  timelineCard: { flex: 1, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 19, padding: 15, marginBottom: 11 },
  updateTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  updateDate: { color: Brand.muted, fontSize: 11, writingDirection: "rtl" },
  updateTitle: { color: Brand.ink, fontSize: 14, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 10 },
  updateNote: { color: Brand.muted, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  stageImages: { flexDirection: "row-reverse", gap: 8, paddingTop: 12 },
  stageImage: { width: 148, height: 112, borderRadius: 14, backgroundColor: Brand.paleGreen, borderWidth: 1, borderColor: Brand.line },
  updateProgress: { color: Brand.pine, fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 9 },
  emptyTimeline: { flexDirection: "row-reverse", alignItems: "center", gap: 9, backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 16, padding: 14 },
  emptyTimelineText: { flex: 1, color: Brand.muted, fontSize: 13, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  rowCard: { flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 18, padding: 14, marginBottom: 9 },
  rowTitle: { flex: 1, color: Brand.ink, fontSize: 14, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  quantity: { color: Brand.pine, fontSize: 13, fontWeight: "900", writingDirection: "ltr" },
  selectionCopy: { flex: 1, alignItems: "flex-end" },
  breadcrumb: { color: Brand.pine, fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  small: { color: Brand.muted, fontSize: 11, marginTop: 3, writingDirection: "rtl" },
  helper: { color: Brand.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, padding: 15, borderRadius: 18 },
  sectionButton: { marginTop: 10 },
  serviceEditButton: { marginTop: -1, marginBottom: 13 },
  removeSelectionButton: { width: 38, height: 38, borderWidth: 1, borderColor: "#703D37", borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2B1A18" },
  actionPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  lockCard: { backgroundColor: "#211B10", borderWidth: 1, borderColor: "#665529", borderRadius: 22, padding: 18, marginTop: 27 },
  lockTitle: { color: Brand.ink, fontSize: 17, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  lockText: { color: Brand.muted, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 7 },
  lockButton: { marginTop: 16 },
  deleteDraftCard: { backgroundColor: "#241816", borderWidth: 1, borderColor: "#6E3D36", borderRadius: 22, padding: 18, marginTop: 14 },
  deleteDraftTitle: { color: Brand.ink, fontSize: 16, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  deleteDraftText: { color: Brand.muted, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 7 },
  deleteDraftButton: { marginTop: 15, minHeight: 46, borderWidth: 1, borderColor: "#85473F", backgroundColor: "#321C19", borderRadius: 14, flexDirection: "row-reverse", justifyContent: "center", alignItems: "center", gap: 8 },
  deleteDraftButtonText: { color: Brand.error, fontSize: 13, fontWeight: "800", writingDirection: "rtl" },
  lockedCard: { flexDirection: "row-reverse", gap: 9, alignItems: "center", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5B4B29", borderRadius: 19, padding: 15, marginTop: 27 },
  lockedText: { flex: 1, color: Brand.ink, fontSize: 13, textAlign: "right", writingDirection: "rtl" },
});
