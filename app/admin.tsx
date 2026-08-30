import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { AdminCatalog, AdminTeam } from "@/components/admin-operations";
import { AdminCatalogHierarchy } from "@/components/admin-catalog-hierarchy";
import { AdminCompanyTools } from "@/components/admin-company-tools";
import { AdminOwnerCatalogTools } from "@/components/admin-owner-catalog-tools";
import { AppHeader, Brand, EmptyState, PrimaryButton, SecondaryButton, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

type AdminSection = "projects" | "catalog" | "team" | "settings" | (string & {});
type TrackingStatus = "submitted" | "under_review" | "locked" | "in_progress" | "completed" | "cancelled";
type StageImage = { uri: string; fileName: string; mimeType: string; dataBase64: string };
type ProjectNotificationKind = "pricing_ready" | "project_completed";

const trackingStages: { value: TrackingStatus; label: string }[] = [
  { value: "under_review", label: "مراجعة الطلب" },
  { value: "locked", label: "بانتظار الانطلاق" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغى" },
];

const projectUpdatePresets: { label: string; status: TrackingStatus; progress: number; title: string; note: string; notificationKind?: ProjectNotificationKind }[] = [
  { label: "تم التسعير", status: "under_review", progress: 10, title: "تم تسعير المشروع", note: "أعدّ فريق MADD عرض التسعير الخاص بالمشروع وهو جاهز للمراجعة.", notificationKind: "pricing_ready" },
  { label: "تم اعتماد التسعير", status: "locked", progress: 15, title: "تم اعتماد التسعير", note: "تم اعتماد عرض التسعير وتجهيز المشروع لبدء الأعمال." },
  { label: "بدء التنفيذ", status: "in_progress", progress: 25, title: "بدأت أعمال التنفيذ", note: "بدأ فريق MADD تنفيذ أعمال المشروع وفق الخطة المعتمدة." },
  { label: "تم الانتهاء", status: "completed", progress: 100, title: "تم الانتهاء من المشروع", note: "اكتملت أعمال المشروع، ويمكنكم مراجعة تفاصيله وصور المراحل.", notificationKind: "project_completed" },
];

export default function AdminScreen() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const adminQuery = trpc.admin.me.useQuery(undefined, { enabled: isAuthenticated });
  const [section, setSection] = useState<AdminSection>("projects");

  if (loading || (isAuthenticated && adminQuery.isLoading)) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  if (!isAuthenticated) return <ScreenContainer className="px-5"><FlatList data={[]} keyExtractor={() => "guest"} renderItem={() => null} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={<><AppHeader title="الإدارة" onBack={() => router.back()} /><EmptyState icon="lock-outline" title="تسجيل الدخول مطلوب" description="أنشئ حساباً أو سجّل الدخول للوصول إلى إدارة المنصة." action={<PrimaryButton label="إنشاء حساب أو تسجيل الدخول" onPress={() => router.push("/auth" as never)} />} /></>} /></ScreenContainer>;
  if (!adminQuery.data?.isAdmin) return <ScreenContainer className="px-5"><FlatList data={[]} keyExtractor={() => "unauthorized"} renderItem={() => null} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={<><AppHeader title="الإدارة" onBack={() => router.back()} /><EmptyState icon="admin-panel-settings" title="لا تملك صلاحية الإدارة" description="تظهر هذه الواجهة لحسابات فريق MADD المفعّلة فقط." /></>} /></ScreenContainer>;

  const permissions = adminQuery.data.permissions;
  const isOwner = adminQuery.data.role === "owner";
  const activeSection: AdminSection = section === "settings" && isOwner ? "settings" : permissions.includes(section === "team" ? "team" : section === "catalog" ? "catalog" : "projects") ? section : permissions.includes("projects") ? "projects" : permissions.includes("catalog") ? "catalog" : "team";
  const sharedHeader = <><AppHeader title="تشغيل MADD" subtitle="إدارة المشروعات والكتالوج والفريق" onBack={() => router.back()} /><AdminRecentActivity /><View style={styles.switcher}>{permissions.includes("projects") ? <SectionButton active={activeSection === "projects"} label="المشروعات" icon="folder" onPress={() => setSection("projects")} /> : null}{permissions.includes("catalog") ? <SectionButton active={activeSection === "catalog"} label="الكتالوج" icon="inventory-2" onPress={() => setSection("catalog")} /> : null}{permissions.includes("team") ? <SectionButton active={activeSection === "team"} label="الفريق" icon="group" onPress={() => setSection("team")} /> : null}{isOwner ? <SectionButton active={activeSection === "settings"} label="إعدادات الشركة" icon="business-center" onPress={() => setSection("settings")} /> : null}</View></>;
  return <ScreenContainer className="px-5">{activeSection === "catalog" ? <AdminCatalog headerContent={<>{sharedHeader}<AdminOwnerCatalogTools /><AdminCatalogHierarchy /></>} /> : activeSection === "projects" ? <AdminProjects headerContent={sharedHeader} /> : activeSection === "settings" ? <AdminCompanyTools headerContent={sharedHeader} /> : <AdminTeam headerContent={sharedHeader} />}</ScreenContainer>;
}

function SectionButton({ active, label, icon, onPress }: { active: boolean; label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.sectionButton, active && styles.sectionButtonActive, pressed && styles.pressed]}><MaterialIcons name={icon} size={18} color={active ? "#0C0C0C" : Brand.pine} /><Text style={[styles.sectionButtonText, active && styles.sectionButtonTextActive]}>{label}</Text></Pressable>;
}

