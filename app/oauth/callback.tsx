import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

/** مسار قديم للتوافق فقط؛ كل عمليات الدخول الجديدة تعود إلى /auth/callback. */
export default function LegacyOAuthCallback() {
  const router = useRouter();
  useEffect(() => { router.replace("/auth" as never); }, [router]);
  return (
    <ScreenContainer className="items-center justify-center p-6">
      <View><Text style={{ textAlign: "center", writingDirection: "rtl" }}>يتم تحويلك إلى دخول MADD…</Text></View>
    </ScreenContainer>
  );
}
