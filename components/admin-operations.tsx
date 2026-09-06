import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import DraggableFlatList from "react-native-draggable-flatlist";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Brand, EmptyState, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { trpc } from "@/lib/trpc";

type StaffRole = "catalog_manager" | "project_manager" | "viewer";
type NodeType = "category" | "option";
type NodeSelectionMode = "multi" | "single" | "view_only";
type SelectedImage = { uri: string; fileName: string; mimeType: string; dataBase64: string };
type ReorderItem = { id: number; title: string; detail: string; imageUrl?: string | null };
type NodeScope = { serviceId: number; parentId: number | null; label: string; items: ReorderItem[] };
type ProductScope = { catalogNodeId: number; label: string; items: ReorderItem[] };
type CatalogDeleteTarget =
  | { type: "node"; id: number; name: string }
  | { type: "product"; id: number; name: string };

const staffRoles: Array<{ value: StaffRole; label: string }> = [
  { value: "catalog_manager", label: "مسؤول الكتالوج" },
  { value: "project_manager", label: "مسؤول المشروعات" },
  { value: "viewer", label: "مشاهدة فقط" },
];

const selectionModeOptions: Array<{ value: NodeSelectionMode; label: string; description: string }> = [
  { value: "multi", label: "اختيار متعدد", description: "يمكن للعميل إضافة أكثر من منتج من هذه التقسيمة." },
  { value: "single", label: "اختيار واحد فقط", description: "يستبدل اختيار العميل السابق في هذه التقسيمة تلقائياً." },
  { value: "view_only", label: "عرض فقط بدون اختيار", description: "تظهر المنتجات للتصفح من دون إمكانية إضافتها إلى المشروع." },
];

function selectionModeLabel(value?: string | null) {
  return selectionModeOptions.find((option) => option.value === value)?.label ?? "اختيار متعدد";
}

async function pickImages(limit: number) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.65,
    base64: true,
  });
  if (result.canceled) return [] as SelectedImage[];
  const images = result.assets.slice(0, limit).flatMap((asset, index): SelectedImage[] => {
    if (!asset.base64) return [];
    const estimatedBytes = Math.floor((asset.base64.length * 3) / 4);
    if (estimatedBytes > 3 * 1024 * 1024) return [];
    return [{ uri: asset.uri, fileName: asset.fileName || `madd-${Date.now()}-${index + 1}.jpg`, mimeType: asset.mimeType || "image/jpeg", dataBase64: asset.base64 }];
  });
  if (images.length !== result.assets.length) Alert.alert("بعض الصور لم تُضف", "اختر صوراً لا يزيد حجم كل منها على 3 ميغابايت بعد الضغط.");
  return images;
}

function ChoiceChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function EditorSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalSheet}><View style={styles.modalTop}><Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}><MaterialIcons name="close" size={21} color={Brand.ink} /></Pressable><Text style={styles.modalTitle}>{title}</Text></View><FlatList data={[]} keyExtractor={() => "editor"} renderItem={() => null} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent} ListHeaderComponent={<>{children}</>} /></View></View></Modal>;
}

