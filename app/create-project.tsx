import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AppHeader, Brand, EmptyState, PrimaryButton, SecondaryButton } from "@/components/app-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { savePendingRoute } from "@/lib/pending-route";

type SetupStep = "basics" | "services" | "catalog";
type GuidedNode = { id: number; name: string; serviceId: number; serviceName: string; ancestors: string[] };
type GuidedService = { id: number; name: string };
type InitialProjectImage = { uri: string; fileName: string; mimeType: string; dataBase64: string };

function StepIndicator({ step }: { step: SetupStep }) {
  const current = step === "basics" ? 1 : step === "services" ? 2 : 3;
  const labels = ["بيانات المشروع", "الخدمات", "الاختيارات"];

  return (
    <View style={styles.steps}>
      {labels.map((label, index) => (
        <View key={label} style={styles.stepPair}>
          {index > 0 ? <View style={[styles.stepLine, current > index && styles.stepLineActive]} /> : null}
          <View style={styles.stepItem}>
            <View style={[styles.stepDot, current >= index + 1 && styles.stepDotActive]}>
              <Text style={[styles.stepNumber, current >= index + 1 && styles.stepNumberActive]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, current >= index + 1 && styles.stepLabelActive]}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function CreateProjectScreen() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [step, setStep] = useState<SetupStep>("basics");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [city, setCity] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [notes, setNotes] = useState("");
  const [initialImages, setInitialImages] = useState<InitialProjectImage[]>([]);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [guidedServices, setGuidedServices] = useState<GuidedService[]>([]);
  const servicesQuery = trpc.catalog.services.useQuery(undefined, { staleTime: 60 * 1000 });
  const createMutation = trpc.projects.create.useMutation();
  const uploadInitialImageMutation = trpc.attachments.upload.useMutation();
  const replaceMutation = trpc.projects.replaceServices.useMutation({
    onSuccess: (success) => {
      if (!success || !projectId) { Alert.alert("تعذر حفظ الخدمات", "حاول مرة أخرى."); return; }
      setGuidedServices((servicesQuery.data ?? []).filter((service) => selectedServices.includes(service.id)).map((service) => ({ id: service.id, name: service.name })));
      setStep("catalog");
    },
    onError: (error) => Alert.alert("تعذر حفظ الخدمات", error.message),
  });

  const pickInitialImages = async () => {
    const remaining = 5 - initialImages.length;
    if (remaining <= 0) { Alert.alert("الحد الأقصى للصور", "يمكنك إضافة خمس صور للمشروع في هذه الخطوة."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: remaining > 1, selectionLimit: remaining, quality: 0.65, base64: true });
    if (result.canceled) return;
    const images = result.assets.slice(0, remaining).flatMap((asset, index): InitialProjectImage[] => {
      if (!asset.base64 || Math.floor((asset.base64.length * 3) / 4) > 3 * 1024 * 1024) return [];
      return [{ uri: asset.uri, fileName: asset.fileName || `project-start-${Date.now()}-${index + 1}.jpg`, mimeType: asset.mimeType || "image/jpeg", dataBase64: asset.base64 }];
    });
    if (images.length !== result.assets.length) Alert.alert("بعض الصور لم تُضف", "اختر صوراً لا يزيد حجم كل منها على 3 ميغابايت.");
    setInitialImages((current) => [...current, ...images]);
  };
  const submitBasics = async () => {
    if (title.trim().length < 2) { Alert.alert("اسم المشروع مطلوب", "مثال: تشطيب شقة الندى"); return; }
    try {
      const id = await createMutation.mutateAsync({ title: title.trim(), propertyType: propertyType.trim() || undefined, city: city.trim() || undefined, areaSqm: areaSqm.trim() || undefined, notes: notes.trim() || undefined });
      setProjectId(id);
      if (initialImages.length > 0) {
        try {
          await Promise.all(initialImages.map((image) => uploadInitialImageMutation.mutateAsync({ projectId: id, fileName: image.fileName, mimeType: image.mimeType, dataBase64: image.dataBase64 })));
        } catch (error) {
          Alert.alert("تم إنشاء المشروع", error instanceof Error ? `تعذر رفع بعض الصور الآن. يمكنك إضافتها من تفاصيل المسودة لاحقاً.\n${error.message}` : "تعذر رفع بعض الصور الآن. يمكنك إضافتها من تفاصيل المسودة لاحقاً.");
        }
      }
      setStep("services");
    } catch (error) {
      Alert.alert("تعذر إنشاء المشروع", error instanceof Error ? error.message : "تحقق من رقم الجوال ثم حاول مرة أخرى.");
    }
  };
  const toggleService = (id: number) => setSelectedServices((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  if (loading) {
    return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;
  }
  if (!isAuthenticated) {
    return <GateScreen icon="lock-outline" title="نحتاج حسابك لحفظ مشروعك" description="أنشئ حساباً أو سجّل الدخول، ثم ستعود تلقائياً لإكمال إنشاء المشروع." actionLabel="إنشاء حساب أو تسجيل الدخول" onPress={async () => { await savePendingRoute("/create-project"); router.push("/auth" as never); }} />;
  }
  if (step === "catalog" && projectId) {
    return <GuidedCatalogSelection projectId={projectId} services={guidedServices} onBack={() => setStep("services")} onComplete={() => router.replace({ pathname: "/project/[projectId]", params: { projectId: String(projectId) } } as never)} />;
  }

  if (step === "services") {
    const services = servicesQuery.data ?? [];
    return (
      <ScreenContainer className="px-5">
        {servicesQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : (
          <FlatList
            data={services}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            directionalLockEnabled
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListHeaderComponent={<>
              <AppHeader title="مشروع جديد" subtitle="اختر الصفحات الرئيسية" onBack={() => setStep("basics")} />
              <StepIndicator step="services" />
              <View style={styles.introCard}>
                <Text style={styles.kicker}>الخطوة الثانية</Text>
                <Text style={styles.intro}>ما الخدمات التي يحتاجها مشروعك؟</Text>
                <Text style={styles.introText}>بعد اختيار الصفحات الرئيسية ستنتقل معك المنصة، خدمةً خدمة، عبر التقسيمات والمنتجات المناسبة.</Text>
              </View>
            </>}
            renderItem={({ item }) => {
              const selected = selectedServices.includes(item.id);
              return (
                <Pressable onPress={() => toggleService(item.id)} style={({ pressed }) => [styles.service, selected && styles.serviceSelected, pressed && styles.pressed]}>
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <MaterialIcons name="check" color="#0C0C0C" size={18} /> : null}</View>
                  <View style={styles.serviceCopy}>
                    <Text style={styles.serviceName}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.serviceText}>{item.description || "سننتقل معك إلى التقسيمات والمنتجات التابعة لها"}</Text>
                  </View>
                  <MaterialIcons name="architecture" color={selected ? Brand.pine : Brand.muted} size={22} />
                </Pressable>
              );
            }}
            ListEmptyComponent={<EmptyState icon="inventory-2" title="لا توجد خدمات متاحة" description="أضف الخدمات من الإدارة أولاً ثم عُد لإنشاء المشروع." />}
            ListFooterComponent={services.length > 0 ? (
              <View style={styles.footerAction}>
                <Text style={styles.selectionCount}>تم اختيار {selectedServices.length} {selectedServices.length === 1 ? "خدمة" : "خدمات"}</Text>
                <PrimaryButton label="بدء رحلة الاختيار" disabled={selectedServices.length === 0} loading={replaceMutation.isPending} onPress={() => projectId && replaceMutation.mutate({ projectId, serviceIds: selectedServices })} />
              </View>
            ) : null}
          />
        )}
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="px-5">
      <ScrollView showsVerticalScrollIndicator={false} directionalLockEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent}>
        <AppHeader title="مشروع جديد" subtitle="ابدأ بخطوة بسيطة" onBack={() => router.back()} />
        <StepIndicator step="basics" />
        <View style={styles.introCard}>
          <Text style={styles.kicker}>الخطوة الأولى</Text>
          <Text style={styles.intro}>عرّفنا على مشروعك باختصار</Text>
          <Text style={styles.introText}>سنستخدم هذه التفاصيل لتنظيم اختياراتك ومتابعة مراحل التنفيذ.</Text>
        </View>
        <View style={styles.formCard}>
          <Field label="اسم المشروع *" placeholder="مثال: شقة الندى" value={title} onChangeText={setTitle} />
          <Field label="نوع العقار" placeholder="شقة، فيلا، مكتب..." value={propertyType} onChangeText={setPropertyType} />
          <Field label="المدينة" placeholder="مثال: الرياض" value={city} onChangeText={setCity} />
          <Field label="المساحة التقريبية (م²)" placeholder="مثال: 160" value={areaSqm} onChangeText={setAreaSqm} keyboardType="decimal-pad" />
          <Field label="ملاحظاتك" placeholder="أي تفاصيل تساعد فريقنا على فهم احتياجك" value={notes} onChangeText={setNotes} multiline />
        </View>
        <View style={styles.initialImagesCard}>
          <Text style={styles.initialImagesTitle}>صور مبدئية للمشروع</Text>
          <Text style={styles.initialImagesText}>اختياري — أضف حتى 5 صور للمكان أو المراجع التي تريد مشاركتها مع فريقنا.</Text>
          {initialImages.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.initialImagesList}><View style={styles.initialImagesRow}>{initialImages.map((image, index) => <View key={`${image.uri}-${index}`} style={styles.initialImageWrap}><Image source={{ uri: image.uri }} style={styles.initialImage} /><Pressable accessibilityRole="button" accessibilityLabel={`حذف الصورة ${index + 1}`} onPress={() => setInitialImages((current) => current.filter((_, currentIndex) => currentIndex !== index))} style={({ pressed }) => [styles.removeInitialImage, pressed && styles.pressed]}><MaterialIcons name="close" color="#0C0C0C" size={15} /></Pressable></View>)}</View></ScrollView> : null}
          <Pressable accessibilityRole="button" onPress={() => void pickInitialImages()} style={({ pressed }) => [styles.addImagesButton, pressed && styles.pressed]}><MaterialIcons name="add-photo-alternate" color={Brand.pine} size={20} /><Text style={styles.addImagesButtonText}>{initialImages.length ? "إضافة صور أخرى" : "إضافة صور"}</Text><Text style={styles.imagesCount}>{initialImages.length}/5</Text></Pressable>
        </View>
        <PrimaryButton label="متابعة لاختيار الخدمات" loading={createMutation.isPending || uploadInitialImageMutation.isPending} onPress={() => void submitBasics()} style={styles.continue} />
        <SecondaryButton label="إلغاء" onPress={() => router.back()} style={styles.cancel} />
      </ScrollView>
    </ScreenContainer>
  );
}

function GateScreen({ icon, title, description, actionLabel, onPress }: { icon: "lock-outline" | "phone-iphone"; title: string; description: string; actionLabel: string; onPress: () => void | Promise<void> }) {
  const router = useRouter();
  return <ScreenContainer className="px-5"><FlatList data={[]} keyExtractor={() => "gate"} renderItem={() => null} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListHeaderComponent={<><AppHeader title="ابدأ مشروعك" onBack={() => router.back()} /><EmptyState icon={icon} title={title} description={description} action={<PrimaryButton label={actionLabel} onPress={() => void onPress()} />} /></>} /></ScreenContainer>;
}

function GuidedCatalogSelection({ projectId, services, onBack, onComplete }: { projectId: number; services: GuidedService[]; onBack: () => void; onComplete: () => void }) {
  const utils = trpc.useUtils();
  const [serviceIndex, setServiceIndex] = useState(0);
  const [currentNode, setCurrentNode] = useState<GuidedNode | null>(null);
  const [remainingNodes, setRemainingNodes] = useState<GuidedNode[]>([]);
  const [selectedRootIds, setSelectedRootIds] = useState<number[]>([]);
  const [selectedChildIds, setSelectedChildIds] = useState<number[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<number, string>>({});
  const service = services[serviceIndex];
  const projectQuery = trpc.projects.get.useQuery({ projectId });
  const rootsQuery = trpc.catalog.children.useQuery({ serviceId: service?.id ?? 1 }, { enabled: Boolean(service) && !currentNode && !isReviewing });
  const childrenQuery = trpc.catalog.children.useQuery({ serviceId: currentNode?.serviceId ?? 1, parentId: currentNode?.id ?? 1 }, { enabled: Boolean(currentNode) });
  const productsQuery = trpc.catalog.products.useQuery({ catalogNodeId: currentNode?.id ?? 1 }, { enabled: Boolean(currentNode) });
  const addSelectionMutation = trpc.projects.addSelection.useMutation({ onSuccess: () => void utils.projects.get.invalidate({ projectId }) });
  const removeSelectionMutation = trpc.projects.removeSelection.useMutation({ onSuccess: () => void utils.projects.get.invalidate({ projectId }) });
  const updateQuantityMutation = trpc.projects.updateSelectionQuantity.useMutation({ onSuccess: () => void utils.projects.get.invalidate({ projectId }) });
  const lockMutation = trpc.projects.lock.useMutation({ onSuccess: () => { void utils.projects.get.invalidate({ projectId }); onComplete(); }, onError: (error) => Alert.alert("تعذر إرسال المشروع", error.message) });
  const selections = projectQuery.data?.selections ?? [];
  const selectedByProductId = useMemo(() => new Map(selections.map((selection) => [selection.productId, selection])), [selections]);
  const selectedProductIds = useMemo(() => new Set(selectedByProductId.keys()), [selectedByProductId]);

  useEffect(() => {
    if (!service || currentNode || isReviewing || rootsQuery.isLoading || !rootsQuery.data || rootsQuery.data.length > 0) return;
    setServiceIndex((current) => current + 1);
  }, [currentNode, isReviewing, rootsQuery.data, rootsQuery.isLoading, service]);
  useEffect(() => { setSelectedRootIds([]); }, [service?.id]);
  useEffect(() => { setSelectedChildIds([]); }, [currentNode?.id]);
  useEffect(() => { if (serviceIndex >= services.length) setIsReviewing(true); }, [serviceIndex, services.length]);

  const toggleInList = (id: number, setSelected: (update: (current: number[]) => number[]) => void) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const advanceRoots = () => {
    if (!service) return;
    const chosen = (rootsQuery.data ?? []).filter((node) => selectedRootIds.includes(node.id)).map((node) => ({ id: node.id, name: node.name, serviceId: service.id, serviceName: service.name, ancestors: [] }));
    if (chosen.length === 0) { if (serviceIndex === services.length - 1) setIsReviewing(true); else setServiceIndex((current) => current + 1); return; }
    setCurrentNode(chosen[0]);
    setRemainingNodes(chosen.slice(1));
  };
  const advanceNode = () => {
    if (!currentNode) return;
    const chosen = (childrenQuery.data ?? []).filter((node) => selectedChildIds.includes(node.id)).map((node) => ({ id: node.id, name: node.name, serviceId: currentNode.serviceId, serviceName: currentNode.serviceName, ancestors: [...currentNode.ancestors, currentNode.name] }));
    const queue = [...chosen, ...remainingNodes];
    if (queue.length > 0) { setCurrentNode(queue[0]); setRemainingNodes(queue.slice(1)); return; }
    if (serviceIndex === services.length - 1) { setIsReviewing(true); return; }
    setCurrentNode(null);
    setRemainingNodes([]);
    setServiceIndex((current) => current + 1);
  };
  const toggleProduct = (productId: number, selected: boolean, available: boolean, mode: string) => {
    if (!available) return;
    if (mode === "view_only") { Alert.alert("للعرض فقط", "لا يمكن إضافة منتجات هذه التقسيمة إلى المشروع."); return; }
    if (selected) { removeSelectionMutation.mutate({ projectId, productId }); return; }
    addSelectionMutation.mutate({ projectId, productId, quantity: 1 }, { onError: (error) => Alert.alert("تعذر حفظ الاختيار", error.message) });
  };
  const setQuantityDraft = (selectionId: number, value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 4);
    setQuantityDrafts((current) => ({ ...current, [selectionId]: sanitized }));
  };
  const clearQuantityDraft = (selectionId: number) => setQuantityDrafts((current) => {
    const { [selectionId]: _discarded, ...remaining } = current;
    return remaining;
  });
  const saveQuantity = (selection: { id: number; quantity: number }) => {
    const enteredValue = quantityDrafts[selection.id];
    if (enteredValue === undefined) return;
    const quantity = Number(enteredValue);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) {
      Alert.alert("كمية غير صالحة", "اكتب عدداً صحيحاً من 1 إلى 9999.");
      clearQuantityDraft(selection.id);
      return;
    }
    if (quantity === selection.quantity) { clearQuantityDraft(selection.id); return; }
    updateQuantityMutation.mutate({ projectId, selectionId: selection.id, quantity }, {
      onSuccess: () => clearQuantityDraft(selection.id),
      onError: (error) => Alert.alert("تعذر حفظ الكمية", error.message),
    });
  };

  if (isReviewing) {
    return (
      <ScreenContainer className="px-5">
        <FlatList
          data={selections}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={<>
            <AppHeader title="راجع اختياراتك" subtitle="الخطوة الأخيرة قبل إرسال المشروع" onBack={() => { setIsReviewing(false); setServiceIndex(0); setCurrentNode(null); setRemainingNodes([]); }} />
            <StepIndicator step="catalog" />
            <View style={styles.guidedCard}>
              <Text style={styles.kicker}>الملخص النهائي</Text>
              <Text style={styles.guidedTitle}>هذه كل اختياراتك</Text>
              <Text style={styles.guidedText}>راجع الصنف والكمية ومساره الهرمي. يمكنك العودة للرحلة لإضافة اختيارات أخرى أو حذف أي منتج من تفاصيل المسودة لاحقاً.</Text>
            </View>
          </>}
          renderItem={({ item }) => (
            <View style={styles.reviewChoice}>
              <MaterialIcons name="check-circle" color={Brand.pine} size={21} />
              <View style={styles.productChoiceCopy}>
                <Text style={styles.productChoiceName}>{item.productName} <Text style={styles.quantityInline}>× {item.quantity}</Text></Text>
                <Text style={styles.breadcrumb}>{item.breadcrumb.join(" ← ")}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={projectQuery.isLoading ? <View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View> : <EmptyState icon="inventory-2" title="لم تختر منتجات بعد" description="يمكنك إرسال المشروع دون منتجات أو العودة للرحلة لاختيار ما يناسبك." />}
          ListFooterComponent={<View style={styles.footerAction}>
            <Text style={styles.selectionCount}>إجمالي المنتجات المختارة: {selections.length}</Text>
            <PrimaryButton label="إرسال المشروع واعتماد الاختيارات" loading={lockMutation.isPending} onPress={() => lockMutation.mutate({ projectId })} />
            <SecondaryButton label="العودة إلى رحلة الاختيار" onPress={() => { setIsReviewing(false); setServiceIndex(0); setCurrentNode(null); setRemainingNodes([]); }} style={styles.cancel} />
          </View>}
        />
      </ScreenContainer>
    );
  }

  if (!service || rootsQuery.isLoading) return <ScreenContainer className="px-5"><View style={styles.loader}><ActivityIndicator color={Brand.pine} /></View></ScreenContainer>;

  if (!currentNode) {
    const roots = rootsQuery.data ?? [];
    return (
      <ScreenContainer className="px-5">
        <FlatList
          data={roots}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListHeaderComponent={<>
            <AppHeader title="اختر التقسيمات" subtitle={`${serviceIndex + 1} من ${services.length}: ${service.name}`} onBack={onBack} />
            <StepIndicator step="catalog" />
            <View style={styles.guidedCard}>
              <Text style={styles.kicker}>بداية الخدمة</Text>
              <Text style={styles.guidedTitle}>{service.name}</Text>
              <Text style={styles.guidedText}>اختر تقسيمة واحدة أو أكثر لنتابع داخل كل فرع بالترتيب، أو تخطَّ الخدمة إن لم ترغب في أي منها.</Text>
              <SelectionBadge count={selectedProductIds.size} />
            </View>
          </>}
          renderItem={({ item }) => {
            const selected = selectedRootIds.includes(item.id);
            return <Pressable onPress={() => toggleInList(item.id, setSelectedRootIds)} style={({ pressed }) => [styles.branchChoice, selected && styles.productChoiceSelected, pressed && styles.pressed]}><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <MaterialIcons name="check" color="#0C0C0C" size={18} /> : null}</View><View style={styles.productChoiceCopy}><Text style={styles.productChoiceName}>{item.name}</Text><Text style={styles.productChoiceText}>افتح هذا الفرع لعرض كل التقسيمات والمنتجات التي بداخله.</Text></View><MaterialIcons name="account-tree" color={selected ? Brand.pine : Brand.muted} size={22} /></Pressable>;
          }}
          ListEmptyComponent={<EmptyState icon="account-tree" title="لا توجد تقسيمات في هذه الخدمة" description="سننتقل تلقائياً إلى الخدمة التالية." />}
          ListFooterComponent={<View style={styles.footerAction}><Text style={styles.selectionCount}>تم اختيار {selectedRootIds.length} تقسيمة · المنتجات المختارة: {selectedProductIds.size}</Text><PrimaryButton label={serviceIndex === services.length - 1 && selectedRootIds.length === 0 ? "الانتقال إلى المراجعة" : "التالي"} onPress={advanceRoots} /><SecondaryButton label="العودة إلى الخدمات" onPress={onBack} style={styles.cancel} /></View>}
        />
      </ScreenContainer>
    );
  }

  const products = productsQuery.data ?? [];
  const childNodes = childrenQuery.data ?? [];
  const path = [currentNode.serviceName, ...currentNode.ancestors, currentNode.name].join(" ← ");
  const journeyItems = [...childNodes.map((node) => ({ kind: "node" as const, value: node })), ...products.map((product) => ({ kind: "product" as const, value: product }))];

  return (
    <ScreenContainer className="px-5">
      <FlatList
        data={journeyItems}
        keyExtractor={(item) => `${item.kind}-${item.value.id}`}
        showsVerticalScrollIndicator={false}
        directionalLockEnabled
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={<>
          <AppHeader title="اختر ما يناسبك" subtitle={`${serviceIndex + 1} من ${services.length}: ${currentNode.serviceName}`} onBack={onBack} />
          <StepIndicator step="catalog" />
          <View style={styles.guidedCard}>
            <Text style={styles.kicker}>التقسيمة الحالية</Text>
            <Text style={styles.guidedTitle}>{currentNode.name}</Text>
            <Text style={styles.breadcrumb}>{path}</Text>
            <Text style={styles.guidedText}>اختر أي تقسيمات فرعية تريدها، واختر المنتجات المناسبة إن وجدت. يمكنك اختيار واحد أو أكثر أو التخطي ثم الضغط على التالي.</Text>
            <SelectionBadge count={selectedProductIds.size} />
          </View>
          {products.length > 0 ? <View style={styles.modeHint}><MaterialIcons name="rule" color={Brand.pine} size={17} /><Text style={styles.modeHintText}>{products[0]?.selectionMode === "single" ? "اختر منتجاً واحداً فقط من منتجات هذه التقسيمة." : products[0]?.selectionMode === "view_only" ? "منتجات هذه التقسيمة للعرض فقط." : "يمكنك اختيار منتج واحد أو أكثر أو تخطي المنتجات."}</Text></View> : null}
          {childNodes.length > 0 ? <Text style={styles.sectionTitle}>التقسيمات الفرعية</Text> : null}
        </>}
        renderItem={({ item, index }) => {
          if (item.kind === "node") {
            const selected = selectedChildIds.includes(item.value.id);
            return <Pressable onPress={() => toggleInList(item.value.id, setSelectedChildIds)} style={({ pressed }) => [styles.branchChoice, selected && styles.productChoiceSelected, pressed && styles.pressed]}><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <MaterialIcons name="check" color="#0C0C0C" size={18} /> : null}</View><View style={styles.productChoiceCopy}><Text style={styles.productChoiceName}>{item.value.name}</Text><Text style={styles.productChoiceText}>اختره للانتقال إلى ما بداخله في الخطوة التالية.</Text></View><MaterialIcons name="account-tree" color={selected ? Brand.pine : Brand.muted} size={22} /></Pressable>;
          }
          const product = item.value;
          const selection = selectedByProductId.get(product.id);
          const selected = Boolean(selection);
          const blocked = !product.isAvailable;
          const isFirstProduct = index === childNodes.length;
          return <>
            {isFirstProduct ? <Text style={styles.sectionTitle}>المنتجات في هذه التقسيمة</Text> : null}
            <View style={[styles.productChoice, selected && styles.productChoiceSelected, blocked && styles.productChoiceDisabled]}>
              <Pressable disabled={blocked} onPress={() => toggleProduct(product.id, selected, product.isAvailable, product.selectionMode)} style={({ pressed }) => [styles.productSelectable, pressed && styles.pressed]}>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <MaterialIcons name="check" color="#0C0C0C" size={18} /> : null}</View>
                <View style={styles.productChoiceCopy}><Text style={styles.productChoiceName}>{product.name}</Text>{product.productCode ? <Text style={styles.productChoiceCode}>{product.productCode}</Text> : null}<Text numberOfLines={2} style={styles.productChoiceText}>{product.description || "تفاصيل المنتج من كتالوج MADD"}</Text></View>
                <MaterialIcons name={!product.isAvailable ? "block" : product.selectionMode === "view_only" ? "visibility" : "add-circle-outline"} color={selected ? Brand.pine : Brand.muted} size={22} />
              </Pressable>
              {selection ? <View style={styles.quantityControl}><Text style={styles.quantityLabel}>الكمية</Text><TextInput value={quantityDrafts[selection.id] ?? String(selection.quantity)} onChangeText={(value) => setQuantityDraft(selection.id, value)} onBlur={() => saveQuantity(selection)} onSubmitEditing={() => saveQuantity(selection)} keyboardType="number-pad" returnKeyType="done" maxLength={4} selectTextOnFocus style={styles.quantityInput} textAlign="center" /></View> : null}
            </View>
          </>;
        }}
        ListEmptyComponent={<View style={styles.emptyProducts}><MaterialIcons name="inventory-2" size={25} color={Brand.muted} /><Text style={styles.emptyProductsText}>لا توجد تقسيمات فرعية أو منتجات مباشرة هنا.</Text></View>}
        ListFooterComponent={<View style={styles.footerAction}><Text style={styles.selectionCount}>إجمالي المنتجات المختارة: {selectedProductIds.size}</Text><PrimaryButton label={serviceIndex === services.length - 1 && remainingNodes.length === 0 && selectedChildIds.length === 0 ? "الانتقال إلى المراجعة" : "التالي"} loading={childrenQuery.isLoading || productsQuery.isLoading || addSelectionMutation.isPending || removeSelectionMutation.isPending || updateQuantityMutation.isPending} onPress={advanceNode} /><SecondaryButton label="العودة إلى الخدمات" onPress={onBack} style={styles.cancel} /></View>}
      />
    </ScreenContainer>
  );
}

