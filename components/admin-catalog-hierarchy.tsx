import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { type ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Brand, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { trpc } from "@/lib/trpc";

type CatalogNode = {
  id: number;
  serviceId: number;
  parentId: number | null;
  name: string;
  nodeType: "category" | "option";
  selectionMode: "multi" | "single" | "view_only";
  sortOrder: number;
  isActive: boolean;
  serviceName: string;
};

type ClipboardItem = {
  action: "copy" | "cut";
  sourceType: "service" | "node";
  sourceId: number;
  label: string;
};

type PasteTarget = {
  targetType: "service" | "node";
  targetId: number;
  label: string;
};

type DeleteTarget = {
  targetType: "service" | "node";
  targetId: number;
  label: string;
};

const selectionModeLabel: Record<CatalogNode["selectionMode"], string> = {
  multi: "متعدد",
  single: "واحد",
  view_only: "عرض فقط",
};

export function AdminCatalogHierarchy() {
  const utils = trpc.useUtils();
  const nodesQuery = trpc.admin.catalogNodes.useQuery();
  const productsQuery = trpc.admin.products.useQuery();
  const servicesQuery = trpc.admin.services.useQuery();
  const [visible, setVisible] = useState(false);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [pasteTarget, setPasteTarget] = useState<PasteTarget | null>(null);
  const [confirmingPaste, setConfirmingPaste] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(() => new Set());
  const nodes = (nodesQuery.data ?? []) as CatalogNode[];
  const products = productsQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  const invalidateCatalog = () => {
    void utils.admin.catalogNodes.invalidate();
    void utils.admin.products.invalidate();
    void utils.admin.services.invalidate();
    void utils.catalog.services.invalidate();
  };

  const pasteClipboard = trpc.admin.pasteCatalogClipboard.useMutation({
    onSuccess: () => {
      void utils.admin.catalogNodes.invalidate();
      void utils.admin.products.invalidate();
      void utils.admin.services.invalidate();
      void utils.catalog.services.invalidate();
      if (clipboard?.action === "cut") setClipboard(null);
      setPasteTarget(null);
      setConfirmingPaste(false);
    },
  });
  const deleteService = trpc.admin.deleteService.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        Alert.alert("تعذر الحذف", result.reason || "هذه الصفحة الرئيسية مرتبطة بسجلات لا يمكن حذفها.");
        return;
      }
      invalidateCatalog();
      setDeleteTarget(null);
      Alert.alert("تم الحذف", "حُذفت الصفحة الرئيسية ومحتواها غير المرتبط باختيارات العملاء.");
    },
    onError: (error) => Alert.alert("تعذر الحذف", error.message),
  });
  const deleteNode = trpc.admin.deleteCatalogNode.useMutation({
    onSuccess: (result) => {
      if (!result.success) {
        Alert.alert("تعذر الحذف", result.reason || "هذه التقسيمة مرتبطة بسجلات لا يمكن حذفها.");
        return;
      }
      invalidateCatalog();
      setDeleteTarget(null);
      Alert.alert("تم الحذف", "حُذفت التقسيمة وكل محتواها غير المرتبط باختيارات العملاء.");
    },
    onError: (error) => Alert.alert("تعذر الحذف", error.message),
  });

  const sortedNodes = useMemo(
    () => [...nodes].sort((left, right) => left.serviceId - right.serviceId || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id),
    [nodes],
  );
  const sortedProducts = useMemo(
    () => [...products].sort((left, right) => left.catalogNodeId - right.catalogNodeId || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id),
    [products],
  );

  const setClipboardItem = (item: ClipboardItem) => {
    setClipboard(item);
    setPasteTarget(null);
    setConfirmingPaste(false);
  };
  const toggleBranch = (branchKey: string) => {
    setCollapsedBranches((current) => {
      const next = new Set(current);
      if (next.has(branchKey)) next.delete(branchKey);
      else next.add(branchKey);
      return next;
    });
  };
  const expandAll = () => setCollapsedBranches(new Set());
  const collapseAll = () => {
    const collapsibleNodes = sortedNodes
      .filter((node) => sortedNodes.some((candidate) => candidate.parentId === node.id) || sortedProducts.some((product) => product.catalogNodeId === node.id))
      .map((node) => `node:${node.id}`);
    setCollapsedBranches(new Set([...services.map((service) => `service:${service.id}`), ...collapsibleNodes]));
  };
  const requestPaste = (target: PasteTarget) => {
    if (!clipboard || pasteClipboard.isPending) return;
    setPasteTarget(target);
    setConfirmingPaste(true);
  };
  const requestDelete = (target: DeleteTarget) => {
    if (deleteService.isPending || deleteNode.isPending) return;
    setDeleteTarget(target);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.targetType === "service") deleteService.mutate({ serviceId: deleteTarget.targetId });
    else deleteNode.mutate({ nodeId: deleteTarget.targetId });
  };
  const close = () => {
    if (pasteClipboard.isPending) return;
    setConfirmingPaste(false);
    setPasteTarget(null);
    setVisible(false);
  };
  const confirmPaste = () => {
    if (!clipboard || !pasteTarget) return;
    pasteClipboard.mutate({
      action: clipboard.action,
      sourceType: clipboard.sourceType,
      sourceId: clipboard.sourceId,
      targetType: pasteTarget.targetType,
      targetId: pasteTarget.targetId,
    });
  };

  const renderClipboardActions = (sourceType: ClipboardItem["sourceType"], sourceId: number, label: string) => <View style={styles.actions}>
    <Pressable accessibilityLabel={`نسخ ${label}`} onPress={() => setClipboardItem({ action: "copy", sourceType, sourceId, label })} style={({ pressed }) => [styles.actionButton, clipboard?.action === "copy" && clipboard.sourceType === sourceType && clipboard.sourceId === sourceId && styles.actionActive, pressed && styles.pressed]}>
      <MaterialIcons name="content-copy" size={14} color={Brand.ink} /><Text style={styles.actionText}>نسخ</Text>
    </Pressable>
    <Pressable accessibilityLabel={`قص ${label}`} onPress={() => setClipboardItem({ action: "cut", sourceType, sourceId, label })} style={({ pressed }) => [styles.actionButton, clipboard?.action === "cut" && clipboard.sourceType === sourceType && clipboard.sourceId === sourceId && styles.actionCutActive, pressed && styles.pressed]}>
      <MaterialIcons name="content-cut" size={15} color={Brand.ink} /><Text style={styles.actionText}>قص</Text>
    </Pressable>
    <Pressable accessibilityLabel={`حذف ${label}`} onPress={() => requestDelete({ targetType: sourceType, targetId: sourceId, label })} style={({ pressed }) => [styles.actionButton, styles.deleteButton, pressed && styles.pressed]}>
      <MaterialIcons name="delete-outline" size={15} color={Brand.error} /><Text style={styles.deleteText}>حذف</Text>
    </Pressable>
  </View>;

  const renderPasteAction = (targetType: PasteTarget["targetType"], targetId: number, label: string) => {
    const sameItem = clipboard?.sourceType === targetType && clipboard.sourceId === targetId;
    if (!clipboard || sameItem) return null;
    return <Pressable accessibilityLabel={`لصق داخل ${label}`} onPress={() => requestPaste({ targetType, targetId, label })} style={({ pressed }) => [styles.pasteButton, pressed && styles.pressed]}>
      <MaterialIcons name="content-paste" size={14} color="#0C0C0C" /><Text style={styles.pasteText}>لصق هنا</Text>
    </Pressable>;
  };

  const renderTreeNode = (node: CatalogNode, depth: number): ReactNode => {
    const children = sortedNodes.filter((candidate) => candidate.parentId === node.id);
    const nodeProducts = sortedProducts.filter((product) => product.catalogNodeId === node.id);
    const nodeLabel = `تقسيمة ${node.name}`;
    const hasChildren = children.length > 0 || nodeProducts.length > 0;
    const branchKey = `node:${node.id}`;
    const isCollapsed = collapsedBranches.has(branchKey);
    return <View key={node.id} style={[styles.branch, { marginRight: depth * 14 }]}>
      <View style={styles.nodeRow}>
        <View style={styles.nodeIcon}><MaterialIcons name={node.nodeType === "category" ? "account-tree" : "tune"} size={17} color={Brand.pine} /></View>
        <View style={styles.nodeCopy}><Text style={styles.nodeName}>{node.name}</Text><Text style={styles.nodeMeta}>{node.nodeType === "category" ? "تقسيمة" : "خيار"} · {selectionModeLabel[node.selectionMode]} · {node.isActive ? "منشور" : "مخفي"}</Text></View>
        {hasChildren ? <Pressable accessibilityLabel={isCollapsed ? `فتح فرع ${node.name}` : `طي فرع ${node.name}`} onPress={() => toggleBranch(branchKey)} style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}><MaterialIcons name={isCollapsed ? "chevron-left" : "expand-more"} size={20} color={Brand.pine} /></Pressable> : null}
      </View>
      <View style={styles.nodeTools}>{renderClipboardActions("node", node.id, nodeLabel)}{renderPasteAction("node", node.id, nodeLabel)}</View>
      {!isCollapsed ? <>{children.map((child) => renderTreeNode(child, depth + 1))}{nodeProducts.map((product) => <View key={product.id} style={[styles.productRow, { marginRight: 14 }]}><MaterialIcons name="inventory-2" size={15} color={Brand.muted} /><Text style={styles.productName} numberOfLines={1}>{product.name}</Text></View>)}</> : null}
    </View>;
  };

  const renderServiceBranch = ({ item: service }: { item: typeof services[number] }) => {
    const serviceLabel = `الصفحة الرئيسية ${service.name}`;
    const serviceKey = `service:${service.id}`;
    const isServiceCollapsed = collapsedBranches.has(serviceKey);
    return <View style={styles.serviceBranch}>
      <View style={styles.serviceHeader}><Text style={styles.serviceName}>{service.name}</Text><Pressable accessibilityLabel={isServiceCollapsed ? `فتح الصفحة الرئيسية ${service.name}` : `طي الصفحة الرئيسية ${service.name}`} onPress={() => toggleBranch(serviceKey)} style={({ pressed }) => [styles.toggleButton, pressed && styles.pressed]}><MaterialIcons name={isServiceCollapsed ? "chevron-left" : "expand-more"} size={20} color={Brand.pine} /></Pressable></View>
      <View style={styles.serviceTools}>{renderClipboardActions("service", service.id, serviceLabel)}{renderPasteAction("service", service.id, serviceLabel)}</View>
      {!isServiceCollapsed ? sortedNodes.filter((node) => node.serviceId === service.id && node.parentId === null).map((node) => renderTreeNode(node, 0)) : null}
    </View>;
  };

  const deleteDescription = deleteTarget?.targetType === "service"
    ? `هل تريد حذف «${deleteTarget.label}» وكل تقسيماتها ومنتجاتها غير المرتبطة باختيارات العملاء؟ لا يمكن التراجع عن هذا الإجراء.`
    : `هل تريد حذف «${deleteTarget?.label ?? ""}» وكل تقسيماتها الفرعية ومنتجاتها غير المرتبطة باختيارات العملاء؟ لا يمكن التراجع عن هذا الإجراء.`;

  return <View style={styles.launcher}>
    <Pressable accessibilityLabel="عرض هيكل الكتالوج وحافظة النسخ والقص واللصق" onPress={() => setVisible(true)} style={({ pressed }) => [styles.launcherButton, pressed && styles.pressed]}>
      <MaterialIcons name="account-tree" size={22} color="#0C0C0C" />
      <View style={styles.launcherCopy}><Text style={styles.launcherTitle}>هيكل الكتالوج وحافظة المحتوى</Text><Text style={styles.launcherSubtitle}>انسخ أو انقل فرعاً كاملاً ثم ألصقه في مكانه الصحيح</Text></View>
    </Pressable>
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetTop}><Pressable accessibilityLabel="إغلاق" onPress={close} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><MaterialIcons name="close" size={21} color={Brand.ink} /></Pressable><Text style={styles.sheetTitle}>هيكل الكتالوج</Text></View>
          <FlatList
            style={styles.treeList}
            data={services}
            renderItem={renderServiceBranch}
            keyExtractor={(service) => String(service.id)}
            nestedScrollEnabled
            scrollEnabled
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            showsVerticalScrollIndicator
            contentContainerStyle={styles.content}
            ListHeaderComponent={<>
              <View style={styles.intro}><MaterialIcons name="format-list-numbered-rtl" size={22} color={Brand.pine} /><View style={styles.introCopy}><Text style={styles.heading}>شجرة الكتالوج والحافظة</Text><Text style={styles.help}>اضغط «نسخ» لإنشاء نسخة مستقلة، أو «قص» لنقل الفرع. بعدها اضغط «لصق هنا» في الصفحة أو التقسيمة الصحيحة. يشمل الإجراء كل الفروع والمنتجات والصور وترتيبها.</Text></View></View>
              <View style={styles.treeControls}><Pressable accessibilityLabel="فتح كل الفروع" onPress={expandAll} style={({ pressed }) => [styles.treeControl, pressed && styles.pressed]}><MaterialIcons name="unfold-more" size={16} color={Brand.ink} /><Text style={styles.treeControlText}>فتح الكل</Text></Pressable><Pressable accessibilityLabel="طي كل الفروع" onPress={collapseAll} style={({ pressed }) => [styles.treeControl, pressed && styles.pressed]}><MaterialIcons name="unfold-less" size={16} color={Brand.ink} /><Text style={styles.treeControlText}>طي الكل</Text></Pressable></View>
              {clipboard ? <View style={styles.clipboardCard}><MaterialIcons name={clipboard.action === "copy" ? "content-copy" : "content-cut"} size={20} color={Brand.pine} /><View style={styles.clipboardCopy}><Text style={styles.clipboardTitle}>{clipboard.action === "copy" ? "جاهز للنسخ" : "جاهز للقص والنقل"}: {clipboard.label}</Text><Text style={styles.clipboardHelp}>{clipboard.action === "copy" ? "يمكنك اللصق في أكثر من مكان. الأصل لن يتغير." : "اختر مكاناً جديداً ثم ألصق؛ سيُنقل الفرع كاملاً من موضعه الحالي."}</Text></View><Pressable accessibilityLabel="إفراغ الحافظة" onPress={() => { setClipboard(null); setPasteTarget(null); setConfirmingPaste(false); }} style={({ pressed }) => [styles.clearClipboard, pressed && styles.pressed]}><MaterialIcons name="close" size={17} color={Brand.ink} /></Pressable></View> : null}
              {nodesQuery.isLoading || productsQuery.isLoading || servicesQuery.isLoading ? <ActivityIndicator color={Brand.pine} style={styles.loader} /> : null}
              {!nodesQuery.isLoading && !productsQuery.isLoading && !servicesQuery.isLoading && services.length === 0 ? <Text style={styles.help}>لا توجد صفحات رئيسية في الكتالوج حالياً.</Text> : null}
            </>}
            ListFooterComponent={<>
              {confirmingPaste && clipboard && pasteTarget ? <View style={styles.confirmBox}><Text style={styles.confirmTitle}>تأكيد {clipboard.action === "copy" ? "النسخ" : "القص واللصق"}</Text><Text style={styles.confirmText}>{clipboard.action === "copy" ? "سيُنشئ النظام نسخة مستقلة" : "سينقل النظام الشجرة الأصلية"} من «{clipboard.label}» إلى داخل «{pasteTarget.label}». {clipboard.action === "copy" ? "سيبقى المصدر بلا أي تغيير." : "ستنتقل الفروع والمنتجات والصور وترتيبها إلى المكان الجديد."}</Text><View style={styles.confirmActions}><SecondaryButton label="إلغاء" onPress={() => { setConfirmingPaste(false); setPasteTarget(null); }} style={styles.confirmAction} /><PrimaryButton label={clipboard.action === "copy" ? "تأكيد النسخ" : "تأكيد النقل"} loading={pasteClipboard.isPending} onPress={confirmPaste} style={styles.confirmAction} /></View></View> : null}
              {pasteClipboard.error ? <Text style={styles.errorText}>{pasteClipboard.error.message}</Text> : null}
            </>}
          />
        </View>
      </View>
    </Modal>
    {deleteTarget ? <DeleteConfirmationDialog
      visible
      title={deleteTarget.targetType === "service" ? "حذف الصفحة الرئيسية" : "حذف التقسيمة"}
      description={deleteDescription}
      confirmLabel={deleteTarget.targetType === "service" ? "حذف الصفحة" : "حذف التقسيمة"}
      loading={deleteService.isPending || deleteNode.isPending}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={confirmDelete}
    /> : null}
  </View>;
}

