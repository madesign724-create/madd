import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import * as maddDb from "../server/db";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
const sql = databaseUrl ? postgres(databaseUrl, { max: 1, prepare: false }) : null;

afterAll(async () => {
  await sql?.end({ timeout: 5 });
});

describe("Supabase catalog persistence", () => {
  it.skipIf(!sql)("saves a finishing section and product image, then reads them back without retaining test data", async () => {
    const suffix = Date.now().toString();
    await sql!.begin(async (transaction) => {
      const [service] = await transaction<{ id: number }[]>`
        insert into services (slug, "defaultSortOrder", name, "sortOrder", "isActive")
        values (${`supabase-check-${suffix}`}, 0, 'فحص Supabase المؤقت', 0, true)
        returning id
      `;
      const [section] = await transaction<{ id: number }[]>`
        insert into catalog_nodes ("serviceId", "nodeType", name, "sortOrder", "isActive")
        values (${service.id}, 'category', 'قسم تشطيبات تجريبي', 0, true)
        returning id
      `;
      const [product] = await transaction<{ id: number }[]>`
        insert into products ("serviceId", "catalogNodeId", name, "sortOrder", "isActive", "isAvailable")
        values (${service.id}, ${section.id}, 'منتج تجريبي', 0, true, true)
        returning id
      `;
      await transaction`
        insert into product_images ("productId", "imageUrl", "sortOrder")
        values (${product.id}, 'https://example.com/madd-supabase-check.jpg', 0)
      `;
      const rows = await transaction<{ section_name: string; image_url: string; selection_mode: string }[]>`
        select node.name as section_name, node.selection_mode, image."imageUrl" as image_url
        from catalog_nodes node
        join products product on product."catalogNodeId" = node.id
        join product_images image on image."productId" = product.id
        where node.id = ${section.id}
      `;
      expect(rows).toEqual([{ section_name: "قسم تشطيبات تجريبي", selection_mode: "multi", image_url: "https://example.com/madd-supabase-check.jpg" }]);
      throw new Error("ROLLBACK_SUPABASE_PERSISTENCE_CHECK");
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "ROLLBACK_SUPABASE_PERSISTENCE_CHECK") return;
      throw error;
    });
  });

  it.skipIf(!sql)("persists a section and product image through the MADD data layer", async () => {
    const suffix = Date.now().toString();
    let serviceId: number | undefined;
    let sectionId: number | undefined;
    let productId: number | undefined;
    try {
      serviceId = await maddDb.createServiceForAdmin({ name: `خدمة اختبار Supabase ${suffix}` });
      sectionId = await maddDb.createCatalogNodeForAdmin({ serviceId, nodeType: "category", name: "قسم اختبار التوافق", selectionMode: "single" });
      productId = await maddDb.createProductForAdmin({ serviceId, catalogNodeId: sectionId, name: "منتج اختبار الصورة" });
      expect(await maddDb.addProductImagesForAdmin(productId, [{ imageUrl: "https://example.com/madd-layer-check.jpg", altText: "صورة فحص" }])).toBe(1);

      const [savedSection] = await sql!<{ selection_mode: string }[]>`select selection_mode from catalog_nodes where id = ${sectionId}`;
      expect(savedSection?.selection_mode).toBe("single");

      const images = await maddDb.listProductImagesForAdmin(productId);
      expect(images).toHaveLength(1);
      expect(images[0]?.imageUrl).toBe("https://example.com/madd-layer-check.jpg");
    } finally {
      if (productId) await sql!`delete from product_images where "productId" = ${productId}`;
      if (productId) await sql!`delete from products where id = ${productId}`;
      if (sectionId) await sql!`delete from catalog_nodes where id = ${sectionId}`;
      if (serviceId) await sql!`delete from services where id = ${serviceId}`;
    }
  });
});
