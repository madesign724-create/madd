import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Brand, EmptyState, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { buildAdminActivityReportHtml, formatReportDate, getMaddLogoDataUri } from "@/lib/report-pdf";
import { saveNativePdf, shareNativePdf } from "@/lib/pdf-native-sharing";
import { trpc } from "@/lib/trpc";
import { openWebPdfExportWindow, type WebPdfExportWindow, writeWebPdfExportWindow } from "@/lib/web-pdf-export";

type CompanyForm = {
  legalName: string;
  arabicName: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  website: string;
  publicTagline: string;
  publicHeroTitle: string;
  publicHeroBody: string;
  reportFooter: string;
};

type ActivityFilterState = {
  search: string;
  action: string | null;
  actorUserId: number | null;
  dateFrom: string;
  dateTo: string;
};

const emptyForm: CompanyForm = {
  legalName: "MADD Engineering & Finishes",
  arabicName: "ماد للهندسة والتشطيبات",
  supportEmail: "madesign724@gmail.com",
  supportPhone: "",
  address: "",
  website: "",
  publicTagline: "هندسة وتشطيبات راقية",
  publicHeroTitle: "تفاصيل استثنائية لمساحتك.",
  publicHeroBody: "استكشف الاختيارات، احفظ تفضيلاتك، وأرسل طلبك لفريق MADD المتخصص.",
  reportFooter: "تقرير إداري داخلي من منصة MADD Engineering & Finishes.",
};

const emptyActivityFilters: ActivityFilterState = { search: "", action: null, actorUserId: null, dateFrom: "", dateTo: "" };

const actionLabels: Record<string, string> = {
  company_settings_updated: "تحديث بيانات الشركة",
  company_logo_updated: "تحديث شعار الشركة",
  ownership_transferred: "نقل ملكية التشغيل",
  backup_owner_updated: "تحديث المالك الاحتياطي",
  staff_invited: "إضافة عضو فريق",
  staff_updated: "تعديل عضو فريق",
  service_created: "إضافة خدمة رئيسية",
  service_updated: "تعديل خدمة رئيسية",
  service_deleted: "حذف خدمة رئيسية",
  service_image_updated: "تحديث صورة خدمة",
  services_reordered: "إعادة ترتيب الخدمات",
  services_order_reset: "استعادة ترتيب الخدمات",
  services_default_order_saved: "حفظ ترتيب الخدمات الافتراضي",
  catalog_node_created: "إضافة تقسيمة كتالوج",
  catalog_node_updated: "تعديل تقسيمة كتالوج",
  catalog_node_deleted: "حذف تقسيمة كتالوج",
  catalog_node_image_updated: "تحديث صورة تقسيمة",
  catalog_nodes_reordered: "إعادة ترتيب التقسيمات",
  product_created: "إضافة منتج",
  product_updated: "تعديل منتج",
  product_shown: "إظهار منتج",
  product_hidden: "إخفاء منتج",
  product_deleted: "حذف منتج",
  product_images_uploaded: "إضافة صور منتج",
  product_image_deleted: "حذف صورة منتج",
  products_reordered: "إعادة ترتيب المنتجات",
  project_manager_assigned: "تحديث مسؤول مشروع",
  project_status_updated: "تعديل حالة مشروع",
  project_update_published: "نشر تحديث مشروع",
  customer_profile_updated: "تحديث ملف عميل",
  customer_project_created: "إنشاء مشروع عميل",
  customer_project_updated: "تعديل مشروع عميل",
  customer_project_services_updated: "تعديل خدمات مشروع",
  customer_project_selection_added: "إضافة اختيار إلى مشروع",
  customer_project_attachment_uploaded: "رفع مرفق لمشروع",
  customer_project_submitted: "إرسال مشروع للمراجعة",
};

function toForm(settings: { legalName: string; arabicName: string; supportEmail: string; supportPhone: string | null; address: string | null; website: string | null; publicTagline: string; publicHeroTitle: string; publicHeroBody: string | null; reportFooter: string }): CompanyForm {
  return {
    legalName: settings.legalName,
    arabicName: settings.arabicName,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone ?? "",
    address: settings.address ?? "",
    website: settings.website ?? "",
    publicTagline: settings.publicTagline,
    publicHeroTitle: settings.publicHeroTitle,
    publicHeroBody: settings.publicHeroBody ?? "",
    reportFooter: settings.reportFooter,
  };
}

