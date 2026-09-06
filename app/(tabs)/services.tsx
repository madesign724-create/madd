import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { AppHeader, Brand, EmptyState } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { resolveAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";

export default function ServicesScreen() {
  const router = useRouter();
  const servicesQuery = trpc.catalog.services.useQuery();
  const services = servicesQuery.data ?? [];

  return (
    <ScreenContainer className="px-5">
      {servicesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : (
        <FlatList
          data={services}
          numColumns={2}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={services.length > 1 ? styles.row : undefined}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<AppHeader title="الخدمات" subtitle="صمّم كل تفصيلة كما تتخيلها" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/service/${item.id}` as never)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              {item.imageUrl ? <Image source={{ uri: resolveAssetUrl(item.imageUrl) }} style={styles.image} /> : <View style={styles.imageFallback}><MaterialIcons name="construction" color={Brand.pine} size={32} /></View>}
              <View style={styles.imageShade} />
              <View style={styles.cardCopy}>
                <Text numberOfLines={2} style={styles.title}>{item.name}</Text>
                <View style={styles.cardFooter}><Text numberOfLines={1} style={styles.description}>{item.description || "استكشف التفاصيل"}</Text><MaterialIcons name="arrow-back" color={Brand.pine} size={16} /></View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="inventory-2" title="الكتالوج قيد التجهيز" description="لا توجد خدمات منشورة الآن. ستظهر هنا فور إضافتها من الإدارة." />}
        />
      )}
    </ScreenContainer>
  );
}

const CARD_GAP = 13;
const CARD_WIDTH = (Dimensions.get("window").width - 20 * 2 - CARD_GAP) / 2;

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 28, paddingTop: 2 },
  row: { flexDirection: "row-reverse", justifyContent: "space-between" },
  card: { width: CARD_WIDTH, height: 210, borderRadius: 21, overflow: "hidden", backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, marginBottom: CARD_GAP, position: "relative" },
  image: { width: "100%", height: "100%", position: "absolute" },
  imageFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: "#211B10", alignItems: "center", justifyContent: "center" },
  imageShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(8,8,8,0.46)" },
  cardCopy: { flex: 1, direction: "rtl", justifyContent: "flex-end", alignItems: "stretch", padding: 14 },
  title: { alignSelf: "stretch", color: "#FFF9EA", fontSize: 17, lineHeight: 23, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  cardFooter: { direction: "rtl", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, marginTop: 6 },
  description: { flex: 1, color: "#E3D8BC", fontSize: 10, textAlign: "right", writingDirection: "rtl" },
  pressed: { opacity: 0.72 },
});