function ReorderSheet({ visible, title, description, data, saving, onClose, onSave }: { visible: boolean; title: string; description: string; data: ReorderItem[]; saving: boolean; onClose: () => void; onSave: (items: ReorderItem[]) => void }) {
  const [items, setItems] = useState(data);
  const utils = trpc.useUtils();
  const isServiceOrder = title === "ترتيب الخدمات الرئيسية";
  const saveDefaultOrder = trpc.admin.saveServicesDefaultOrder.useMutation({
    onSuccess: () => {
      void utils.admin.services.invalidate();
      void utils.catalog.services.invalidate();
      Alert.alert("تم اعتماد الترتيب الافتراضي", "سيُستخدم هذا التسلسل عند استعادة ترتيب الخدمات لاحقاً.");
    },
    onError: (error) => Alert.alert("تعذر اعتماد الترتيب", error.message),
  });
  const saveCurrentServicesAsDefault = trpc.admin.reorderServices.useMutation({
    onSuccess: () => saveDefaultOrder.mutate(),
    onError: (error) => Alert.alert("تعذر حفظ ترتيب الخدمات", error.message),
  });

  useEffect(() => {
    if (visible) setItems(data);
  }, [data, visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.reorderSheet}>
          <View style={styles.modalTop}>
            <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <MaterialIcons name="close" size={21} color={Brand.ink} />
            </Pressable>
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <View style={styles.reorderIntro}>
            <MaterialIcons name="drag-indicator" size={24} color={Brand.pine} />
            <Text style={styles.help}>{description}</Text>
          </View>
          <DraggableFlatList
            data={items}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.reorderList}
            activationDistance={12}
            onDragEnd={({ data: nextItems }) => setItems(nextItems)}
            renderItem={({ item, drag, isActive }) => (
              <Pressable onLongPress={drag} delayLongPress={120} disabled={isActive} style={({ pressed }) => [styles.reorderRow, isActive && styles.reorderRowActive, (pressed || isActive) && styles.pressed]}>
                <View style={styles.dragHandle}><MaterialIcons name="drag-handle" size={25} color={Brand.pine} /></View>
                {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.reorderImage} /> : <View style={styles.reorderImageFallback}><MaterialIcons name="category" size={19} color={Brand.pine} /></View>}
                <View style={styles.reorderText}><Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.meta}>{item.detail}</Text></View>
              </Pressable>
            )}
            ListFooterComponent={(
              <View style={styles.reorderActions}>
                {isServiceOrder ? <><Text style={styles.orderHint}>اعتمد تسلسل السحب الحالي كمرجع تستعيده الإدارة لاحقاً بنقرة واحدة.</Text><SecondaryButton label="اعتماد الترتيب الحالي كافتراضي" loading={saveCurrentServicesAsDefault.isPending || saveDefaultOrder.isPending} onPress={() => saveCurrentServicesAsDefault.mutate({ serviceIds: items.map((item) => item.id) })} /></> : null}
                <PrimaryButton label="حفظ الترتيب" loading={saving} onPress={() => onSave(items)} />
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

export function AdminTeam({ headerContent }: { headerContent?: ReactNode }) {
  const utils = trpc.useUtils();
  const staffQuery = trpc.admin.staff.useQuery();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("catalog_manager");
  const inviteMutation = trpc.admin.inviteStaff.useMutation({ onSuccess: () => { setEmail(""); setName(""); setRole("catalog_manager"); void utils.admin.staff.invalidate(); Alert.alert("تمت إضافة العضو", "يحتاج العضو إلى تسجيل الدخول بالبريد نفسه لتفعيل صلاحياته."); } });
  const updateMutation = trpc.admin.updateStaff.useMutation({ onSuccess: () => void utils.admin.staff.invalidate() });
  const staff = staffQuery.data ?? [];
  const addMember = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { Alert.alert("بريد غير صحيح", "اكتب بريد الموظف الذي سيستخدمه عند تسجيل الدخول."); return; }
    inviteMutation.mutate({ email: email.trim().toLowerCase(), displayName: name.trim() || undefined, role });
  };
  return <FlatList data={staff} keyExtractor={(item) => String(item.id)} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} ListHeaderComponent={<>{headerContent}<View style={styles.form}><Text style={styles.formTitle}>إضافة عضو فريق</Text><Text style={styles.help}>أضف بريد الموظف ثم اختر نطاق عمله. لا يحصل أي عضو على صلاحية المالك.</Text><TextInput value={name} onChangeText={setName} placeholder="اسم الموظف (اختياري)" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={email} onChangeText={setEmail} placeholder="بريد الموظف" placeholderTextColor={Brand.muted} autoCapitalize="none" keyboardType="email-address" style={styles.input} textAlign="right" /><FlatList horizontal data={staffRoles} keyExtractor={(item) => item.value} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} renderItem={({ item }) => <ChoiceChip active={role === item.value} label={item.label} onPress={() => setRole(item.value)} />} /><PrimaryButton label="إضافة عضو" loading={inviteMutation.isPending} onPress={addMember} /></View></>} renderItem={({ item }) => <View style={styles.card}><View style={styles.rowBetween}><Text style={styles.tag}>{item.role === "owner" ? "مالك التشغيل" : staffRoles.find((value) => value.value === item.role)?.label || "مشاهدة فقط"}</Text><Text style={styles.cardTitle}>{item.displayName || item.email}</Text></View><Text style={styles.meta}>{item.email}</Text><View style={styles.rowActions}>{item.role !== "owner" ? <SecondaryButton label={item.isActive ? "إيقاف" : "تفعيل"} onPress={() => updateMutation.mutate({ staffId: item.id, isActive: !item.isActive })} style={styles.flexAction} /> : null}{item.role !== "owner" ? <Text style={[styles.state, !item.isActive && styles.stateMuted]}>{item.isActive ? "نشط" : "موقوف"}</Text> : <Text style={styles.state}>محمي</Text>}</View></View>} ListEmptyComponent={staffQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : <EmptyState icon="group" title="لا يوجد أعضاء بعد" description="أضف موظفي MADD وحدد حدود وصول كل منهم." />} />;
}

