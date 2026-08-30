import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

type ProjectReport = {
  project: {
    id: number; title: string; propertyType?: string | null; city?: string | null; address?: string | null;
    areaSqm?: string | number | null; notes?: string | null; status: string; progressPercent: number; lockedAt?: Date | string | null;
    customerName?: string | null; customerEmail?: string | null; customerPhone?: string | null; customerProfileName?: string | null;
  };
  selectedServices: Array<{ id: number; name: string; notes?: string | null }>;
  selectedProducts: Array<{ id: number; productName?: string | null; productCode?: string | null; quantity: number; notes?: string | null; breadcrumb?: string[] }>;
  updates: Array<{ id: number; title: string; progressPercent: number; createdAt: Date | string; note?: string | null; images: Array<{ imageUrl: string; caption?: string | null; fileName: string }> }>;
  attachments: Array<{ id: number; fileName: string; mimeType?: string | null }>;
};

type PortfolioReport = {
  generatedAt: Date | string;
  filters?: { search?: string; status?: string; city?: string; dateFrom?: string; dateTo?: string };
  summary: { total: number; averageProgress: number; completed: number; inProgress: number; underReview: number; cancelled: number };
  projects: Array<{ id: number; title: string; propertyType?: string | null; city?: string | null; status: string; progressPercent: number; updatedAt: Date | string; customerName?: string | null; customerEmail?: string | null; assignedManagerName?: string | null; assignedManagerEmail?: string | null }>;
};

export type AdminActivityReport = {
  generatedAt: Date | string;
  filters?: { search?: string; action?: string; actorName?: string; dateFrom?: string; dateTo?: string };
  entries: Array<{ id: number; action: string; summary: string; actorName?: string | null; createdAt: Date | string }>;
};

export type ReportBranding = {
  legalName?: string;
  arabicName?: string;
  supportEmail?: string;
  supportPhone?: string | null;
  address?: string | null;
  reportFooter?: string;
};

let maddLogoDataUri: string | undefined;

export function formatReportDate(value: Date | string | null | undefined) {
  if (!value) return "غير مسجل";
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "—").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character] || character);
}

export async function getMaddLogoDataUri() {
  if (maddLogoDataUri) return maddLogoDataUri;
  try {
    const asset = Asset.fromModule(require("../assets/images/icon.png"));
    if (Platform.OS === "web") return asset.uri;
    await asset.downloadAsync();
    if (!asset.localUri) return "";
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: FileSystem.EncodingType.Base64 });
    maddLogoDataUri = `data:image/png;base64,${base64}`;
    return maddLogoDataUri;
  } catch {
    return "";
  }
}

function documentStyles() {
  return "@page{margin:22px}body{font-family:Arial,sans-serif;color:#171717;line-height:1.7;direction:rtl}.official-header{display:flex;align-items:center;gap:12px;margin-bottom:16px}.logo{width:58px;height:58px;object-fit:contain}.brand-copy{flex:1}.company-name{color:#765f22;margin:0 0 3px;font-size:18px;font-weight:700}.company-contact{color:#68624e;font-size:11px;direction:ltr;text-align:right}.report-title{font-size:17px;font-weight:700;margin-top:7px}.report-subtitle{color:#68624e;font-size:12px}.gold-divider{height:2px;background:#b99a48;margin:11px 0 16px}.tag{display:inline-block;background:#191919;color:#d5b75d;border-radius:8px;padding:4px 10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0}.cell{background:#f4f2ea;padding:10px;border-radius:8px}.label{display:block;color:#68624e;font-size:12px}.section{margin-top:22px;border-top:1px solid #ddd;padding-top:12px}.update{border:1px solid #ddd;padding:10px;margin:10px 0;border-radius:8px;break-inside:avoid}.update h3{margin:0;color:#3d351f}.update p{font-size:12px;color:#666;margin:2px 0 8px}.photos{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.photos img{width:150px;height:110px;object-fit:cover;border-radius:6px}ul{padding-right:20px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:12px}th{background:#191919;color:#d5b75d}footer{font-size:11px;color:#777;border-top:1px solid #ddd;margin-top:25px;padding-top:8px}";
}

