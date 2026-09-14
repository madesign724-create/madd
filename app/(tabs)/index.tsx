import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Brand, PrimaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { resolveAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

export default function HomeScreen() {
  const router = useRouter();
  const servicesQuery = trpc.catalog.services.useQuery();
  const companyQuery = trpc.company.settings.useQuery();
  const { isAuthenticated } = useAuth();
  const unreadNotificationsQuery = trpc.notifications.unreadCount.useQuery(undefined, { enabled: isAuthenticated });
  const services = servicesQuery.data ?? [];
  const company = companyQuery.data;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <FlatList
        data={services.slice(0, 4)}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.topBar}>
              <View style={styles.logoMark}><MaterialIcons name="architecture" size={22} color="#0C0C0C" /></View>
              <View style={styles.companyBlock}>
                <Text style={styles.companyArabic}>{company?.arabicName || "ماد للهندسة والتشطيبات"}</Text>
                <Text style={styles.companyEnglish}>{company?.legalName || "MADD ENGINEERING & FINISHES"}</Text>
              </View>
              <Pressable accessibilityLabel="إشعاراتي" onPress={() => router.push("/notifications" as never)} style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}>
                <MaterialIcons name="notifications-none" size={22} color={Brand.pine} />
                {(unreadNotificationsQuery.data ?? 0) > 0 ? <View style={styles.notificationBadge}><Text style={styles.notificationBadgeText}>{Math.min(unreadNotificationsQuery.data ?? 0, 9)}</Text></View> : null}
              </Pressable>
            </View>

            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <View style={styles.heroContent}>
                <Text style={styles.eyebrow}>{company?.publicTagline || "هندسة وتشطيبات راقية"}</Text>
                <Text style={styles.heroTitle}>{company?.publicHeroTitle || "مساحتك تستحق تفاصيل استثنائية."}</Text>
                <Text style={styles.heroText}>{company?.publicHeroBody || "استكشف اختيارات التشطيب، وحدد رؤيتك، واترك التنفيذ لفريق MADD."}</Text>
                <View style={styles.heroRule} />
                <Text style={styles.heroNote}>من الفكرة إلى آخر لمسة</Text>
              </View>
              {company?.logoUrl ? <Image source={{ uri: resolveAssetUrl(company.logoUrl) }} style={styles.heroLogo} /> : <View style={styles.heroMonogram}><Text style={styles.heroMonogramText}>M</Text></View>}
            </View>

            <PrimaryButton label="ابدأ مشروعك" onPress={() => router.push("/create-project" as never)} style={styles.primaryCta} />

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>اختيارات MADD</Text>
                <Text style={styles.sectionTitle}>خدماتنا</Text>
              </View>
              <Pressable onPress={() => router.push("/(tabs)/services" as never)} style={({ pressed }) => [styles.allLink, pressed && styles.pressed]}>
                <Text style={styles.allLinkText}>عرض الكل</Text><MaterialIcons name="arrow-back" size={15} color={Brand.pine} />
              </Pressable>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/service/${item.id}` as never)} style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}>
            {item.imageUrl ? <Image source={{ uri: resolveAssetUrl(item.imageUrl) }} style={styles.serviceImage} /> : <View style={styles.serviceImageFallback}><MaterialIcons name="dashboard-customize" size={28} color={Brand.pine} /></View>}
            <View style={styles.serviceOverlay} />
            <View style={styles.serviceCopy}>
              <View style={styles.serviceText}>
                <Text style={styles.serviceName}>{item.name}</Text>
                <Text numberOfLines={2} style={styles.serviceDescription}>{item.description || "استكشف خيارات التشطيب المتاحة لهذه الخدمة."}</Text>
              </View>
              <View style={styles.serviceArrow}><MaterialIcons name="arrow-back" size={16} color="#0C0C0C" /></View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={!servicesQuery.isLoading ? <View style={styles.notice}><MaterialIcons name="inventory-2" size={23} color={Brand.pine} /><Text style={styles.noticeText}>سيظهر كتالوج الخدمات هنا فور إضافة فريق MADD للخدمات والصور من لوحة الإدارة.</Text></View> : null}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 28 },
  topBar: { minHeight: 54, flexDirection: "row", alignItems: "center", marginBottom: 18 },
  logoMark: { width: 42, height: 42, borderRadius: 13, backgroundColor: Brand.pine, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, elevation: 3 },
  companyBlock: { flex: 1, alignItems: "flex-start", marginLeft: 11 },
  companyArabic: { alignSelf: "stretch", color: Brand.ink, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  companyEnglish: { alignSelf: "stretch", color: Brand.pine, fontSize: 9, fontWeight: "800", letterSpacing: 1.1, marginTop: 2, textAlign: "right" },
  notificationButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: "#5B4B29", backgroundColor: "#12120F", alignItems: "center", justifyContent: "center", position: "relative" },
  notificationBadge: { position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Brand.pine, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Brand.canvas },
  notificationBadgeText: { color: Brand.canvas, fontSize: 9, fontWeight: "900", writingDirection: "ltr" },
  hero: { minHeight: 275, borderRadius: 27, overflow: "hidden", backgroundColor: "#15130E", borderWidth: 1, borderColor: "#765F2D", padding: 24, position: "relative" },
  heroGlow: { width: 190, height: 190, borderRadius: 95, backgroundColor: "#3B2F12", opacity: 0.72, position: "absolute", left: -78, top: -60 },
  heroContent: { flex: 1, alignSelf: "stretch", alignItems: "flex-start", justifyContent: "flex-end", zIndex: 1 },
  eyebrow: { alignSelf: "stretch", color: Brand.pine, fontSize: 12, fontWeight: "800", letterSpacing: 0.2, writingDirection: "rtl", textAlign: "right" },
  heroTitle: { alignSelf: "flex-start", color: Brand.ink, fontSize: 30, lineHeight: 39, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 11, width: "88%" },
  heroText: { alignSelf: "flex-start", color: Brand.muted, fontSize: 13, lineHeight: 21, textAlign: "right", writingDirection: "rtl", marginTop: 11, width: "76%" },
  heroRule: { width: 44, height: 2, backgroundColor: Brand.pine, borderRadius: 2, marginTop: 17, alignSelf: "flex-start" },
  heroNote: { alignSelf: "stretch", color: "#D7C995", fontSize: 11, fontWeight: "700", writingDirection: "rtl", textAlign: "right", marginTop: 8 },
  heroLogo: { position: "absolute", width: 98, height: 98, borderRadius: 28, left: 22, bottom: 28, opacity: 0.88, borderWidth: 1, borderColor: "#856D35" },
  heroMonogram: { position: "absolute", width: 93, height: 93, borderRadius: 27, left: 22, bottom: 30, borderWidth: 1, borderColor: "#846A32", alignItems: "center", justifyContent: "center", backgroundColor: "#211B0E" },
  heroMonogramText: { color: Brand.pine, fontSize: 44, fontWeight: "300", fontStyle: "italic" },
  primaryCta: { marginTop: 16 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 32, marginBottom: 14 },
  sectionEyebrow: { color: Brand.pine, fontSize: 10, fontWeight: "800", textAlign: "right", writingDirection: "rtl", letterSpacing: 0.3 },
  sectionTitle: { color: Brand.ink, fontSize: 22, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginTop: 1 },
  allLink: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 4 },
  allLinkText: { color: Brand.pine, fontSize: 12, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  serviceCard: { height: 146, borderRadius: 22, overflow: "hidden", backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, marginBottom: 12, position: "relative" },
  serviceImage: { width: "100%", height: "100%", position: "absolute" },
  serviceImageFallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#211B10" },
  serviceOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(12,12,12,0.57)" },
  serviceCopy: { flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 16 },
  serviceArrow: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: Brand.pine },
  serviceText: { flex: 1, alignItems: "flex-start", marginRight: 12 },
  serviceName: { alignSelf: "stretch", color: "#FFF9EA", fontSize: 19, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  serviceDescription: { alignSelf: "stretch", color: "#E7DDC2", fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 5, maxWidth: "94%" },
  notice: { flexDirection: "row-reverse", alignItems: "center", gap: 10, borderRadius: 17, borderWidth: 1, borderColor: "#5B4B29", backgroundColor: Brand.card, padding: 16 },
  noticeText: { flex: 1, color: Brand.muted, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