function SelectionBadge({ count }: { count: number }) {
  return <View style={styles.selectionBadge}><MaterialIcons name="shopping-bag" color={Brand.pine} size={17} /><Text style={styles.selectionBadgeText}>المنتجات المختارة الآن: {count}</Text></View>;
}

function Field({ label, placeholder, value, onChangeText, keyboardType, multiline = false }: { label: string; placeholder: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "decimal-pad"; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={[styles.inputWrap, multiline && styles.inputWrapMulti]}><TextInput placeholder={placeholder} placeholderTextColor="#827762" value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={[styles.input, multiline && styles.multiline]} textAlign="right" textAlignVertical={multiline ? "top" : "center"} multiline={multiline} returnKeyType="done" /></View></View>;
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  formContent: { paddingBottom: 30 },
  list: { paddingBottom: 28 },
  steps: { minHeight: 48, flexDirection: "row-reverse", alignItems: "flex-start", justifyContent: "center", marginBottom: 16 },
  stepPair: { flexDirection: "row-reverse", alignItems: "flex-start" },
  stepItem: { alignItems: "center", minWidth: 77 },
  stepDot: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: "#756541", backgroundColor: Brand.card, alignItems: "center", justifyContent: "center" },
  stepDotActive: { borderColor: Brand.pine, backgroundColor: Brand.pine },
  stepNumber: { color: Brand.muted, fontSize: 11, fontWeight: "900" },
  stepNumberActive: { color: "#0C0C0C" },
  stepLabel: { color: Brand.muted, fontSize: 9, marginTop: 4, writingDirection: "rtl", textAlign: "center" },
  stepLabelActive: { color: Brand.ink, fontWeight: "800" },
  stepLine: { width: 27, height: 1, backgroundColor: Brand.line, marginTop: 12, marginHorizontal: 1 },
  stepLineActive: { backgroundColor: Brand.pine },
  introCard: { alignItems: "flex-end", paddingBottom: 19, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Brand.line, marginBottom: 19 },
  kicker: { color: Brand.pine, fontSize: 11, fontWeight: "900", writingDirection: "rtl" },
  intro: { color: Brand.ink, fontSize: 23, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginTop: 5 },
  introText: { color: Brand.muted, fontSize: 12, lineHeight: 19, writingDirection: "rtl", textAlign: "right", marginTop: 7 },
  formCard: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 21, padding: 16 },
  initialImagesCard: { marginTop: 14, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 21, padding: 16, alignItems: "stretch" },
  initialImagesTitle: { color: Brand.ink, fontSize: 14, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  initialImagesText: { color: Brand.muted, fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  initialImagesList: { paddingTop: 12, paddingBottom: 2 },
  initialImagesRow: { flexDirection: "row-reverse", gap: 9 },
  initialImageWrap: { width: 72, height: 72, borderRadius: 12, overflow: "visible" },
  initialImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: "#11110F" },
  removeInitialImage: { position: "absolute", top: -7, left: -7, width: 23, height: 23, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: Brand.pine, borderWidth: 2, borderColor: Brand.card },
  addImagesButton: { minHeight: 45, marginTop: 13, flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#806B35", borderRadius: 13, backgroundColor: "#17150D" },
  addImagesButtonText: { color: Brand.ink, fontSize: 12, fontWeight: "900", writingDirection: "rtl" },
  imagesCount: { marginLeft: "auto", color: Brand.pine, fontSize: 12, fontWeight: "900", writingDirection: "ltr" },
  field: { marginBottom: 15 },
  label: { color: Brand.ink, fontSize: 12, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 7 },
  inputWrap: { minHeight: 51, backgroundColor: "#11110F", borderWidth: 1, borderColor: "#4C4025", borderRadius: 13, justifyContent: "center" },
  inputWrapMulti: { minHeight: 94, justifyContent: "flex-start" },
  input: { color: Brand.ink, fontSize: 14, paddingHorizontal: 13, writingDirection: "rtl" },
  multiline: { minHeight: 92, paddingTop: 12 },
  continue: { marginTop: 18 },
  cancel: { marginTop: 10 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  service: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.card, padding: 15, marginBottom: 10 },
  serviceSelected: { borderColor: Brand.pine, backgroundColor: "#211C10" },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: "#847546", alignItems: "center", justifyContent: "center" },
  checkboxSelected: { borderColor: Brand.pine, backgroundColor: Brand.pine },
  serviceCopy: { flex: 1, alignItems: "flex-end" },
  serviceName: { color: Brand.ink, fontSize: 16, fontWeight: "900", writingDirection: "rtl", textAlign: "right" },
  serviceText: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 4 },
  footerAction: { marginTop: 8 },
  selectionCount: { color: Brand.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginBottom: 9 },
  guidedCard: { backgroundColor: Brand.card, borderWidth: 1, borderColor: "#665529", borderRadius: 20, padding: 16, alignItems: "stretch", marginBottom: 11 },
  guidedTitle: { color: Brand.ink, fontSize: 22, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginTop: 4 },
  breadcrumb: { color: Brand.pine, fontSize: 11, lineHeight: 18, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  guidedText: { color: Brand.muted, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  selectionBadge: { alignSelf: "stretch", flexDirection: "row-reverse", alignItems: "center", justifyContent: "flex-start", gap: 7, marginTop: 13, paddingHorizontal: 11, paddingVertical: 9, backgroundColor: "#17150D", borderWidth: 1, borderColor: "#5E502D", borderRadius: 12 },
  selectionBadgeText: { color: Brand.ink, fontSize: 12, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  modeHint: { flexDirection: "row-reverse", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12, backgroundColor: "#211B10", borderRadius: 14, borderWidth: 1, borderColor: "#4C4025" },
  modeHintText: { color: Brand.muted, flex: 1, fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl" },
  sectionTitle: { alignSelf: "stretch", color: Brand.pine, fontSize: 12, fontWeight: "900", writingDirection: "rtl", textAlign: "right", marginTop: 5, marginBottom: 8 },
  branchChoice: { flexDirection: "row-reverse", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: "#5B4D2D", backgroundColor: "#161510", padding: 14, marginBottom: 9 },
  productChoice: { flexDirection: "row-reverse", alignItems: "stretch", borderRadius: 18, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.card, marginBottom: 9, overflow: "hidden" },
  productSelectable: { flex: 1, flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14 },
  productChoiceSelected: { borderColor: Brand.pine, backgroundColor: "#211C10" },
  productChoiceDisabled: { opacity: 0.63 },
  productChoiceCopy: { flex: 1, alignItems: "flex-end" },
  productChoiceName: { alignSelf: "stretch", color: Brand.ink, fontSize: 15, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  productChoiceCode: { color: Brand.pine, fontSize: 10, fontWeight: "800", marginTop: 3, alignSelf: "stretch", textAlign: "right" },
  productChoiceText: { alignSelf: "stretch", color: Brand.muted, fontSize: 11, lineHeight: 17, textAlign: "right", writingDirection: "rtl", marginTop: 5 },
  quantityControl: { width: 76, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "#665529", alignItems: "center", justifyContent: "center", paddingHorizontal: 7, paddingVertical: 9, backgroundColor: "#15130B" },
  quantityLabel: { color: Brand.pine, fontSize: 10, fontWeight: "900", writingDirection: "rtl", marginBottom: 5 },
  quantityInput: { width: "100%", minHeight: 35, borderWidth: 1, borderColor: "#806B35", borderRadius: 9, color: Brand.ink, fontSize: 15, fontWeight: "900", paddingHorizontal: 4, backgroundColor: "#0D0D0B" },
  quantityInline: { color: Brand.pine, fontSize: 14, fontWeight: "900", writingDirection: "ltr" },
  reviewChoice: { flexDirection: "row-reverse", alignItems: "flex-start", gap: 10, padding: 14, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.line, borderRadius: 17, marginBottom: 9 },
  emptyProducts: { padding: 22, alignItems: "center", gap: 8 },
  emptyProductsText: { color: Brand.muted, fontSize: 12, writingDirection: "rtl", textAlign: "center" },
});
