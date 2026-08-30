import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, like, lte, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  adminActivityLogs,
  catalogNodes,
  companySettings,
  customerProfiles,
  projectAttachments,
  projectUpdateImages,
  projectUpdates,
  projectSelections,
  productImages,
  products,
  projects,
  projectServices,
  services,
  staffMembers,
  userDeviceTokens,
  userNotifications,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getBootstrapAdminEmail, isBootstrapAdminEmail } from "./admin-bootstrap";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  const databaseUrl = process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!_db && databaseUrl) {
    try {
      _db = drizzle(databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach((field) => {
    const value = user[field];
    if (value !== undefined) {
      values[field] = value ?? null;
      updateSet[field] = value ?? null;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  const isBootstrapManager = isBootstrapAdminEmail(user.email);
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (isBootstrapManager) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });

  const syncedUser = await getUserByOpenId(user.openId);
  if (!syncedUser?.email) return;
  const normalizedEmail = syncedUser.email.trim().toLowerCase();
  const isBootstrapOwner = isBootstrapAdminEmail(normalizedEmail);
  if (isBootstrapOwner) {
    await db
      .insert(companySettings)
      .values({ ...defaultCompanySettings, ownerUserId: syncedUser.id })
      .onConflictDoUpdate({
        target: companySettings.id,
        set: { ownerUserId: syncedUser.id, updatedAt: new Date() },
      });
    await db
      .insert(staffMembers)
      .values({ userId: syncedUser.id, email: normalizedEmail, displayName: syncedUser.name, role: "owner", isActive: true, createdByUserId: syncedUser.id })
      .onConflictDoUpdate({ target: staffMembers.email, set: { userId: syncedUser.id, displayName: syncedUser.name, role: "owner", isActive: true, updatedAt: new Date() } });
  } else {
    await db.update(staffMembers).set({ userId: syncedUser.id, displayName: syncedUser.name ?? undefined }).where(and(eq(staffMembers.email, normalizedEmail), eq(staffMembers.isActive, true)));
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/** يعثر على حساب محلي قديم ببريده المطبع، لاستخدامه مرة واحدة عند ربط Google الموثق. */
export async function getUserByNormalizedEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  const result = await db.select().from(users).where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
  return result[0];
}

/**
 * يبدل مفتاح الهوية فقط مع الإبقاء على رقم المستخدم المحلي نفسه، ولذلك تبقى
 * المشروعات والاختيارات وعضوية الفريق المرتبطة به كما هي.
 */
export async function linkUserToSupabaseIdentity(input: {
  userId: number;
  openId: string;
  name: string | null;
  email: string;
  lastSignedIn: Date;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .update(users)
    .set({
      openId: input.openId,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      loginMethod: "google",
      lastSignedIn: input.lastSignedIn,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId))
    .returning();
  return result[0];
}

export async function isUserAdmin(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const company = await getCompanySettings();
  if (isBootstrapAdminEmail(result[0]?.email)) return true;
  const bootstrapOwner = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${getBootstrapAdminEmail()}`).limit(1);
  const ownerUserId = bootstrapOwner[0]?.id ?? company.ownerUserId;
  if (bootstrapOwner[0] && company.ownerUserId !== bootstrapOwner[0].id) {
    await db.insert(companySettings).values({ ...defaultCompanySettings, ownerUserId: bootstrapOwner[0].id }).onConflictDoUpdate({ target: companySettings.id, set: { ownerUserId: bootstrapOwner[0].id, updatedAt: new Date() } });
  }
  const staff = await db.select({ role: staffMembers.role, isActive: staffMembers.isActive, createdByUserId: staffMembers.createdByUserId }).from(staffMembers).where(eq(staffMembers.userId, userId)).limit(1);
  return Boolean(ownerUserId && staff[0]?.isActive && staff[0].role !== "viewer" && staff[0].createdByUserId === ownerUserId);
}

export type OperationsArea = "team" | "catalog" | "projects";
export type OperationsRole = "owner" | "catalog_manager" | "project_manager" | "viewer";

const permissionsForRole: Record<OperationsRole, OperationsArea[]> = {
  owner: ["team", "catalog", "projects"],
  catalog_manager: ["catalog"],
  project_manager: ["projects"],
  viewer: [],
};

export async function getOperationsAccess(userId: number) {
  const db = await getDb();
  if (!db) return { isAdmin: false, role: null as OperationsRole | null, permissions: [] as OperationsArea[] };
  const user = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const company = await getCompanySettings();
  if (isBootstrapAdminEmail(user[0]?.email)) return { isAdmin: true, role: "owner" as const, permissions: permissionsForRole.owner };
  const bootstrapOwner = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${getBootstrapAdminEmail()}`).limit(1);
  const ownerUserId = bootstrapOwner[0]?.id ?? company.ownerUserId;
  if (bootstrapOwner[0] && company.ownerUserId !== bootstrapOwner[0].id) {
    await db.insert(companySettings).values({ ...defaultCompanySettings, ownerUserId: bootstrapOwner[0].id }).onConflictDoUpdate({ target: companySettings.id, set: { ownerUserId: bootstrapOwner[0].id, updatedAt: new Date() } });
  }
  const staff = await db.select({ role: staffMembers.role, isActive: staffMembers.isActive, createdByUserId: staffMembers.createdByUserId }).from(staffMembers).where(eq(staffMembers.userId, userId)).limit(1);
  if (!ownerUserId || !staff[0]?.isActive || staff[0].createdByUserId !== ownerUserId) return { isAdmin: false, role: null as OperationsRole | null, permissions: [] as OperationsArea[] };
  return { isAdmin: staff[0].role !== "viewer", role: staff[0].role, permissions: permissionsForRole[staff[0].role] };
}

export async function listStaffForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(staffMembers).orderBy(asc(staffMembers.role), asc(staffMembers.createdAt));
}

export async function listAssignableProjectManagersForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: staffMembers.id, displayName: staffMembers.displayName, email: staffMembers.email, role: staffMembers.role })
    .from(staffMembers)
    .where(and(eq(staffMembers.isActive, true), inArray(staffMembers.role, ["owner", "project_manager"])))
    .orderBy(asc(staffMembers.role), asc(staffMembers.displayName), asc(staffMembers.email));
}

export async function inviteStaffMemberForAdmin(input: { email: string; displayName?: string; role: Exclude<OperationsRole, "owner">; createdByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const normalizedEmail = input.email.trim().toLowerCase();
  const result = await db
    .insert(staffMembers)
    .values({ email: normalizedEmail, displayName: input.displayName || null, role: input.role, isActive: true, createdByUserId: input.createdByUserId })
    .onConflictDoUpdate({ target: staffMembers.email, set: { displayName: input.displayName || null, role: input.role, isActive: true, updatedAt: new Date() } })
    .returning({ id: staffMembers.id });
  return result[0].id;
}

export async function updateStaffMemberForAdmin(staffId: number, input: Partial<{ displayName: string; role: Exclude<OperationsRole, "owner">; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(staffMembers).set({ ...input, updatedAt: new Date() }).where(and(eq(staffMembers.id, staffId), ne(staffMembers.role, "owner"))).returning({ id: staffMembers.id });
  return result.length > 0;
}

const defaultCompanySettings = {
  id: 1,
  legalName: "MADD Engineering & Finishes",
  arabicName: "ماد للهندسة والتشطيبات",
  supportEmail: "madesign724@gmail.com",
  supportPhone: null,
  address: null,
  website: null,
  logoUrl: null,
  publicTagline: "هندسة وتشطيبات راقية",
  publicHeroTitle: "تفاصيل استثنائية لمساحتك.",
  publicHeroBody: "استكشف الاختيارات، احفظ تفضيلاتك، وأرسل طلبك لفريق MADD المتخصص.",
  reportFooter: "تقرير إداري داخلي من منصة MADD Engineering & Finishes.",
  ownerUserId: null,
  backupOwnerUserId: null,
};

export type CompanySettingsInput = Partial<{
  legalName: string;
  arabicName: string;
  supportEmail: string;
  supportPhone: string | null;
  address: string | null;
  website: string | null;
  logoUrl: string | null;
  publicTagline: string;
  publicHeroTitle: string;
  publicHeroBody: string | null;
  reportFooter: string;
}>;

export async function getCompanySettings() {
  const db = await getDb();
  if (!db) return defaultCompanySettings;
  const result = await db.select().from(companySettings).where(eq(companySettings.id, 1)).limit(1);
  return result[0] ?? defaultCompanySettings;
}

export async function updateCompanySettingsForAdmin(input: CompanySettingsInput) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(companySettings).values({ ...defaultCompanySettings, ...input }).onConflictDoUpdate({ target: companySettings.id, set: { ...input, updatedAt: new Date() } });
  return getCompanySettings();
}

export async function listOwnerCandidatesForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: staffMembers.id, userId: staffMembers.userId, email: staffMembers.email, displayName: staffMembers.displayName, role: staffMembers.role })
    .from(staffMembers)
    .where(eq(staffMembers.isActive, true))
    .orderBy(asc(staffMembers.displayName), asc(staffMembers.email));
}

