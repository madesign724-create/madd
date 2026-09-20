import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

export function BottomSheet({
  visible,
  onRequestClose,
  heightRatio = 0.9,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  heightRatio?: number;
  children: ReactNode;
}) {
  if (!visible) return null;

  const windowHeight = Dimensions.get("window").height;
  const sheetHeight = Math.floor(windowHeight * heightRatio);

  // 1. على الويب: استخدام createPortal مباشرة في document.body لحل مشاكل السكرول والـ z-index
  if (Platform.OS === "web") {
    const webContent = (
      <View style={styles.webRoot} pointerEvents="box-none">
        <Pressable
          style={styles.backdrop}
          onPress={onRequestClose}
          accessibilityLabel="إغلاق"
        />
        <View style={[styles.sheet, { height: sheetHeight, maxHeight: sheetHeight }]}>
          {children}
        </View>
      </View>
    );

    if (typeof document !== "undefined") {
      return createPortal(webContent, document.body);
    }
    return webContent;
  }

  // 2. على أندرويد و iOS: استخدام Modal النظامي الأصلي حتى ينفصل تماماً عن سكرول شاشة الإدارة
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.nativeRoot}>
        <Pressable
          style={styles.backdrop}
          onPress={onRequestClose}
          accessibilityLabel="إغلاق"
        />
        <View style={[styles.sheet, { height: sheetHeight, maxHeight: sheetHeight }]}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  webRoot: {
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
  nativeRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.68)",
  },
  sheet: {
    width: "100%",
    backgroundColor: "#1C1A14",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
});