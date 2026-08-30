import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, StyleSheet, Text, View } from "react-native";

import { AppHeader, Brand, EmptyState, PrimaryButton, SecondaryButton, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { buildPortfolioReportHtml, formatReportDate, getMaddLogoDataUri } from "@/lib/report-pdf";
import { saveNativePdf, shareNativePdf } from "@/lib/pdf-native-sharing";
import { trpc } from "@/lib/trpc";
import { openWebPdfExportWindow, writeWebPdfExportWindow } from "@/lib/web-pdf-export";

type TrackingStatus = "submitted" | "under_review" | "locked" | "in_progress" | "completed" | "cancelled";
const validStatuses: TrackingStatus[] = ["submitted", "under_review", "locked", "in_progress", "completed", "cancelled"];

export default function PortfolioReportScreen() {
  const router = useRouter();
  const { search, status: rawStatus, managerId: rawManagerId, city, dateFrom, dateTo } = useLocalSearchParams<{ search?: string; status?: string; managerId?: string; city?: string; dateFrom?: string; dateTo?: string }>();
  const status = validStatuses.includes(rawStatus as TrackingStatus) ? rawStatus as TrackingStatus : undefined;
  const assignedStaffId = Number(rawManagerId);
  const query = trpc.admin.portfolioReport.useQuery({ search: search?.trim() || undefined, status, assignedStaffId: Number.isInteger(assignedStaffId) && assignedStaffId > 0 ? assignedStaffId : undefined, city: city?.trim() || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
  const companyQuery = trpc.company.settings.useQuery();
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [exportedPdfUri, setExportedPdfUri] = useState<string | null>(null);
  const report = query.data;
  const getHtml = async () => report ? buildPortfolioReportHtml(report, companyQuery.data?.logoUrl || await getMaddLogoDataUri(), companyQuery.data) : "";
  const openWebPdf = async () => {
    const printWindow = openWebPdfExportWindow();
    try {
      writeWebPdfExportWindow(printWindow, await getHtml(), "تقرير مشروعات MADD");
    } catch (error) {
      printWindow.close();
      throw error;
    }
  };
  const printReport = async () => { if (!report) return; setPrinting(true); try { if (Platform.OS === "web") await openWebPdf(); else await Print.printAsync({ html: await getHtml() }); } catch { Alert.alert("تعذرت الطباعة", "تأكد من السماح بالنوافذ المنبثقة أو توفر خدمة الطباعة ثم حاول مرة أخرى."); } finally { setPrinting(false); } };
  const createNativePdf = async () => {
    const savedFileUri = await saveNativePdf({ html: await getHtml(), fileName: `madd-portfolio-report-${Date.now()}` });
    setExportedPdfUri(savedFileUri);
    return savedFileUri;
  };
  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      if (Platform.OS === "web") {
        await openWebPdf();
        Alert.alert("نافذة التصدير جاهزة", "اختر «حفظ كملف PDF» من نافذة الطباعة لتنزيل التقرير.");
        return;
      }
      await createNativePdf();
      Alert.alert("تم تصدير PDF", "أصبح ملف التقرير جاهزاً للمشاركة أو الإرسال عبر أي تطبيق متاح على الهاتف.");
    } catch { Alert.alert("تعذر تصدير PDF", Platform.OS === "web" ? "اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى." : "حاول مرة أخرى بعد التحقق من مساحة التخزين."); }
    finally { setExporting(false); }
  };
  const sharePdf = async () => {
    if (Platform.OS === "web") { await exportPdf(); return; }
    setSharingPdf(true);
    try {
      const fileUri = exportedPdfUri ?? await createNativePdf();
      await shareNativePdf(fileUri, "مشاركة تقرير MADD الشامل");
    } catch (error) { Alert.alert("تعذرت مشاركة التقرير", error instanceof Error ? error.message : "حاول مرة أخرى بعد التحقق من توفر تطبيق مناسب للمشاركة."); }
    finally { setSharingPdf(false); }
  };

  if (query.isLoading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  if (!report) return <ScreenContainer className="px-5"><FlatList data={[]} keyExtractor={() => "unavailable"} renderItem={() => null} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListHeaderComponent={<><AppHeader title="تقرير شامل" onBack={() => router.back()} /><EmptyState icon="analytics" title="تعذر تجهيز التقرير" description="حاول الرجوع وتحديث قائمة المشروعات." /></>} /></ScreenContainer>;
  const { summary } = report;
  const appliedFilters = [["بحث", search?.trim()], ["المدينة", city?.trim()], ["من", dateFrom], ["إلى", dateTo]].filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}: ${value}`).join(" · ");
  return <ScreenContainer className="px-5"><FlatList data={report.projects} keyExtractor={(item) => String(item.id)} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListHeaderComponent={<><AppHeader title="تقرير شامل" subtitle="نظرة تنفيذية على المشروعات" onBack={() => router.back()} /><View style={styles.hero}><Text style={styles.heroTitle}>تقرير شامل للمشروعات</Text><Text style={styles.heroSub}>آخر إعداد: {formatReportDate(report.generatedAt)}</Text>{appliedFilters ? <Text style={styles.filtersNote}>الفلاتر المطبقة: {appliedFilters}</Text> : null}<View style={styles.actions}><PrimaryButton label="طباعة التقرير" loading={printing} onPress={() => void printReport()} style={styles.action} /><SecondaryButton label="تصدير PDF" loading={exporting} onPress={() => void exportPdf()} style={styles.action} /><SecondaryButton label={Platform.OS === "web" ? "حفظ PDF" : "مشاركة PDF"} loading={sharingPdf} onPress={() => void sharePdf()} style={styles.shareAction} /></View>{exportedPdfUri ? <Text style={styles.exportedNote}>تم تصدير ملف PDF وهو جاهز للمشاركة عبر أي تطبيق متاح.</Text> : <Text style={styles.exportHint}>{Platform.OS === "web" ? "اختر حفظ PDF من نافذة الطباعة لتنزيل التقرير." : "زر المشاركة ينشئ ملف PDF ثم يفتح تطبيقات المشاركة المتاحة."}</Text>}</View><View style={styles.summary}><Metric icon="folder" label="الإجمالي" value={String(summary.total)} /><Metric icon="trending-up" label="متوسط الإنجاز" value={`${summary.averageProgress}%`} /><Metric icon="task-alt" label="مكتملة" value={String(summary.completed)} /><Metric icon="construction" label="قيد التنفيذ" value={String(summary.inProgress)} /></View><Text style={styles.listTitle}>تفاصيل المشروعات</Text></>} renderItem={({ item }) => <View style={styles.card}><View style={styles.top}><StatusPill status={item.status} /><Text style={styles.percent}>{item.progressPercent}%</Text></View><Text style={styles.name}>{item.title}</Text><Text style={styles.meta}>{item.customerName || item.customerEmail || "عميل"} · {[item.propertyType, item.city].filter(Boolean).join(" — ") || "تفاصيل غير مكتملة"}</Text><Text style={styles.manager}>المسؤول: {item.assignedManagerName || item.assignedManagerEmail || "غير معيّن"}</Text><Text style={styles.updated}>آخر تحديث: {formatReportDate(item.updatedAt)}</Text></View>} ListEmptyComponent={<EmptyState icon="folder-open" title="لا توجد مشروعات مطابقة" description="عدّل الفلاتر من صفحة المشروعات ثم أعد إنشاء التقرير." />} /></ScreenContainer>;
}

function Metric({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) { return <View style={styles.metric}><MaterialIcons name={icon} size={17} color={Brand.pine} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ loader: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { paddingBottom: 32 }, hero: { backgroundColor: "#171717", borderColor: Brand.line, borderWidth: 1, borderRadius: 19, padding: 16, marginBottom: 13 }, heroTitle: { color: Brand.ink, fontSize: 20, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, heroSub: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 5 }, filtersNote: { color: Brand.pine, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 8 }, actions: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, marginTop: 15 }, action: { width: "48.5%", minHeight: 45 }, shareAction: { width: "100%", minHeight: 45 }, exportHint: { color: Brand.muted, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 9 }, exportedNote: { color: Brand.pine, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 9 }, summary: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, marginBottom: 17 }, metric: { width: "48.5%", minHeight: 89, alignItems: "flex-end", justifyContent: "center", backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 16, padding: 12 }, metricValue: { color: Brand.pine, fontSize: 20, fontWeight: "900", marginTop: 4 }, metricLabel: { color: Brand.muted, fontSize: 11, writingDirection: "rtl", marginTop: 2 }, listTitle: { color: Brand.ink, fontSize: 16, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 8 }, card: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 17, padding: 13, marginBottom: 9 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, percent: { color: Brand.pine, fontSize: 16, fontWeight: "900" }, name: { color: Brand.ink, fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 11 }, meta: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 5 }, manager: { color: Brand.pine, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 8 }, updated: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 5 } });