export async function recordAdminActivity(input: { actorUserId: number; action: string; entityType: string; entityId?: number | null; summary: string; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(adminActivityLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary,
    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

export type AdminActivityFilters = {
  limit?: number;
  search?: string;
  action?: string;
  actorUserId?: number;
  dateFrom?: Date;
  dateTo?: Date;
};

export async function listAdminActivityForOwner(filters: AdminActivityFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.search) conditions.push(like(adminActivityLogs.summary, `%${filters.search}%`));
  if (filters.action) conditions.push(eq(adminActivityLogs.action, filters.action));
  if (filters.actorUserId) conditions.push(eq(adminActivityLogs.actorUserId, filters.actorUserId));
  if (filters.dateFrom) conditions.push(gte(adminActivityLogs.createdAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(adminActivityLogs.createdAt, filters.dateTo));

  return db
    .select()
    .from(adminActivityLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(adminActivityLogs.createdAt))
    .limit(Math.min(Math.max(filters.limit ?? 80, 1), 150));
}

/** A compact, team-visible feed of the most recent operational changes. */
export async function listRecentAdminActivityForAdmin(limit = 6) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: adminActivityLogs.id,
      action: adminActivityLogs.action,
      entityType: adminActivityLogs.entityType,
      entityId: adminActivityLogs.entityId,
      summary: adminActivityLogs.summary,
      createdAt: adminActivityLogs.createdAt,
      actorUserId: adminActivityLogs.actorUserId,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(adminActivityLogs)
    .innerJoin(users, eq(adminActivityLogs.actorUserId, users.id))
    .orderBy(desc(adminActivityLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 12));
}

export async function updateCompanyGovernanceForOwner(input: { actorUserId: number; backupOwnerUserId?: number | null; transferToUserId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getCompanySettings();
  if (current.ownerUserId && current.ownerUserId !== input.actorUserId) throw new Error("لا يملك هذا الحساب صلاحية تحديث حوكمة المالك.");

  if (input.backupOwnerUserId !== undefined && input.backupOwnerUserId === current.ownerUserId) throw new Error("لا يمكن اختيار المالك الحالي كمالك احتياطي.");
  if (input.backupOwnerUserId !== undefined && input.backupOwnerUserId !== null) {
    const candidates = await listOwnerCandidatesForAdmin();
    if (!candidates.some((candidate) => candidate.userId === input.backupOwnerUserId)) throw new Error("المالك الاحتياطي يجب أن يكون عضواً نشطاً سجّل دخوله إلى التطبيق.");
  }

  if (input.transferToUserId !== undefined) {
    if (input.transferToUserId === input.actorUserId) throw new Error("الحساب المحدد هو المالك الحالي بالفعل.");
    const candidates = await listOwnerCandidatesForAdmin();
    const target = candidates.find((candidate) => candidate.userId === input.transferToUserId);
    if (!target?.userId) throw new Error("المالك الجديد يجب أن يكون عضواً نشطاً سجّل دخوله إلى التطبيق.");
    const targetUserId = target.userId;
    await db.transaction(async (transaction) => {
      if (current.ownerUserId) {
        await transaction.update(users).set({ role: "user" }).where(eq(users.id, current.ownerUserId));
        await transaction.update(staffMembers).set({ role: "viewer" }).where(eq(staffMembers.userId, current.ownerUserId));
      }
      await transaction.update(users).set({ role: "admin" }).where(eq(users.id, targetUserId));
      await transaction.update(staffMembers).set({ role: "owner", isActive: true }).where(eq(staffMembers.userId, targetUserId));
      await transaction.insert(companySettings).values({ ...defaultCompanySettings, ownerUserId: targetUserId, backupOwnerUserId: input.backupOwnerUserId === targetUserId ? null : input.backupOwnerUserId ?? current.backupOwnerUserId }).onConflictDoUpdate({ target: companySettings.id, set: { ownerUserId: targetUserId, backupOwnerUserId: input.backupOwnerUserId === targetUserId ? null : input.backupOwnerUserId ?? current.backupOwnerUserId, updatedAt: new Date() } });
    });
    await recordAdminActivity({ actorUserId: input.actorUserId, action: "ownership_transferred", entityType: "company", entityId: 1, summary: `نُقلت ملكية تشغيل MADD إلى ${target.displayName || target.email}.`, metadata: { previousOwnerUserId: current.ownerUserId, newOwnerUserId: targetUserId } });
    return getCompanySettings();
  }

  if (input.backupOwnerUserId !== undefined) {
    await db.insert(companySettings).values({ ...defaultCompanySettings, backupOwnerUserId: input.backupOwnerUserId }).onConflictDoUpdate({ target: companySettings.id, set: { backupOwnerUserId: input.backupOwnerUserId, updatedAt: new Date() } });
    await recordAdminActivity({ actorUserId: input.actorUserId, action: "backup_owner_updated", entityType: "company", entityId: 1, summary: input.backupOwnerUserId ? "تم تعيين مالك احتياطي للتشغيل." : "تم إلغاء تعيين المالك الاحتياطي.", metadata: { backupOwnerUserId: input.backupOwnerUserId } });
  }
  return getCompanySettings();
}

export async function getPublicServices() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(services)
    .where(eq(services.isActive, true))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function listServicesForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(services).orderBy(asc(services.sortOrder), asc(services.name));
}

export async function createServiceForAdmin(input: { slug?: string; name: string; description?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existingServices = await db.select({ sortOrder: services.sortOrder }).from(services).orderBy(desc(services.sortOrder)).limit(1);
  const nextSortOrder = input.sortOrder ?? (existingServices[0]?.sortOrder ?? 0) + 100;
  const generatedSlug = input.slug || `service-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const result = await db.insert(services).values({ slug: generatedSlug, name: input.name, description: input.description, sortOrder: nextSortOrder, defaultSortOrder: nextSortOrder, isActive: true }).returning({ id: services.id });
  return result[0].id;
}

export async function updateServiceForAdmin(serviceId: number, input: Partial<{ name: string; description: string; imageUrl: string; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(services).set({ ...input, updatedAt: new Date() }).where(eq(services.id, serviceId)).returning({ id: services.id });
  return result.length > 0;
}

export async function deleteServiceForAdmin(serviceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [linkedProjectService, serviceProductRows] = await Promise.all([
    db.select({ id: projectServices.id }).from(projectServices).where(eq(projectServices.serviceId, serviceId)).limit(1),
    db.select({ id: products.id }).from(products).where(eq(products.serviceId, serviceId)),
  ]);
  if (linkedProjectService[0]) return { success: false, reason: "هذه الخدمة مرتبطة بطلبات عملاء محفوظة. أخفِها بدلاً من حذفها للحفاظ على التقارير." };
  const productIds = serviceProductRows.map((product) => product.id);
  const selectedProduct = productIds.length
    ? await db.select({ id: projectSelections.id }).from(projectSelections).where(inArray(projectSelections.productId, productIds)).limit(1)
    : [];
  if (selectedProduct[0]) return { success: false, reason: "تحتوي هذه الصفحة على منتج اختاره عميل. أخفِ الصفحة أو المنتج بدلاً من الحذف للحفاظ على مشروع العميل." };
  const result = await db.transaction(async (transaction) => {
    if (productIds.length) await transaction.delete(productImages).where(inArray(productImages.productId, productIds));
    await transaction.delete(products).where(eq(products.serviceId, serviceId));
    await transaction.delete(catalogNodes).where(eq(catalogNodes.serviceId, serviceId));
    return transaction.delete(services).where(eq(services.id, serviceId)).returning({ id: services.id });
  });
  return { success: result.length > 0, deletedProductCount: productIds.length };
}

export async function reorderServicesForAdmin(serviceIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (new Set(serviceIds).size !== serviceIds.length) throw new Error("لا يمكن تكرار الخدمة في الترتيب.");
  const allServices = await db.select({ id: services.id }).from(services);
  if (allServices.length !== serviceIds.length || !allServices.every((service) => serviceIds.includes(service.id))) {
    throw new Error("قائمة ترتيب الخدمات يجب أن تحتوي جميع الخدمات مرة واحدة.");
  }
  await db.transaction(async (transaction) => {
    for (const [index, serviceId] of serviceIds.entries()) {
      await transaction.update(services).set({ sortOrder: (index + 1) * 100 }).where(eq(services.id, serviceId));
    }
  });
  return true;
}

export async function resetServicesOrderForAdmin() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const defaultServices = await db
    .select({ id: services.id })
    .from(services)
    .orderBy(asc(services.defaultSortOrder), asc(services.id));
  await db.transaction(async (transaction) => {
    for (const [index, service] of defaultServices.entries()) {
      await transaction
        .update(services)
        .set({ sortOrder: (index + 1) * 100 })
        .where(eq(services.id, service.id));
    }
  });
  return true;
}

export async function saveServicesDefaultOrderForAdmin() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const currentServices = await db
    .select({ id: services.id })
    .from(services)
    .orderBy(asc(services.sortOrder), asc(services.name), asc(services.id));
  await db.transaction(async (transaction) => {
    for (const [index, service] of currentServices.entries()) {
      await transaction
        .update(services)
        .set({ defaultSortOrder: (index + 1) * 100 })
        .where(eq(services.id, service.id));
    }
  });
  return true;
}

export async function listCatalogNodesForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: catalogNodes.id,
      serviceId: catalogNodes.serviceId,
      parentId: catalogNodes.parentId,
      nodeType: catalogNodes.nodeType,
      name: catalogNodes.name,
      description: catalogNodes.description,
      imageUrl: catalogNodes.imageUrl,
      selectionMode: catalogNodes.selectionMode,
      sortOrder: catalogNodes.sortOrder,
      isActive: catalogNodes.isActive,
      serviceName: services.name,
    })
    .from(catalogNodes)
    .innerJoin(services, eq(catalogNodes.serviceId, services.id))
    .orderBy(asc(services.sortOrder), asc(catalogNodes.sortOrder), asc(catalogNodes.name));
}

export type CatalogSelectionMode = "multi" | "single" | "view_only";

export async function createCatalogNodeForAdmin(input: { serviceId: number; parentId?: number | null; nodeType: "category" | "option"; name: string; description?: string; selectionMode?: CatalogSelectionMode; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(catalogNodes).values({ serviceId: input.serviceId, parentId: input.parentId ?? null, nodeType: input.nodeType, name: input.name, description: input.description || null, selectionMode: input.selectionMode ?? "multi", sortOrder: input.sortOrder ?? 0, isActive: true }).returning({ id: catalogNodes.id });
  return result[0].id;
}

export async function updateCatalogNodeForAdmin(nodeId: number, input: Partial<{ parentId: number | null; nodeType: "category" | "option"; name: string; description: string; imageUrl: string; selectionMode: CatalogSelectionMode; sortOrder: number; isActive: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.parentId !== undefined && input.parentId !== null) {
    const node = await db.select({ serviceId: catalogNodes.serviceId }).from(catalogNodes).where(eq(catalogNodes.id, nodeId)).limit(1);
    if (!node[0]) return false;
    const visited = new Set([nodeId]);
    let cursor: number | null = input.parentId;
    while (cursor !== null) {
      if (visited.has(cursor)) throw new Error("لا يمكن نقل التقسيمة داخل أحد فروعها.");
      visited.add(cursor);
      const parent = await db.select({ parentId: catalogNodes.parentId, serviceId: catalogNodes.serviceId }).from(catalogNodes).where(eq(catalogNodes.id, cursor)).limit(1);
      if (!parent[0]) throw new Error("التقسيمة الأم غير موجودة.");
      if (parent[0].serviceId !== node[0].serviceId) throw new Error("يجب أن تبقى التقسيمة داخل الخدمة نفسها.");
      cursor = parent[0].parentId;
    }
  }
  const result = await db.update(catalogNodes).set({ ...input, updatedAt: new Date() }).where(eq(catalogNodes.id, nodeId)).returning({ id: catalogNodes.id });
  return result.length > 0;
}

/**
 * Copies every descendant node, product, and product-gallery image from one catalog
 * branch into another branch of the same service. The source branch is never modified.
 */
export async function copyCatalogSubtreeForAdmin(input: { sourceNodeId: number; targetNodeId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.sourceNodeId === input.targetNodeId) throw new Error("اختر تقسيمة مختلفة للنسخ إليها.");

  const allNodes = await db
    .select()
    .from(catalogNodes);
  const sourceRoot = allNodes.find((node) => node.id === input.sourceNodeId);
  const targetRoot = allNodes.find((node) => node.id === input.targetNodeId);
  if (!sourceRoot || !targetRoot) throw new Error("التقسيمة المصدر أو الهدف لم تعد موجودة.");
  if (sourceRoot.serviceId !== targetRoot.serviceId) throw new Error("يجب أن تكون التقسيمتان داخل الخدمة نفسها.");

  const sourceNodeIds = new Set<number>([sourceRoot.id]);
  const pendingNodeIds = [sourceRoot.id];
  while (pendingNodeIds.length) {
    const parentId = pendingNodeIds.shift()!;
    for (const child of allNodes.filter((node) => node.parentId === parentId)) {
      if (!sourceNodeIds.has(child.id)) {
        sourceNodeIds.add(child.id);
        pendingNodeIds.push(child.id);
      }
    }
  }
  if (sourceNodeIds.has(targetRoot.id)) throw new Error("لا يمكن نسخ التقسيمة داخل أحد فروعها.");

  const sourceNodes = allNodes
    .filter((node) => sourceNodeIds.has(node.id) && node.id !== sourceRoot.id)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);
  const serviceProducts = await db
    .select()
    .from(products)
    .where(eq(products.serviceId, sourceRoot.serviceId));
  const sourceProducts = serviceProducts.filter((product) => sourceNodeIds.has(product.catalogNodeId));
  sourceProducts.sort((left, right) => left.catalogNodeId - right.catalogNodeId || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);
  const sourceProductIds = sourceProducts.map((product) => product.id);
  const sourceImages = sourceProductIds.length
    ? await db.select().from(productImages).where(inArray(productImages.productId, sourceProductIds))
    : [];

  return db.transaction(async (transaction) => {
    const copiedNodeIds = new Map<number, number>();
    const nextNodeSortOrder = new Map<number, number>();
    const nextProductSortOrder = new Map<number, number>();
    const copiedProductIds = new Map<number, number>();

    const getNextNodeSortOrder = (parentId: number) => {
      const current = nextNodeSortOrder.get(parentId) ?? Math.max(0, ...allNodes.filter((node) => node.parentId === parentId).map((node) => node.sortOrder));
      const next = current + 100;
      nextNodeSortOrder.set(parentId, next);
      return next;
    };
    const getNextProductSortOrder = (nodeId: number) => {
      const current = nextProductSortOrder.get(nodeId) ?? Math.max(0, ...serviceProducts.filter((product) => product.catalogNodeId === nodeId).map((product) => product.sortOrder));
      const next = current + 100;
      nextProductSortOrder.set(nodeId, next);
      return next;
    };

    const pendingCopies = sourceNodes.filter((node) => node.parentId === sourceRoot.id);
    while (pendingCopies.length) {
      const sourceNode = pendingCopies.shift()!;
      const newParentId = sourceNode.parentId === sourceRoot.id
        ? targetRoot.id
        : copiedNodeIds.get(sourceNode.parentId!);
      if (!newParentId) throw new Error("تعذر إعادة بناء تسلسل التقسيمات أثناء النسخ.");
      const created = await transaction
        .insert(catalogNodes)
        .values({
          serviceId: targetRoot.serviceId,
          parentId: newParentId,
          nodeType: sourceNode.nodeType,
          name: sourceNode.name,
          description: sourceNode.description,
          imageUrl: sourceNode.imageUrl,
          selectionMode: sourceNode.selectionMode,
          sortOrder: getNextNodeSortOrder(newParentId),
          isActive: sourceNode.isActive,
        })
        .returning({ id: catalogNodes.id });
      copiedNodeIds.set(sourceNode.id, created[0].id);
      const children = sourceNodes
        .filter((node) => node.parentId === sourceNode.id)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);
      pendingCopies.push(...children);
    }

    for (const sourceProduct of sourceProducts) {
      const newCatalogNodeId = sourceProduct.catalogNodeId === sourceRoot.id
        ? targetRoot.id
        : copiedNodeIds.get(sourceProduct.catalogNodeId);
      if (!newCatalogNodeId) continue;
      const created = await transaction
        .insert(products)
        .values({
          serviceId: targetRoot.serviceId,
          catalogNodeId: newCatalogNodeId,
          name: sourceProduct.name,
          description: sourceProduct.description,
          productCode: null,
          mainImageUrl: sourceProduct.mainImageUrl,
          customerPrice: sourceProduct.customerPrice,
          internalCostPrice: sourceProduct.internalCostPrice,
          isAvailable: sourceProduct.isAvailable,
          isActive: sourceProduct.isActive,
          sortOrder: getNextProductSortOrder(newCatalogNodeId),
        })
        .returning({ id: products.id });
      copiedProductIds.set(sourceProduct.id, created[0].id);
    }

    for (const sourceImage of sourceImages) {
      const newProductId = copiedProductIds.get(sourceImage.productId);
      if (!newProductId) continue;
      await transaction.insert(productImages).values({
        productId: newProductId,
        imageUrl: sourceImage.imageUrl,
        altText: sourceImage.altText,
        sortOrder: sourceImage.sortOrder,
      });
    }

    return { copiedNodeCount: copiedNodeIds.size, copiedProductCount: copiedProductIds.size, copiedImageCount: sourceImages.length };
  });
}

export type CatalogClipboardItemType = "service" | "node";
export type CatalogClipboardAction = "copy" | "cut";

/**
 * Pastes a clipboard item into a catalog destination. A copied item becomes an
 * independent branch; a cut item keeps its IDs and customer history while its
 * complete branch is reassigned to the destination.
 */
export async function pasteCatalogClipboardForAdmin(input: {
  action: CatalogClipboardAction;
  sourceType: CatalogClipboardItemType;
  sourceId: number;
  targetType: CatalogClipboardItemType;
  targetId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [allNodes, allServices, allProducts] = await Promise.all([
    db.select().from(catalogNodes),
    db.select().from(services),
    db.select().from(products),
  ]);
  const sourceService = input.sourceType === "service"
    ? allServices.find((service) => service.id === input.sourceId)
    : undefined;
  const sourceNode = input.sourceType === "node"
    ? allNodes.find((node) => node.id === input.sourceId)
    : undefined;
  const targetService = input.targetType === "service"
    ? allServices.find((service) => service.id === input.targetId)
    : undefined;
  const targetNode = input.targetType === "node"
    ? allNodes.find((node) => node.id === input.targetId)
    : undefined;

  if ((input.sourceType === "service" && !sourceService) || (input.sourceType === "node" && !sourceNode)) {
    throw new Error("العنصر المصدر لم يعد موجوداً.");
  }
  if ((input.targetType === "service" && !targetService) || (input.targetType === "node" && !targetNode)) {
    throw new Error("مكان اللصق لم يعد موجوداً.");
  }

  const sourceServiceId = sourceService?.id ?? sourceNode!.serviceId;
  const targetServiceId = targetService?.id ?? targetNode!.serviceId;
  const targetParentId = targetNode?.id ?? null;
  if (input.sourceType === "service" && input.targetType === "service" && input.sourceId === input.targetId) {
    throw new Error("اختر صفحة رئيسية مختلفة كمكان للصق.");
  }
  if (input.sourceType === "node" && input.targetType === "node" && input.sourceId === input.targetId) {
    throw new Error("لا يمكن لصق التقسيمة داخل نفسها.");
  }

  const sourceNodeIds = new Set<number>();
  const sourceRoots = input.sourceType === "service"
    ? allNodes.filter((node) => node.serviceId === sourceServiceId && node.parentId === null)
    : [sourceNode!];
  const pendingNodeIds = sourceRoots.map((node) => node.id);
  for (const root of sourceRoots) sourceNodeIds.add(root.id);
  while (pendingNodeIds.length) {
    const parentId = pendingNodeIds.shift()!;
    for (const child of allNodes.filter((node) => node.parentId === parentId && node.serviceId === sourceServiceId)) {
      if (!sourceNodeIds.has(child.id)) {
        sourceNodeIds.add(child.id);
        pendingNodeIds.push(child.id);
      }
    }
  }
  if (input.sourceType === "node" && input.targetType === "node" && sourceNodeIds.has(input.targetId)) {
    throw new Error("لا يمكن لصق التقسيمة داخل أحد فروعها.");
  }

  const sourceNodes = allNodes
    .filter((node) => sourceNodeIds.has(node.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);
  const sourceProducts = allProducts
    .filter((product) => sourceNodeIds.has(product.catalogNodeId))
    .sort((left, right) => left.catalogNodeId - right.catalogNodeId || left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);
  const sourceProductIds = sourceProducts.map((product) => product.id);
  const sourceImages = sourceProductIds.length
    ? await db.select().from(productImages).where(inArray(productImages.productId, sourceProductIds))
    : [];

  if (input.action === "cut") {
    if (input.sourceType === "service" && sourceServiceId === targetServiceId) {
      throw new Error("لا يمكن قص محتوى الصفحة إلى الصفحة نفسها.");
    }
    return db.transaction(async (transaction) => {
      const existingTargetSiblings = allNodes.filter((node) => node.serviceId === targetServiceId && node.parentId === targetParentId && !sourceNodeIds.has(node.id));
      let nextSortOrder = Math.max(0, ...existingTargetSiblings.map((node) => node.sortOrder));
      const orderedRoots = [...sourceRoots].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);

      if (sourceNodeIds.size) {
        await transaction.update(catalogNodes).set({ serviceId: targetServiceId, updatedAt: new Date() }).where(inArray(catalogNodes.id, [...sourceNodeIds]));
      }
      if (sourceProducts.length) {
        await transaction.update(products).set({ serviceId: targetServiceId, updatedAt: new Date() }).where(inArray(products.id, sourceProductIds));
      }
      for (const root of orderedRoots) {
        nextSortOrder += 100;
        await transaction.update(catalogNodes).set({ parentId: targetParentId, serviceId: targetServiceId, sortOrder: nextSortOrder, updatedAt: new Date() }).where(eq(catalogNodes.id, root.id));
      }
      return { action: "cut" as const, nodeCount: sourceNodes.length, productCount: sourceProducts.length, imageCount: sourceImages.length };
    });
  }

  return db.transaction(async (transaction) => {
    const copiedNodeIds = new Map<number, number>();
    const nextNodeSortOrders = new Map<string, number>();
    const nextProductSortOrders = new Map<number, number>();
    const copiedProductIds = new Map<number, number>();
    const nodeOrder = (parentId: number | null) => {
      const key = String(parentId ?? "root");
      const current = nextNodeSortOrders.get(key) ?? Math.max(0, ...allNodes.filter((node) => node.serviceId === targetServiceId && node.parentId === parentId).map((node) => node.sortOrder));
      const next = current + 100;
      nextNodeSortOrders.set(key, next);
      return next;
    };
    const productOrder = (nodeId: number) => {
      const current = nextProductSortOrders.get(nodeId) ?? Math.max(0, ...allProducts.filter((product) => product.catalogNodeId === nodeId).map((product) => product.sortOrder));
      const next = current + 100;
      nextProductSortOrders.set(nodeId, next);
      return next;
    };
    const pendingCopies = [...sourceRoots].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id);
    while (pendingCopies.length) {
      const source = pendingCopies.shift()!;
      const newParentId = sourceRoots.some((root) => root.id === source.id)
        ? targetParentId
        : copiedNodeIds.get(source.parentId!);
      if (newParentId === undefined) throw new Error("تعذر إعادة بناء تسلسل التقسيمات أثناء اللصق.");
      const created = await transaction.insert(catalogNodes).values({
        serviceId: targetServiceId,
        parentId: newParentId,
        nodeType: source.nodeType,
        name: source.name,
        description: source.description,
        imageUrl: source.imageUrl,
        selectionMode: source.selectionMode,
        sortOrder: nodeOrder(newParentId),
        isActive: source.isActive,
      }).returning({ id: catalogNodes.id });
      copiedNodeIds.set(source.id, created[0].id);
      pendingCopies.push(...sourceNodes.filter((node) => node.parentId === source.id).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ar") || left.id - right.id));
    }
    for (const source of sourceProducts) {
      const targetNodeId = copiedNodeIds.get(source.catalogNodeId);
      if (!targetNodeId) continue;
      const created = await transaction.insert(products).values({
        serviceId: targetServiceId,
        catalogNodeId: targetNodeId,
        name: source.name,
        description: source.description,
        productCode: null,
        mainImageUrl: source.mainImageUrl,
        customerPrice: source.customerPrice,
        internalCostPrice: source.internalCostPrice,
        isAvailable: source.isAvailable,
        isActive: source.isActive,
        sortOrder: productOrder(targetNodeId),
      }).returning({ id: products.id });
      copiedProductIds.set(source.id, created[0].id);
    }
    for (const image of sourceImages) {
      const productId = copiedProductIds.get(image.productId);
      if (productId) await transaction.insert(productImages).values({ productId, imageUrl: image.imageUrl, altText: image.altText, sortOrder: image.sortOrder });
    }
    return { action: "copy" as const, nodeCount: copiedNodeIds.size, productCount: copiedProductIds.size, imageCount: sourceImages.length };
  });
}

export async function deleteCatalogNodeForAdmin(nodeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const node = await db.select({ id: catalogNodes.id, serviceId: catalogNodes.serviceId }).from(catalogNodes).where(eq(catalogNodes.id, nodeId)).limit(1);
  if (!node[0]) return { success: false, reason: "التقسيمة غير موجودة أو حُذفت بالفعل." };
  const serviceNodes = await db.select({ id: catalogNodes.id, parentId: catalogNodes.parentId }).from(catalogNodes).where(eq(catalogNodes.serviceId, node[0].serviceId));
  const nodeIds = new Set<number>([nodeId]);
  const pendingNodeIds = [nodeId];
  while (pendingNodeIds.length) {
    const parentId = pendingNodeIds.shift()!;
    for (const child of serviceNodes) {
      if (child.parentId === parentId && !nodeIds.has(child.id)) {
        nodeIds.add(child.id);
        pendingNodeIds.push(child.id);
      }
    }
  }
  const branchNodeIds = [...nodeIds];
  const branchProducts = await db.select({ id: products.id }).from(products).where(inArray(products.catalogNodeId, branchNodeIds));
  const productIds = branchProducts.map((product) => product.id);
  const selectedProduct = productIds.length
    ? await db.select({ id: projectSelections.id }).from(projectSelections).where(inArray(projectSelections.productId, productIds)).limit(1)
    : [];
  if (selectedProduct[0]) return { success: false, reason: "تحتوي هذه التقسيمة على منتج اختاره عميل. أخفِ المنتج بدلاً من الحذف للحفاظ على سجل مشروعه." };
  const result = await db.transaction(async (transaction) => {
    if (productIds.length) await transaction.delete(productImages).where(inArray(productImages.productId, productIds));
    if (productIds.length) await transaction.delete(products).where(inArray(products.id, productIds));
    return transaction.delete(catalogNodes).where(inArray(catalogNodes.id, branchNodeIds)).returning({ id: catalogNodes.id });
  });
  return { success: result.length > 0, deletedNodeCount: branchNodeIds.length, deletedProductCount: productIds.length };
}

export async function reorderCatalogNodesForAdmin(input: { serviceId: number; parentId: number | null; nodeIds: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (new Set(input.nodeIds).size !== input.nodeIds.length) throw new Error("لا يمكن تكرار التقسيمة في الترتيب.");
  const rows = await db
    .select({ id: catalogNodes.id, serviceId: catalogNodes.serviceId, parentId: catalogNodes.parentId })
    .from(catalogNodes)
    .where(inArray(catalogNodes.id, input.nodeIds));
  if (rows.length !== input.nodeIds.length) throw new Error("إحدى التقسيمات غير موجودة.");
  if (rows.some((row) => row.serviceId !== input.serviceId || row.parentId !== input.parentId)) throw new Error("يمكن إعادة ترتيب التقسيمات الشقيقة فقط.");
  await db.transaction(async (transaction) => {
    for (const [index, nodeId] of input.nodeIds.entries()) {
      await transaction.update(catalogNodes).set({ sortOrder: (index + 1) * 100 }).where(eq(catalogNodes.id, nodeId));
    }
  });
  return true;
}

export async function listProductsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: products.id,
      serviceId: products.serviceId,
      catalogNodeId: products.catalogNodeId,
      name: products.name,
      description: products.description,
      productCode: products.productCode,
      mainImageUrl: products.mainImageUrl,
      customerPrice: products.customerPrice,
      internalCostPrice: products.internalCostPrice,
      isAvailable: products.isAvailable,
      isActive: products.isActive,
      sortOrder: products.sortOrder,
      serviceName: services.name,
      catalogNodeName: catalogNodes.name,
    })
    .from(products)
    .innerJoin(services, eq(products.serviceId, services.id))
    .innerJoin(catalogNodes, eq(products.catalogNodeId, catalogNodes.id))
    .orderBy(asc(services.sortOrder), asc(catalogNodes.sortOrder), asc(products.sortOrder), asc(products.name));
}

export async function createProductForAdmin(input: { serviceId: number; catalogNodeId: number; name: string; description?: string; productCode?: string; customerPrice?: string; internalCostPrice?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values({ serviceId: input.serviceId, catalogNodeId: input.catalogNodeId, name: input.name, description: input.description || null, productCode: input.productCode || null, customerPrice: input.customerPrice || null, internalCostPrice: input.internalCostPrice || null, sortOrder: input.sortOrder ?? 0, isAvailable: true, isActive: true }).returning({ id: products.id });
  return result[0].id;
}

export async function updateProductForAdmin(productId: number, input: Partial<{ catalogNodeId: number; name: string; description: string; productCode: string; customerPrice: string; internalCostPrice: string; isAvailable: boolean; isActive: boolean; sortOrder: number; mainImageUrl: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (input.catalogNodeId !== undefined) {
    const [product, targetNode] = await Promise.all([
      db.select({ serviceId: products.serviceId }).from(products).where(eq(products.id, productId)).limit(1),
      db.select({ serviceId: catalogNodes.serviceId }).from(catalogNodes).where(eq(catalogNodes.id, input.catalogNodeId!)).limit(1),
    ]);
    if (!product[0]) return false;
    if (!targetNode[0]) throw new Error("التقسيمة المختارة غير موجودة.");
    if (targetNode[0].serviceId !== product[0].serviceId) throw new Error("لا يمكن نقل المنتج إلى خدمة مختلفة.");
  }
  const result = await db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, productId)).returning({ id: products.id });
  return result.length > 0;
}

export async function deleteProductForAdmin(productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const selection = await db.select({ id: projectSelections.id }).from(projectSelections).where(eq(projectSelections.productId, productId)).limit(1);
  if (selection[0]) return { success: false, reason: "لا يمكن حذف منتج اختاره عميل في مشروع. يمكنك إخفاؤه بدلاً من ذلك للحفاظ على سجل المشروع." };
  const result = await db.transaction(async (transaction) => {
    await transaction.delete(productImages).where(eq(productImages.productId, productId));
    return transaction.delete(products).where(eq(products.id, productId)).returning({ id: products.id });
  });
  return { success: result.length > 0 };
}

export async function reorderProductsForAdmin(input: { catalogNodeId: number; productIds: number[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (new Set(input.productIds).size !== input.productIds.length) throw new Error("لا يمكن تكرار المنتج في الترتيب.");
  const rows = await db
    .select({ id: products.id, catalogNodeId: products.catalogNodeId })
    .from(products)
    .where(inArray(products.id, input.productIds));
  if (rows.length !== input.productIds.length) throw new Error("أحد المنتجات غير موجود.");
  if (rows.some((row) => row.catalogNodeId !== input.catalogNodeId)) throw new Error("يمكن إعادة ترتيب منتجات التقسيمة نفسها فقط.");
  await db.transaction(async (transaction) => {
    for (const [index, productId] of input.productIds.entries()) {
      await transaction.update(products).set({ sortOrder: (index + 1) * 100 }).where(eq(products.id, productId));
    }
  });
  return true;
}

export async function addProductImagesForAdmin(productId: number, images: Array<{ imageUrl: string; altText?: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (images.length === 0) return 0;
  const product = await db.select({ id: products.id, mainImageUrl: products.mainImageUrl }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product[0]) throw new Error("Product was not found");
  await db.insert(productImages).values(images.map((image, sortOrder) => ({ productId, imageUrl: image.imageUrl, altText: image.altText || null, sortOrder })));
  if (!product[0].mainImageUrl) await db.update(products).set({ mainImageUrl: images[0].imageUrl }).where(eq(products.id, productId));
  return images.length;
}

export async function listProductImagesForAdmin(productId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
}

export async function deleteProductImageForAdmin(imageId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const found = await db
    .select({ id: productImages.id, productId: productImages.productId, imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(eq(productImages.id, imageId))
    .limit(1);
  if (!found[0]) return { success: false, reason: "الصورة غير موجودة." };
  await db.transaction(async (transaction) => {
    await transaction.delete(productImages).where(eq(productImages.id, imageId));
    const product = await transaction
      .select({ mainImageUrl: products.mainImageUrl })
      .from(products)
      .where(eq(products.id, found[0].productId))
      .limit(1);
    if (product[0]?.mainImageUrl === found[0].imageUrl) {
      const nextImage = await transaction
        .select({ imageUrl: productImages.imageUrl })
        .from(productImages)
        .where(eq(productImages.productId, found[0].productId))
        .orderBy(asc(productImages.sortOrder), asc(productImages.id))
        .limit(1);
      await transaction.update(products).set({ mainImageUrl: nextImage[0]?.imageUrl ?? null }).where(eq(products.id, found[0].productId));
    }
  });
  return { success: true, productId: found[0].productId };
}

export async function getCatalogChildren(serviceId: number, parentId?: number) {
  const db = await getDb();
  if (!db) return [];
  const parentCondition = parentId === undefined ? isNull(catalogNodes.parentId) : eq(catalogNodes.parentId, parentId);
  return db
    .select()
    .from(catalogNodes)
    .where(and(eq(catalogNodes.serviceId, serviceId), eq(catalogNodes.isActive, true), parentCondition))
    .orderBy(asc(catalogNodes.sortOrder), asc(catalogNodes.name));
}

export async function getProductsForCatalogNode(catalogNodeId: number) {
  const db = await getDb();
  if (!db) return [];
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      productCode: products.productCode,
      mainImageUrl: products.mainImageUrl,
      isAvailable: products.isAvailable,
      serviceId: products.serviceId,
      catalogNodeId: products.catalogNodeId,
      selectionMode: catalogNodes.selectionMode,
    })
    .from(products)
    .innerJoin(catalogNodes, eq(products.catalogNodeId, catalogNodes.id))
    .where(and(eq(products.catalogNodeId, catalogNodeId), eq(products.isActive, true)))
    .orderBy(asc(products.sortOrder), asc(products.name));
  return Promise.all(productRows.map(async (product) => ({
    ...product,
    breadcrumb: await getProductBreadcrumb(product.id),
  })));
}

/**
 * Returns the visible catalog ancestry for a product, without repeating the
 * product name itself. Consumers append the product name when rendering a
 * complete path such as "الخدمة ← التقسيمة ← المنتج".
 */
export async function getProductBreadcrumb(productId: number): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];

  const product = await db
    .select({ catalogNodeId: products.catalogNodeId, serviceName: services.name })
    .from(products)
    .innerJoin(services, eq(products.serviceId, services.id))
    .where(eq(products.id, productId))
    .limit(1);
  if (!product[0]) return [];

  const nodeNames: string[] = [];
  const visited = new Set<number>();
  let currentNodeId: number | null = product[0].catalogNodeId;

  while (currentNodeId !== null && !visited.has(currentNodeId)) {
    visited.add(currentNodeId);
    const node = await db
      .select({ id: catalogNodes.id, parentId: catalogNodes.parentId, name: catalogNodes.name })
      .from(catalogNodes)
      .where(eq(catalogNodes.id, currentNodeId))
      .limit(1);
    if (!node[0]) break;
    nodeNames.unshift(node[0].name);
    currentNodeId = node[0].parentId;
  }

  return [product[0].serviceName, ...nodeNames];
}

export async function getPublicProduct(productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      productCode: products.productCode,
      mainImageUrl: products.mainImageUrl,
      isAvailable: products.isAvailable,
      serviceId: products.serviceId,
      catalogNodeId: products.catalogNodeId,
      selectionMode: catalogNodes.selectionMode,
    })
    .from(products)
    .innerJoin(catalogNodes, eq(products.catalogNodeId, catalogNodes.id))
    .where(and(eq(products.id, productId), eq(products.isActive, true)))
    .limit(1);
  const product = result[0];
  if (!product) return undefined;
  const imageRows = await db
    .select({ imageUrl: productImages.imageUrl })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.sortOrder), asc(productImages.id));
  const imageUrls = [...new Set([product.mainImageUrl, ...imageRows.map((image) => image.imageUrl)].filter((imageUrl): imageUrl is string => Boolean(imageUrl)))];
  return { ...product, imageUrls, breadcrumb: await getProductBreadcrumb(product.id) };
}

export async function listProjectsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function listProjectsForAdmin() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: projects.id, userId: projects.userId, title: projects.title, propertyType: projects.propertyType, city: projects.city, status: projects.status, progressPercent: projects.progressPercent, assignedStaffId: projects.assignedStaffId, assignedManagerName: staffMembers.displayName, assignedManagerEmail: staffMembers.email, lockedAt: projects.lockedAt, createdAt: projects.createdAt, updatedAt: projects.updatedAt, customerName: users.name, customerEmail: users.email })
    .from(projects)
    .innerJoin(users, eq(projects.userId, users.id))
    .leftJoin(staffMembers, eq(projects.assignedStaffId, staffMembers.id))
    .orderBy(desc(projects.updatedAt));
}

type ProjectTrackingStatus = "submitted" | "under_review" | "locked" | "in_progress" | "completed" | "cancelled";
type LockedReportFilters = { search?: string; status?: ProjectTrackingStatus; assignedStaffId?: number; city?: string; dateFrom?: string; dateTo?: string };

function matchesProjectReportFilters<T extends { title: string; customerName?: string | null; customerEmail?: string | null; city?: string | null; propertyType?: string | null; status: string; assignedStaffId?: number | null; createdAt?: Date | string | null }>(project: T, filters: LockedReportFilters) {
  if (filters.status && project.status !== filters.status) return false;
  if (filters.assignedStaffId && project.assignedStaffId !== filters.assignedStaffId) return false;
  const normalizedCity = filters.city?.trim().toLocaleLowerCase("ar-EG");
  if (normalizedCity && !project.city?.toLocaleLowerCase("ar-EG").includes(normalizedCity)) return false;
  const createdAt = project.createdAt ? new Date(project.createdAt) : null;
  if (filters.dateFrom && (!createdAt || createdAt < new Date(`${filters.dateFrom}T00:00:00.000Z`))) return false;
  if (filters.dateTo && (!createdAt || createdAt > new Date(`${filters.dateTo}T23:59:59.999Z`))) return false;
  const normalizedSearch = filters.search?.trim().toLocaleLowerCase("ar-EG");
  if (!normalizedSearch) return true;
  return [project.title, project.customerName, project.customerEmail, project.city, project.propertyType]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("ar-EG").includes(normalizedSearch));
}

export async function listLockedProjectReportsForAdmin(filters: LockedReportFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const reports = await db
    .select({
      id: projects.id,
      userId: projects.userId,
      title: projects.title,
      propertyType: projects.propertyType,
      city: projects.city,
      status: projects.status,
      progressPercent: projects.progressPercent,
      assignedStaffId: projects.assignedStaffId,
      assignedManagerName: staffMembers.displayName,
      assignedManagerEmail: staffMembers.email,
      lockedAt: projects.lockedAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(projects)
    .innerJoin(users, eq(projects.userId, users.id))
    .leftJoin(staffMembers, eq(projects.assignedStaffId, staffMembers.id))
    .where(isNotNull(projects.lockedAt))
    .orderBy(desc(projects.lockedAt));

  return reports.filter((report) => Boolean(report.lockedAt) && matchesProjectReportFilters(report, filters));
}

/** تقرير تنفيذي شامل للمشروعات؛ يعرض كل المشروعات وليس الطلبات المقفولة فقط. */
export async function getPortfolioReportForAdmin(filters: LockedReportFilters = {}) {
  const reportProjects = (await listProjectsForAdmin()).filter((project) => matchesProjectReportFilters(project, filters));
  const total = reportProjects.length;
  const progressTotal = reportProjects.reduce((sum, project) => sum + project.progressPercent, 0);
  return {
    generatedAt: new Date(),
    filters,
    summary: {
      total,
      averageProgress: total ? Math.round(progressTotal / total) : 0,
      completed: reportProjects.filter((project) => project.status === "completed").length,
      inProgress: reportProjects.filter((project) => project.status === "in_progress").length,
      underReview: reportProjects.filter((project) => project.status === "under_review" || project.status === "submitted" || project.status === "locked").length,
      cancelled: reportProjects.filter((project) => project.status === "cancelled").length,
    },
    projects: reportProjects,
  };
}

export async function getLockedProjectReportForAdmin(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const reportProject = await db
    .select({
      id: projects.id,
      title: projects.title,
      propertyType: projects.propertyType,
      city: projects.city,
      address: projects.address,
      areaSqm: projects.areaSqm,
      notes: projects.notes,
      status: projects.status,
      progressPercent: projects.progressPercent,
      submittedAt: projects.submittedAt,
      lockedAt: projects.lockedAt,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      customerName: users.name,
      customerEmail: users.email,
      customerPhone: customerProfiles.phone,
      customerProfileName: customerProfiles.fullName,
      assignedStaffId: projects.assignedStaffId,
      assignedManagerName: staffMembers.displayName,
      assignedManagerEmail: staffMembers.email,
    })
    .from(projects)
    .innerJoin(users, eq(projects.userId, users.id))
    .leftJoin(customerProfiles, eq(customerProfiles.userId, users.id))
    .leftJoin(staffMembers, eq(projects.assignedStaffId, staffMembers.id))
    .where(eq(projects.id, projectId))
    .limit(1);
  const project = reportProject[0];
  if (!project?.lockedAt) return null;
  const [selectedServices, selectedProductRows, updates, attachments] = await Promise.all([
    db.select({ id: projectServices.id, serviceId: services.id, name: services.name, notes: projectServices.notes }).from(projectServices).innerJoin(services, eq(projectServices.serviceId, services.id)).where(eq(projectServices.projectId, projectId)).orderBy(asc(services.sortOrder), asc(services.name)),
    db.select({ id: projectSelections.id, projectServiceId: projectSelections.projectServiceId, productId: products.id, productName: products.name, productCode: products.productCode, mainImageUrl: products.mainImageUrl, quantity: projectSelections.quantity, notes: projectSelections.notes }).from(projectSelections).leftJoin(products, eq(projectSelections.productId, products.id)).where(eq(projectSelections.projectId, projectId)).orderBy(desc(projectSelections.updatedAt)),
    db.select().from(projectUpdates).where(eq(projectUpdates.projectId, projectId)).orderBy(desc(projectUpdates.createdAt)),
    db.select().from(projectAttachments).where(eq(projectAttachments.projectId, projectId)).orderBy(desc(projectAttachments.createdAt)),
  ]);
  const updateImages = updates.length ? await db.select().from(projectUpdateImages).where(inArray(projectUpdateImages.projectUpdateId, updates.map((update) => update.id))).orderBy(asc(projectUpdateImages.sortOrder), asc(projectUpdateImages.id)) : [];
  const selectedProducts = await Promise.all(selectedProductRows.map(async (selection) => ({
    ...selection,
    breadcrumb: selection.productId ? await getProductBreadcrumb(selection.productId) : [],
  })));
  return {
    project,
    selectedServices,
    selectedProducts,
    updates: updates.map((update) => ({ ...update, images: updateImages.filter((image) => image.projectUpdateId === update.id) })),
    attachments,
  };
}

export async function assignProjectManagerForAdmin(projectId: number, assignedStaffId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (assignedStaffId !== null) {
    const manager = await db
      .select({ id: staffMembers.id })
      .from(staffMembers)
      .where(and(eq(staffMembers.id, assignedStaffId), eq(staffMembers.isActive, true), inArray(staffMembers.role, ["owner", "project_manager"])))
      .limit(1);
    if (!manager[0]) throw new Error("مسؤول المشروع المحدد غير متاح.");
  }
  const result = await db.update(projects).set({ assignedStaffId, updatedAt: new Date() }).where(eq(projects.id, projectId)).returning({ id: projects.id });
  return result.length > 0;
}

export async function updateProjectStatusForAdmin(projectId: number, status: ProjectTrackingStatus) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(projects).set({ status, updatedAt: new Date() }).where(eq(projects.id, projectId)).returning({ id: projects.id });
  return result.length > 0;
}

export async function createProjectUpdateForAdmin(
  adminUserId: number,
  input: { projectId: number; status: ProjectTrackingStatus; progressPercent: number; title: string; note?: string; notificationKind?: "pricing_ready" | "project_completed" | null },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await db
    .select({ id: projects.id, userId: projects.userId, title: projects.title })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project[0]) return undefined;

  const progressPercent = Math.min(100, Math.max(0, Math.round(input.progressPercent)));
  return db.transaction(async (transaction) => {
    await transaction.update(projects).set({ status: input.status, progressPercent, updatedAt: new Date() }).where(eq(projects.id, input.projectId));
    const result = await transaction.insert(projectUpdates).values({
      projectId: input.projectId,
      status: input.status,
      progressPercent,
      title: input.title,
      note: input.note || null,
      createdByUserId: adminUserId,
    }).returning({ id: projectUpdates.id });
    const updateId = result[0].id;
    await transaction.insert(userNotifications).values({
      userId: project[0].userId,
      projectId: input.projectId,
      projectUpdateId: updateId,
      kind: input.notificationKind ?? "project_update",
      title: input.title,
      body: input.note?.trim() || `هناك تحديث جديد على مشروع ${project[0].title}.`,
    });
    return { project: project[0], updateId, progressPercent };
  });
}

export async function listUserNotifications(userId: number, limit = 80) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: userNotifications.id,
      projectId: userNotifications.projectId,
      projectUpdateId: userNotifications.projectUpdateId,
      kind: userNotifications.kind,
      title: userNotifications.title,
      body: userNotifications.body,
      readAt: userNotifications.readAt,
      createdAt: userNotifications.createdAt,
      projectTitle: projects.title,
    })
    .from(userNotifications)
    .innerJoin(projects, eq(userNotifications.projectId, projects.id))
    .where(and(eq(userNotifications.userId, userId), eq(projects.userId, userId)))
    .orderBy(desc(userNotifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 120));
}

export async function getUnreadNotificationCountForUser(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)));
  return result[0]?.count ?? 0;
}

export async function markUserNotificationRead(notificationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId), isNull(userNotifications.readAt)))
    .returning({ id: userNotifications.id });
  return result.length > 0;
}

export async function markAllUserNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(userNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)))
    .returning({ id: userNotifications.id });
  return result.length;
}

export async function listProjectUpdatesForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db || !(await getProjectForUser(projectId, userId))) return [];
  const updates = await db.select().from(projectUpdates).where(eq(projectUpdates.projectId, projectId)).orderBy(desc(projectUpdates.createdAt));
  if (updates.length === 0) return [];
  const images = await db
    .select()
    .from(projectUpdateImages)
    .where(inArray(projectUpdateImages.projectUpdateId, updates.map((update) => update.id)))
    .orderBy(asc(projectUpdateImages.sortOrder), asc(projectUpdateImages.id));
  return updates.map((update) => ({
    ...update,
    images: images.filter((image) => image.projectUpdateId === update.id),
  }));
}

export async function createProjectUpdateImagesForAdmin(
  input: {
    projectUpdateId: number;
    images: Array<{ storageKey: string; imageUrl: string; fileName: string; mimeType?: string; fileSizeBytes: number; caption?: string }>;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const update = await db
    .select({ id: projectUpdates.id })
    .from(projectUpdates)
    .where(eq(projectUpdates.id, input.projectUpdateId))
    .limit(1);
  if (!update[0]) throw new Error("Project update was not found");
  if (input.images.length === 0) return 0;

  await db.insert(projectUpdateImages).values(
    input.images.map((image, sortOrder) => ({
      projectUpdateId: input.projectUpdateId,
      storageKey: image.storageKey,
      imageUrl: image.imageUrl,
      fileName: image.fileName,
      mimeType: image.mimeType,
      fileSizeBytes: image.fileSizeBytes,
      caption: image.caption || null,
      sortOrder,
    })),
  );
  return input.images.length;
}

export async function registerDeviceTokenForUser(userId: number, expoPushToken: string, platform: "ios" | "android") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(userDeviceTokens)
    .values({ userId, expoPushToken, platform })
    .onConflictDoUpdate({ target: userDeviceTokens.expoPushToken, set: { userId, platform, updatedAt: new Date() } });
}

export async function listDeviceTokensForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ expoPushToken: userDeviceTokens.expoPushToken }).from(userDeviceTokens).where(eq(userDeviceTokens.userId, userId));
}

export async function getProjectForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createProjectForUser(
  userId: number,
  input: { title: string; propertyType?: string; city?: string; address?: string; areaSqm?: string; notes?: string },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const profile = await getCustomerProfile(userId);
  if (!profile?.phone?.trim()) throw new Error("يرجى إضافة رقم هاتفك في الملف الشخصي أولاً.");
  const result = await db.insert(projects).values({ userId, ...input }).returning({ id: projects.id });
  return result[0].id;
}

export async function updateProjectForUser(
  projectId: number,
  userId: number,
  input: Partial<{ title: string; propertyType: string; city: string; address: string; areaSqm: string; notes: string }>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "draft")))
    .returning({ id: projects.id });
  return result.length > 0;
}

export async function replaceProjectServicesForUser(projectId: number, userId: number, serviceIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await getProjectForUser(projectId, userId);
  if (!project || project.status !== "draft") return false;

  await db.delete(projectServices).where(eq(projectServices.projectId, projectId));
  if (serviceIds.length > 0) {
    await db.insert(projectServices).values(serviceIds.map((serviceId) => ({ projectId, serviceId })));
  }
  return true;
}

export async function getProjectServicesForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  const project = await getProjectForUser(projectId, userId);
  if (!project) return [];
  return db
    .select({ id: projectServices.id, serviceId: services.id, name: services.name, imageUrl: services.imageUrl, notes: projectServices.notes })
    .from(projectServices)
    .innerJoin(services, eq(projectServices.serviceId, services.id))
    .where(eq(projectServices.projectId, projectId))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

export async function listProjectSelectionsForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  const project = await getProjectForUser(projectId, userId);
  if (!project) return [];
  const selections = await db
    .select({
      id: projectSelections.id,
      projectServiceId: projectSelections.projectServiceId,
      productId: products.id,
      productName: products.name,
      productCode: products.productCode,
      mainImageUrl: products.mainImageUrl,
      quantity: projectSelections.quantity,
      notes: projectSelections.notes,
    })
    .from(projectSelections)
    .innerJoin(products, eq(projectSelections.productId, products.id))
    .where(eq(projectSelections.projectId, projectId))
    .orderBy(desc(projectSelections.updatedAt));
  return Promise.all(selections.map(async (selection) => ({
    ...selection,
    breadcrumb: await getProductBreadcrumb(selection.productId),
  })));
}

export async function addProductToProjectForUser(projectId: number, userId: number, productId: number, notes?: string, quantity = 1) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await getProjectForUser(projectId, userId);
  if (!project || project.status !== "draft") throw new Error("Project is not editable");

  const product = await getPublicProduct(productId);
  if (!product || !product.isAvailable) throw new Error("Product is unavailable");
  if (product.selectionMode === "view_only") throw new Error("هذه التقسيمة للعرض فقط ولا يمكن إضافة منتجات منها إلى المشروع.");
  const matchingService = await db
    .select({ id: projectServices.id })
    .from(projectServices)
    .where(and(eq(projectServices.projectId, projectId), eq(projectServices.serviceId, product.serviceId)))
    .limit(1);
  const projectService = matchingService[0];
  if (!projectService) throw new Error("Add the product service to the project first");

  const existing = await db
    .select({ id: projectSelections.id })
    .from(projectSelections)
    .where(and(eq(projectSelections.projectId, projectId), eq(projectSelections.productId, productId)))
    .limit(1);
  if (existing[0]) return existing[0].id;

  if (product.selectionMode === "single") {
    return db.transaction(async (transaction) => {
      await transaction
        .delete(projectSelections)
        .where(and(eq(projectSelections.projectId, projectId), eq(projectSelections.catalogNodeId, product.catalogNodeId)));
      const result = await transaction.insert(projectSelections).values({
        projectId,
        projectServiceId: projectService.id,
        productId,
        catalogNodeId: product.catalogNodeId,
        quantity,
        notes,
      }).returning({ id: projectSelections.id });
      return result[0].id;
    });
  }

  const result = await db.insert(projectSelections).values({
    projectId,
    projectServiceId: projectService.id,
    productId,
    catalogNodeId: product.catalogNodeId,
    quantity,
    notes,
  }).returning({ id: projectSelections.id });
  return result[0].id;
}

/** Updates the requested quantity for one customer-owned selection in an editable draft only. */
export async function updateSelectionQuantityForUser(projectId: number, userId: number, selectionId: number, quantity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await getProjectForUser(projectId, userId);
  if (!project || project.status !== "draft") throw new Error("Project is not editable");

  const updated = await db
    .update(projectSelections)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(projectSelections.id, selectionId), eq(projectSelections.projectId, projectId)))
    .returning({ id: projectSelections.id });
  return updated.length > 0;
}

export async function removeProductFromProjectForUser(projectId: number, userId: number, productId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await getProjectForUser(projectId, userId);
  if (!project || project.status !== "draft") throw new Error("Project is not editable");
  const deleted = await db
    .delete(projectSelections)
    .where(and(eq(projectSelections.projectId, projectId), eq(projectSelections.productId, productId)))
    .returning({ id: projectSelections.id });
  return deleted.length > 0;
}

/** Deletes only the current user's editable draft, including its dependent database records. */
export async function deleteDraftProjectForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (transaction) => {
    const draft = await transaction
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "draft")))
      .limit(1);
    if (!draft[0]) return false;

    const updateRows = await transaction
      .select({ id: projectUpdates.id })
      .from(projectUpdates)
      .where(eq(projectUpdates.projectId, projectId));
    if (updateRows.length > 0) {
      await transaction.delete(projectUpdateImages).where(inArray(projectUpdateImages.projectUpdateId, updateRows.map((update) => update.id)));
      await transaction.delete(projectUpdates).where(eq(projectUpdates.projectId, projectId));
    }

    await transaction.delete(projectAttachments).where(eq(projectAttachments.projectId, projectId));
    await transaction.delete(projectSelections).where(eq(projectSelections.projectId, projectId));
    await transaction.delete(projectServices).where(eq(projectServices.projectId, projectId));
    const deleted = await transaction
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "draft")))
      .returning({ id: projects.id });
    return deleted.length > 0;
  });
}

export async function submitAndLockProjectForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await getProjectForUser(projectId, userId);
  if (!project || project.status !== "draft") return false;

  const projectServiceRows = await db.select({ id: projectServices.id }).from(projectServices).where(eq(projectServices.projectId, projectId));
  if (projectServiceRows.length === 0) throw new Error("At least one service is required before submission");

  const result = await db
    .update(projects)
    .set({ status: "locked", submittedAt: new Date(), lockedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "draft")))
    .returning({ id: projects.id });
  if (result.length > 0) {
    await db.insert(projectUpdates).values({
      projectId,
      status: "locked",
      progressPercent: 0,
      title: "تم استلام المشروع",
      note: "استلم فريقنا طلبك وسيبدأ مراجعته قريباً.",
      createdByUserId: null,
    });
  }
  return result.length > 0;
}

export async function ensureCustomerProfile(userId: number, fullName?: string | null, phone?: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateValues: Partial<typeof customerProfiles.$inferInsert> = { updatedAt: new Date() };
  if (fullName !== undefined) updateValues.fullName = fullName || null;
  if (phone !== undefined) updateValues.phone = phone || null;
  await db
    .insert(customerProfiles)
    .values({ userId, fullName: fullName ?? null, phone: phone ?? null })
    .onConflictDoUpdate({ target: customerProfiles.userId, set: updateValues });
}

export async function getCustomerProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customerProfiles).where(eq(customerProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function listProjectAttachmentsForUser(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  const project = await getProjectForUser(projectId, userId);
  if (!project) return [];
  return db.select().from(projectAttachments).where(eq(projectAttachments.projectId, projectId)).orderBy(desc(projectAttachments.createdAt));
}

export async function createProjectAttachmentForUser(
  userId: number,
  input: { projectId: number; storageKey: string; fileName: string; mimeType?: string; fileSizeBytes: number },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const project = await getProjectForUser(input.projectId, userId);
  if (!project || project.status !== "draft") throw new Error("Project cannot accept attachments in its current status");

  const result = await db.insert(projectAttachments).values({
    projectId: input.projectId,
    userId,
    storageKey: input.storageKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    uploadStatus: "uploaded",
  }).returning({ id: projectAttachments.id });
  return result[0].id;
}
