import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";

const sections = [
  {
    title: "1. نطاق هذه السياسة",
    body: "تشرح هذه السياسة كيفية تعامل MADD Engineering & Finishes (ويُشار إليها باسم «MADD») مع البيانات عند استخدام تطبيقها وموقعها. تنطبق على العملاء وأعضاء فريق العمل المخوّلين.",
  },
  {
    title: "2. البيانات التي نجمعها",
    body: "قد نجمع الاسم والبريد الإلكتروني ورقم الجوال، وبيانات المشروع التي تدخلها مثل نوع العقار والمدينة والعنوان والمساحة والملاحظات والاختيارات. إذا رفعت صوراً أو مرفقات للمشروع، نحفظها لعرضها لفريق المشروع. كما نحفظ رمز إشعارات الجهاز عند منحك الإذن لتلقي تحديثات مشروعك.",
  },
  {
    title: "3. لماذا نستخدم البيانات",
    body: "نستخدم البيانات لإنشاء حسابك وتأمينه، وحفظ مشروعك واختياراتك، والتواصل بشأن طلبك، وعرض تحديثات التنفيذ، وإرسال الإشعارات التي طلبتها، وتشغيل التطبيق وحمايته. لا نبيع بياناتك الشخصية ولا نستخدمها للإعلانات الموجهة.",
  },
  {
    title: "4. مشاركة البيانات",
    body: "يصل فريق MADD المخوّل إلى بيانات المشروع بقدر ما يلزم لتنفيذ الخدمة. نستخدم مزودي خدمة تقنيين لتشغيل المصادقة وقاعدة البيانات وتخزين الملفات والإشعارات، مثل Supabase وExpo. لا نسمح لهؤلاء المزودين باستخدام البيانات لأغراضهم التسويقية المستقلة.",
  },
  {
    title: "5. الحماية والاحتفاظ",
    body: "نستخدم اتصالات مشفرة عند نقل البيانات ونطبق صلاحيات وصول بحسب الحساب والدور. نحتفظ ببيانات الحساب والمشروع ما دام الحساب أو المشروع نشطاً أو كان الاحتفاظ ضرورياً لتقديم الخدمة. عند طلب الحذف، نعالج الطلب خلال 30 يوماً ما لم يلزمنا القانون بالاحتفاظ بجزء محدد من السجلات لفترة أطول.",
  },
  {
    title: "6. خياراتك وحذف الحساب",
    body: "يمكنك تحديث اسمك ورقم جوالك من «حسابي» وإدارة أذونات الإشعارات من إعدادات جهازك. لطلب حذف الحساب والبيانات المرتبطة به، افتح صفحة «طلب حذف الحساب» وأرسل الطلب من البريد الإلكتروني المسجل. قد نطلب معلومات إضافية للتحقق من الملكية قبل التنفيذ.",
  },
  {
    title: "7. الأطفال والتغييرات والتواصل",
    body: "التطبيق غير موجّه للأطفال. إذا عدّلنا طريقة معالجة البيانات بصورة جوهرية، سنحدّث هذه الصفحة وتاريخها. للاستفسار عن الخصوصية أو طلب حذف البيانات، تواصل معنا عبر madesign724@gmail.com.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <ScreenContainer className="px-5">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} directionalLockEnabled>
        <AppHeader title="سياسة الخصوصية" subtitle="MADD Engineering & Finishes" onBack={() => router.back()} />
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>خصوصيتك مهمة لنا</Text>
          <Text style={styles.heroTitle}>سياسة خصوصية MADD</Text>
          <Text style={styles.heroText}>آخر تحديث: 22 أغسطس 2026</Text>
        </View>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
        <Text style={styles.footer}>هذه الصفحة متاحة للجميع ويمكن استخدامها كرابط سياسة الخصوصية في صفحات المتجر.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  hero: { backgroundColor: "#211B10", borderColor: "#665529", borderWidth: 1, borderRadius: 22, padding: 20, marginBottom: 14, alignItems: "flex-end" },
  eyebrow: { color: Brand.pine, fontSize: 11, fontWeight: "900", writingDirection: "rtl", textAlign: "right", alignSelf: "stretch" },
  heroTitle: { color: Brand.ink, fontSize: 24, fontWeight: "900", writingDirection: "rtl", textAlign: "right", alignSelf: "stretch", marginTop: 5 },
  heroText: { color: Brand.muted, fontSize: 12, writingDirection: "rtl", textAlign: "right", alignSelf: "stretch", marginTop: 8 },
  section: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 10 },
  sectionTitle: { color: Brand.ink, fontSize: 15, fontWeight: "900", writingDirection: "rtl", textAlign: "right", alignSelf: "stretch" },
  sectionBody: { color: Brand.muted, fontSize: 13, lineHeight: 21, writingDirection: "rtl", textAlign: "right", alignSelf: "stretch", marginTop: 8 },
  footer: { color: Brand.muted, fontSize: 11, lineHeight: 18, writingDirection: "rtl", textAlign: "center", marginTop: 10 },
});
