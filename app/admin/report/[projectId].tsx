import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Print from "expo-print";
import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Platform, StyleSheet, Text, View } from "react-native";

import { AppHeader, Brand, EmptyState, PrimaryButton, SecondaryButton, StatusPill } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { buildProjectReportHtml, formatReportDate, getMaddLogoDataUri } from "@/lib/report-pdf";
import { saveNativePdf, shareNativePdf } from "@/lib/pdf-native-sharing";
import { trpc } from "@/lib/trpc";
import { openWebPdfExportWindow, writeWebPdfExportWindow } from "@/lib/web-pdf-export";

export default function ProjectReportScreen() {
  const router = useRouter();
  const { projectId: rawProjectId } = useLocalSearchParams<{ projectId: string }>();
  const projectId = Number(rawProjectId);
  const reportQuery = trpc.admin.lockedProjectReport.useQuery({ projectId }, { enabled: Number.isInteger(projectId) && projectId > 0 });
  const companyQuery = trpc.company.settings.useQuery();
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [exportedPdfUri, setExportedPdfUri] = useState<string | null>(null);
  const report = reportQuery.data;

  const getHtml = async () => report ? buildProjectReportHtml(report, companyQuery.data?.logoUrl || await getMaddLogoDataUri(), companyQuery.data) : "";
  const openWebPdf = async (documentTitle: string) => {
    const printWindow = openWebPdfExportWindow();
    try {
      writeWebPdfExportWindow(printWindow, await getHtml(), documentTitle);
    } catch (error) {
      printWindow.close();
      throw error;
    }
  };
  const printReport = async () => {
    if (!report) return;
    setPrinting(true);
    try { if (Platform.OS === "web") await openWebPdf(`تقرير مشروع MADD - ${report.project.title}`); else await Print.printAsync({ html: await getHtml() }); }
    catch { Alert.alert("تعذرت الطباعة", "تأكد من السماح بالنوافذ المنبثقة أو توفر خدمة الطباعة ثم حاول مرة أخرى."); }
    finally { setPrinting(false); }
  };
  const createNativePdf = async () => {
    if (!report) throw new Error("التقرير غير متاح.");
    const savedFileUri = await saveNativePdf({
      html: await getHtml(),
      fileName: `madd-project-report-${report.project.id}-${Date.now()}`,
    });
    setExportedPdfUri(savedFileUri);
    return savedFileUri;
  };
  const exportPdf = async () => {
    if (!report) return;
    setExporting(true);
    try {
      if (Platform.OS === "web") {
        await openWebPdf(`تقرير مشروع MADD - ${report.project.title}`);
        Alert.alert("نافذة التصدير جاهزة", "اختر «حفظ كملف PDF» من نافذة الطباعة لتنزيل التقرير.");
        return;
      }
      await createNativePdf();
      Alert.alert("تم تصدير PDF", "أصبح ملف التقرير جاهزاً للمشاركة أو الإرسال عبر أي تطبيق متاح على الهاتف.");
    } catch { Alert.alert("تعذر تصدير PDF", Platform.OS === "web" ? "اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى." : "حاول مرة أخرى بعد التحقق من مساحة التخزين المتاحة."); }
    finally { setExporting(false); }
  };
  const sharePdf = async () => {
    if (Platform.OS === "web") { await exportPdf(); return; }
    setSharingPdf(true);
    try {
      const fileUri = exportedPdfUri ?? await createNativePdf();
      await shareNativePdf(fileUri, "مشاركة تقرير MADD");
    } catch (error) { Alert.alert("تعذرت مشاركة التقرير", error instanceof Error ? error.message : "حاول مرة أخرى بعد التحقق من توفر تطبيق مناسب للمشاركة."); }
    finally { setSharingPdf(false); }
  };

  if (reportQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  if (!report) return <ScreenContainer className="px-5"><FlatList data={[]} keyExtractor={() => "unavailable"} renderItem={() => null} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListHeaderComponent={<><AppHeader title="تقرير تفصيلي للمشروع" onBack={() => router.back()} /><EmptyState icon="description" title="التقرير التفصيلي غير متاح" description="لا يمكن عرض التقرير إلا للطلب الذي تم إقفاله وحفظه في النظام." /></>} /></ScreenContainer>;
  const project = report.project;
  return <ScreenContainer className="px-5"><FlatList data={report.updates} keyExtractor={(item) => String(item.id)} showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} ListHeaderComponent={<><AppHeader title="تقرير تفصيلي للمشروع" subtitle={`طلب مقفول رقم ${project.id}`} onBack={() => router.back()} /><View style={styles.reportHero}><View style={styles.heroTop}><StatusPill status={project.status} /><Text style={styles.reportId}>#{project.id}</Text></View><Text style={styles.projectName}>{project.title}</Text><Text style={styles.lockedText}>أُقفل الطلب في {formatReportDate(project.lockedAt)}</Text><Text style={styles.logoNote}>يتضمن ملف PDF رأس MADD الرسمي وبيانات التواصل.</Text><View style={styles.actionRow}><PrimaryButton label="طباعة التقرير" loading={printing} onPress={() => void printReport()} style={styles.actionButton} /><SecondaryButton label="تصدير PDF" loading={exporting} onPress={() => void exportPdf()} style={styles.actionButton} /><SecondaryButton label={Platform.OS === "web" ? "حفظ PDF" : "مشاركة PDF"} loading={sharingPdf} onPress={() => void sharePdf()} style={styles.shareAction} /></View>{exportedPdfUri ? <Text style={styles.exportedNote}>تم تصدير ملف PDF وهو جاهز للمشاركة عبر أي تطبيق متاح.</Text> : <Text style={styles.exportHint}>{Platform.OS === "web" ? "اختر حفظ PDF من نافذة الطباعة لتنزيل التقرير." : "زر المشاركة ينشئ ملف PDF ثم يفتح تطبيقات المشاركة المتاحة."}</Text>}</View><Section title="بيانات المشروع والعميل"><InfoRow icon="person-outline" label="العميل" value={project.customerProfileName || project.customerName || "غير مسجل"} /><InfoRow icon="mail-outline" label="البريد" value={project.customerEmail || "غير مسجل"} /><InfoRow icon="phone" label="الهاتف" value={project.customerPhone || "غير مسجل"} /><InfoRow icon="location-on" label="الموقع" value={[project.city, project.address].filter(Boolean).join(" — ") || "غير مسجل"} /><InfoRow icon="analytics" label="نسبة الإنجاز الحالية" value={`${project.progressPercent}%`} /></Section>{project.notes ? <View style={styles.notesCard}><Text style={styles.notesLabel}>ملاحظات العميل</Text><Text style={styles.notesText}>{project.notes}</Text></View> : null}<Section title="الخدمات المختارة">{report.selectedServices.length ? report.selectedServices.map((service) => <Choice key={service.id} title={service.name} detail={service.notes} />) : <EmptyText />}</Section><Section title="اختيارات المنتجات">{report.selectedProducts.length ? report.selectedProducts.map((product) => <View key={product.id} style={styles.productChoice}>{product.mainImageUrl ? <Image source={{ uri: product.mainImageUrl }} style={styles.productImage} /> : <View style={[styles.productImage, styles.productPlaceholder]}><MaterialIcons name="inventory-2" size={21} color={Brand.pine} /></View>}<View style={styles.productText}><Choice title={`${product.productName || "منتج محذوف من الكتالوج"} × ${product.quantity}`} detail={[product.breadcrumb?.length ? `المسار: ${[...product.breadcrumb, product.productName || "منتج"].join(" ← ")}` : null, product.productCode, product.notes].filter(Boolean).join(" · ")} /></View></View>) : <EmptyText />}</Section><Section title="مرفقات العميل">{report.attachments.length ? report.attachments.map((attachment) => <View key={attachment.id} style={styles.attachment}><MaterialIcons name="attach-file" size={19} color={Brand.pine} /><Choice title={attachment.fileName} detail={attachment.mimeType || "ملف"} /></View>) : <EmptyText />}</Section><Text style={styles.sectionTitle}>سجل مراحل التنفيذ</Text></>} renderItem={({ item }) => <View style={styles.updateCard}><View style={styles.updateTop}><Text style={styles.progress}>{item.progressPercent}%</Text><Text style={styles.updateTitle}>{item.title}</Text></View><Text style={styles.date}>{formatReportDate(item.createdAt)}</Text>{item.note ? <Text style={styles.updateNote}>{item.note}</Text> : null}{item.images.length ? <FlatList horizontal data={item.images} keyExtractor={(image) => String(image.id)} contentContainerStyle={styles.updateImages} renderItem={({ item: image }) => <Image source={{ uri: image.imageUrl }} style={styles.updateImage} />} /> : null}</View>} ListEmptyComponent={<View style={styles.infoCard}><Text style={styles.emptyText}>لا توجد تحديثات مراحل مسجلة لهذا الطلب.</Text></View>} /></ScreenContainer>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <><Text style={styles.sectionTitle}>{title}</Text><View style={styles.infoCard}>{children}</View></>; }
function InfoRow({ icon, label, value }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string }) { return <View style={styles.infoRow}><MaterialIcons name={icon} size={18} color={Brand.pine} /><View style={styles.infoText}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>; }
function Choice({ title, detail }: { title: string; detail?: string | null }) { return <View style={styles.choice}><Text style={styles.choiceTitle}>{title}</Text>{detail ? <Text style={styles.choiceDetail}>{detail}</Text> : null}</View>; }
function EmptyText() { return <Text style={styles.emptyText}>لا توجد بيانات محفوظة.</Text>; }

const styles = StyleSheet.create({ loader: { flex: 1, alignItems: "center", justifyContent: "center" }, content: { paddingBottom: 32 }, reportHero: { backgroundColor: "#171717", borderColor: Brand.line, borderWidth: 1, borderRadius: 19, padding: 16, marginBottom: 17 }, heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, reportId: { color: Brand.pine, fontSize: 15, fontWeight: "900" }, projectName: { color: Brand.ink, fontSize: 20, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 15 }, lockedText: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 5 }, logoNote: { color: Brand.pine, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 5 }, actionRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 9, marginTop: 15 }, actionButton: { width: "48.5%", minHeight: 45 }, shareAction: { width: "100%", minHeight: 45 }, exportHint: { color: Brand.muted, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 9 }, exportedNote: { color: Brand.pine, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 9 }, sectionTitle: { color: Brand.ink, fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 16, marginBottom: 8 }, infoCard: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 17, padding: 13 }, infoRow: { flexDirection: "row-reverse", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line }, infoText: { flex: 1, alignItems: "flex-end" }, infoLabel: { color: Brand.muted, fontSize: 11, writingDirection: "rtl" }, infoValue: { color: Brand.ink, fontSize: 13, textAlign: "right", writingDirection: "rtl", marginTop: 2 }, notesCard: { backgroundColor: Brand.paleGreen, borderColor: Brand.line, borderWidth: 1, borderRadius: 15, padding: 13, marginTop: 10 }, notesLabel: { color: Brand.pine, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, notesText: { color: Brand.ink, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 5 }, choice: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line, alignItems: "flex-end" }, choiceTitle: { color: Brand.ink, fontSize: 13, fontWeight: "800", textAlign: "right", writingDirection: "rtl" }, choiceDetail: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 3 }, productChoice: { flexDirection: "row-reverse", gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line }, productImage: { width: 52, height: 52, borderRadius: 10, backgroundColor: "#181818" }, productPlaceholder: { alignItems: "center", justifyContent: "center" }, productText: { flex: 1, alignItems: "flex-end" }, attachment: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line }, updateCard: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 17, padding: 13, marginBottom: 9 }, updateTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 }, updateTitle: { color: Brand.ink, fontSize: 14, fontWeight: "900", flex: 1, textAlign: "right", writingDirection: "rtl" }, progress: { color: Brand.pine, fontSize: 14, fontWeight: "900" }, date: { color: Brand.muted, fontSize: 11, textAlign: "right", writingDirection: "rtl", marginTop: 4 }, updateNote: { color: Brand.ink, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 9 }, updateImages: { gap: 8, marginTop: 10 }, updateImage: { width: 112, height: 84, borderRadius: 10 }, emptyText: { color: Brand.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", paddingVertical: 6 } });