function isValidDate(value: string) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function activityActionLabel(action: string) {
  return actionLabels[action] || action.replace(/_/g, " ");
}

export function AdminCompanyTools({ headerContent }: { headerContent?: ReactNode }) {
  const utils = trpc.useUtils();
  const accessQuery = trpc.admin.me.useQuery();
  const isOwner = accessQuery.data?.role === "owner";
  const settingsQuery = trpc.admin.companySettings.useQuery(undefined, { enabled: isOwner });
  const candidatesQuery = trpc.admin.ownerCandidates.useQuery(undefined, { enabled: isOwner });
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [backupOwnerUserId, setBackupOwnerUserId] = useState<number | null>(null);
  const [transferToUserId, setTransferToUserId] = useState<number | null>(null);
  const [transferConfirmation, setTransferConfirmation] = useState("");
  const [activityFilters, setActivityFilters] = useState<ActivityFilterState>(emptyActivityFilters);
  const [appliedActivityFilters, setAppliedActivityFilters] = useState<ActivityFilterState>(emptyActivityFilters);
  const [exportingActivityPdf, setExportingActivityPdf] = useState(false);
  const [sharingActivityPdf, setSharingActivityPdf] = useState(false);
  const [exportedActivityPdfUri, setExportedActivityPdfUri] = useState<string | null>(null);

  const hasInvalidActivityDates = !isValidDate(appliedActivityFilters.dateFrom)
    || !isValidDate(appliedActivityFilters.dateTo)
    || Boolean(appliedActivityFilters.dateFrom && appliedActivityFilters.dateTo && appliedActivityFilters.dateFrom > appliedActivityFilters.dateTo);
  const activityQuery = trpc.admin.adminActivity.useQuery(
    hasInvalidActivityDates
      ? undefined
      : {
          limit: 150,
          search: appliedActivityFilters.search.trim() || undefined,
          action: appliedActivityFilters.action || undefined,
          actorUserId: appliedActivityFilters.actorUserId || undefined,
          dateFrom: appliedActivityFilters.dateFrom || undefined,
          dateTo: appliedActivityFilters.dateTo || undefined,
        },
    { enabled: isOwner && !hasInvalidActivityDates },
  );

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(toForm(settingsQuery.data));
      setBackupOwnerUserId(settingsQuery.data.backupOwnerUserId ?? null);
    }
  }, [settingsQuery.data]);

  const actorNames = useMemo(() => new Map(
    (candidatesQuery.data ?? [])
      .filter((candidate): candidate is typeof candidate & { userId: number } => candidate.userId !== null)
      .map((candidate) => [candidate.userId, candidate.displayName || candidate.email]),
  ), [candidatesQuery.data]);
  const activityEntries = useMemo(() => (activityQuery.data ?? []).map((entry) => ({
    ...entry,
    actorName: actorNames.get(entry.actorUserId) || `حساب إداري #${entry.actorUserId}`,
  })), [activityQuery.data, actorNames]);
  const availableActions = useMemo(() => Array.from(new Set([
    ...Object.keys(actionLabels),
    ...activityEntries.map((entry) => entry.action),
  ])).sort((first, second) => activityActionLabel(first).localeCompare(activityActionLabel(second), "ar")), [activityEntries]);
  const activityActors = (candidatesQuery.data ?? []).filter((candidate): candidate is typeof candidate & { userId: number } => candidate.userId !== null);

  const invalidateCompany = () => {
    void utils.admin.companySettings.invalidate();
    void utils.admin.ownerCandidates.invalidate();
    void utils.company.settings.invalidate();
  };
  const updateSettings = trpc.admin.updateCompanySettings.useMutation({
    onSuccess: () => { invalidateCompany(); Alert.alert("تم الحفظ", "تم تحديث بيانات الشركة الظاهرة للعملاء وفي ملفات PDF."); },
    onError: (error) => Alert.alert("تعذر الحفظ", error.message),
  });
  const uploadLogo = trpc.admin.uploadCompanyLogo.useMutation({
    onSuccess: () => { invalidateCompany(); Alert.alert("تم رفع الشعار", "سيظهر الشعار الجديد في الواجهات والتقارير."); },
    onError: (error) => Alert.alert("تعذر رفع الشعار", error.message),
  });
  const governance = trpc.admin.companyGovernance.useMutation({
    onSuccess: (_, input) => {
      invalidateCompany();
      setTransferConfirmation("");
      setTransferToUserId(null);
      Alert.alert(input.transferToUserId ? "تم نقل الملكية" : "تم الحفظ", input.transferToUserId ? "أصبح الحساب المحدد مالك تشغيل MADD." : "تم تحديث المالك الاحتياطي.");
    },
    onError: (error) => Alert.alert("تعذر تحديث الحوكمة", error.message),
  });

  if (!isOwner) return null;

  const saveCompany = () => {
    if (!form.legalName.trim() || !form.arabicName.trim() || !form.supportEmail.trim() || !form.publicHeroTitle.trim() || !form.reportFooter.trim()) {
      Alert.alert("بيانات ناقصة", "أكمل اسمَي الشركة والبريد والعنوان الرئيسي وتذييل التقرير.");
      return;
    }
    updateSettings.mutate({
      legalName: form.legalName.trim(), arabicName: form.arabicName.trim(), supportEmail: form.supportEmail.trim(),
      supportPhone: form.supportPhone.trim() || null, address: form.address.trim() || null, website: form.website.trim() || null,
      publicTagline: form.publicTagline.trim(), publicHeroTitle: form.publicHeroTitle.trim(),
      publicHeroBody: form.publicHeroBody.trim() || null, reportFooter: form.reportFooter.trim(),
    });
  };
  const chooseLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert("تعذر قراءة الصورة", "اختر صورة بصيغة مدعومة وحاول مجدداً."); return; }
    if (Math.floor((asset.base64.length * 3) / 4) > 3 * 1024 * 1024) { Alert.alert("حجم كبير", "اختر شعاراً لا يزيد حجمه على 3 ميغابايت."); return; }
    uploadLogo.mutate({ image: { fileName: asset.fileName || `madd-logo-${Date.now()}.png`, mimeType: asset.mimeType || "image/png", dataBase64: asset.base64 } });
  };
  const confirmTransfer = () => {
    if (!transferToUserId || transferConfirmation !== "نقل الملكية") { Alert.alert("تأكيد مطلوب", "اختر المالك الجديد واكتب العبارة «نقل الملكية» كاملةً قبل المتابعة."); return; }
    const candidate = (candidatesQuery.data ?? []).find((item) => item.userId === transferToUserId);
    Alert.alert("تأكيد نقل الملكية", `سيصبح ${candidate?.displayName || candidate?.email || "الحساب المحدد"} مالك تشغيل MADD، وستتغير صلاحيات حسابك إلى المشاهدة فقط.`, [
      { text: "إلغاء", style: "cancel" },
      { text: "نقل الملكية", style: "destructive", onPress: () => governance.mutate({ transferToUserId, confirmation: "نقل الملكية" }) },
    ]);
  };
  const applyActivityFilters = () => {
    if (!isValidDate(activityFilters.dateFrom) || !isValidDate(activityFilters.dateTo)) {
      Alert.alert("صيغة التاريخ غير صحيحة", "اكتب التاريخ بالصيغة YYYY-MM-DD، مثل 2026-08-21.");
      return;
    }
    if (activityFilters.dateFrom && activityFilters.dateTo && activityFilters.dateFrom > activityFilters.dateTo) {
      Alert.alert("الفترة غير صحيحة", "يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساوياً له.");
      return;
    }
    setAppliedActivityFilters({ ...activityFilters, search: activityFilters.search.trim() });
    setExportedActivityPdfUri(null);
  };
  const resetActivityFilters = () => {
    setActivityFilters(emptyActivityFilters);
    setAppliedActivityFilters(emptyActivityFilters);
    setExportedActivityPdfUri(null);
  };
  const createNativeActivityPdf = async () => {
    const logoDataUri = settingsQuery.data?.logoUrl || await getMaddLogoDataUri();
    const actorName = appliedActivityFilters.actorUserId ? actorNames.get(appliedActivityFilters.actorUserId) : undefined;
    const html = buildAdminActivityReportHtml({
      generatedAt: new Date(),
      filters: { search: appliedActivityFilters.search || undefined, action: appliedActivityFilters.action ? activityActionLabel(appliedActivityFilters.action) : undefined, actorName, dateFrom: appliedActivityFilters.dateFrom || undefined, dateTo: appliedActivityFilters.dateTo || undefined },
      entries: activityEntries,
    }, logoDataUri, settingsQuery.data);
    const savedFileUri = await saveNativePdf({ html, fileName: `madd-admin-activity-${Date.now()}` });
    setExportedActivityPdfUri(savedFileUri);
    return savedFileUri;
  };
  const exportActivityPdf = async () => {
    setExportingActivityPdf(true);
    let webPrintWindow: WebPdfExportWindow | null = null;
    try {
      webPrintWindow = Platform.OS === "web" ? openWebPdfExportWindow() : null;
      const logoDataUri = settingsQuery.data?.logoUrl || await getMaddLogoDataUri();
      const actorName = appliedActivityFilters.actorUserId ? actorNames.get(appliedActivityFilters.actorUserId) : undefined;
      const html = buildAdminActivityReportHtml({
        generatedAt: new Date(),
        filters: { search: appliedActivityFilters.search || undefined, action: appliedActivityFilters.action ? activityActionLabel(appliedActivityFilters.action) : undefined, actorName, dateFrom: appliedActivityFilters.dateFrom || undefined, dateTo: appliedActivityFilters.dateTo || undefined },
        entries: activityEntries,
      }, logoDataUri, settingsQuery.data);
      if (Platform.OS === "web") {
        try {
          writeWebPdfExportWindow(webPrintWindow!, html, "سجل نشاط MADD الإداري");
        } catch (error) {
          webPrintWindow?.close();
          throw error;
        }
        Alert.alert("نافذة التصدير جاهزة", "اختر «حفظ كملف PDF» من نافذة الطباعة لتنزيل السجل.");
        return;
      }
      await createNativeActivityPdf();
      Alert.alert("تم تصدير PDF", "أصبح سجل النشاط جاهزاً للمشاركة أو الإرسال عبر أي تطبيق متاح على الهاتف.");
    } catch {
      webPrintWindow?.close();
      Alert.alert("تعذر تصدير PDF", Platform.OS === "web" ? "اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى." : "حاول مرة أخرى بعد التحقق من مساحة التخزين.");
    } finally {
      setExportingActivityPdf(false);
    }
  };
  const shareActivityPdf = async () => {
    if (Platform.OS === "web") { await exportActivityPdf(); return; }
    setSharingActivityPdf(true);
    try {
      const fileUri = exportedActivityPdfUri ?? await createNativeActivityPdf();
      await shareNativePdf(fileUri, "مشاركة سجل نشاط MADD");
    } catch (error) {
      Alert.alert("تعذرت مشاركة السجل", error instanceof Error ? error.message : "حاول مرة أخرى بعد التحقق من توفر تطبيق مناسب للمشاركة.");
    } finally {
      setSharingActivityPdf(false);
    }
  };
  const setField = (field: keyof CompanyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const governanceCandidates = (candidatesQuery.data ?? []).filter((candidate) => candidate.userId !== null && candidate.userId !== settingsQuery.data?.ownerUserId);

  return (
    <FlatList data={[]} keyExtractor={() => "company-tools"} renderItem={() => null} style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" ListHeaderComponent={<>
      {headerContent}
      <View style={styles.pageHeader}>
        <View style={styles.headerCopy}><Text style={styles.title}>إعدادات الشركة والحوكمة</Text><Text style={styles.subtitle}>الهوية، بيانات التواصل، النصوص العامة، سجل التدقيق وملكية التشغيل.</Text></View>
        <View style={styles.headerIcon}><MaterialIcons name="business-center" size={22} color={Brand.pine} /></View>
      </View>
      {settingsQuery.isLoading ? <View style={styles.loading}><ActivityIndicator color={Brand.pine} /></View> : <>
        <View style={styles.card}>
          <Text style={styles.heading}>هوية الشركة وبيانات التواصل</Text><Text style={styles.help}>تظهر هذه البيانات في المحتوى العام والتقارير. احفظ التغييرات بعد تعديلها.</Text>
          <View style={styles.logoRow}>{settingsQuery.data?.logoUrl ? <Image source={{ uri: settingsQuery.data.logoUrl }} style={styles.logo} /> : <View style={styles.logoFallback}><Text style={styles.logoLetters}>MADD</Text></View>}<View style={styles.logoCopy}><Text style={styles.logoText}>شعار الشركة</Text><SecondaryButton label="تغيير الشعار" loading={uploadLogo.isPending} onPress={chooseLogo} /></View></View>
          <Field label="الاسم الإنجليزي" value={form.legalName} onChangeText={(value) => setField("legalName", value)} /><Field label="الاسم العربي" value={form.arabicName} onChangeText={(value) => setField("arabicName", value)} />
          <Field label="بريد الإدارة" value={form.supportEmail} keyboardType="email-address" onChangeText={(value) => setField("supportEmail", value)} /><Field label="هاتف التواصل (اختياري)" value={form.supportPhone} keyboardType="phone-pad" onChangeText={(value) => setField("supportPhone", value)} />
          <Field label="العنوان (اختياري)" value={form.address} multiline onChangeText={(value) => setField("address", value)} /><Field label="الموقع الإلكتروني (اختياري)" value={form.website} keyboardType="url" onChangeText={(value) => setField("website", value)} />
        </View>
        <View style={styles.card}>
          <Text style={styles.heading}>النصوص العامة</Text><Text style={styles.help}>تتحكم في العنوان والوصف الظاهرين للعميل، إضافة إلى تذييل ملفات PDF.</Text>
          <Field label="وصف قصير" value={form.publicTagline} onChangeText={(value) => setField("publicTagline", value)} /><Field label="عنوان الواجهة" value={form.publicHeroTitle} onChangeText={(value) => setField("publicHeroTitle", value)} />
          <Field label="وصف الواجهة" value={form.publicHeroBody} multiline onChangeText={(value) => setField("publicHeroBody", value)} /><Field label="تذييل تقرير PDF" value={form.reportFooter} multiline onChangeText={(value) => setField("reportFooter", value)} />
          <PrimaryButton label="حفظ بيانات الشركة" loading={updateSettings.isPending} onPress={saveCompany} />
        </View>
        <View style={styles.governanceCard}>
          <Text style={[styles.heading, styles.governanceHeading]}>حوكمة المالك</Text><Text style={[styles.help, styles.governanceHelp]}>حدد مالكاً احتياطياً من أعضاء الفريق النشطين. هذا الحساب لا يحصل على صلاحيات المالك تلقائياً.</Text>
          <Text style={styles.selectionLabel}>المالك الاحتياطي</Text><View style={styles.chips}><OwnerChip active={backupOwnerUserId === null} label="لا يوجد" onPress={() => setBackupOwnerUserId(null)} />{governanceCandidates.map((item) => <OwnerChip key={item.id} active={backupOwnerUserId === item.userId} label={item.displayName || item.email} onPress={() => setBackupOwnerUserId(item.userId)} />)}</View>
          <SecondaryButton label="حفظ المالك الاحتياطي" loading={governance.isPending} onPress={() => governance.mutate({ backupOwnerUserId })} />
          <View style={styles.dangerDivider} /><Text style={styles.transferTitle}>نقل ملكية التشغيل</Text><Text style={[styles.help, styles.governanceHelp]}>هذه العملية دائمة فور التأكيد. ستتحول صلاحياتك إلى المشاهدة بعد النقل.</Text>
          <View style={styles.chips}>{governanceCandidates.map((item) => <OwnerChip key={`transfer-${item.id}`} active={transferToUserId === item.userId} label={item.displayName || item.email} onPress={() => setTransferToUserId(item.userId)} />)}</View>
          <Field label="اكتب «نقل الملكية» للتأكيد" value={transferConfirmation} onChangeText={setTransferConfirmation} /><Pressable onPress={confirmTransfer} style={({ pressed }) => [styles.transferButton, pressed && styles.pressed]}><Text style={styles.transferText}>تأكيد نقل الملكية</Text></Pressable>
        </View>
        <View style={styles.activityCard}>
          <View style={styles.activityHeader}><View style={styles.activityHeaderCopy}><Text style={styles.heading}>سجل النشاط الإداري</Text><Text style={styles.help}>راجع حتى 150 عملية إدارية حديثة، ثم صدّر النتائج المفلترة كملف PDF.</Text></View><MaterialIcons name="history" size={22} color={Brand.pine} /></View>
          <Field label="بحث في تفاصيل العملية" value={activityFilters.search} placeholder="مثال: منتج أو مشروع أو عضو فريق" onChangeText={(search) => setActivityFilters((current) => ({ ...current, search }))} />
          <Text style={styles.filterLabel}>نوع الإجراء</Text><View style={styles.chips}><FilterChip active={!activityFilters.action} label="كل الإجراءات" onPress={() => setActivityFilters((current) => ({ ...current, action: null }))} />{availableActions.map((action) => <FilterChip key={action} active={activityFilters.action === action} label={activityActionLabel(action)} onPress={() => setActivityFilters((current) => ({ ...current, action }))} />)}</View>
          <Text style={styles.filterLabel}>المنفذ</Text><View style={styles.chips}><FilterChip active={!activityFilters.actorUserId} label="كل المنفذين" onPress={() => setActivityFilters((current) => ({ ...current, actorUserId: null }))} />{activityActors.map((actor) => <FilterChip key={actor.id} active={activityFilters.actorUserId === actor.userId} label={actor.displayName || actor.email} onPress={() => setActivityFilters((current) => ({ ...current, actorUserId: actor.userId }))} />)}</View>
          <View style={styles.dateRow}><View style={styles.dateField}><Field label="من تاريخ" value={activityFilters.dateFrom} placeholder="YYYY-MM-DD" onChangeText={(dateFrom) => setActivityFilters((current) => ({ ...current, dateFrom }))} /></View><View style={styles.dateField}><Field label="إلى تاريخ" value={activityFilters.dateTo} placeholder="YYYY-MM-DD" onChangeText={(dateTo) => setActivityFilters((current) => ({ ...current, dateTo }))} /></View></View>
          <View style={styles.filterActions}><PrimaryButton label="تطبيق الفلاتر" onPress={applyActivityFilters} style={styles.filterButton} /><SecondaryButton label="إعادة ضبط" onPress={resetActivityFilters} style={styles.filterButton} /></View>
          <View style={styles.activityPdfActions}><SecondaryButton label="تصدير PDF" loading={exportingActivityPdf} onPress={() => void exportActivityPdf()} style={styles.filterButton} /><SecondaryButton label={Platform.OS === "web" ? "حفظ PDF" : "مشاركة PDF"} loading={sharingActivityPdf} onPress={() => void shareActivityPdf()} style={styles.filterButton} /></View>
          {exportedActivityPdfUri ? <Text style={styles.exportedNote}>تم حفظ ملف PDF وهو جاهز للمشاركة عبر أي تطبيق متاح على الهاتف.</Text> : <Text style={styles.exportHint}>{Platform.OS === "web" ? "اختر حفظ PDF من نافذة الطباعة لتنزيل السجل." : "زر المشاركة ينشئ ملف PDF ثم يفتح تطبيقات المشاركة المتاحة."}</Text>}
          {activityQuery.isLoading ? <View style={styles.activityLoading}><ActivityIndicator color={Brand.pine} /><Text style={styles.loadingText}>جارٍ تحميل السجل…</Text></View> : activityQuery.error ? <EmptyState icon="error-outline" title="تعذر تحميل السجل" description={activityQuery.error.message} /> : activityEntries.length ? <View style={styles.activityList}>{activityEntries.map((entry) => <ActivityEntry key={entry.id} action={activityActionLabel(entry.action)} actorName={entry.actorName} summary={entry.summary} createdAt={entry.createdAt} />)}</View> : <EmptyState icon="history" title="لا توجد عمليات مطابقة" description="جرّب إزالة بعض الفلاتر أو غيّر فترة التاريخ." />}
        </View>
      </>}
    </>} />
  );
}

