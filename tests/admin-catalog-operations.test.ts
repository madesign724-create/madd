import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync("server/db.ts", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const catalogUiSource = readFileSync("components/admin-operations.tsx", "utf8");
const hierarchyUiSource = readFileSync("components/admin-catalog-hierarchy.tsx", "utf8");
const catalogScreenSource = readFileSync("app/catalog/[nodeId].tsx", "utf8");
const productScreenSource = readFileSync("app/product/[productId].tsx", "utf8");

describe("إدارة كتالوج MADD", () => {
  it("توفّر تعديل وحذف المنتجات والتقسيمات عبر واجهات إدارية محمية", () => {
    expect(routerSource).toContain("deleteCatalogNode:");
    expect(routerSource).toContain("deleteProduct:");
    expect(routerSource).toContain('assertAdmin(ctx.user.id, "catalog")');
    expect(routerSource).toContain("updateCatalogNode:");
    expect(routerSource).toContain("updateProduct:");
  });

  it("يحذف المحتوى المتفرع غير المرتبط ويحافظ على سجل اختيارات المشروع", () => {
    expect(dbSource).toContain("deleteCatalogNodeForAdmin");
    expect(dbSource).toContain("deleteProductForAdmin");
    expect(dbSource).toContain("const branchNodeIds = [...nodeIds]");
    expect(dbSource).toContain("تحتوي هذه التقسيمة على منتج اختاره عميل");
    expect(dbSource).toContain("projectSelections.productId");
    expect(dbSource).toContain("await transaction.delete(productImages)");
  });

  it("يحفظ ترتيب العناصر داخل نطاقها فقط ويوفر إخفاء المنتج من الكتالوج", () => {
    expect(routerSource).toContain("reorderCatalogNodes:");
    expect(routerSource).toContain("reorderProducts:");
    expect(routerSource).toContain("setProductVisibility:");
    expect(dbSource).toContain("reorderCatalogNodesForAdmin");
    expect(dbSource).toContain("reorderProductsForAdmin");
    expect(dbSource).toContain("يمكن إعادة ترتيب التقسيمات الشقيقة فقط");
    expect(dbSource).toContain("يمكن إعادة ترتيب منتجات التقسيمة نفسها فقط");
    expect(dbSource).toContain("where(eq(projectSelections.projectId, projectId))");
  });

  it("يوفر حفظ ترتيب الخدمات الرئيسية ضمن صلاحية إدارة الكتالوج", () => {
    expect(routerSource).toContain("reorderServices:");
    expect(dbSource).toContain("reorderServicesForAdmin");
    expect(dbSource).toContain("قائمة ترتيب الخدمات يجب أن تحتوي جميع الخدمات مرة واحدة");
  });

  it("يعيد الخدمات إلى ترتيبها الافتراضي عبر إجراء محمي وتأكيد واضح", () => {
    expect(routerSource).toContain("resetServicesOrder:");
    expect(routerSource).toContain("resetServicesOrderForAdmin");
    expect(dbSource).toContain("resetServicesOrderForAdmin");
    expect(dbSource).toContain("orderBy(asc(services.defaultSortOrder), asc(services.id))");
    expect(catalogUiSource).toContain("إعادة الضبط إلى الترتيب الافتراضي");
    expect(catalogUiSource).toContain("استعادة الترتيب الافتراضي");
  });

  it("يحفظ ترتيباً مرجعياً مخصصاً للخدمات ويعرض اعتمادَه داخل لوحة الكتالوج", () => {
    expect(routerSource).toContain("saveServicesDefaultOrder:");
    expect(dbSource).toContain("saveServicesDefaultOrderForAdmin");
    expect(dbSource).toContain("defaultSortOrder");
    expect(catalogUiSource).toContain("اعتماد الترتيب الحالي كافتراضي");
    expect(catalogUiSource).toContain("saveCurrentServicesAsDefault");
    expect(catalogUiSource).toContain("serviceIds: items.map");
    expect(catalogUiSource).toContain("التسلسل المرجعي الذي اعتمدته الإدارة");
  });

  it("يتيح أنماط الاختيار الثلاثة ويحمي اختيار العميل على مستوى الخادم", () => {
    expect(routerSource).toContain('z.enum(["multi", "single", "view_only"])');
    expect(dbSource).toContain('export type CatalogSelectionMode = "multi" | "single" | "view_only"');
    expect(dbSource).toContain('product.selectionMode === "view_only"');
    expect(dbSource).toContain('product.selectionMode === "single"');
    expect(dbSource).toContain('eq(projectSelections.catalogNodeId, product.catalogNodeId)');
    expect(catalogUiSource).toContain("اختيار متعدد");
    expect(catalogUiSource).toContain("اختيار واحد فقط");
    expect(catalogUiSource).toContain("عرض فقط بدون اختيار");
  });

  it("يوضح للعميل حالة العرض فقط والاستبدال التلقائي قبل الحفظ", () => {
    expect(catalogScreenSource).toContain("هذه التقسيمة للعرض فقط");
    expect(catalogScreenSource).toContain("اختر منتجاً واحداً فقط");
    expect(productScreenSource).toContain("هذا المنتج للعرض فقط ولا يمكن إضافته إلى المشروع");
    expect(productScreenSource).toContain("اختيار هذا المنتج بدلاً من السابق");
    expect(productScreenSource).toContain("استُبدل أي اختيار سابق");
  });

  it("يحفظ التقسيمة مباشرة من زر الإضافة باستخدام نمط الاختيار المحدد", () => {
    expect(catalogUiSource).toContain("selectionMode: nodeSelectionMode");
    expect(catalogUiSource).toContain("createNode.mutate({ serviceId: selectedService");
    expect(catalogUiSource).not.toContain('Alert.alert("نمط اختيار العملاء", "اختر الطريقة التي سيتعامل بها العميل مع منتجات هذه التقسيمة."');
  });

  it("يثبت خلفية بطاقة الكتالوج كي يبقى اسم التصنيف مرئياً على الهاتف", () => {
    expect(catalogScreenSource).toContain('imageFallback: { ...StyleSheet.absoluteFillObject');
    expect(catalogScreenSource).toContain('numberOfLines={2} style={styles.title}');
    expect(catalogScreenSource).toContain('copy: { flex: 1, justifyContent: "flex-end", padding: 13 }');
  });

  it("يوفر حافظة هرمية تنسخ أو تنقل الشجرة الكاملة مع حماية المصدر والهدف", () => {
    expect(routerSource).toContain("pasteCatalogClipboard:");
    expect(dbSource).toContain("pasteCatalogClipboardForAdmin");
    expect(dbSource).toContain("لا يمكن لصق التقسيمة داخل نفسها");
    expect(dbSource).toContain("لا يمكن لصق التقسيمة داخل أحد فروعها");
    expect(dbSource).toContain("const copiedNodeIds = new Map<number, number>()");
    expect(dbSource).toContain("const copiedProductIds = new Map<number, number>()");
    expect(dbSource).toContain("transaction.insert(productImages)");
    expect(hierarchyUiSource).toContain("شجرة الكتالوج والحافظة");
    expect(hierarchyUiSource).toContain("content-copy");
    expect(hierarchyUiSource).toContain("content-cut");
    expect(hierarchyUiSource).toContain("لصق هنا");
    expect(hierarchyUiSource).toContain("تأكيد النقل");
  });

  it("يتيح طي وفتح الفروع المتعددة مع أدوات عامة لإدارة الشجرة الطويلة", () => {
    expect(hierarchyUiSource).toContain("collapsedBranches");
    expect(hierarchyUiSource).toContain("toggleBranch");
    expect(hierarchyUiSource).toContain("فتح الكل");
    expect(hierarchyUiSource).toContain("طي الكل");
    expect(hierarchyUiSource).toContain("فتح فرع");
    expect(hierarchyUiSource).toContain("طي فرع");
  });

  it("يجعل نافذة هيكل الكتالوج قابلة للتمرير على الهاتف", () => {
    expect(hierarchyUiSource).toContain("style={styles.treeList}");
    expect(hierarchyUiSource).toContain("nestedScrollEnabled");
    expect(hierarchyUiSource).toContain("scrollEventThrottle={16}");
    expect(hierarchyUiSource).toContain("data={services}");
    expect(hierarchyUiSource).toContain("renderItem={renderServiceBranch}");
    expect(hierarchyUiSource).toContain("treeList: { flex: 1 }");
    expect(hierarchyUiSource).not.toContain('data={[{ id: "catalog-hierarchy" }]}');
  });

  it("يضع حذفاً مؤكداً بجوار النسخ والقص لعناصر هيكل الكتالوج", () => {
    expect(hierarchyUiSource).toContain("deleteCatalogNode.useMutation");
    expect(hierarchyUiSource).toContain("deleteService.useMutation");
    expect(hierarchyUiSource).toContain("DeleteConfirmationDialog");
    expect(hierarchyUiSource).toContain("حذف التقسيمة");
    expect(hierarchyUiSource).toContain("حذف الصفحة الرئيسية");
    expect(hierarchyUiSource).toContain("delete-outline");
  });
});
