import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync("app/(tabs)/index.tsx", "utf8");
const servicesSource = readFileSync("app/(tabs)/services.tsx", "utf8");
const serviceDetailSource = readFileSync("app/service/[serviceId].tsx", "utf8");
const uiSource = readFileSync("components/app-ui.tsx", "utf8");

describe("بطاقات الخدمات العربية", () => {
  it("يعرض اسم الخدمة فوق طبقة الخلفية حتى إذا لم تُرفع لها صورة", () => {
    expect(homeSource).toContain("serviceImageFallback: { ...StyleSheet.absoluteFillObject");
    expect(servicesSource).toContain("imageFallback: { ...StyleSheet.absoluteFillObject");
    expect(homeSource).toContain("{item.name}");
    expect(servicesSource).toContain("{item.name}");
  });

  it("يحافظ على اتجاه ومحاذاة عربية واضحين في نصوص الواجهة الرئيسية", () => {
    expect(homeSource).toContain('topBar: { minHeight: 54, flexDirection: "row"');
    expect(homeSource).toContain('heroContent: { flex: 1, alignSelf: "stretch"');
    expect(homeSource).toContain('heroTitle: { alignSelf: "flex-start", color: Brand.ink');
    expect(homeSource).toContain('sectionHeading: {, flexDirection: "row"');
    expect(homeSource).toContain('serviceCopy: { flex: 1, flexDirection: "row"');
    expect(servicesSource).toContain('cardCopy: { flex: 1');
    expect(servicesSource).toContain('cardFooter: {, flexDirection: "row"');
    expect(servicesSource).toContain('title: { alignSelf: "stretch", color: "#FFF9EA"');
  });

  it("يفرض RTL على بطاقة الخدمة وتفرعات مودرن وزر الرجوع", () => {
    expect(serviceDetailSource).toContain('flatList: { }');
    expect(serviceDetailSource).toContain('hero: { height: 190, marginBottom: 18, borderRadius: 23, overflow: "hidden", position: "relative"');
    expect(serviceDetailSource).toContain('card: { minHeight: 87, flexDirection: "row-reverse"');
    expect(serviceDetailSource).toContain('copy: { flex: 1, alignSelf: "stretch", alignItems: "flex-end", justifyContent: "center" }');
    expect(uiSource).toContain('header: {, flexDirection: "row-reverse"');
  });
});