const styles = StyleSheet.create({
  launcher: { marginBottom: 12 },
  launcherButton: { flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: Brand.paleGreen, borderWidth: 1, borderColor: Brand.line },
  launcherCopy: { flex: 1, alignItems: "flex-end" },
  launcherTitle: { color: Brand.ink, fontSize: 14, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  launcherSubtitle: { color: Brand.muted, fontSize: 11, marginTop: 2, writingDirection: "rtl", textAlign: "right" },
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  sheet: { height: "92%", backgroundColor: Brand.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: Brand.line, overflow: "hidden" },
  sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Brand.line, paddingHorizontal: 17, paddingVertical: 14 },
  close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: Brand.paleGreen },
  sheetTitle: { color: Brand.ink, fontSize: 17, fontWeight: "900", writingDirection: "rtl" },
  treeList: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },
  intro: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  introCopy: { flex: 1, alignItems: "flex-end" },
  heading: { color: Brand.ink, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  help: { color: Brand.muted, fontSize: 12, lineHeight: 19, writingDirection: "rtl", textAlign: "right", marginTop: 4 },
  treeControls: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  treeControl: { flexDirection: "row-reverse", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: Brand.paleGreen, borderWidth: 1, borderColor: Brand.line },
  treeControlText: { color: Brand.ink, fontSize: 11, fontWeight: "800", writingDirection: "rtl" },
  loader: { marginVertical: 24 },
  clipboardCard: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 9, padding: 12, borderRadius: 15, borderWidth: 1, borderColor: Brand.pine, backgroundColor: "#17150E", marginBottom: 12 },
  clipboardCopy: { flex: 1, alignItems: "flex-end" },
  clipboardTitle: { color: Brand.ink, fontSize: 12, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  clipboardHelp: { color: Brand.muted, fontSize: 10, lineHeight: 16, marginTop: 2, writingDirection: "rtl", textAlign: "right" },
  clearClipboard: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Brand.card },
  serviceBranch: { marginTop: 9, borderWidth: 1, borderColor: Brand.line, backgroundColor: "#151714", borderRadius: 16, padding: 12 },
  serviceHeader: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Brand.line, paddingBottom: 8 },
  serviceName: { flex: 1, color: Brand.pine, fontSize: 15, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  serviceTools: { flexDirection: "row-reverse", flexWrap: "wrap", justifyContent: "flex-start", gap: 6, paddingTop: 9 },
  branch: { marginTop: 9, borderRightWidth: 1, borderRightColor: Brand.line, paddingRight: 8 },
  nodeRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 5 },
  nodeIcon: { width: 29, height: 29, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Brand.paleGreen },
  nodeCopy: { flex: 1, alignItems: "flex-end" },
  nodeName: { color: Brand.ink, fontSize: 13, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  nodeMeta: { color: Brand.muted, fontSize: 10, marginTop: 1, writingDirection: "rtl", textAlign: "right" },
  toggleButton: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: Brand.paleGreen, borderWidth: 1, borderColor: Brand.line },
  nodeTools: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, paddingRight: 37, paddingBottom: 4 },
  actions: { flexDirection: "row-reverse", gap: 6 },
  actionButton: { flexDirection: "row-reverse", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line },
  actionActive: { borderColor: Brand.pine, backgroundColor: Brand.paleGreen },
  actionCutActive: { borderColor: Brand.error, backgroundColor: "#2A1715" },
  deleteButton: { borderColor: "#8B4540", backgroundColor: "#2B1717" },
  actionText: { color: Brand.ink, fontSize: 10, fontWeight: "800", writingDirection: "rtl" },
  deleteText: { color: Brand.error, fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  pasteButton: { flexDirection: "row-reverse", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9, backgroundColor: Brand.pine },
  pasteText: { color: "#0C0C0C", fontSize: 10, fontWeight: "900", writingDirection: "rtl" },
  productRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, paddingVertical: 4 },
  productName: { flex: 1, color: Brand.muted, fontSize: 12, writingDirection: "rtl", textAlign: "right" },
  confirmBox: { marginTop: 18, padding: 12, borderRadius: 14, backgroundColor: Brand.paleGreen, borderWidth: 1, borderColor: Brand.pine },
  confirmTitle: { color: Brand.pine, fontSize: 14, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  confirmText: { color: Brand.ink, fontSize: 12, lineHeight: 19, writingDirection: "rtl", textAlign: "right", marginTop: 4 },
  confirmActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  confirmAction: { flex: 1 },
  errorText: { color: Brand.error, fontSize: 12, lineHeight: 18, writingDirection: "rtl", textAlign: "right", marginTop: 10 },
  pressed: { opacity: 0.72 },
});
