import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Brand, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { trpc } from "@/lib/trpc";

type SelectedImage = { uri: string; fileName: string; mimeType: string; dataBase64: string };

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
    if (Math.floor((asset.base64.length * 3) / 4) > 3 * 1024 * 1024) return [];
    return [{ uri: asset.uri, fileName: asset.fileName || `madd-${Date.now()}-${index + 1}.jpg`, mimeType: asset.mimeType || "image/jpeg", dataBase64: asset.base64 }];
  });
  if (images.length !== result.assets.length) Alert.alert("بعض الصور لم تُضف", "اختر صوراً لا يزيد حجم كل منها على 3 ميغابايت.");
  return images;
}

export function AdminOwnerCatalogTools() {
  const utils = trpc.useUtils();
  const accessQuery = trpc.admin.me.useQuery();
  const servicesQuery = trpc.admin.services.useQuery();
  const productsQuery = trpc.admin.products.useQuery();
  const [visible, setVisible] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [serviceDeleteOpen, setServiceDeleteOpen] = useState(false);
  const productImagesQuery = trpc.admin.productImages.useQuery({ productId: selectedProductId ?? 1 }, { enabled: selectedProductId !== null });
  const invalidateCatalog = () => {
    void utils.admin.services.invalidate();
    void utils.admin.catalogNodes.invalidate();
    void utils.catalog.services.invalidate();
    void utils.admin.products.invalidate();
    if (selectedProductId) void utils.admin.productImages.invalidate({ productId: selectedProductId });
  };
  const createService = trpc.admin.createService.useMutation({
    onSuccess: (serviceId) => {
      invalidateCatalog();
      setEditingServiceId(serviceId);
      Alert.alert("تمت إضافة الصفحة", "أضف الآن صورة الخدمة أو عدّل الوصف من الواجهة نفسها.");
    },
    onError: (error) => Alert.alert("تعذر إضافة الصفحة", error.message),
  });
  const updateService = trpc.admin.updateService.useMutation({ onSuccess: () => { invalidateCatalog(); Alert.alert("تم الحفظ", "تم تحديث بيانات الخدمة."); }, onError: (error) => Alert.alert("تعذر الحفظ", error.message) });
  const deleteService = trpc.admin.deleteService.useMutation({ onSuccess: (result) => { if (!result.success) { Alert.alert("تعذر الحذف", result.reason || "هذه الخدمة مرتبطة بسجلات أخرى."); return; } setServiceDeleteOpen(false); invalidateCatalog(); setEditingServiceId(null); setServiceName(""); setServiceDescription(""); Alert.alert("تم الحذف", "حُذفت الخدمة ومحتواها غير المرتبط بالعملاء من الكتالوج."); }, onError: (error) => Alert.alert("تعذر الحذف", error.message) });
  const uploadServiceImage = trpc.admin.uploadServiceImage.useMutation({ onSuccess: () => { invalidateCatalog(); Alert.alert("تم تحديث الصورة", "ستظهر الصورة الجديدة في صفحات العملاء."); }, onError: (error) => Alert.alert("تعذر رفع الصورة", error.message) });
  const uploadProductImages = trpc.admin.uploadProductImages.useMutation({ onSuccess: () => { invalidateCatalog(); Alert.alert("تمت إضافة الصور", "أُضيفت الصور إلى معرض المنتج."); }, onError: (error) => Alert.alert("تعذر رفع الصور", error.message) });
  const deleteProductImage = trpc.admin.deleteProductImage.useMutation({ onSuccess: (result) => { if (!result.success) { Alert.alert("تعذر الحذف", result.reason || "تعذر حذف الصورة."); return; } invalidateCatalog(); Alert.alert("تم حذف الصورة", "تغيّرت الصورة الرئيسية تلقائياً إن كانت الصورة المحذوفة هي الرئيسية."); }, onError: (error) => Alert.alert("تعذر حذف الصورة", error.message) });
  const setMainImage = trpc.admin.updateProduct.useMutation({ onSuccess: () => { invalidateCatalog(); Alert.alert("تم تحديد الصورة الرئيسية", "ستظهر هذه الصورة أولاً للعملاء."); }, onError: (error) => Alert.alert("تعذر تغيير الصورة الرئيسية", error.message) });

  const services = servicesQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const editingService = services.find((service) => service.id === editingServiceId) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const isOwner = accessQuery.data?.role === "owner";

  useEffect(() => {
    if (editingService) {
      setServiceName(editingService.name);
      setServiceDescription(editingService.description || "");
    }
  }, [editingService]);

  if (!isOwner) return null;

  const resetServiceEditor = () => { setEditingServiceId(null); setServiceName(""); setServiceDescription(""); };
  const saveService = () => {
    if (serviceName.trim().length < 2) { Alert.alert("بيانات ناقصة", "اكتب اسم الخدمة أولاً."); return; }
    if (editingServiceId) updateService.mutate({ serviceId: editingServiceId, name: serviceName.trim(), description: serviceDescription.trim() || undefined });
    else createService.mutate({ name: serviceName.trim(), description: serviceDescription.trim() || undefined });
  };
  const confirmServiceDelete = () => editingService && setServiceDeleteOpen(true);
  const addServiceImage = () => void pickImages(1).then((images) => {
    const image = images[0];
    if (image && editingService) uploadServiceImage.mutate({ serviceId: editingService.id, image: { fileName: image.fileName, mimeType: image.mimeType, dataBase64: image.dataBase64 } });
  });
  const addProductImages = () => void pickImages(3).then((images) => {
    if (images.length && selectedProduct) uploadProductImages.mutate({ productId: selectedProduct.id, images: images.map(({ fileName, mimeType, dataBase64 }) => ({ fileName, mimeType, dataBase64 })) });
  });
  const confirmImageDelete = (imageId: number) => Alert.alert("حذف الصورة", "هل تريد حذف هذه الصورة من معرض المنتج؟", [{ text: "إلغاء", style: "cancel" }, { text: "حذف", style: "destructive", onPress: () => deleteProductImage.mutate({ imageId }) }]);

  if (serviceDeleteOpen && editingService) {
    return <DeleteConfirmationDialog visible title="حذف صفحة خدمة" description={`هل تريد حذف «${editingService.name}» وكل تقسيماتها ومنتجاتها غير المرتبطة باختيارات العملاء؟ لا يمكن التراجع عن ذلك.`} confirmLabel="حذف الصفحة" loading={deleteService.isPending} onCancel={() => setServiceDeleteOpen(false)} onConfirm={() => deleteService.mutate({ serviceId: editingService.id })} />;
  }

  return <View style={styles.launcher}><Pressable onPress={() => setVisible(true)} style={({ pressed }) => [styles.launcherButton, pressed && styles.pressed]}><MaterialIcons name="admin-panel-settings" size={21} color="#0C0C0C" /><View style={styles.launcherText}><Text style={styles.launcherTitle}>أدوات المالك: الصفحات وصور المنتجات</Text><Text style={styles.launcherSub}>إضافة وتعديل وحذف الخدمات والصور من واجهة مرئية</Text></View></Pressable><Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}><View style={styles.overlay}><View style={styles.sheet}><View style={styles.sheetTop}><Pressable onPress={() => setVisible(false)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><MaterialIcons name="close" size={21} color={Brand.ink} /></Pressable><Text style={styles.sheetTitle}>إدارة صفحات MADD وصور المنتجات</Text></View><FlatList data={productImagesQuery.data ?? []} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.content} ListHeaderComponent={<><View style={styles.editorCard}><View style={styles.headingRow}><Text style={styles.heading}>{editingService ? `تعديل صفحة: ${editingService.name}` : "إضافة صفحة خدمة"}</Text><Pressable onPress={resetServiceEditor} style={({ pressed }) => [styles.smallAction, pressed && styles.pressed]}><Text style={styles.smallActionText}>جديد</Text></Pressable></View><Text style={styles.help}>اكتب اسم الصفحة ووصفها بالعربية فقط؛ يُنشئ النظام المعرف الداخلي تلقائياً.</Text><TextInput value={serviceName} onChangeText={setServiceName} placeholder="اسم الخدمة، مثل: التشطيبات الداخلية" placeholderTextColor={Brand.muted} style={styles.input} textAlign="right" /><TextInput value={serviceDescription} onChangeText={setServiceDescription} placeholder="وصف الخدمة (اختياري)" placeholderTextColor={Brand.muted} style={[styles.input, styles.multiline]} textAlign="right" multiline /><PrimaryButton label={editingService ? "حفظ تعديل الخدمة" : "إضافة صفحة الخدمة"} loading={createService.isPending || updateService.isPending} onPress={saveService} />{editingService ? <><SecondaryButton label={editingService.imageUrl ? "تغيير صورة الخدمة" : "إضافة صورة للخدمة"} loading={uploadServiceImage.isPending} onPress={addServiceImage} />{editingService.imageUrl ? <Image source={{ uri: editingService.imageUrl }} style={styles.serviceImage} /> : null}<SecondaryButton label={editingService.isActive ? "إخفاء الصفحة عن العملاء" : "إظهار الصفحة للعملاء"} onPress={() => updateService.mutate({ serviceId: editingService.id, isActive: !editingService.isActive })} /><Pressable onPress={confirmServiceDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}><Text style={styles.deleteText}>حذف هذه الصفحة</Text></Pressable></> : null}</View><Text style={styles.sectionLabel}>صفحات الخدمات الحالية</Text><FlatList horizontal data={services} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceList} renderItem={({ item }) => <Pressable onPress={() => setEditingServiceId(item.id)} style={({ pressed }) => [styles.serviceChip, item.id === editingServiceId && styles.serviceChipActive, pressed && styles.pressed]}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.chipImage} /> : <MaterialIcons name="pages" size={18} color={Brand.pine} />}<Text numberOfLines={1} style={styles.serviceChipText}>{item.name}</Text></Pressable>} /><View style={styles.mediaCard}><Text style={styles.heading}>معرض صور المنتجات</Text><Text style={styles.help}>اختر منتجاً، ثم أضف صوراً، عيّن صورة رئيسية، أو احذف صورة واحدة من المعرض.</Text><FlatList horizontal data={products} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.serviceList} renderItem={({ item }) => <Pressable onPress={() => setSelectedProductId(item.id)} style={({ pressed }) => [styles.serviceChip, item.id === selectedProductId && styles.serviceChipActive, pressed && styles.pressed]}>{item.mainImageUrl ? <Image source={{ uri: item.mainImageUrl }} style={styles.chipImage} /> : <MaterialIcons name="inventory-2" size={18} color={Brand.pine} />}<Text numberOfLines={1} style={styles.serviceChipText}>{item.name}</Text></Pressable>} />{selectedProduct ? <><Text style={styles.selectedProduct}>{selectedProduct.name}</Text><SecondaryButton label="إضافة صور للمنتج" loading={uploadProductImages.isPending} onPress={addProductImages} /><Text style={styles.help}>اضغط «رئيسية» لتغيير صورة العرض، أو رمز الحذف لإزالة صورة مفردة.</Text></> : <Text style={styles.help}>اختر منتجاً من القائمة لإدارة صوره.</Text>}</View></>} renderItem={({ item }) => <View style={styles.imageRow}><Image source={{ uri: item.imageUrl }} style={styles.galleryImage} /><View style={styles.imageControls}><Text style={styles.imageState}>{item.imageUrl === selectedProduct?.mainImageUrl ? "الصورة الرئيسية" : "صورة ضمن المعرض"}</Text>{item.imageUrl !== selectedProduct?.mainImageUrl ? <SecondaryButton label="رئيسية" loading={setMainImage.isPending} onPress={() => selectedProduct && setMainImage.mutate({ productId: selectedProduct.id, mainImageUrl: item.imageUrl })} /> : null}<Pressable accessibilityLabel="حذف صورة المنتج" onPress={() => confirmImageDelete(item.id)} style={({ pressed }) => [styles.deleteIcon, pressed && styles.pressed]}><MaterialIcons name="delete-outline" size={21} color={Brand.error} /></Pressable></View></View>} ListEmptyComponent={selectedProductId ? productImagesQuery.isLoading ? <View style={styles.loading}><ActivityIndicator color={Brand.pine} /></View> : <Text style={styles.emptyImages}>لا توجد صور لهذا المنتج بعد.</Text> : null} /></View></View></Modal></View>;
}

