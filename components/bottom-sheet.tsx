import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Dimensions, Platform, Pressable, StyleSheet, View } from "react-native";

/**
 * Drop-in replacement for React Native's <Modal> for bottom-sheet style panels.
 *
 * React Native's <Modal> renders through a native/DOM portal. On React Native
 * Web this portal breaks height/flex resolution for nested <FlatList> or
 * <ScrollView> content in some browsers, causing the sheet to render with no
 * working scrollbar, or to render inline instead of as an overlay.
 *
 * On web we render through a real React Portal straight into document.body,
 * which sidesteps every ancestor's overflow/position/z-index quirks. On
 * native (iOS/Android) we just render a plain absolutely-positioned View,
 * which works fine there.
 */
export function BottomSheet({
  visible,
  onRequestClose,
  heightRatio = 0.92,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  heightRatio?: number;
  children: ReactNode;
}) {
  if (!visible) return null;
  const sheetHeight = Dimensions.get("window").height * heightRatio;

  const content = (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onRequestClose} accessibilityLabel="إغلاق" />
      <View style={[styles.sheet, { height: sheetHeight, maxHeight: sheetHeight }]}>{children}</View>
    </View>
  );

  if (Platform.OS === "web" && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

const styles = StyleSheet.create({
  root: {
    position: "fixed" as "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  sheet: {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
});