function Field({ label, value, onChangeText, multiline = false, keyboardType, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; keyboardType?: "default" | "email-address" | "phone-pad" | "url"; placeholder?: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Brand.muted} multiline={multiline} keyboardType={keyboardType} autoCapitalize="none" textAlign="right" style={[styles.input, multiline && styles.multiline]} /></View>;
}

function OwnerChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.ownerChip, active && styles.ownerChipActive, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.ownerChipText, active && styles.ownerChipTextActive]}>{label}</Text></Pressable>;
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.filterChip, active && styles.filterChipActive, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></Pressable>;
}

function ActivityEntry({ action, actorName, summary, createdAt }: { action: string; actorName: string; summary: string; createdAt: Date | string }) {
  return <View style={styles.activityEntry}><View style={styles.activityEntryTop}><Text style={styles.activityAction}>{action}</Text><Text style={styles.activityDate}>{formatReportDate(createdAt)}</Text></View><Text style={styles.activitySummary}>{summary}</Text><Text style={styles.activityActor}>المنفذ: {actorName}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingBottom: 30 }, pageHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 11, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 18, padding: 14, marginBottom: 12 }, headerCopy: { flex: 1 }, headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#1D1B13" }, title: { color: Brand.ink, fontSize: 18, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, subtitle: { color: Brand.muted, fontSize: 11, marginTop: 4, textAlign: "right", writingDirection: "rtl", lineHeight: 17 }, loading: { flex: 1, minHeight: 250, alignItems: "center", justifyContent: "center" }, card: { backgroundColor: Brand.paleGreen, borderColor: Brand.line, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 }, governanceCard: { backgroundColor: "#191813", borderColor: "#6B5B2A", borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 }, activityCard: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 14 }, heading: { color: Brand.ink, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" }, governanceHeading: { color: "#F2D98A" }, help: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 7, marginBottom: 11 }, governanceHelp: { color: "#C1B997" }, logoRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginBottom: 13 }, logo: { width: 68, height: 68, borderRadius: 14, backgroundColor: "#111" }, logoFallback: { width: 68, height: 68, borderRadius: 14, backgroundColor: "#0C0C0C", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Brand.pine }, logoLetters: { color: Brand.pine, fontSize: 14, fontWeight: "900" }, logoCopy: { flex: 1, alignItems: "flex-end" }, logoText: { color: Brand.ink, fontSize: 13, fontWeight: "800", marginBottom: 6, writingDirection: "rtl" }, field: { marginBottom: 10 }, fieldLabel: { color: Brand.ink, fontSize: 12, fontWeight: "800", writingDirection: "rtl", textAlign: "right", marginBottom: 6 }, input: { minHeight: 47, borderRadius: 12, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.card, paddingHorizontal: 12, color: Brand.ink, fontSize: 14, writingDirection: "rtl" }, multiline: { minHeight: 76, textAlignVertical: "top", paddingTop: 11 }, selectionLabel: { color: "#F2D98A", fontSize: 12, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 7 }, filterLabel: { color: Brand.ink, fontSize: 12, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 7 }, chips: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 11 }, ownerChip: { maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#26241C", borderWidth: 1, borderColor: "#5A523A" }, ownerChipActive: { backgroundColor: Brand.pine, borderColor: Brand.pine }, ownerChipText: { color: "#E5DFCB", fontSize: 11, fontWeight: "700", writingDirection: "rtl" }, ownerChipTextActive: { color: "#0C0C0C" }, filterChip: { maxWidth: "100%", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#242424", borderWidth: 1, borderColor: Brand.line }, filterChipActive: { backgroundColor: Brand.pine, borderColor: Brand.pine }, filterChipText: { color: Brand.ink, fontSize: 11, fontWeight: "700", writingDirection: "rtl" }, filterChipTextActive: { color: "#0C0C0C" }, dangerDivider: { height: 1, backgroundColor: "#5A3A32", marginVertical: 13 }, transferTitle: { color: "#E99B86", fontSize: 14, fontWeight: "900", writingDirection: "rtl", textAlign: "right" }, transferButton: { minHeight: 47, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#44251F", borderWidth: 1, borderColor: "#A96656" }, transferText: { color: "#FFD7CF", fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] }, activityHeader: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10 }, activityHeaderCopy: { flex: 1 }, dateRow: { flexDirection: "row-reverse", gap: 9 }, dateField: { flex: 1 }, filterActions: { flexDirection: "row-reverse", gap: 9, marginTop: 2 }, activityPdfActions: { flexDirection: "row-reverse", gap: 9, marginTop: 9 }, filterButton: { flex: 1, minHeight: 45 }, exportHint: { color: Brand.muted, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 10 }, exportedNote: { color: Brand.pine, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 10 }, activityLoading: { minHeight: 110, alignItems: "center", justifyContent: "center", gap: 8 }, loadingText: { color: Brand.muted, fontSize: 12, writingDirection: "rtl" }, activityList: { marginTop: 13 }, activityEntry: { backgroundColor: "#111111", borderWidth: 1, borderColor: Brand.line, borderRadius: 14, padding: 12, marginBottom: 8 }, activityEntryTop: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }, activityAction: { color: Brand.pine, fontSize: 13, fontWeight: "900", writingDirection: "rtl", flex: 1, textAlign: "right" }, activityDate: { color: Brand.muted, fontSize: 10, writingDirection: "rtl", textAlign: "left" }, activitySummary: { color: Brand.ink, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 8 }, activityActor: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 7 },
});
