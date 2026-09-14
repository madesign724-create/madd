import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Brand } from "@/components/app-ui";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  style,
  ...props
}: ScreenContainerProps) {
  return (
    <View style={[styles.root, style]} {...props}>
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    backgroundColor: Brand.canvas,
  },
  safeArea: {
    flex: 1,
    width: "100%",
    backgroundColor: Brand.canvas,
  },
  body: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 16,
  },
});