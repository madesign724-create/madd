import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { Brand } from "@/components/app-ui";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.pine,
        tabBarInactiveTintColor: "#847960",
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
        tabBarItemStyle: { borderRadius: 14, marginHorizontal: 3 },
        tabBarStyle: { height: 62 + bottomPadding, paddingTop: 7, paddingBottom: bottomPadding, backgroundColor: Brand.canvas, borderTopColor: "#4C4025", borderTopWidth: 1 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color }) => <IconSymbol size={25} name="house.fill" color={color} /> }} />
      <Tabs.Screen name="services" options={{ title: "الخدمات", tabBarIcon: ({ color }) => <IconSymbol size={25} name="square.grid.2x2.fill" color={color} /> }} />
      <Tabs.Screen name="projects" options={{ title: "مشاريعي", tabBarIcon: ({ color }) => <IconSymbol size={25} name="folder.fill" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: "حسابي", tabBarIcon: ({ color }) => <IconSymbol size={25} name="person.crop.circle" color={color} /> }} />
    </Tabs>
  );
}