export function AdminCatalog({ embedded = false, headerContent }: { embedded?: boolean; headerContent?: ReactNode }) {
  const utils = trpc.useUtils();
  const servicesQuery = trpc.admin.services.useQuery();
  const nodesQuery = trpc.admin.catalogNodes.useQuery();
  const productsQuery = trpc.admin.products.useQuery();
  const services = servicesQuery.data ?? [];
  const nodes = nodesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [nodeName, setNodeName] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [nodeType, setNodeType] = useState<NodeType>("category");
  const [nodeSelectionMode, setNodeSelectionMode] = useState<NodeSelectionMode>("multi");
  const [nodeImage, setNodeImage] = useState<SelectedImage | null>(null);
  const [productNodeId, setProductNodeId] = useState<number | null>(null);
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productImages, setProductImages] = useState<SelectedImage[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<number | null>(null);
  const [editNodeName, setEditNodeName] = useState("");
  const [editNodeDescription, setEditNodeDescription] = useState("");
  const [editNodeParentId, setEditNodeParentId] = useState<number | null>(null);
  const [editNodeType, setEditNodeType] = useState<NodeType>("category");
  const [editNodeSelectionMode, setEditNodeSelectionMode] = useState<NodeSelectionMode>("multi");
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductCode, setEditProductCode] = useState("");
  const [editProductDescription, setEditProductDescription] = useState("");
  const [editProductNodeId, setEditProductNodeId] = useState<number | null>(null);
  const [nodeReorderScope, setNodeReorderScope] = useState<NodeScope | null>(null);
  const [productReorderScope, setProductReorderScope] = useState<ProductScope | null>(null);
  const [serviceReorderOpen, setServiceReorderOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CatalogDeleteTarget | null>(null);
  const selectedService = serviceId ?? services[0]?.id ?? null;
  const selectedProductNode = productNodeId ?? nodes.find((node) => node.serviceId === selectedService)?.id ?? null;
  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? null;
  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;
  const invalidateCatalog = () => { void utils.admin.services.invalidate(); void utils.catalog.services.invalidate(); void utils.admin.catalogNodes.invalidate(); void utils.admin.products.invalidate(); void utils.catalog.children.invalidate(); void utils.catalog.products.invalidate(); };

  const nodeScopes = useMemo<NodeScope[]>(() => {
    const groupMap = new Map<string, NodeScope>();
    nodes.forEach((node) => {
      const key = `${node.serviceId}:${node.parentId ?? "root"}`;
      const existing = groupMap.get(key) ?? { serviceId: node.serviceId, parentId: node.parentId, label: node.parentId ? `داخل ${nodes.find((parent) => parent.id === node.parentId)?.name || "تقسيمة فرعية"}` : `${node.serviceName} · التقسيمات الرئيسية`, items: [] };
      existing.items.push({ id: node.id, title: node.name, detail: node.nodeType === "category" ? "تقسيمة" : "خيار", imageUrl: node.imageUrl });
      groupMap.set(key, existing);
    });
    return [...groupMap.values()];
  }, [nodes]);
  const productScopes = useMemo<ProductScope[]>(() => {
    const groupMap = new Map<number, ProductScope>();
    products.forEach((product) => {
      const existing = groupMap.get(product.catalogNodeId) ?? { catalogNodeId: product.catalogNodeId, label: `${product.serviceName} · ${product.catalogNodeName}`, items: [] };
      existing.items.push({ id: product.id, title: product.name, detail: product.isActive ? (product.productCode || "منتج منشور") : "مخفي من الكتالوج", imageUrl: product.mainImageUrl });
      groupMap.set(product.catalogNodeId, existing);
    });
    return [...groupMap.values()];
  }, [products]);
  const serviceReorderItems = useMemo<ReorderItem[]>(() => services.map((service) => ({ id: service.id, title: service.name, detail: service.isActive ? "خدمة منشورة" : "خدمة مخفية", imageUrl: service.imageUrl })), [services]);

  const uploadNodeImage = trpc.admin.uploadCatalogNodeImage.useMutation({ onSuccess: invalidateCatalog });
  const uploadProductImages = trpc.admin.uploadProductImages.useMutation({ onSuccess: invalidateCatalog });
  const createNode = trpc.admin.createCatalogNode.useMutation({ onSuccess: async (createdNodeId) => { if (nodeImage) await uploadNodeImage.mutateAsync({ nodeId: createdNodeId, image: { fileName: nodeImage.fileName, mimeType: nodeImage.mimeType, dataBase64: nodeImage.dataBase64 } }); setNodeName(""); setNodeDescription(""); setNodeSelectionMode("multi"); setNodeImage(null); setParentId(null); invalidateCatalog(); Alert.alert("تمت إضافة التقسيمة", "يمكنك الآن اختيارها عند إنشاء منتج أو تقسيمة فرعية."); }, onError: (error) => Alert.alert("تعذر إضافة التقسيمة", error.message || "تحقق من الصلاحية والاتصال ثم حاول مرة أخرى.") });
  const createProduct = trpc.admin.createProduct.useMutation({ onSuccess: async (createdProductId) => { if (productImages.length) await uploadProductImages.mutateAsync({ productId: createdProductId, images: productImages.map((image) => ({ fileName: image.fileName, mimeType: image.mimeType, dataBase64: image.dataBase64 })) }); setProductName(""); setProductCode(""); setProductDescription(""); setProductImages([]); invalidateCatalog(); Alert.alert("تمت إضافة المنتج", "ظهر المنتج في الكتالوج حسب حالة خدمته وتقسيمته."); }, onError: (error) => Alert.alert("تعذر إضافة المنتج", error.message || "تحقق من الصلاحية والاتصال ثم حاول مرة أخرى.") });
  const updateNode = trpc.admin.updateCatalogNode.useMutation({ onSuccess: invalidateCatalog, onError: (error) => Alert.alert("تعذر حفظ التعديل", error.message) });
  const updateProduct = trpc.admin.updateProduct.useMutation({ onSuccess: invalidateCatalog, onError: (error) => Alert.alert("تعذر حفظ التعديل", error.message) });
  const setProductVisibility = trpc.admin.setProductVisibility.useMutation({ onSuccess: (_result, input) => { invalidateCatalog(); Alert.alert(input.isActive ? "ظهر المنتج في الكتالوج" : "تم إخفاء المنتج", input.isActive ? "أصبح المنتج متاحاً للعملاء عند التصفح والاختيار." : "لن يظهر المنتج في الكتالوج أو الاختيارات الجديدة، وسيبقى ضمن مشروعات العملاء الذين اختاروه سابقاً."); }, onError: (error) => Alert.alert("تعذر تغيير الظهور", error.message) });
  const deleteNode = trpc.admin.deleteCatalogNode.useMutation({ onSuccess: (result) => { if (!result.success) { Alert.alert("تعذر الحذف", result.reason || "هذا العنصر مرتبط بسجلات أخرى."); return; } setDeleteTarget(null); invalidateCatalog(); Alert.alert("تم الحذف", "حُذفت التقسيمة وكل محتواها غير المرتبط بالعملاء من الكتالوج."); }, onError: (error) => Alert.alert("تعذر الحذف", error.message) });
  const deleteProduct = trpc.admin.deleteProduct.useMutation({ onSuccess: (result) => { if (!result.success) { Alert.alert("تعذر الحذف", result.reason || "هذا المنتج مرتبط بسجلات أخرى."); return; } setDeleteTarget(null); setEditingProductId(null); invalidateCatalog(); Alert.alert("تم الحذف", "حُذف المنتج وصوره من الكتالوج."); }, onError: (error) => Alert.alert("تعذر الحذف", error.message) });
  const reorderNodes = trpc.admin.reorderCatalogNodes.useMutation({ onSuccess: () => { invalidateCatalog(); setNodeReorderScope(null); Alert.alert("تم حفظ الترتيب", "سيظهر ترتيب التقسيمات الجديد للعميل فور تحديث الكتالوج."); }, onError: (error) => Alert.alert("تعذر حفظ الترتيب", error.message) });
  const reorderProducts = trpc.admin.reorderProducts.useMutation({ onSuccess: () => { invalidateCatalog(); setProductReorderScope(null); Alert.alert("تم حفظ الترتيب", "سيظهر ترتيب المنتجات الجديد للعملاء عند فتح هذه التقسيمة."); }, onError: (error) => Alert.alert("تعذر حفظ الترتيب", error.message) });
  const reorderServices = trpc.admin.reorderServices.useMutation({ onSuccess: () => { invalidateCatalog(); setServiceReorderOpen(false); Alert.alert("تم حفظ الترتيب", "سيظهر ترتيب الخدمات الجديد للعميل فور تحديث الصفحة الرئيسية والكتالوج."); }, onError: (error) => Alert.alert("تعذر حفظ الترتيب", error.message) });
  const resetServicesOrder = trpc.admin.resetServicesOrder.useMutation({ onSuccess: () => { invalidateCatalog(); setServiceReorderOpen(false); Alert.alert("تمت إعادة الترتيب", "عادت الخدمات إلى الترتيب الافتراضي الذي اعتمدته الإدارة."); }, onError: (error) => Alert.alert("تعذر إعادة الترتيب", error.message) });

  const saveNode = () => { if (!selectedService) { Alert.alert("أضف خدمة رئيسية أولاً", "لا يمكن إنشاء تقسيمة مستقلة. من بطاقة «أدوات المالك: الصفحات وصور المنتجات» أعلى هذه الشاشة اختر «إضافة صفحة الخدمة»، ثم أضف التقسيمات داخلها."); return; } if (nodeName.trim().length < 2) { Alert.alert("بيانات ناقصة", "اكتب اسم التقسيمة أولاً."); return; } createNode.mutate({ serviceId: selectedService, parentId, nodeType, name: nodeName.trim(), description: nodeDescription.trim() || undefined, selectionMode: nodeSelectionMode }); };
  const saveProduct = () => { const node = nodes.find((item) => item.id === selectedProductNode); if (!node || productName.trim().length < 2) { Alert.alert("بيانات ناقصة", "اختر تقسيمة واكتب اسم المنتج."); return; } createProduct.mutate({ serviceId: node.serviceId, catalogNodeId: node.id, name: productName.trim(), productCode: productCode.trim() || undefined, description: productDescription.trim() || undefined }); };
  const openNodeEditor = (node: typeof nodes[number]) => { setEditingNodeId(node.id); setEditNodeName(node.name); setEditNodeDescription(node.description || ""); setEditNodeParentId(node.parentId); setEditNodeType(node.nodeType); setEditNodeSelectionMode(node.selectionMode === "single" || node.selectionMode === "view_only" ? node.selectionMode : "multi"); };
  const openProductEditor = (product: typeof products[number]) => { setEditingProductId(product.id); setEditProductName(product.name); setEditProductCode(product.productCode || ""); setEditProductDescription(product.description || ""); setEditProductNodeId(product.catalogNodeId); };
  const saveNodeEdit = () => { if (!editingNode || editNodeName.trim().length < 2) { Alert.alert("بيانات ناقصة", "اكتب اسم التقسيمة."); return; } updateNode.mutate({ nodeId: editingNode.id, name: editNodeName.trim(), description: editNodeDescription.trim() || undefined, parentId: editNodeParentId, nodeType: editNodeType, selectionMode: editNodeSelectionMode }, { onSuccess: () => { invalidateCatalog(); setEditingNodeId(null); Alert.alert("تم الحفظ", "تم تحديث بيانات التقسيمة ونمط اختيار العملاء."); } }); };
  const saveProductEdit = () => { if (!editingProduct || !editProductNodeId || editProductName.trim().length < 2) { Alert.alert("بيانات ناقصة", "اكتب اسم المنتج واختر التقسيمة."); return; } updateProduct.mutate({ productId: editingProduct.id, catalogNodeId: editProductNodeId, name: editProductName.trim(), productCode: editProductCode.trim() || undefined, description: editProductDescription.trim() || undefined }, { onSuccess: () => { invalidateCatalog(); setEditingProductId(null); Alert.alert("تم الحفظ", "تم تحديث بيانات المنتج."); } }); };
  const confirmDeleteNode = (node: typeof nodes[number]) => setDeleteTarget({ type: "node", id: node.id, name: node.name });
  const confirmDeleteProduct = (product: typeof products[number]) => setDeleteTarget({ type: "product", id: product.id, name: product.name });
  const completeDelete = () => {
    if (deleteTarget?.type === "node") deleteNode.mutate({ nodeId: deleteTarget.id });
    if (deleteTarget?.type === "product") deleteProduct.mutate({ productId: deleteTarget.id });
  };
  const confirmVisibility = (product: typeof products[number]) => Alert.alert(product.isActive ? "إخفاء من الكتالوج" : "إظهار في الكتالوج", product.isActive ? `سيختفي «${product.name}» من الكتالوج ومن الاختيارات الجديدة. ستبقى اختيارات العملاء السابقة محفوظة داخل مشروعاتهم.` : `سيصبح «${product.name}» ظاهراً للعملاء مرة أخرى.`, [{ text: "إلغاء", style: "cancel" }, { text: product.isActive ? "إخفاء" : "إظهار", onPress: () => setProductVisibility.mutate({ productId: product.id, isActive: !product.isActive }) }]);
  const confirmResetServicesOrder = () => Alert.alert("استعادة الترتيب الافتراضي", "سيعود ترتيب الخدمات إلى التسلسل المرجعي الذي اعتمدته الإدارة. هل تريد المتابعة؟", [{ text: "إلغاء", style: "cancel" }, { text: "استعادة", style: "destructive", onPress: () => resetServicesOrder.mutate() }]);
  if (deleteTarget) {
    const description = deleteTarget.type === "node"
      ? `هل تريد حذف «${deleteTarget.name}» وكل تقسيماتها الفرعية ومنتجاتها غير المرتبطة باختيارات العملاء؟ لا يمكن التراجع عن ذلك.`
      : `هل تريد حذف «${deleteTarget.name}» وصوره نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`;
    return <DeleteConfirmationDialog visible title={deleteTarget.type === "node" ? "حذف التقسيمة" : "حذف المنتج"} description={description} confirmLabel={deleteTarget.type === "node" ? "حذف التقسيمة" : "حذف المنتج"} loading={deleteNode.isPending || deleteProduct.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={completeDelete} />;
  }

  const header = <View><View style={styles.form}><Text style={styles.formTitle}>ترتيب الخدمات الرئيسية</Text><Text style={styles.help}>رتّب خدمات MADD كما يجب أن يراها العميل في الصفحة الرئيسية والكتالوج. الخدمات المخفية تحتفظ بموضعها ولا تظهر للعميل.</Text><SecondaryButton label={serviceReorderItems.length > 1 ? "ترتيب الخدمات بالسحب والإفلات" : "أضف خدمة أخرى لتفعيل الترتيب"} onPress={() => serviceReorderItems.length > 1 && setServiceReorderOpen(true)} /><SecondaryButton label="إعادة الضبط إلى الترتيب الافتراضي" loading={resetServicesOrder.isPending} onPress={confirmResetServicesOrder} /></View>{services.length === 0 ? <View style={styles.form}><Text style={styles.formTitle}>ابدأ بإضافة صفحة خدمة</Text><Text style={styles.help}>لا يمكن حفظ تقسيمة أو منتج قبل وجود خدمة رئيسية تحتويهما. افتح بطاقة «أدوات المالك: الصفحات وصور المنتجات» أعلى تبويب الكتالوج، ثم اختر «إضافة صفحة الخدمة» وأنشئ أول خدمة مثل «دهانات» أو «أرضيات».</Text></View> : null}<View style={styles.form}><Text style={styles.formTitle}>تقسيمة أو نوع تشطيب جديد</Text><Text style={styles.help}>مثال: دهانات ← دهانات داخلية ← دهان مطفي. اختر الخدمة ثم — اختيارياً — التقسيمة الأم.</Text><FlatList horizontal data={services} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} renderItem={({ item }) => <ChoiceChip active={selectedService === item.id} label={item.name} onPress={() => { setServiceId(item.id); setParentId(null); setProductNodeId(null); }} />} /><TextInput value={nodeName} onChangeText={setNodeName} placeholder="اسم التقسيمة أو النوع" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={nodeDescription} onChangeText={setNodeDescription} placeholder="وصف مختصر (اختياري)" placeholderTextColor={Brand.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline /><View style={styles.dualChoice}><ChoiceChip active={nodeType === "category"} label="تقسيمة" onPress={() => setNodeType("category")} /><ChoiceChip active={nodeType === "option"} label="خيار" onPress={() => setNodeType("option")} /></View><FlatList horizontal data={nodes.filter((node) => node.serviceId === selectedService)} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} ListHeaderComponent={<ChoiceChip active={parentId === null} label="بدون تقسيمة أم" onPress={() => setParentId(null)} />} renderItem={({ item }) => <ChoiceChip active={parentId === item.id} label={`داخل ${item.name}`} onPress={() => setParentId(item.id)} />} /><SecondaryButton label={nodeImage ? "تغيير صورة التقسيمة" : "إرفاق صورة للتقسيمة"} onPress={() => void pickImages(1).then((images) => setNodeImage(images[0] ?? null))} />{nodeImage ? <Image source={{ uri: nodeImage.uri }} style={styles.singlePreview} /> : null}<PrimaryButton label="إضافة التقسيمة" loading={createNode.isPending || uploadNodeImage.isPending} onPress={saveNode} /></View><View style={styles.form}><Text style={styles.formTitle}>منتج جديد</Text><Text style={styles.help}>اختر التقسيمة المناسبة، ثم أضف بيانات المنتج وصوره. الأسعار تظل داخلية ولا تظهر للعميل.</Text><FlatList horizontal data={nodes.filter((node) => node.serviceId === selectedService)} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} renderItem={({ item }) => <ChoiceChip active={selectedProductNode === item.id} label={item.name} onPress={() => setProductNodeId(item.id)} />} /><TextInput value={productName} onChangeText={setProductName} placeholder="اسم المنتج" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={productCode} onChangeText={setProductCode} placeholder="كود المنتج (اختياري)" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={productDescription} onChangeText={setProductDescription} placeholder="وصف المنتج (اختياري)" placeholderTextColor={Brand.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline /><SecondaryButton label={productImages.length ? `تعديل صور المنتج (${productImages.length})` : "إرفاق صور المنتج"} onPress={() => void pickImages(3).then(setProductImages)} /><FlatList horizontal data={productImages} keyExtractor={(item) => item.uri} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewList} renderItem={({ item }) => <Pressable onPress={() => setProductImages((current) => current.filter((selectedImage) => selectedImage.uri !== item.uri))} style={({ pressed }) => [styles.previewWrap, pressed && styles.pressed]}><Image source={{ uri: item.uri }} style={styles.preview} /><View style={styles.remove}><MaterialIcons name="close" size={14} color="#0C0C0C" /></View></Pressable>} /><PrimaryButton label="إضافة المنتج" loading={createProduct.isPending || uploadProductImages.isPending} onPress={saveProduct} /></View><View style={styles.orderHelp}><MaterialIcons name="drag-indicator" size={22} color={Brand.pine} /><Text style={styles.orderHelpText}>يمكنك فتح أداة الترتيب للخدمات أو التقسيمات أو مجموعات المنتجات، ثم السحب من المقبض لتغيير موضع العناصر.</Text></View><Text style={styles.sectionTitle}>المنتجات المنشورة والمخفية</Text></View>;

  return <><FlatList data={products} scrollEnabled={!embedded} nestedScrollEnabled={false} directionalLockEnabled keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} ListHeaderComponent={<View>{headerContent}{header}</View>} renderItem={({ item }) => { const scope = productScopes.find((group) => group.catalogNodeId === item.catalogNodeId); return <View style={[styles.card, !item.isActive && styles.hiddenCard]}><View style={styles.rowBetween}><Text style={[styles.tag, !item.isActive && styles.hiddenTag]}>{item.isActive ? `${item.serviceName} · ${item.catalogNodeName}` : "مخفي من الكتالوج"}</Text><Text style={styles.cardTitle}>{item.name}</Text></View>{item.mainImageUrl ? <Image source={{ uri: item.mainImageUrl }} style={styles.productImage} /> : null}<Text style={styles.meta}>{item.productCode || "بدون كود"}</Text>{!item.isActive ? <Text style={styles.hiddenNote}>لا يظهر للعملاء عند التصفح أو الاختيار الجديد، وتبقى اختيارات العملاء السابقة محفوظة.</Text> : null}<View style={styles.catalogActions}><SecondaryButton label={item.isActive ? "إخفاء من الكتالوج" : "إظهار في الكتالوج"} loading={setProductVisibility.isPending} onPress={() => confirmVisibility(item)} style={styles.flexAction} />{scope && scope.items.length > 1 ? <Pressable accessibilityLabel="ترتيب منتجات التقسيمة" onPress={() => setProductReorderScope(scope)} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><MaterialIcons name="reorder" size={22} color={Brand.pine} /></Pressable> : null}<Pressable accessibilityLabel="تعديل المنتج" onPress={() => openProductEditor(item)} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><MaterialIcons name="edit" size={20} color={Brand.pine} /></Pressable><Pressable accessibilityLabel="حذف المنتج" onPress={() => confirmDeleteProduct(item)} style={({ pressed }) => [styles.iconAction, styles.deleteAction, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={21} color={Brand.error} /></Pressable></View></View>; }} ListFooterComponent={<View style={styles.catalogFooter}><Text style={styles.sectionTitle}>التقسيمات الحالية</Text>{nodeScopes.map((scope) => <View key={`${scope.serviceId}-${scope.parentId ?? "root"}`} style={styles.nodeGroup}><View style={styles.rowBetween}><Pressable accessibilityLabel="ترتيب التقسيمات" onPress={() => setNodeReorderScope(scope)} disabled={scope.items.length < 2} style={({ pressed }) => [styles.orderButton, scope.items.length < 2 && styles.orderButtonDisabled, pressed && styles.pressed]}><MaterialIcons name="reorder" size={22} color={Brand.pine} /><Text style={styles.orderButtonText}>ترتيب</Text></Pressable><Text style={styles.groupTitle}>{scope.label}</Text></View>{nodes.filter((node) => node.serviceId === scope.serviceId && node.parentId === scope.parentId).map((node) => <View key={node.id} style={styles.nodeRow}><Text style={styles.meta}>{node.nodeType === "category" ? "تقسيمة" : "خيار"}{node.isActive ? " · منشور" : " · مخفي"}</Text><Text style={styles.cardTitle}>{node.name}</Text><View style={styles.catalogActions}><SecondaryButton label={node.isActive ? "إخفاء" : "نشر"} onPress={() => updateNode.mutate({ nodeId: node.id, isActive: !node.isActive })} style={styles.flexAction} /><Pressable accessibilityLabel="تعديل التقسيمة" onPress={() => openNodeEditor(node)} style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}><MaterialIcons name="edit" size={20} color={Brand.pine} /></Pressable><Pressable accessibilityLabel="حذف التقسيمة" onPress={() => confirmDeleteNode(node)} style={({ pressed }) => [styles.iconAction, styles.deleteAction, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={21} color={Brand.error} /></Pressable></View></View>)}</View>)}</View>} ListEmptyComponent={productsQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : <EmptyState icon="inventory-2" title="أضف أول منتج" description="ابدأ بتقسيمة ثم أضف المنتجات والصور التي تريد أن يراها العملاء." />} /><EditorSheet visible={Boolean(editingNode)} title="تعديل التقسيمة" onClose={() => setEditingNodeId(null)}><TextInput value={editNodeName} onChangeText={setEditNodeName} placeholder="اسم التقسيمة" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={editNodeDescription} onChangeText={setEditNodeDescription} placeholder="الوصف (اختياري)" placeholderTextColor={Brand.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline /><View style={styles.dualChoice}><ChoiceChip active={editNodeType === "category"} label="تقسيمة" onPress={() => setEditNodeType("category")} /><ChoiceChip active={editNodeType === "option"} label="خيار" onPress={() => setEditNodeType("option")} /></View><Text style={styles.fieldLabel}>التقسيمة الأم</Text><FlatList horizontal data={nodes.filter((node) => node.serviceId === editingNode?.serviceId && node.id !== editingNode?.id)} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} ListHeaderComponent={<ChoiceChip active={editNodeParentId === null} label="بدون تقسيمة أم" onPress={() => setEditNodeParentId(null)} />} renderItem={({ item }) => <ChoiceChip active={editNodeParentId === item.id} label={item.name} onPress={() => setEditNodeParentId(item.id)} />} /><SecondaryButton label="تغيير صورة التقسيمة" loading={uploadNodeImage.isPending} onPress={() => void pickImages(1).then((images) => { const image = images[0]; if (image && editingNode) uploadNodeImage.mutate({ nodeId: editingNode.id, image: { fileName: image.fileName, mimeType: image.mimeType, dataBase64: image.dataBase64 } }); })} /><PrimaryButton label="حفظ التعديلات" loading={updateNode.isPending} onPress={saveNodeEdit} /><Pressable onPress={() => editingNode && confirmDeleteNode(editingNode)} style={({ pressed }) => [styles.destructiveButton, pressed && styles.pressed]}><Text style={styles.destructiveButtonText}>حذف هذه التقسيمة</Text></Pressable></EditorSheet><EditorSheet visible={Boolean(editingProduct)} title="تعديل المنتج" onClose={() => setEditingProductId(null)}><TextInput value={editProductName} onChangeText={setEditProductName} placeholder="اسم المنتج" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={editProductCode} onChangeText={setEditProductCode} placeholder="كود المنتج (اختياري)" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={editProductDescription} onChangeText={setEditProductDescription} placeholder="الوصف (اختياري)" placeholderTextColor={Brand.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline /><Text style={styles.fieldLabel}>انقل المنتج داخل الخدمة نفسها</Text><FlatList horizontal data={nodes.filter((node) => node.serviceId === editingProduct?.serviceId)} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipList} renderItem={({ item }) => <ChoiceChip active={editProductNodeId === item.id} label={item.name} onPress={() => setEditProductNodeId(item.id)} />} /><SecondaryButton label="إضافة صور جديدة للمنتج" loading={uploadProductImages.isPending} onPress={() => void pickImages(3).then((images) => { if (images.length && editingProduct) uploadProductImages.mutate({ productId: editingProduct.id, images: images.map((image) => ({ fileName: image.fileName, mimeType: image.mimeType, dataBase64: image.dataBase64 })) }); })} /><Text style={styles.help}>تُضاف الصور الجديدة إلى معرض المنتج، ولا تحذف الصور الموجودة.</Text><PrimaryButton label="حفظ التعديلات" loading={updateProduct.isPending} onPress={saveProductEdit} /><Pressable onPress={() => editingProduct && confirmDeleteProduct(editingProduct)} style={({ pressed }) => [styles.destructiveButton, pressed && styles.pressed]}><Text style={styles.destructiveButtonText}>حذف هذا المنتج</Text></Pressable></EditorSheet><ReorderSheet visible={serviceReorderOpen} title="ترتيب الخدمات الرئيسية" description="اضغط مطولاً على مقبض السحب ثم رتّب تسلسل الخدمات كما يجب أن يظهر للعملاء." data={serviceReorderItems} saving={reorderServices.isPending} onClose={() => setServiceReorderOpen(false)} onSave={(items) => reorderServices.mutate({ serviceIds: items.map((item) => item.id) })} /><ReorderSheet visible={Boolean(nodeReorderScope)} title="ترتيب التقسيمات" description="اضغط مطولاً على مقبض السحب ثم اسحب لتغيير موضع التقسيمات الشقيقة." data={nodeReorderScope?.items ?? []} saving={reorderNodes.isPending} onClose={() => setNodeReorderScope(null)} onSave={(items) => { if (nodeReorderScope) reorderNodes.mutate({ serviceId: nodeReorderScope.serviceId, parentId: nodeReorderScope.parentId, nodeIds: items.map((item) => item.id) }); }} /><ReorderSheet visible={Boolean(productReorderScope)} title="ترتيب المنتجات" description="اضغط مطولاً على مقبض السحب ثم اسحب لتحديد ترتيب ظهور منتجات هذه التقسيمة للعملاء." data={productReorderScope?.items ?? []} saving={reorderProducts.isPending} onClose={() => setProductReorderScope(null)} onSave={(items) => { if (productReorderScope) reorderProducts.mutate({ catalogNodeId: productReorderScope.catalogNodeId, productIds: items.map((item) => item.id) }); }} /></>;
}

const styles = StyleSheet.create({
  loader: { minHeight: 180, alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 30 },
  form: { backgroundColor: "#211B10", borderColor: "#665529", borderWidth: 1, padding: 16, borderRadius: 21, marginBottom: 14 },
  formTitle: { color: Brand.ink, fontSize: 17, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 7 },
  help: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginBottom: 12 },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: "#4C4025", backgroundColor: "#11110F", paddingHorizontal: 13, fontSize: 14, color: Brand.ink, writingDirection: "rtl", marginBottom: 10 },
  multiline: { minHeight: 72, textAlignVertical: "top", paddingTop: 12 },
  chipList: { gap: 7, paddingVertical: 2, paddingHorizontal: 1, marginBottom: 11 },
  chip: { borderRadius: 12, borderColor: "#5B4B29", borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: Brand.card, marginLeft: 7 },
  chipActive: { backgroundColor: Brand.pine, borderColor: Brand.pine },
  chipText: { color: Brand.pine, fontSize: 12, fontWeight: "700", writingDirection: "rtl" },
  chipTextActive: { color: "#0C0C0C" },
  dualChoice: { flexDirection: "row-reverse", gap: 7, marginBottom: 11 },
  singlePreview: { width: 88, height: 88, borderRadius: 13, marginTop: 10, marginBottom: 11, alignSelf: "flex-end" },
  previewList: { gap: 8, paddingVertical: 10 },
  previewWrap: { width: 76, height: 76, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Brand.line, marginLeft: 8 },
  preview: { width: "100%", height: "100%" },
  remove: { position: "absolute", top: 4, left: 4, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: Brand.pine },
  sectionTitle: { color: Brand.ink, fontWeight: "800", fontSize: 16, textAlign: "right", writingDirection: "rtl", marginVertical: 12 },
  card: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 20, padding: 15, marginBottom: 10 },
  hiddenCard: { borderColor: "#8B7958", backgroundColor: "#191815" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowActions: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 10, marginTop: 12 },
  catalogActions: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginTop: 12 },
  iconAction: { minWidth: 42, minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: "#5B4B29", alignItems: "center", justifyContent: "center", backgroundColor: "#11110F" },
  deleteAction: { borderColor: "#8B4540" },
  cardTitle: { color: Brand.ink, fontSize: 15, fontWeight: "800", textAlign: "right", writingDirection: "rtl", flexShrink: 1 },
  meta: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  tag: { color: Brand.clay, fontSize: 11, fontWeight: "700", textAlign: "left" },
  hiddenTag: { color: Brand.pine },
  hiddenNote: { color: Brand.pine, fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  state: { color: Brand.success, fontSize: 12, fontWeight: "700" },
  stateMuted: { color: Brand.muted },
  flexAction: { minHeight: 40, flex: 1 },
  productImage: { width: "100%", height: 130, borderRadius: 14, marginTop: 11, backgroundColor: "#171717", borderWidth: 1, borderColor: Brand.line },
  catalogFooter: { marginTop: 8 },
  nodeGroup: { marginBottom: 16 },
  groupTitle: { color: Brand.ink, fontSize: 13, fontWeight: "800", flexShrink: 1, textAlign: "right", writingDirection: "rtl" },
  nodeRow: { backgroundColor: Brand.card, borderColor: Brand.line, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 9 },
  orderHelp: { flexDirection: "row-reverse", gap: 9, alignItems: "flex-start", borderRadius: 17, padding: 13, backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5B4B29", marginBottom: 4 },
  orderHelpText: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", flex: 1 },
  orderButton: { minHeight: 39, flexDirection: "row-reverse", gap: 3, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: "#5B4B29", paddingHorizontal: 9, backgroundColor: "#11110F" },
  orderButtonDisabled: { opacity: 0.42 },
  orderButtonText: { color: Brand.pine, fontSize: 12, fontWeight: "800", writingDirection: "rtl" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  modalSheet: { maxHeight: "90%", minHeight: "58%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: Brand.card, borderColor: "#665529", borderWidth: 1, overflow: "hidden" },
  reorderSheet: { Height: Dimensions.get("window").height * 0.84, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: Brand.card, borderColor: "#665529", borderWidth: 1, overflow: "hidden" },
  modalTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Brand.line },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#211B10", borderWidth: 1, borderColor: "#5B4B29" },
  modalTitle: { color: Brand.ink, fontSize: 18, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  modalContent: { padding: 17, paddingBottom: 34 },
  fieldLabel: { color: Brand.ink, fontSize: 13, fontWeight: "700", writingDirection: "rtl", textAlign: "right", marginBottom: 7 },
  destructiveButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "#8B4540", backgroundColor: "#2B1717", marginTop: 12 },
  destructiveButtonText: { color: Brand.error, fontSize: 14, fontWeight: "800", writingDirection: "rtl" },
  reorderIntro: { flexDirection: "row-reverse", gap: 9, alignItems: "flex-start", paddingHorizontal: 17, paddingTop: 16 },
  reorderList: { paddingHorizontal: 17, paddingBottom: 30 },
  reorderActions: { gap: 10, paddingTop: 6 },
  orderHint: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl" },
  reorderRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, minHeight: 74, padding: 10, backgroundColor: "#211B10", borderColor: Brand.line, borderWidth: 1, borderRadius: 18, marginBottom: 9 },
  reorderRowActive: { backgroundColor: "#2A2A20", borderColor: Brand.pine, opacity: 0.95 },
  dragHandle: { width: 32, alignItems: "center", justifyContent: "center" },
  reorderImage: { width: 48, height: 48, borderRadius: 11, backgroundColor: "#171717" },
  reorderImageFallback: { width: 48, height: 48, borderRadius: 11, backgroundColor: Brand.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: Brand.line },
  reorderText: { flex: 1, alignItems: "flex-end" },
  pressed: { opacity: 0.68 },
});