export function buildMaddHeader(title: string, subtitle: string, generatedAt: Date | string, logoDataUri: string, branding: ReportBranding = {}) {
  const legalName = branding.legalName || "MADD Engineering & Finishes";
  const arabicName = branding.arabicName || "ماد للهندسة والتشطيبات";
  const contact = [branding.supportEmail || "madesign724@gmail.com", branding.supportPhone, branding.address].filter(Boolean).join(" · ");
  return `<header class="official-header">${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="شعار ${escapeHtml(arabicName)}" />` : ""}<div class="brand-copy"><h1 class="company-name">${escapeHtml(legalName)} | ${escapeHtml(arabicName)}</h1><div class="company-contact">${escapeHtml(contact)}</div><div class="report-title">${escapeHtml(title)}</div><div class="report-subtitle">${escapeHtml(subtitle)} · تاريخ إنشاء التقرير: ${escapeHtml(formatReportDate(generatedAt))}</div></div></header><div class="gold-divider"></div>`;
}

export function buildProjectReportHtml(report: ProjectReport, logoDataUri: string, branding?: ReportBranding) {
  const project = report.project;
  const services = report.selectedServices.map((service) => `<li><strong>${escapeHtml(service.name)}</strong>${service.notes ? `<br><span>${escapeHtml(service.notes)}</span>` : ""}</li>`).join("") || "<li>لا توجد خدمات مختارة.</li>";
  const products = report.selectedProducts.map((product) => `<li><strong>${escapeHtml(product.productName || "منتج محذوف من الكتالوج")} × ${escapeHtml(product.quantity)}</strong>${product.productCode ? ` — ${escapeHtml(product.productCode)}` : ""}${product.breadcrumb?.length ? `<br><span>المسار: ${escapeHtml([...product.breadcrumb, product.productName || "منتج"].join(" ← "))}</span>` : ""}${product.notes ? `<br>${escapeHtml(product.notes)}` : ""}</li>`).join("") || "<li>لا توجد اختيارات منتجات.</li>";
  const updates = report.updates.map((update) => `<section class="update"><h3>${escapeHtml(update.title)} <small>(${escapeHtml(update.progressPercent)}%)</small></h3><p>${escapeHtml(formatReportDate(update.createdAt))}</p>${update.note ? `<div>${escapeHtml(update.note)}</div>` : ""}${update.images.length ? `<div class="photos">${update.images.map((image) => `<img src="${escapeHtml(image.imageUrl)}" alt="${escapeHtml(image.caption || image.fileName)}" />`).join("")}</div>` : ""}</section>`).join("") || "<p>لا توجد تحديثات مراحل مسجلة.</p>";
  const attachments = report.attachments.map((attachment) => `<li>${escapeHtml(attachment.fileName)} — ${escapeHtml(attachment.mimeType || "ملف")}</li>`).join("") || "<li>لا توجد مرفقات.</li>";
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${documentStyles()}</style></head><body>${buildMaddHeader("تقرير طلب مقفول", `رقم الطلب ${project.id}`, new Date(), logoDataUri, branding)}<span class="tag">${escapeHtml(project.status)}</span><div class="grid"><div class="cell"><span class="label">المشروع</span>${escapeHtml(project.title)}</div><div class="cell"><span class="label">تاريخ الإقفال</span>${escapeHtml(formatReportDate(project.lockedAt))}</div><div class="cell"><span class="label">العميل</span>${escapeHtml(project.customerProfileName || project.customerName || "—")}</div><div class="cell"><span class="label">التواصل</span>${escapeHtml(project.customerPhone || project.customerEmail || "—")}</div><div class="cell"><span class="label">الموقع</span>${escapeHtml([project.city, project.address].filter(Boolean).join(" — ") || "—")}</div><div class="cell"><span class="label">نوع ومساحة العقار</span>${escapeHtml([project.propertyType, project.areaSqm ? `${project.areaSqm} م²` : null].filter(Boolean).join(" — ") || "—")}</div></div>${project.notes ? `<div class="section"><h2>ملاحظات العميل</h2><p>${escapeHtml(project.notes)}</p></div>` : ""}<div class="section"><h2>الخدمات المختارة</h2><ul>${services}</ul></div><div class="section"><h2>اختيارات المنتجات</h2><ul>${products}</ul></div><div class="section"><h2>سجل مراحل التنفيذ</h2>${updates}</div><footer>${escapeHtml(branding?.reportFooter || "تقرير إداري داخلي من منصة MADD Engineering & Finishes.")}</footer></body></html>`;
}

