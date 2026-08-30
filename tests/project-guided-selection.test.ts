import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync("server/db.ts", "utf8");
const routerSource = readFileSync("server/routers.ts", "utf8");
const accountSource = readFileSync("app/(tabs)/account.tsx", "utf8");
const createProjectSource = readFileSync("app/create-project.tsx", "utf8");
const catalogSource = readFileSync("app/catalog/[nodeId].tsx", "utf8");
const productSource = readFileSync("app/product/[productId].tsx", "utf8");
const projectSource = readFileSync("app/project/[projectId].tsx", "utf8");
const rootLayoutSource = readFileSync("app/_layout.tsx", "utf8");
const phoneSetupDialogSource = readFileSync("components/phone-setup-dialog.tsx", "utf8");

describe("إنشاء مشروع MADD والاختيار الموجّه", () => {
  it("يرفض إنشاء المشروع عندما لا يكون للمستخدم رقم هاتف محفوظ", () => {
    expect(routerSource).toContain("TRPCError");
    expect(routerSource).toContain("PRECONDITION_FAILED");
    expect(routerSource).toContain("يرجى إضافة رقم هاتفك في الملف الشخصي أولاً.");
    expect(routerSource).toContain("getCustomerProfile(ctx.user.id)");
  });

  it("يوضح شرط رقم الهاتف في الحساب ويطلبه في نافذة داخل السياق بدلاً من تحويل العميل إلى الحساب", () => {
    expect(accountSource).toContain("رقم الجوال مطلوب لإنشاء مشروع جديد");
    expect(phoneSetupDialogSource).toContain("<Modal");
    expect(phoneSetupDialogSource).toContain("أضف رقم جوالك للمتابعة");
    expect(phoneSetupDialogSource).toContain("لن تفقد أي مشروع أو اختيار بدأت به");
    expect(phoneSetupDialogSource).toContain("profile.save.useMutation");
    expect(rootLayoutSource).toContain("<PhoneSetupDialog />");
    expect(createProjectSource).not.toContain('router.push("/account"');
  });

  it("يخفف إعادة جلب بيانات الرحلة عند التنقل بين خطوات المشروع", () => {
    expect(rootLayoutSource).toContain("staleTime: 30 * 1000");
    expect(rootLayoutSource).toContain("refetchOnWindowFocus: false");
    expect(rootLayoutSource).toContain("refetchOnMount: false");
    expect(createProjectSource).toContain("catalog.services.useQuery(undefined, { staleTime: 60 * 1000 })");
  });

  it("يبني رحلة متسلسلة من الخدمات إلى التقسيمات والمنتجات ويحترم أنماط الاختيار", () => {
    expect(createProjectSource).toContain("اختر الصفحات الرئيسية");
    expect(createProjectSource).toContain('"التالي"');
    expect(createProjectSource).toContain("catalog.children.useQuery");
    expect(createProjectSource).toContain("catalog.products.useQuery");
    expect(createProjectSource).toContain("view_only");
    expect(createProjectSource).toContain("single");
    expect(createProjectSource).toContain("addSelectionMutation");
  });

  it("يمر بالفروع المختارة واحداً تلو الآخر ويعرض مراجعة كاملة قبل إرسال المشروع", () => {
    expect(createProjectSource).toContain("selectedRootIds");
    expect(createProjectSource).toContain("selectedChildIds");
    expect(createProjectSource).toContain("remainingNodes");
    expect(createProjectSource).toContain("const queue = [...chosen, ...remainingNodes]");
    expect(createProjectSource).toContain("اختر التقسيمات");
    expect(createProjectSource).toContain("التقسيمات الفرعية");
    expect(createProjectSource).toContain("راجع اختياراتك");
    expect(createProjectSource).toContain("إرسال المشروع واعتماد الاختيارات");
  });

  it("يعرض عدد المنتجات المختارة ويثبت محاذاة RTL داخل بطاقات الرحلة", () => {
    expect(createProjectSource).toContain("function SelectionBadge");
    expect(createProjectSource).toContain("المنتجات المختارة الآن:");
    expect(createProjectSource).toContain("إجمالي المنتجات المختارة:");
    expect(createProjectSource).toContain('flexDirection: "row-reverse"');
    expect(createProjectSource).toContain('writingDirection: "rtl"');
    expect(createProjectSource).toContain('textAlign: "right"');
  });

  it("يحفظ كمية افتراضية للمنتج ويتيح تعديلها في مشروع مسودة يملكه العميل فقط", () => {
    expect(routerSource).toContain("quantity: z.number().int().min(1).max(9999).default(1)");
    expect(routerSource).toContain("updateSelectionQuantity:");
    expect(dbSource).toContain("quantity,");
    expect(dbSource).toContain("updateSelectionQuantityForUser");
    expect(dbSource).toContain('project.status !== "draft"');
    expect(createProjectSource).toContain("quantityControl");
    expect(createProjectSource).toContain("updateQuantityMutation");
  });

  it("يعرض اسم الصنف وكميته ثم المسار الهرمي RTL في المراجعة النهائية", () => {
    expect(createProjectSource).toContain("راجع الصنف والكمية ومساره الهرمي");
    expect(createProjectSource).toContain("quantityInline");
    expect(createProjectSource).toContain("× {item.quantity}");
    expect(createProjectSource).toContain('item.breadcrumb.join(" ← ")');
    expect(createProjectSource).toContain('writingDirection: "rtl"');
  });

  it("يُعيد المسار الهرمي مع بيانات المنتج ويعرضه في الكتالوج والتفاصيل", () => {
    expect(routerSource).toContain("productBreadcrumb:");
    expect(dbSource).toContain("breadcrumb: await getProductBreadcrumb(product.id)");
    expect(catalogSource).toContain("item.breadcrumb");
    expect(catalogSource).toContain('join(" ← ")');
    expect(productSource).toContain("product.breadcrumb.length");
    expect(productSource).toContain("account-tree");
  });

  it("يسمح بتعديل وحذف المسودة فقط، مع تنظيف البيانات التابعة وحماية المشروع المرسل", () => {
    expect(dbSource).toContain("deleteDraftProjectForUser");
    expect(dbSource).toContain('eq(projects.status, "draft")');
    expect(dbSource).toContain("transaction.delete(projectSelections)");
    expect(dbSource).toContain("transaction.delete(projectAttachments)");
    expect(routerSource).toContain("deleteDraft:");
    expect(routerSource).toContain("customer_project_draft_deleted");
    expect(projectSource).toContain("removeSelectionMutation");
    expect(projectSource).toContain("تعديل منتجات");
    expect(projectSource).toContain("حذف المشروع بالكامل");
    expect(projectSource).toContain("DeleteConfirmationDialog");
  });

  it("يرفع صور المشروع الاختيارية في أول خطوة بعد إنشاء المسودة ويتيح حذف معايناتها", () => {
    expect(createProjectSource).toContain("صور مبدئية للمشروع");
    expect(createProjectSource).toContain("launchImageLibraryAsync");
    expect(createProjectSource).toContain("allowsMultipleSelection");
    expect(createProjectSource).toContain("uploadInitialImageMutation");
    expect(createProjectSource).toContain("attachments.upload.useMutation");
    expect(createProjectSource).toContain("حذف الصورة");
  });
});