function formatActivityDate(value: Date | string | null | undefined) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متاح";
  return date.toLocaleString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function AdminRecentActivity() {
  const activityQuery = trpc.admin.recentActivity.useQuery({ limit: 4 });
  const entries = activityQuery.data ?? [];
  return <View style={styles.recentActivityCard}>
    <View style={styles.recentActivityHeader}><View><Text style={styles.recentActivityTitle}>آخر التعديلات</Text><Text style={styles.recentActivitySubtitle}>التاريخ والوقت ومنفذ كل تغيير</Text></View><MaterialIcons name="history" size={21} color={Brand.pine} /></View>
    {activityQuery.isLoading ? <ActivityIndicator color={Brand.pine} style={styles.recentActivityLoader} /> : entries.length ? entries.map((entry) => <View key={entry.id} style={styles.recentActivityRow}><Text style={styles.recentActivitySummary} numberOfLines={2}>{entry.summary}</Text><Text style={styles.recentActivityMeta}>آخر تعديل: {formatActivityDate(entry.createdAt)} بواسطة {entry.actorName || entry.actorEmail || `حساب #${entry.actorUserId}`}</Text></View>) : <Text style={styles.recentActivityEmpty}>ستظهر هنا أحدث التغييرات فور حدوثها.</Text>}
  </View>;
}