const styles = StyleSheet.create({
  launcher: { marginBottom: 12 }, launcherButton: { flexDirection: "row-reverse", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: Brand.pine }, launcherText: { flex: 1, alignItems: "flex-end" }, launcherTitle: { color: "#0C0C0C", fontSize: 13, fontWeight: "900", writingDirection: "rtl" }, launcherSub: { color: "#312B1D", fontSize: 11, marginTop: 2, writingDirection: "rtl", textAlign: "right" }, overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" }, sheet: { maxHeight: Dimensions.get("window").height * 0.92, backgroundColor: Brand.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderColor: Brand.line, borderWidth: 1, overflow: "hidden" }, sheetTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: Brand.line, paddingHorizontal: 17, paddingVertical: 14 }, close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: Brand.paleGreen }, sheetTitle: { color: Brand.ink, fontSize: 17, fontWeight: "900", writingDirection: "rtl", textAlign: "right" }, content: { padding: 16, paddingBottom: 34 }, editorCard: { backgroundColor: Brand.paleGreen, borderColor: Brand.line, borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 15 }, mediaCard: { backgroundColor: "#151714", borderColor: Brand.line, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 5, marginBottom: 13 }, headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, heading: { color: Brand.ink, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right", flex: 1 }, smallAction: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line }, smallActionText: { color: Brand.pine, fontSize: 11, fontWeight: "800", writingDirection: "rtl" }, help: { color: Brand.muted, fontSize: 12, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 7, marginBottom: 10 }, input: { minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.card, paddingHorizontal: 12, color: Brand.ink, fontSize: 14, writingDirection: "rtl", marginBottom: 9 }, multiline: { minHeight: 72, paddingTop: 10, textAlignVertical: "top" }, serviceImage: { width: "100%", height: 130, borderRadius: 13, marginTop: 10, backgroundColor: "#171717" }, deleteButton: { marginTop: 11, minHeight: 45, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "#8B4540", backgroundColor: "#2B1717" }, deleteText: { color: Brand.error, fontWeight: "900", writingDirection: "rtl" }, sectionLabel: { color: Brand.ink, fontSize: 14, fontWeight: "900", textAlign: "right", writingDirection: "rtl", marginBottom: 5 }, serviceList: { gap: 8, paddingVertical: 7, paddingHorizontal: 1, marginBottom: 8 }, serviceChip: { width: 112, minHeight: 88, borderWidth: 1, borderColor: Brand.line, borderRadius: 14, backgroundColor: Brand.card, alignItems: "center", justifyContent: "center", padding: 8, gap: 6 }, serviceChipActive: { borderColor: Brand.pine, backgroundColor: "#28261D" }, chipImage: { width: 33, height: 33, borderRadius: 8, backgroundColor: "#171717" }, serviceChipText: { color: Brand.ink, fontSize: 11, fontWeight: "800", writingDirection: "rtl", textAlign: "center" }, selectedProduct: { color: Brand.pine, fontSize: 14, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginBottom: 4 }, imageRow: { flexDirection: "row-reverse", gap: 12, minHeight: 106, padding: 10, borderWidth: 1, borderColor: Brand.line, borderRadius: 15, backgroundColor: Brand.paleGreen, marginBottom: 9 }, galleryImage: { width: 86, height: 86, borderRadius: 11, backgroundColor: "#171717" }, imageControls: { flex: 1, alignItems: "flex-end", justifyContent: "space-between" }, imageState: { color: Brand.muted, fontSize: 11, writingDirection: "rtl", textAlign: "right" }, deleteIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10, borderColor: "#8B4540", borderWidth: 1, backgroundColor: "#2B1717" }, emptyImages: { color: Brand.muted, textAlign: "center", writingDirection: "rtl", paddingVertical: 20 }, loading: { minHeight: 90, alignItems: "center", justifyContent: "center" }, pressed: { opacity: 0.68 },
});
