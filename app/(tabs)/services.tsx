import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { AppHeader, Brand, EmptyState } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { resolveAssetUrl } from "@/lib/asset-url";
import { trpc } from "@/lib/trpc";

export default function ServicesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const servicesQuery = trpc.catalog.services.useQuery();
  const services = servicesQuery.data ?? [];

  // حساب عرض الكارت بدقة بناءً على عرض الشاشة الفعلي
  const cardWidth = Math.floor((width - 44) / 2);

  if (servicesQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loader}>
          <ActivityIndicator color={Brand.pine} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={services}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        style={styles.flatList}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <AppHeader title="الخدمات" subtitle="صمّم كل تفصيلة كما تتخيلها" />
        }
        renderItem={({ item }) => {
          const hasImage = Boolean(item.imageUrl);
          const desc = item.description ? String(item.description) : "استكشف التفاصيل";

          return (
            <Pressable
              onPress={() => router.push(`/service/${item.id}` as never)}
              style={({ pressed }) => [
                styles.card,
                { width: cardWidth },
                pressed ? styles.pressed : null,
              ]}
            >
              {hasImage ? (
                <Image
                  source={{ uri: resolveAssetUrl(item.imageUrl!) }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imageFallback}>
                  <MaterialIcons name="construction" color={Brand.pine} size={36} />
                </View>
              )}

              <View style={styles.imageShade} />

              <View style={styles.cardCopy}>
                <Text numberOfLines={2} style={styles.title}>
                  {item.name}
                </Text>
                <View style={styles.cardFooter}>
                  <Text numberOfLines={1} style={styles.description}>
                    {desc}
                  </Text>
                  <MaterialIcons name="arrow-back" color={Brand.pine} size={16} />
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="inventory-2"
            title="الكتالوج قيد التجهيز"
            description="لا توجد خدمات منشورة الآن. ستظهر هنا فور إضافتها من الإدارة."
          />
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  flatList: {
    flex: 1,
    width: "100%",
  },
  list: {
    width: "100%",
    paddingBottom: 28,
  },
  row: {
    width: "100%",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  card: {
    height: 195,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.line,
    position: "relative",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#1F1B12",
    alignItems: "center",
    justifyContent: "center",
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 10, 10, 0.65)",
  },
  cardCopy: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 12,
  },
  title: {
    color: "#FFF9EA",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },
  cardFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 4,
  },
  description: {
    flex: 1,
    color: "#D4C8A9",
    fontSize: 11,
    textAlign: "right",
    writingDirection: "rtl",
  },
  pressed: {
    opacity: 0.75,
  },
});