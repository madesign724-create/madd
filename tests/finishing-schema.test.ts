import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  catalogNodes,
  productImages,
  products,
  projectAttachments,
  projectUpdateImages,
  projectUpdates,
  projects,
  projectSelections,
  projectServices,
  services,
  userDeviceTokens,
} from "../drizzle/schema";

describe("finishing platform schema", () => {
  it("defines a dynamic catalog with independent services, hierarchy, and products", () => {
    expect(getTableName(services)).toBe("services");
    expect(getTableName(catalogNodes)).toBe("catalog_nodes");
    expect(getTableName(products)).toBe("products");
    expect(getTableName(productImages)).toBe("product_images");
    expect(catalogNodes).toHaveProperty("parentId");
    expect(catalogNodes).toHaveProperty("selectionMode");
    expect(products).toHaveProperty("customerPrice");
    expect(products).toHaveProperty("internalCostPrice");
  });

  it("keeps project choices and file records outside the product catalog", () => {
    expect(getTableName(projects)).toBe("projects");
    expect(getTableName(projectServices)).toBe("project_services");
    expect(getTableName(projectSelections)).toBe("project_selections");
    expect(getTableName(projectAttachments)).toBe("project_attachments");
    expect(projects).toHaveProperty("status");
    expect(projectAttachments).toHaveProperty("storageKey");
  });

  it("records a customer-visible progress timeline and device tokens for targeted updates", () => {
    expect(projects).toHaveProperty("progressPercent");
    expect(getTableName(projectUpdates)).toBe("project_updates");
    expect(projectUpdates).toHaveProperty("status");
    expect(projectUpdates).toHaveProperty("progressPercent");
    expect(getTableName(userDeviceTokens)).toBe("user_device_tokens");
    expect(userDeviceTokens).toHaveProperty("expoPushToken");
  });

  it("keeps visual stage evidence ordered under the project update that published it", () => {
    expect(getTableName(projectUpdateImages)).toBe("project_update_images");
    expect(projectUpdateImages).toHaveProperty("projectUpdateId");
    expect(projectUpdateImages).toHaveProperty("imageUrl");
    expect(projectUpdateImages).toHaveProperty("sortOrder");
  });
});