function AdminProjects({ headerContent }: { headerContent?: ReactNode }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const projectsQuery = trpc.admin.projects.useQuery();
  const [reportsOnly, setReportsOnly] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatus, setReportStatus] = useState<TrackingStatus | undefined>();
  const [reportManagerId, setReportManagerId] = useState<number | undefined>();
  const [reportCity, setReportCity] = useState("");
  const [reportDateRange, setReportDateRange] = useState({ from: "", to: "" });
  const managersQuery = trpc.admin.projectManagers.useQuery();
  const lockedReportsQuery = trpc.admin.lockedProjectReports.useQuery(
    { search: reportSearch.trim() || undefined, status: reportStatus, assignedStaffId: reportManagerId, city: reportCity.trim() || undefined, dateFrom: reportDateRange.from || undefined, dateTo: reportDateRange.to || undefined },
    { enabled: reportsOnly },
  );
  const [openProjectId, setOpenProjectId] = useState<number | null>(null);
  const [assigningProjectId, setAssigningProjectId] = useState<number | null>(null);
  const [status, setStatus] = useState<TrackingStatus>("under_review");
  const [progress, setProgress] = useState("0");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [stageImages, setStageImages] = useState<StageImage[]>([]);
  const [notificationKind, setNotificationKind] = useState<ProjectNotificationKind | null>(null);
  const projects = projectsQuery.data ?? [];
  const managers = managersQuery.data ?? [];
  const visibleProjects = (reportsOnly ? lockedReportsQuery.data ?? [] : projects) as typeof projects;
  const updateMutation = trpc.admin.addProjectUpdate.useMutation({
    onSuccess: (result) => {
      void utils.admin.projects.invalidate();
      void utils.admin.lockedProjectReports.invalidate();
      setOpenProjectId(null); setNote(""); setStageImages([]); setNotificationKind(null);
      if (result.success) Alert.alert("تم نشر التحديث", `${result.imageCount ? `أُرفقت ${result.imageCount} صور. ` : ""}${result.notification.attempted ? `أُرسل التنبيه إلى ${result.notification.accepted} جهاز مسجل.` : "سيصل التنبيه فور تسجيل جهاز العميل في التطبيق."}`);
    },
    onError: (error) => Alert.alert("تعذر حفظ التحديث", error.message),
  });
  const assignManagerMutation = trpc.admin.assignProjectManager.useMutation({
    onSuccess: () => { void utils.admin.projects.invalidate(); void utils.admin.lockedProjectReports.invalidate(); setAssigningProjectId(null); },
    onError: (error) => Alert.alert("تعذر تعيين المسؤول", error.message),
  });
  const openUpdateForm = (item: typeof projects[number]) => {
    const initialStatus: TrackingStatus = item.status === "draft" || item.status === "submitted" ? "under_review" : item.status as TrackingStatus;
    setOpenProjectId(item.id); setStatus(initialStatus); setProgress(String(item.progressPercent)); setTitle(`تحديث مشروع: ${item.title}`); setNote(""); setStageImages([]); setNotificationKind(null);
  };
  const applyProjectUpdatePreset = (preset: typeof projectUpdatePresets[number]) => {
    setStatus(preset.status);
    setProgress(String(preset.progress));
    setTitle(preset.title);
    setNote(preset.note);
    setNotificationKind(preset.notificationKind ?? null);
  };
  const pickStageImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 3, quality: 0.65, base64: true });
    if (result.canceled) return;
    const images = result.assets.slice(0, 3).flatMap((asset, index): StageImage[] => {
      if (!asset.base64 || Math.floor((asset.base64.length * 3) / 4) > 3 * 1024 * 1024) return [];
      return [{ uri: asset.uri, fileName: asset.fileName || `stage-${Date.now()}-${index + 1}.jpg`, mimeType: asset.mimeType || "image/jpeg", dataBase64: asset.base64 }];
    });
    if (images.length !== result.assets.length) Alert.alert("بعض الصور لم تُضف", "اختر صوراً لا يزيد حجم كل منها على 3 ميغابايت.");
    setStageImages(images);
  };
  const saveUpdate = (projectId: number) => {
    const parsedProgress = Number(progress);
    if (!title.trim() || !Number.isInteger(parsedProgress) || parsedProgress < 0 || parsedProgress > 100) { Alert.alert("بيانات غير مكتملة", "اكتب عنوان التحديث ونسبة صحيحة بين 0 و100."); return; }
    updateMutation.mutate({ projectId, status, progressPercent: parsedProgress, title: title.trim(), note: note.trim() || undefined, notificationKind: notificationKind ?? undefined, images: stageImages.map(({ fileName, mimeType, dataBase64 }) => ({ fileName, mimeType, dataBase64 })) });
  };
  const renderItem = ({ item }: { item: typeof projects[number] }) => <View style={styles.projectCard}>
    <View style={styles.projectTop}><StatusPill status={item.status} /><Text style={styles.customer}>{item.customerName || item.customerEmail || "عميل"}</Text></View>
    <Text style={styles.projectName}>{item.title}</Text>
    <Text style={styles.projectMeta}>{[item.propertyType, item.city].filter(Boolean).join(" · ") || "تفاصيل المشروع قيد الاستكمال"}</Text>
    <Text style={styles.reportHint}>مسؤول المشروع: {item.assignedManagerName || item.assignedManagerEmail || "غير معيّن"}</Text>
    <View style={styles.progressRow}><Text style={styles.progressValue}>{item.progressPercent}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${item.progressPercent}%` }]} /></View></View>
    <View style={styles.projectActions}>
      <SecondaryButton label={openProjectId === item.id ? "إغلاق التحديث" : "تحديث المرحلة"} onPress={() => openProjectId === item.id ? setOpenProjectId(null) : openUpdateForm(item)} style={styles.actionButton} />
      <SecondaryButton label={assigningProjectId === item.id ? "إغلاق التعيين" : "تعيين مسؤول"} onPress={() => setAssigningProjectId((current) => current === item.id ? null : item.id)} style={styles.actionButton} />
      {item.lockedAt ? <SecondaryButton label="تقرير تفصيلي للمشروع" onPress={() => router.push(`/admin/report/${item.id}` as never)} style={styles.actionButton} /> : null}
    </View>
    {assigningProjectId === item.id ? <View style={styles.updateForm}><Text style={styles.updateFormTitle}>اختر مسؤول المشروع</Text><View style={styles.stageGrid}><Pressable onPress={() => assignManagerMutation.mutate({ projectId: item.id, assignedStaffId: null })} style={({ pressed }) => [styles.stageChip, !item.assignedStaffId && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, !item.assignedStaffId && styles.stageChipTextActive]}>بدون مسؤول</Text></Pressable>{managers.map((manager) => <Pressable key={manager.id} onPress={() => assignManagerMutation.mutate({ projectId: item.id, assignedStaffId: manager.id })} style={({ pressed }) => [styles.stageChip, item.assignedStaffId === manager.id && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, item.assignedStaffId === manager.id && styles.stageChipTextActive]}>{manager.displayName || manager.email}</Text></Pressable>)}</View>{assignManagerMutation.isPending ? <ActivityIndicator color={Brand.pine} /> : null}</View> : null}
    {item.lockedAt ? <Text style={styles.reportHint}>الطلب مقفول ومحفوظ كتقرير تفصيلي جاهز للطباعة أو الحفظ PDF.</Text> : null}
    {openProjectId === item.id ? <View style={styles.updateForm}>
      <Text style={styles.updateFormTitle}>تحديث يراه العميل فوراً</Text>
      <Text style={styles.quickUpdateHint}>اختر تحديثاً سريعاً لتعبئة البيانات تلقائياً، ثم عدّل النص أو النسبة إن أردت.</Text>
      <View style={styles.stageGrid}>{projectUpdatePresets.map((preset) => <Pressable key={preset.label} onPress={() => applyProjectUpdatePreset(preset)} style={({ pressed }) => [styles.quickUpdateChip, pressed && styles.pressed]}><MaterialIcons name="bolt" size={15} color="#0C0C0C" /><Text style={styles.quickUpdateChipText}>{preset.label}</Text></Pressable>)}</View>
      <Text style={styles.statusHint}>حالة المشروع</Text>
      <View style={styles.stageGrid}>{trackingStages.map((stage) => <Pressable key={stage.value} onPress={() => { setStatus(stage.value); setNotificationKind(null); }} style={({ pressed }) => [styles.stageChip, status === stage.value && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, status === stage.value && styles.stageChipTextActive]}>{stage.label}</Text></Pressable>)}</View>
      {notificationKind ? <Text style={styles.specialNotificationHint}>سيصل للعميل إشعار مرئي داخل التطبيق عند حفظ هذا التحديث.</Text> : null}
      <TextInput value={progress} onChangeText={(value) => { setProgress(value); setNotificationKind(null); }} placeholder="نسبة الإنجاز من 0 إلى 100" placeholderTextColor={Brand.muted} keyboardType="number-pad" style={styles.input} textAlign="right" />
      <TextInput value={title} onChangeText={(value) => { setTitle(value); setNotificationKind(null); }} placeholder="عنوان التحديث" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" />
      <TextInput value={note} onChangeText={(value) => { setNote(value); setNotificationKind(null); }} placeholder="ملاحظة للعميل (اختيارية)" placeholderTextColor={Brand.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline />
      <View style={styles.photoBlock}><Text style={styles.photoHint}>أرفق حتى 3 صور للمرحلة (اختياري)</Text><SecondaryButton label={stageImages.length ? `تعديل الصور المرفقة (${stageImages.length})` : "إرفاق صور المرحلة"} onPress={() => void pickStageImages()} /><View style={styles.photoPreviewRow}>{stageImages.map((image) => <Pressable key={image.uri} onPress={() => setStageImages((current) => current.filter((candidate) => candidate.uri !== image.uri))} style={({ pressed }) => [styles.photoPreviewWrap, pressed && styles.pressed]}><Image source={{ uri: image.uri }} style={styles.photoPreview} /><View style={styles.removePhoto}><MaterialIcons name="close" size={14} color="#0C0C0C" /></View></Pressable>)}</View></View>
      <PrimaryButton label={stageImages.length ? "نشر التحديث والصور" : "حفظ وإرسال إشعار"} loading={updateMutation.isPending} onPress={() => saveUpdate(item.id)} />
    </View> : null}
  </View>;
  const reportsLoading = reportsOnly && lockedReportsQuery.isLoading;
  const openPortfolioReport = () => {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if ((reportDateRange.from && !datePattern.test(reportDateRange.from)) || (reportDateRange.to && !datePattern.test(reportDateRange.to))) {
      Alert.alert("تنسيق التاريخ غير صحيح", "اكتب التاريخ بصيغة سنة-شهر-يوم، مثل 2026-08-20.");
      return;
    }
    if (reportDateRange.from && reportDateRange.to && reportDateRange.from > reportDateRange.to) {
      Alert.alert("الفترة الزمنية غير صحيحة", "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.");
      return;
    }
    router.push({ pathname: "/admin/portfolio-report", params: { search: reportSearch.trim() || undefined, status: reportStatus, managerId: reportManagerId ? String(reportManagerId) : undefined, city: reportCity.trim() || undefined, dateFrom: reportDateRange.from || undefined, dateTo: reportDateRange.to || undefined } } as never);
  };
  const projectsLoading = (!reportsOnly && projectsQuery.isLoading) || reportsLoading;
  const reportsHeader = <View style={styles.reportFilters}>
    <View style={styles.reportModeRow}>
      <Pressable onPress={() => setReportsOnly(false)} style={({ pressed }) => [styles.reportMode, !reportsOnly && styles.reportModeActive, pressed && styles.pressed]}><Text style={[styles.reportModeText, !reportsOnly && styles.reportModeTextActive]}>كل المشروعات</Text></Pressable>
      <Pressable onPress={() => setReportsOnly(true)} style={({ pressed }) => [styles.reportMode, reportsOnly && styles.reportModeActive, pressed && styles.pressed]}><MaterialIcons name="description" size={16} color={reportsOnly ? "#0C0C0C" : Brand.pine} /><Text style={[styles.reportModeText, reportsOnly && styles.reportModeTextActive]}>تقارير الطلبات</Text></Pressable>
    </View>
    {reportsOnly ? <>
      <TextInput value={reportSearch} onChangeText={setReportSearch} placeholder="ابحث باسم المشروع أو العميل أو المدينة" placeholderTextColor={Brand.muted} style={styles.searchInput} textAlign="right" returnKeyType="search" />
      <Text style={styles.reportHint}>فلترة بالحالة</Text><View style={styles.stageGrid}><Pressable onPress={() => setReportStatus(undefined)} style={({ pressed }) => [styles.stageChip, !reportStatus && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, !reportStatus && styles.stageChipTextActive]}>كل الحالات</Text></Pressable>{trackingStages.map((stage) => <Pressable key={stage.value} onPress={() => setReportStatus(stage.value)} style={({ pressed }) => [styles.stageChip, reportStatus === stage.value && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, reportStatus === stage.value && styles.stageChipTextActive]}>{stage.label}</Text></Pressable>)}</View>
      <Text style={styles.reportHint}>فلترة بمسؤول المشروع</Text><View style={styles.stageGrid}><Pressable onPress={() => setReportManagerId(undefined)} style={({ pressed }) => [styles.stageChip, !reportManagerId && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, !reportManagerId && styles.stageChipTextActive]}>كل المسؤولين</Text></Pressable>{managers.map((manager) => <Pressable key={manager.id} onPress={() => setReportManagerId(manager.id)} style={({ pressed }) => [styles.stageChip, reportManagerId === manager.id && styles.stageChipActive, pressed && styles.pressed]}><Text style={[styles.stageChipText, reportManagerId === manager.id && styles.stageChipTextActive]}>{manager.displayName || manager.email}</Text></Pressable>)}</View>
      <TextInput value={reportCity} onChangeText={setReportCity} placeholder="فلترة المدينة (مثل القاهرة)" placeholderTextColor={Brand.muted} style={styles.searchInput} textAlign="right" />
      <Text style={styles.reportHint}>فلترة فترة إنشاء المشروع</Text><View style={styles.dateRangeRow}><TextInput value={reportDateRange.to} onChangeText={(to) => setReportDateRange((current) => ({ ...current, to }))} placeholder="إلى: YYYY-MM-DD" placeholderTextColor={Brand.muted} style={styles.dateInput} textAlign="right" keyboardType="numbers-and-punctuation" maxLength={10} /><TextInput value={reportDateRange.from} onChangeText={(from) => setReportDateRange((current) => ({ ...current, from }))} placeholder="من: YYYY-MM-DD" placeholderTextColor={Brand.muted} style={styles.dateInput} textAlign="right" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
      <Text style={styles.reportHint}>تُطبّق المدينة والفترة على قائمة الطلبات والتقرير الشامل.</Text>
      <SecondaryButton label="إنشاء تقرير شامل للمشروعات" onPress={openPortfolioReport} />
    </> : null}
  </View>;
  return <FlatList data={projectsLoading ? [] : visibleProjects} keyExtractor={(item) => String(item.id)} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} renderItem={renderItem} ListHeaderComponent={<>{headerContent}{reportsHeader}</>} ListEmptyComponent={projectsLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : <EmptyState icon={reportsOnly ? "description" : "folder-open"} title={reportsOnly ? "لا توجد تقارير مطابقة" : "لا توجد مشروعات بعد"} description={reportsOnly ? "جرّب تغيير كلمة البحث أو الفلاتر المحددة." : "ستظهر هنا طلبات العملاء فور إنشائها أو إرسالها للمراجعة."} />} />;
}

const styles = StyleSheet.create({
  recentActivityCard: { backgroundColor: Brand.card, borderColor: "#665529", borderWidth: 1, borderRadius: 20, padding: 15, marginBottom: 14 },
  recentActivityHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  recentActivityTitle: { color: Brand.ink, fontSize: 14, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  recentActivitySubtitle: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  recentActivityRow: { borderTopColor: Brand.line, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 9 },
  recentActivitySummary: { color: Brand.ink, fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl", lineHeight: 18 },
  recentActivityMeta: { color: Brand.pine, fontSize: 10, textAlign: "right", writingDirection: "rtl", marginTop: 4, lineHeight: 15 },
  recentActivityEmpty: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", paddingVertical: 5 },
  recentActivityLoader: { paddingVertical: 8 },
  catalogPage: { flex: 1 },
  catalogPageContent: { paddingBottom: 36 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" }, catalogLayout: { flex: 1 }, switcher: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, backgroundColor: "#12120F", borderColor: "#5B4B29", borderWidth: 1, borderRadius: 18, padding: 5, marginBottom: 15 }, sectionButton: { width: "48%", flexGrow: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 43, borderRadius: 13 }, sectionButtonActive: { backgroundColor: Brand.pine }, sectionButtonText: { color: Brand.pine, fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, sectionButtonTextActive: { color: "#0C0C0C" }, list: { paddingBottom: 28 }, reportFilters: { backgroundColor: Brand.card, borderColor: "#5B4B29", borderWidth: 1, borderRadius: 20, padding: 13, marginBottom: 13 }, reportModeRow: { flexDirection: "row-reverse", gap: 7 }, reportMode: { flex: 1, minHeight: 41, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 12, borderColor: Brand.line, borderWidth: 1 }, reportModeActive: { backgroundColor: Brand.pine, borderColor: Brand.pine }, reportModeText: { color: Brand.pine, fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, reportModeTextActive: { color: "#0C0C0C" }, searchInput: { minHeight: 48, borderWidth: 1, borderColor: "#4C4025", borderRadius: 13, paddingHorizontal: 12, color: Brand.ink, backgroundColor: "#11110F", writingDirection: "rtl", marginTop: 10 }, dateRangeRow: { flexDirection: "row-reverse", gap: 8, marginTop: 8 }, dateInput: { flex: 1, minHeight: 45, borderWidth: 1, borderColor: "#4C4025", borderRadius: 13, paddingHorizontal: 10, color: Brand.ink, backgroundColor: "#11110F", writingDirection: "rtl", fontSize: 12 }, monthRow: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", marginTop: 10 }, monthArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: Brand.paleGreen, borderWidth: 1, borderColor: "#5B4B29" }, monthLabel: { flexDirection: "row-reverse", gap: 6, alignItems: "center" }, monthText: { color: Brand.ink, fontSize: 13, fontWeight: "800", writingDirection: "rtl" }, monthSummary: { flexDirection: "row-reverse", justifyContent: "space-between", backgroundColor: "#211B10", borderRadius: 14, borderWidth: 1, borderColor: Brand.line, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 10 }, summaryValue: { color: Brand.pine, fontSize: 16, fontWeight: "900", textAlign: "center" }, summaryLabel: { color: Brand.muted, fontSize: 10, writingDirection: "rtl", textAlign: "center", marginTop: 2 }, projectCard: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 21, padding: 16, marginBottom: 11 }, projectTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, customer: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl" }, projectName: { color: Brand.ink, fontSize: 17, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 13 }, projectMeta: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 5 }, progressRow: { flexDirection: "row-reverse", alignItems: "center", gap: 9, marginTop: 14 }, progressValue: { color: Brand.pine, fontSize: 13, fontWeight: "900", width: 38, textAlign: "left" }, progressTrack: { flex: 1, height: 8, overflow: "hidden", borderRadius: 4, backgroundColor: "#302A1F" }, progressFill: { height: "100%", borderRadius: 4, backgroundColor: Brand.pine }, projectActions: { flexDirection: "row-reverse", gap: 8, marginTop: 14 }, actionButton: { minHeight: 43, flex: 1 }, reportHint: { color: Brand.pine, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 9 }, updateForm: { marginTop: 12, backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5B4B29", borderRadius: 19, padding: 14 }, updateFormTitle: { color: Brand.ink, fontSize: 15, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginBottom: 10 }, quickUpdateHint: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", lineHeight: 17, marginBottom: 8 }, specialNotificationHint: { color: Brand.success, fontSize: 11, fontWeight: "800", textAlign: "right", writingDirection: "rtl", lineHeight: 17, marginTop: -3, marginBottom: 10 }, statusHint: { color: Brand.muted, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 7 }, stageGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 12 }, stageChip: { borderWidth: 1, borderColor: "#5B4B29", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Brand.card }, stageChipActive: { backgroundColor: Brand.pine, borderColor: Brand.pine }, stageChipText: { color: Brand.pine, fontSize: 12, fontWeight: "800", writingDirection: "rtl" }, stageChipTextActive: { color: "#0C0C0C" }, quickUpdateChip: { flexDirection: "row-reverse", alignItems: "center", gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: Brand.pine, borderColor: Brand.pine, borderWidth: 1 }, quickUpdateChipText: { color: "#0C0C0C", fontSize: 12, fontWeight: "900", writingDirection: "rtl" }, input: { minHeight: 48, borderColor: "#4C4025", borderWidth: 1, borderRadius: 13, backgroundColor: "#11110F", color: Brand.ink, paddingHorizontal: 12, marginBottom: 9, writingDirection: "rtl" }, multiline: { minHeight: 76, textAlignVertical: "top", paddingTop: 11 }, photoBlock: { marginBottom: 12 }, photoHint: { color: Brand.muted, fontSize: 12, writingDirection: "rtl", textAlign: "right", marginBottom: 8 }, photoPreviewRow: { flexDirection: "row-reverse", gap: 8, marginTop: 10 }, photoPreviewWrap: { width: 70, height: 70, borderRadius: 13, overflow: "hidden", borderWidth: 1, borderColor: Brand.line }, photoPreview: { width: "100%", height: "100%" }, removePhoto: { position: "absolute", top: 4, left: 4, width: 21, height: 21, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: Brand.pine }, pressed: { opacity: 0.68 },
});
