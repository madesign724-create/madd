import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

const identityId = () => integer("id").generatedByDefaultAsIdentity().primaryKey();
const createdAt = () => timestamp("createdAt", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull();

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const staffRoleEnum = pgEnum("staff_role", ["owner", "catalog_manager", "project_manager", "viewer"]);
export const catalogNodeTypeEnum = pgEnum("catalog_node_type", ["category", "option"]);
export const projectStatusEnum = pgEnum("project_status", ["draft", "submitted", "under_review", "locked", "in_progress", "completed", "cancelled"]);
export const devicePlatformEnum = pgEnum("device_platform", ["ios", "android"]);
export const attachmentStatusEnum = pgEnum("attachment_status", ["pending", "uploaded", "failed"]);
export const userNotificationKindEnum = pgEnum("user_notification_kind", ["project_update", "pricing_ready", "project_completed"]);

/** Core user table backing the OAuth flow. */
export const users = pgTable("users", {
  id: identityId(), openId: varchar("openId", { length: 64 }).notNull().unique(), name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(), createdAt: createdAt(), updatedAt: updatedAt(), lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export const customerProfiles = pgTable("customer_profiles", {
  id: identityId(), userId: integer("userId").notNull(), fullName: varchar("fullName", { length: 180 }), phone: varchar("phone", { length: 32 }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("customer_profiles_user_id_unique").on(table.userId)]);

export const staffMembers = pgTable("staff_members", {
  id: identityId(), userId: integer("userId"), email: varchar("email", { length: 320 }).notNull(), displayName: varchar("displayName", { length: 180 }), role: staffRoleEnum("role").default("viewer").notNull(), isActive: boolean("isActive").default(true).notNull(), createdByUserId: integer("createdByUserId"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("staff_members_email_unique").on(table.email), uniqueIndex("staff_members_user_id_unique").on(table.userId), index("staff_members_role_active_idx").on(table.role, table.isActive)]);

export const companySettings = pgTable("company_settings", {
  id: integer("id").primaryKey(), legalName: varchar("legalName", { length: 180 }).notNull(), arabicName: varchar("arabicName", { length: 180 }).notNull(), supportEmail: varchar("supportEmail", { length: 320 }).notNull(), supportPhone: varchar("supportPhone", { length: 32 }), address: text("address"), website: varchar("website", { length: 300 }), logoUrl: text("logoUrl"), publicTagline: varchar("publicTagline", { length: 300 }).notNull(), publicHeroTitle: varchar("publicHeroTitle", { length: 300 }).notNull(), publicHeroBody: text("publicHeroBody"), reportFooter: varchar("reportFooter", { length: 500 }).notNull(), ownerUserId: integer("ownerUserId"), backupOwnerUserId: integer("backupOwnerUserId"), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: identityId(), actorUserId: integer("actorUserId").notNull(), action: varchar("action", { length: 100 }).notNull(), entityType: varchar("entityType", { length: 100 }).notNull(), entityId: integer("entityId"), summary: varchar("summary", { length: 500 }).notNull(), metadataJson: text("metadataJson"), createdAt: createdAt(),
}, (table) => [index("admin_activity_logs_created_idx").on(table.createdAt), index("admin_activity_logs_actor_idx").on(table.actorUserId)]);

export const services = pgTable("services", {
  id: identityId(), slug: varchar("slug", { length: 120 }).notNull(), defaultSortOrder: integer("defaultSortOrder").default(0).notNull(), name: varchar("name", { length: 180 }).notNull(), description: text("description"), imageUrl: text("imageUrl"), sortOrder: integer("sortOrder").default(0).notNull(), isActive: boolean("isActive").default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("services_slug_unique").on(table.slug), index("services_active_order_idx").on(table.isActive, table.sortOrder)]);

export const catalogNodes = pgTable("catalog_nodes", {
  id: identityId(), serviceId: integer("serviceId").notNull(), parentId: integer("parentId"), nodeType: catalogNodeTypeEnum("nodeType").default("category").notNull(), name: varchar("name", { length: 180 }).notNull(), description: text("description"), imageUrl: text("imageUrl"), selectionMode: text("selection_mode").default("multi").notNull(), sortOrder: integer("sortOrder").default(0).notNull(), isActive: boolean("isActive").default(true).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("catalog_nodes_service_parent_order_idx").on(table.serviceId, table.parentId, table.sortOrder), index("catalog_nodes_active_idx").on(table.isActive)]);

export const products = pgTable("products", {
  id: identityId(), serviceId: integer("serviceId").notNull(), catalogNodeId: integer("catalogNodeId").notNull(), name: varchar("name", { length: 220 }).notNull(), description: text("description"), productCode: varchar("productCode", { length: 120 }), mainImageUrl: text("mainImageUrl"), customerPrice: decimal("customerPrice", { precision: 12, scale: 2 }), internalCostPrice: decimal("internalCostPrice", { precision: 12, scale: 2 }), isAvailable: boolean("isAvailable").default(true).notNull(), isActive: boolean("isActive").default(true).notNull(), sortOrder: integer("sortOrder").default(0).notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("products_catalog_active_order_idx").on(table.catalogNodeId, table.isActive, table.sortOrder), index("products_service_idx").on(table.serviceId), uniqueIndex("products_code_unique").on(table.productCode)]);

export const productImages = pgTable("product_images", {
  id: identityId(), productId: integer("productId").notNull(), imageUrl: text("imageUrl").notNull(), altText: varchar("altText", { length: 240 }), sortOrder: integer("sortOrder").default(0).notNull(), createdAt: createdAt(),
}, (table) => [index("product_images_product_order_idx").on(table.productId, table.sortOrder)]);

export const projects = pgTable("projects", {
  id: identityId(), userId: integer("userId").notNull(), title: varchar("title", { length: 180 }).notNull(), propertyType: varchar("propertyType", { length: 80 }), city: varchar("city", { length: 100 }), address: text("address"), areaSqm: decimal("areaSqm", { precision: 10, scale: 2 }), notes: text("notes"), status: projectStatusEnum("status").default("draft").notNull(), progressPercent: integer("progressPercent").default(0).notNull(), assignedStaffId: integer("assignedStaffId"), submittedAt: timestamp("submittedAt", { withTimezone: true }), lockedAt: timestamp("lockedAt", { withTimezone: true }), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("projects_user_status_updated_idx").on(table.userId, table.status, table.updatedAt), index("projects_assigned_staff_idx").on(table.assignedStaffId)]);

export const projectUpdates = pgTable("project_updates", {
  id: identityId(), projectId: integer("projectId").notNull(), status: projectStatusEnum("status").notNull(), progressPercent: integer("progressPercent").default(0).notNull(), title: varchar("title", { length: 180 }).notNull(), note: text("note"), createdByUserId: integer("createdByUserId"), createdAt: createdAt(),
}, (table) => [index("project_updates_project_created_idx").on(table.projectId, table.createdAt)]);

export const projectUpdateImages = pgTable("project_update_images", {
  id: identityId(), projectUpdateId: integer("projectUpdateId").notNull(), storageKey: text("storageKey").notNull(), imageUrl: text("imageUrl").notNull(), fileName: varchar("fileName", { length: 255 }).notNull(), mimeType: varchar("mimeType", { length: 120 }), fileSizeBytes: integer("fileSizeBytes"), caption: varchar("caption", { length: 500 }), sortOrder: integer("sortOrder").default(0).notNull(), createdAt: createdAt(),
}, (table) => [index("project_update_images_update_order_idx").on(table.projectUpdateId, table.sortOrder)]);

/** إشعار دائم داخل التطبيق؛ يخص مالك المشروع ولا يحل محل Push الخارجي. */
export const userNotifications = pgTable("user_notifications", {
  id: identityId(), userId: integer("userId").notNull(), projectId: integer("projectId").notNull(), projectUpdateId: integer("projectUpdateId"), kind: userNotificationKindEnum("kind").default("project_update").notNull(), title: varchar("title", { length: 180 }).notNull(), body: text("body"), readAt: timestamp("readAt", { withTimezone: true }), createdAt: createdAt(),
}, (table) => [index("user_notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt), index("user_notifications_project_idx").on(table.projectId)]);

export const userDeviceTokens = pgTable("user_device_tokens", {
  id: identityId(), userId: integer("userId").notNull(), expoPushToken: varchar("expoPushToken", { length: 255 }).notNull(), platform: devicePlatformEnum("platform").notNull(), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("user_device_tokens_token_unique").on(table.expoPushToken), index("user_device_tokens_user_idx").on(table.userId)]);

export const projectServices = pgTable("project_services", {
  id: identityId(), projectId: integer("projectId").notNull(), serviceId: integer("serviceId").notNull(), notes: text("notes"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [uniqueIndex("project_services_project_service_unique").on(table.projectId, table.serviceId), index("project_services_project_idx").on(table.projectId)]);

export const projectSelections = pgTable("project_selections", {
  id: identityId(), projectId: integer("projectId").notNull(), projectServiceId: integer("projectServiceId").notNull(), productId: integer("productId"), catalogNodeId: integer("catalogNodeId"), quantity: integer("quantity").default(1).notNull(), notes: text("notes"), createdAt: createdAt(), updatedAt: updatedAt(),
}, (table) => [index("project_selections_project_service_idx").on(table.projectId, table.projectServiceId)]);

export const projectAttachments = pgTable("project_attachments", {
  id: identityId(), projectId: integer("projectId").notNull(), userId: integer("userId").notNull(), storageKey: text("storageKey").notNull(), fileName: varchar("fileName", { length: 255 }).notNull(), mimeType: varchar("mimeType", { length: 120 }), fileSizeBytes: integer("fileSizeBytes"), uploadStatus: attachmentStatusEnum("uploadStatus").default("pending").notNull(), createdAt: createdAt(),
}, (table) => [index("project_attachments_project_idx").on(table.projectId), index("project_attachments_user_idx").on(table.userId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type StaffMember = typeof staffMembers.$inferSelect;
export type CompanySettings = typeof companySettings.$inferSelect;
export type AdminActivityLog = typeof adminActivityLogs.$inferSelect;
export type Service = typeof services.$inferSelect;
export type CatalogNode = typeof catalogNodes.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectUpdate = typeof projectUpdates.$inferSelect;
export type ProjectUpdateImage = typeof projectUpdateImages.$inferSelect;
export type UserNotification = typeof userNotifications.$inferSelect;
export type UserDeviceToken = typeof userDeviceTokens.$inferSelect;
export type ProjectService = typeof projectServices.$inferSelect;
export type ProjectSelection = typeof projectSelections.$inferSelect;
export type ProjectAttachment = typeof projectAttachments.$inferSelect;