function statusLabel(status: string) {
  return ({ submitted: "مُرسل", under_review: "مراجعة الطلب", locked: "بانتظار الانطلاق", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغى" } as Record<string, string>)[status] || status;
}

/** قالب التقرير التنفيذي الذي يمنح الإدارة لقطة واحدة لجميع المشروعات. */
export function buildPortfolioReportHtml(report: PortfolioReport, logoDataUri: string, branding?: ReportBranding) {
  const summary = report.summary;
  const rows = report.projects.map((project) => `<tr><td>#${escapeHtml(project.id)}</td><td><strong>${escapeHtml(project.title)}</strong><br><small>${escapeHtml(project.customerName || project.customerEmail || "—")}</small></td><td>${escapeHtml([project.propertyType, project.city].filter(Boolean).join(" — ") || "—")}</td><td>${escapeHtml(project.assignedManagerName || project.assignedManagerEmail || "غير معيّن")}</td><td>${escapeHtml(statusLabel(project.status))}</td><td>${escapeHtml(project.progressPercent)}%</td><td>${escapeHtml(formatReportDate(project.updatedAt))}</td></tr>`).join("") || "<tr><td colspan=\"7\">لا توجد مشروعات مطابقة للفلاتر المحددة.</td></tr>";
  const filters = report.filters || {};
  const filterSummary = [["بحث", filters.search], ["المدينة", filters.city], ["من تاريخ", filters.dateFrom], ["إلى تاريخ", filters.dateTo], ["الحالة", filters.status ? statusLabel(filters.status) : undefined]].filter(([, value]) => Boolean(value)).map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(value)}`).join(" · ");
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${documentStyles()}</style></head><body>${buildMaddHeader("تقرير شامل للمشروعات", "ملخص إداري للمشروعات", report.generatedAt, logoDataUri, branding)}${filterSummary ? `<div class="cell"><span class="label">الفلاتر المطبقة</span>${filterSummary}</div>` : ""}<div class="grid"><div class="cell"><span class="label">إجمالي المشروعات</span>${escapeHtml(summary.total)}</div><div class="cell"><span class="label">متوسط الإنجاز</span>${escapeHtml(summary.averageProgress)}%</div><div class="cell"><span class="label">مكتملة</span>${escapeHtml(summary.completed)}</div><div class="cell"><span class="label">قيد التنفيذ</span>${escapeHtml(summary.inProgress)}</div><div class="cell"><span class="label">قيد المراجعة/الانتظار</span>${escapeHtml(summary.underReview)}</div><div class="cell"><span class="label">ملغاة</span>${escapeHtml(summary.cancelled)}</div></div><div class="section"><h2>تفاصيل المشروعات</h2><table><thead><tr><th>رقم</th><th>المشروع والعميل</th><th>الموقع</th><th>المسؤول</th><th>الحالة</th><th>الإنجاز</th><th>آخر تحديث</th></tr></thead><tbody>${rows}</tbody></table></div><footer>${escapeHtml(branding?.reportFooter || "تقرير إداري داخلي من منصة MADD Engineering & Finishes.")}</footer></body></html>`;
}

/** قالب رسمي لسجل العمليات الإدارية، مع إظهار الفلاتر المطبقة في ملف التصدير. */
export function buildAdminActivityReportHtml(report: AdminActivityReport, logoDataUri: string, branding?: ReportBranding) {
  const filters = report.filters || {};
  const filterSummary = [["بحث", filters.search], ["الإجراء", filters.action], ["المنفذ", filters.actorName], ["من تاريخ", filters.dateFrom], ["إلى تاريخ", filters.dateTo]]
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${escapeHtml(label)}: ${escapeHtml(value)}`)
    .join(" · ");
  const rows = report.entries.map((entry) => `<tr><td>#${escapeHtml(entry.id)}</td><td>${escapeHtml(formatReportDate(entry.createdAt))}</td><td>${escapeHtml(entry.actorName || "حساب إداري")}</td><td><strong>${escapeHtml(entry.action)}</strong></td><td>${escapeHtml(entry.summary)}</td></tr>`).join("") || "<tr><td colspan=\"5\">لا توجد عمليات مطابقة للفلاتر المحددة.</td></tr>";
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><style>${documentStyles()}</style></head><body>${buildMaddHeader("سجل النشاط الإداري", "تقرير تدقيق عمليات إدارة منصة MADD", report.generatedAt, logoDataUri, branding)}${filterSummary ? `<div class="cell"><span class="label">الفلاتر المطبقة</span>${filterSummary}</div>` : ""}<div class="grid"><div class="cell"><span class="label">عدد العمليات المعروضة</span>${escapeHtml(report.entries.length)}</div><div class="cell"><span class="label">نطاق التقرير</span>حتى 150 عملية حديثة مطابقة للفلاتر</div></div><div class="section"><h2>تفاصيل النشاط</h2><table><thead><tr><th>رقم</th><th>التاريخ</th><th>المنفذ</th><th>الإجراء</th><th>التفاصيل</th></tr></thead><tbody>${rows}</tbody></table></div><footer>${escapeHtml(branding?.reportFooter || "تقرير إداري داخلي من منصة MADD Engineering & Finishes.")}</footer></body></html>`;
}
