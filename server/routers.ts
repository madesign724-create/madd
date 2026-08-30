import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sendProjectUpdatePush } from "./push";
import { storagePut } from "./storage";

const projectInput = z.object({
  title: z.string().trim().min(2, "اسم المشروع مطلوب").max(180),
  propertyType: z.string().trim().max(80).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(2000).optional(),
  areaSqm: z.string().regex(/^\d+(\.\d{1,2})?$/, "المساحة يجب أن تكون رقماً صحيحاً").optional(),
  notes: z.string().trim().max(5000).optional(),
});

const serviceInput = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "استخدم حروفاً إنجليزية صغيرة وشرطات فقط").optional(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

async function assertAdmin(userId: number, area?: db.OperationsArea) {
  const access = await db.getOperationsAccess(userId);
  if (!access.isAdmin || (area && !access.permissions.includes(area))) throw new Error("لا تملك صلاحية لهذا القسم الإداري");
  return access;
}

async function assertOwner(userId: number) {
  const access = await assertAdmin(userId, "catalog");
  if (access.role !== "owner") throw new Error("هذه العملية متاحة لمالك التشغيل فقط");
  return access;
}

const staffRoleInput = z.enum(["catalog_manager", "project_manager", "viewer"]);
const catalogNodeInput = z.object({ serviceId: z.number().int().positive(), parentId: z.number().int().positive().nullable().optional(), nodeType: z.enum(["category", "option"]), name: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).optional(), selectionMode: z.enum(["multi", "single", "view_only"]).default("multi"), sortOrder: z.number().int().min(0).max(10000).optional() });
const productInput = z.object({ serviceId: z.number().int().positive(), catalogNodeId: z.number().int().positive(), name: z.string().trim().min(2).max(220), description: z.string().trim().max(4000).optional(), productCode: z.string().trim().max(120).optional(), customerPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), internalCostPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), sortOrder: z.number().int().min(0).max(10000).optional() });
const imagePayload = z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().trim().regex(/^image\//, "يجب أن يكون الملف صورة"), dataBase64: z.string().min(1).max(4_200_000) });
const orderedIds = z.array(z.number().int().positive()).min(1).max(500).refine((ids) => new Set(ids).size === ids.length, "لا يمكن تكرار العناصر في الترتيب");
const projectReportFiltersInput = z.object({ search: z.string().trim().min(1).max(100).optional(), status: z.enum(["submitted", "under_review", "locked", "in_progress", "completed", "cancelled"]).optional(), assignedStaffId: z.number().int().positive().optional(), city: z.string().trim().min(1).max(100).optional(), dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, { message: "يجب أن يكون تاريخ البداية قبل أو مساوياً لتاريخ النهاية.", path: ["dateTo"] });

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalog: router({
    services: publicProcedure.query(() => db.getPublicServices()),
    children: publicProcedure.input(z.object({ serviceId: z.number().int().positive(), parentId: z.number().int().positive().optional() })).query(({ input }) => db.getCatalogChildren(input.serviceId, input.parentId)),
    products: publicProcedure.input(z.object({ catalogNodeId: z.number().int().positive() })).query(({ input }) => db.getProductsForCatalogNode(input.catalogNodeId)),
    product: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => db.getPublicProduct(input.productId)),
    productBreadcrumb: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => db.getProductBreadcrumb(input.productId)),
  }),
  company: router({
    settings: publicProcedure.query(() => db.getCompanySettings()),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => db.getCustomerProfile(ctx.user.id)),
    save: protectedProcedure
      .input(z.object({ fullName: z.string().trim().min(2).max(180).optional(), phone: z.string().trim().max(32).optional() }))
      .mutation(async ({ ctx, input }) => {
        await db.ensureCustomerProfile(ctx.user.id, input.fullName, input.phone);
        await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_profile_updated", entityType: "customer_profile", entityId: ctx.user.id, summary: "حدّث عميل بيانات ملفه الشخصي." });
        return { success: true };
      }),
  }),
  admin: router({
    me: protectedProcedure.query(async ({ ctx }) => db.getOperationsAccess(ctx.user.id)),
    companySettings: protectedProcedure.query(async ({ ctx }) => {
      await assertOwner(ctx.user.id);
      return db.getCompanySettings();
    }),
    updateCompanySettings: protectedProcedure
      .input(z.object({
        legalName: z.string().trim().min(2).max(180),
        arabicName: z.string().trim().min(2).max(180),
        supportEmail: z.string().trim().email().max(320),
        supportPhone: z.string().trim().max(32).nullable().optional(),
        address: z.string().trim().max(1500).nullable().optional(),
        website: z.string().trim().url().max(300).nullable().optional(),
        logoUrl: z.string().url().max(2000).nullable().optional(),
        publicTagline: z.string().trim().min(2).max(300),
        publicHeroTitle: z.string().trim().min(2).max(300),
        publicHeroBody: z.string().trim().max(1500).nullable().optional(),
        reportFooter: z.string().trim().min(2).max(500),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwner(ctx.user.id);
        const settings = await db.updateCompanySettingsForAdmin(input);
        await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "company_settings_updated", entityType: "company", entityId: 1, summary: "تم تحديث بيانات الشركة والنسخة العامة للتطبيق." });
        return settings;
      }),
    uploadCompanyLogo: protectedProcedure.input(z.object({ image: imagePayload })).mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.user.id);
      const bytes = Buffer.from(input.image.dataBase64, "base64");
      if (bytes.length > 3 * 1024 * 1024) throw new Error("حجم الشعار يجب ألا يتجاوز 3 ميغابايت");
      const safeName = input.image.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "madd-logo.png";
      const stored = await storagePut(`company-brand/${safeName}`, bytes, input.image.mimeType);
      await db.updateCompanySettingsForAdmin({ logoUrl: stored.url });
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "company_logo_updated", entityType: "company", entityId: 1, summary: "تم تحديث شعار الشركة." });
      return { url: stored.url };
    }),
    ownerCandidates: protectedProcedure.query(async ({ ctx }) => {
      await assertOwner(ctx.user.id);
      return db.listOwnerCandidatesForAdmin();
    }),
    companyGovernance: protectedProcedure
      .input(z.object({ backupOwnerUserId: z.number().int().positive().nullable().optional(), transferToUserId: z.number().int().positive().optional(), confirmation: z.literal("نقل الملكية").optional() }).superRefine((value, context) => {
        if (value.transferToUserId && value.confirmation !== "نقل الملكية") context.addIssue({ code: "custom", message: "اكتب «نقل الملكية» لتأكيد العملية.", path: ["confirmation"] });
      }))
      .mutation(async ({ ctx, input }) => {
        await assertOwner(ctx.user.id);
        return db.updateCompanyGovernanceForOwner({ actorUserId: ctx.user.id, backupOwnerUserId: input.backupOwnerUserId, transferToUserId: input.transferToUserId });
      }),
    adminActivity: protectedProcedure.input(z.object({
      limit: z.number().int().min(1).max(150).optional(),
      search: z.string().trim().min(1).max(180).optional(),
      action: z.string().trim().min(1).max(100).optional(),
      actorUserId: z.number().int().positive().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).optional()).query(async ({ ctx, input }) => {
      await assertOwner(ctx.user.id);
      const dateFrom = input?.dateFrom ? new Date(`${input.dateFrom}T00:00:00.000`) : undefined;
      const dateTo = input?.dateTo ? new Date(`${input.dateTo}T23:59:59.999`) : undefined;
      return db.listAdminActivityForOwner({
        limit: input?.limit ?? 80,
        search: input?.search,
        action: input?.action,
        actorUserId: input?.actorUserId,
        dateFrom,
        dateTo,
      });
    }),
    recentActivity: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(12).optional() }).optional()).query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id);
      return db.listRecentAdminActivityForAdmin(input?.limit ?? 6);
    }),
    staff: protectedProcedure.query(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "team");
      return db.listStaffForAdmin();
    }),
    inviteStaff: protectedProcedure.input(z.object({ email: z.string().trim().email().max(320), displayName: z.string().trim().min(2).max(180).optional(), role: staffRoleInput })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "team");
      const staffId = await db.inviteStaffMemberForAdmin({ ...input, createdByUserId: ctx.user.id });
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "staff_invited", entityType: "staff", entityId: staffId, summary: `تمت إضافة عضو فريق: ${input.displayName || input.email}.`, metadata: { role: input.role } });
      return staffId;
    }),
    updateStaff: protectedProcedure.input(z.object({ staffId: z.number().int().positive(), displayName: z.string().trim().min(2).max(180).optional(), role: staffRoleInput.optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "team");
      const { staffId, ...values } = input;
      const success = await db.updateStaffMemberForAdmin(staffId, values);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "staff_updated", entityType: "staff", entityId: staffId, summary: "تم تعديل بيانات أو صلاحيات أحد أعضاء الفريق.", metadata: values });
      return { success };
    }),
    services: protectedProcedure.query(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "catalog");
      return db.listServicesForAdmin();
    }),
    createService: protectedProcedure.input(serviceInput).mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.user.id);
      const serviceId = await db.createServiceForAdmin(input);
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "service_created", entityType: "service", entityId: serviceId, summary: `تمت إضافة خدمة رئيسية: ${input.name}.` });
      return serviceId;
    }),
    updateService: protectedProcedure
      .input(z.object({ serviceId: z.number().int().positive(), name: z.string().trim().min(2).max(180).optional(), description: z.string().trim().max(2000).optional(), imageUrl: z.string().url().max(2000).optional(), sortOrder: z.number().int().min(0).max(10000).optional(), isActive: z.boolean().optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertOwner(ctx.user.id);
        const { serviceId, ...values } = input;
        const success = await db.updateServiceForAdmin(serviceId, values);
        if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "service_updated", entityType: "service", entityId: serviceId, summary: "تم تعديل بيانات خدمة رئيسية.", metadata: values });
        return { success };
      }),
    uploadServiceImage: protectedProcedure.input(z.object({ serviceId: z.number().int().positive(), image: imagePayload })).mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.user.id);
      const bytes = Buffer.from(input.image.dataBase64, "base64");
      if (bytes.length > 3 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 3 ميغابايت");
      const safeName = input.image.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "service.jpg";
      const stored = await storagePut(`service-images/${input.serviceId}/${safeName}`, bytes, input.image.mimeType);
      await db.updateServiceForAdmin(input.serviceId, { imageUrl: stored.url });
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "service_image_updated", entityType: "service", entityId: input.serviceId, summary: "تم تحديث صورة خدمة رئيسية." });
      return { url: stored.url };
    }),
    deleteService: protectedProcedure.input(z.object({ serviceId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await assertOwner(ctx.user.id);
      const result = await db.deleteServiceForAdmin(input.serviceId);
      if (result.success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "service_deleted", entityType: "service", entityId: input.serviceId, summary: `تم حذف صفحة خدمة ومحتواها غير المرتبط بالعملاء (${result.deletedProductCount} منتج).` });
      return result;
    }),
    reorderServices: protectedProcedure
      .input(z.object({ serviceIds: z.array(z.number().int().positive()).min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        await assertAdmin(ctx.user.id, "catalog");
        const success = await db.reorderServicesForAdmin(input.serviceIds);
        if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "services_reordered", entityType: "service", summary: "تمت إعادة ترتيب الخدمات الرئيسية.", metadata: { serviceCount: input.serviceIds.length } });
        return { success };
      }),
    resetServicesOrder: protectedProcedure.mutation(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const success = await db.resetServicesOrderForAdmin();
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "services_order_reset", entityType: "service", summary: "تمت استعادة الترتيب الافتراضي للخدمات." });
      return { success };
    }),
    saveServicesDefaultOrder: protectedProcedure.mutation(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const success = await db.saveServicesDefaultOrderForAdmin();
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "services_default_order_saved", entityType: "service", summary: "تم حفظ ترتيب الخدمات الحالي كترتيب افتراضي." });
      return { success };
    }),
    catalogNodes: protectedProcedure.query(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "catalog");
      return db.listCatalogNodesForAdmin();
    }),
    createCatalogNode: protectedProcedure.input(catalogNodeInput).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const nodeId = await db.createCatalogNodeForAdmin(input);
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "catalog_node_created", entityType: "catalog_node", entityId: nodeId, summary: `تمت إضافة تقسيمة كتالوج: ${input.name}.` });
      return nodeId;
    }),
    updateCatalogNode: protectedProcedure.input(catalogNodeInput.partial().extend({ nodeId: z.number().int().positive(), imageUrl: z.string().url().max(2000).optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const { nodeId, serviceId: _serviceId, ...values } = input;
      const success = await db.updateCatalogNodeForAdmin(nodeId, values);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "catalog_node_updated", entityType: "catalog_node", entityId: nodeId, summary: "تم تعديل تقسيمة في الكتالوج.", metadata: values });
      return { success };
    }),
    copyCatalogSubtree: protectedProcedure.input(z.object({ sourceNodeId: z.number().int().positive(), targetNodeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const result = await db.copyCatalogSubtreeForAdmin(input);
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "catalog_subtree_copied", entityType: "catalog_node", entityId: input.targetNodeId, summary: `تم نسخ محتوى تقسيمة إلى تقسيمة أخرى (${result.copiedNodeCount} تقسيمة و${result.copiedProductCount} منتج).`, metadata: input });
      return result;
    }),
    pasteCatalogClipboard: protectedProcedure.input(z.object({
      action: z.enum(["copy", "cut"]),
      sourceType: z.enum(["service", "node"]),
      sourceId: z.number().int().positive(),
      targetType: z.enum(["service", "node"]),
      targetId: z.number().int().positive(),
    })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const result = await db.pasteCatalogClipboardForAdmin(input);
      const actionLabel = input.action === "copy" ? "نسخ" : "قص ولصق";
      await db.recordAdminActivity({
        actorUserId: ctx.user.id,
        action: input.action === "copy" ? "catalog_clipboard_copied" : "catalog_clipboard_cut_pasted",
        entityType: input.targetType === "service" ? "service" : "catalog_node",
        entityId: input.targetId,
        summary: `تم ${actionLabel} شجرة كتالوج (${result.nodeCount} تقسيمة و${result.productCount} منتج).`,
        metadata: input,
      });
      return result;
    }),
    deleteCatalogNode: protectedProcedure.input(z.object({ nodeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const result = await db.deleteCatalogNodeForAdmin(input.nodeId);
      if (result.success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "catalog_node_deleted", entityType: "catalog_node", entityId: input.nodeId, summary: `تم حذف تقسيمة ومحتواها غير المرتبط بالعملاء (${result.deletedProductCount} منتج).` });
      return result;
    }),
    reorderCatalogNodes: protectedProcedure.input(z.object({ serviceId: z.number().int().positive(), parentId: z.number().int().positive().nullable(), nodeIds: orderedIds })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const success = await db.reorderCatalogNodesForAdmin(input);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "catalog_nodes_reordered", entityType: "catalog_node", summary: "تمت إعادة ترتيب تقسيمات الكتالوج.", metadata: { serviceId: input.serviceId, parentId: input.parentId, nodeCount: input.nodeIds.length } });
      return { success };
    }),
    uploadCatalogNodeImage: protectedProcedure.input(z.object({ nodeId: z.number().int().positive(), image: imagePayload })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const bytes = Buffer.from(input.image.dataBase64, "base64");
      if (bytes.length > 3 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 3 ميغابايت");
      const safeName = input.image.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "category.jpg";
      const stored = await storagePut(`catalog-nodes/${input.nodeId}/${safeName}`, bytes, input.image.mimeType);
      await db.updateCatalogNodeForAdmin(input.nodeId, { imageUrl: stored.url });
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "catalog_node_image_updated", entityType: "catalog_node", entityId: input.nodeId, summary: "تم تحديث صورة تقسيمة كتالوج." });
      return { url: stored.url };
    }),
    products: protectedProcedure.query(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "catalog");
      return db.listProductsForAdmin();
    }),
    createProduct: protectedProcedure.input(productInput).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const productId = await db.createProductForAdmin(input);
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "product_created", entityType: "product", entityId: productId, summary: `تمت إضافة منتج: ${input.name}.` });
      return productId;
    }),
    updateProduct: protectedProcedure.input(productInput.partial().extend({ productId: z.number().int().positive(), mainImageUrl: z.string().url().max(2000).optional(), isAvailable: z.boolean().optional(), isActive: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const { productId, serviceId: _serviceId, ...values } = input;
      const success = await db.updateProductForAdmin(productId, values);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "product_updated", entityType: "product", entityId: productId, summary: "تم تعديل بيانات منتج.", metadata: values });
      return { success };
    }),
    setProductVisibility: protectedProcedure.input(z.object({ productId: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const success = await db.updateProductForAdmin(input.productId, { isActive: input.isActive });
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: input.isActive ? "product_shown" : "product_hidden", entityType: "product", entityId: input.productId, summary: input.isActive ? "تم إظهار منتج في الكتالوج." : "تم إخفاء منتج من الكتالوج مع حفظ اختيارات العملاء السابقة." });
      return { success };
    }),
    deleteProduct: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const result = await db.deleteProductForAdmin(input.productId);
      if (result.success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "product_deleted", entityType: "product", entityId: input.productId, summary: "تم حذف منتج غير مرتبط باختيارات العملاء." });
      return result;
    }),
    reorderProducts: protectedProcedure.input(z.object({ catalogNodeId: z.number().int().positive(), productIds: orderedIds })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const success = await db.reorderProductsForAdmin(input);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "products_reordered", entityType: "product", summary: "تمت إعادة ترتيب منتجات التقسيمة.", metadata: { catalogNodeId: input.catalogNodeId, productCount: input.productIds.length } });
      return { success };
    }),
    uploadProductImages: protectedProcedure.input(z.object({ productId: z.number().int().positive(), images: z.array(imagePayload).min(1).max(3) })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const uploaded: Array<{ imageUrl: string; altText: string }> = [];
      for (const [index, image] of input.images.entries()) {
        const bytes = Buffer.from(image.dataBase64, "base64");
        if (bytes.length > 3 * 1024 * 1024) throw new Error("حجم الصورة يجب ألا يتجاوز 3 ميغابايت");
        const safeName = image.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || `product-${index + 1}.jpg`;
        const stored = await storagePut(`product-images/${input.productId}/${safeName}`, bytes, image.mimeType);
        uploaded.push({ imageUrl: stored.url, altText: "صورة منتج MADD" });
      }
      const imageCount = await db.addProductImagesForAdmin(input.productId, uploaded);
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "product_images_uploaded", entityType: "product", entityId: input.productId, summary: `تمت إضافة ${imageCount} صورة أو صور لمنتج.`, metadata: { addedImageCount: input.images.length } });
      return { imageCount };
    }),
    productImages: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      return db.listProductImagesForAdmin(input.productId);
    }),
    deleteProductImage: protectedProcedure.input(z.object({ imageId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "catalog");
      const result = await db.deleteProductImageForAdmin(input.imageId);
      if (result.success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "product_image_deleted", entityType: "product", entityId: result.productId, summary: "تم حذف صورة من معرض منتج." });
      return result;
    }),
    projects: protectedProcedure.query(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "projects");
      return db.listProjectsForAdmin();
    }),
    projectManagers: protectedProcedure.query(async ({ ctx }) => {
      await assertAdmin(ctx.user.id, "projects");
      return db.listAssignableProjectManagersForAdmin();
    }),
    lockedProjectReport: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "projects");
      return db.getLockedProjectReportForAdmin(input.projectId);
    }),
    lockedProjectReports: protectedProcedure.input(projectReportFiltersInput.optional()).query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "projects");
      return db.listLockedProjectReportsForAdmin(input);
    }),
    portfolioReport: protectedProcedure.input(projectReportFiltersInput.optional()).query(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "projects");
      return db.getPortfolioReportForAdmin(input);
    }),
    assignProjectManager: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), assignedStaffId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx.user.id, "projects");
      const success = await db.assignProjectManagerForAdmin(input.projectId, input.assignedStaffId);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "project_manager_assigned", entityType: "project", entityId: input.projectId, summary: input.assignedStaffId ? "تم تعيين مسؤول للمشروع." : "تم إلغاء تعيين مسؤول المشروع.", metadata: { assignedStaffId: input.assignedStaffId } });
      return { success };
    }),
    updateProjectStatus: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), status: z.enum(["submitted", "under_review", "locked", "in_progress", "completed", "cancelled"]) }))
      .mutation(async ({ ctx, input }) => {
        await assertAdmin(ctx.user.id, "projects");
        const success = await db.updateProjectStatusForAdmin(input.projectId, input.status);
        if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "project_status_updated", entityType: "project", entityId: input.projectId, summary: "تم تعديل حالة المشروع.", metadata: { status: input.status } });
        return { success };
      }),
    addProjectUpdate: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          status: z.enum(["submitted", "under_review", "locked", "in_progress", "completed", "cancelled"]),
          progressPercent: z.number().int().min(0).max(100),
          title: z.string().trim().min(2).max(180),
          note: z.string().trim().max(2000).optional(),
          notificationKind: z.enum(["pricing_ready", "project_completed"]).nullable().optional(),
          images: z
            .array(
              z.object({
                fileName: z.string().trim().min(1).max(255),
                mimeType: z.string().trim().regex(/^image\//, "يجب أن يكون الملف صورة"),
                dataBase64: z.string().min(1).max(4_200_000),
              }),
            )
            .max(3, "يمكن إرفاق ثلاث صور كحد أقصى")
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertAdmin(ctx.user.id, "projects");
        if (input.notificationKind === "pricing_ready" && input.status !== "under_review") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "إشعار التسعير متاح فقط مع حالة مراجعة الطلب." });
        }
        if (input.notificationKind === "project_completed" && (input.status !== "completed" || input.progressPercent !== 100)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "إشعار الانتهاء يتطلب حالة مكتمل ونسبة إنجاز 100%." });
        }
        const created = await db.createProjectUpdateForAdmin(ctx.user.id, input);
        if (!created) return { success: false, notification: { attempted: 0, accepted: 0 } };
        const uploadedImages: Array<{ storageKey: string; imageUrl: string; fileName: string; mimeType: string; fileSizeBytes: number }> = [];
        for (const [index, image] of (input.images ?? []).entries()) {
          const fileBytes = Buffer.from(image.dataBase64, "base64");
          if (fileBytes.length > 3 * 1024 * 1024) throw new Error("Each stage image must be 3 MB or smaller");
          const safeFileName = image.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || `stage-${index + 1}.jpg`;
          const stored = await storagePut(
            `project-update-images/${input.projectId}/${created.updateId}/${safeFileName}`,
            fileBytes,
            image.mimeType,
          );
          uploadedImages.push({ storageKey: stored.key, imageUrl: stored.url, fileName: image.fileName, mimeType: image.mimeType, fileSizeBytes: fileBytes.length });
        }
        const imageCount = await db.createProjectUpdateImagesForAdmin({ projectUpdateId: created.updateId, images: uploadedImages });
        const devices = await db.listDeviceTokensForUser(created.project.userId);
        const notification = await sendProjectUpdatePush({
          tokens: devices.map((device) => device.expoPushToken),
          projectId: input.projectId,
          projectTitle: created.project.title,
          updateTitle: input.title,
          progressPercent: created.progressPercent,
          note: input.note,
          hasImages: imageCount > 0,
          notificationKind: input.notificationKind ?? undefined,
        });
        await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "project_update_published", entityType: "project", entityId: input.projectId, summary: `تم نشر تحديث مرحلة للمشروع: ${input.title}.`, metadata: { progressPercent: created.progressPercent, status: input.status, imageCount } });
        return { success: true, updateId: created.updateId, imageCount, notification };
      }),
  }),
  notifications: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(120).optional() }).optional()).query(({ ctx, input }) =>
      db.listUserNotifications(ctx.user.id, input?.limit),
    ),
    unreadCount: protectedProcedure.query(({ ctx }) => db.getUnreadNotificationCountForUser(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) =>
      db.markUserNotificationRead(input.notificationId, ctx.user.id),
    ),
    markAllRead: protectedProcedure.mutation(({ ctx }) => db.markAllUserNotificationsRead(ctx.user.id)),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => db.listProjectsForUser(ctx.user.id)),
    get: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const project = await db.getProjectForUser(input.projectId, ctx.user.id);
      if (!project) return null;
      const [selectedServices, selections, updates] = await Promise.all([
        db.getProjectServicesForUser(input.projectId, ctx.user.id),
        db.listProjectSelectionsForUser(input.projectId, ctx.user.id),
        db.listProjectUpdatesForUser(input.projectId, ctx.user.id),
      ]);
      return { ...project, selectedServices, selections, updates };
    }),
    create: protectedProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
      const profile = await db.getCustomerProfile(ctx.user.id);
      if (!profile?.phone?.trim()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يرجى إضافة رقم هاتفك في الملف الشخصي أولاً." });
      }
      const projectId = await db.createProjectForUser(ctx.user.id, input);
      await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_created", entityType: "project", entityId: projectId, summary: `أنشأ عميل مشروعاً جديداً: ${input.title}.` });
      return projectId;
    }),
    update: protectedProcedure.input(projectInput.partial().extend({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { projectId, ...values } = input;
      const success = await db.updateProjectForUser(projectId, ctx.user.id, values);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_updated", entityType: "project", entityId: projectId, summary: "حدّث عميل بيانات مشروعه قبل الإرسال.", metadata: values });
      return { success };
    }),
    replaceServices: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), serviceIds: z.array(z.number().int().positive()).max(30) }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.replaceProjectServicesForUser(input.projectId, ctx.user.id, [...new Set(input.serviceIds)]);
        if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_services_updated", entityType: "project", entityId: input.projectId, summary: "حدّث عميل الخدمات المختارة لمشروعه.", metadata: { serviceCount: input.serviceIds.length } });
        return success;
      }),
    addSelection: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), productId: z.number().int().positive(), quantity: z.number().int().min(1).max(9999).default(1), notes: z.string().trim().max(2000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const selectionId = await db.addProductToProjectForUser(input.projectId, ctx.user.id, input.productId, input.notes, input.quantity);
        await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_selection_added", entityType: "project", entityId: input.projectId, summary: "أضاف عميل اختياراً من الكتالوج إلى مشروعه.", metadata: { productId: input.productId, selectionId, quantity: input.quantity } });
        return selectionId;
      }),
    updateSelectionQuantity: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), selectionId: z.number().int().positive(), quantity: z.number().int().min(1).max(9999) }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.updateSelectionQuantityForUser(input.projectId, ctx.user.id, input.selectionId, input.quantity);
        if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_selection_quantity_updated", entityType: "project", entityId: input.projectId, summary: "حدّث عميل كمية أحد اختيارات مشروعه قبل الإرسال.", metadata: { selectionId: input.selectionId, quantity: input.quantity } });
        return { success };
      }),
    removeSelection: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), productId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const success = await db.removeProductFromProjectForUser(input.projectId, ctx.user.id, input.productId);
        if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_selection_removed", entityType: "project", entityId: input.projectId, summary: "أزال عميل اختياراً من مشروعه قبل الإرسال.", metadata: { productId: input.productId } });
        return { success };
      }),
    deleteDraft: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const success = await db.deleteDraftProjectForUser(input.projectId, ctx.user.id);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_draft_deleted", entityType: "project", entityId: input.projectId, summary: "حذف عميل مشروعاً مسودة قبل الإرسال." });
      return { success };
    }),
    lock: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const success = await db.submitAndLockProjectForUser(input.projectId, ctx.user.id);
      if (success) await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_submitted", entityType: "project", entityId: input.projectId, summary: "أرسل عميل مشروعه وأغلقه كتقرير تشغيلي." });
      return success;
    }),
  }),
  devices: router({
    registerPushToken: protectedProcedure
      .input(z.object({ expoPushToken: z.string().trim().min(16).max(255), platform: z.enum(["ios", "android"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.registerDeviceTokenForUser(ctx.user.id, input.expoPushToken, input.platform);
        return { success: true };
      }),
  }),
  attachments: router({
    list: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(({ ctx, input }) => db.listProjectAttachmentsForUser(input.projectId, ctx.user.id)),
    upload: protectedProcedure
      .input(
        z.object({
          projectId: z.number().int().positive(),
          fileName: z.string().trim().min(1).max(255),
          mimeType: z.string().trim().max(120).optional(),
          dataBase64: z.string().min(1).max(14_000_000),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-160) || "attachment";
        const fileBytes = Buffer.from(input.dataBase64, "base64");
        if (fileBytes.length > 10 * 1024 * 1024) throw new Error("Attachment exceeds the 10 MB limit");

        const stored = await storagePut(
          `project-attachments/${ctx.user.id}/${input.projectId}/${safeFileName}`,
          fileBytes,
          input.mimeType || "application/octet-stream",
        );
        const attachmentId = await db.createProjectAttachmentForUser(ctx.user.id, {
          projectId: input.projectId,
          storageKey: stored.key,
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSizeBytes: fileBytes.length,
        });
        await db.recordAdminActivity({ actorUserId: ctx.user.id, action: "customer_project_attachment_uploaded", entityType: "project", entityId: input.projectId, summary: `رفع عميل مرفقاً لمشروعه: ${input.fileName}.`, metadata: { attachmentId } });
        return { id: attachmentId, url: stored.url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
