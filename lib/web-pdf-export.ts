export type WebPdfExportWindow = {
  closed: boolean;
  close: () => void;
  focus: () => void;
  print: () => void;
  document: {
    open: () => void;
    write: (html: string) => void;
    close: () => void;
  };
};

function escapeDocumentTitle(title: string) {
  return title.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

/** يضيف عنواناً وإعدادات طباعة من دون تعديل قالب التقرير العربي نفسه. */
export function prepareWebPdfHtml(html: string, documentTitle: string) {
  const title = `<title>${escapeDocumentTitle(documentTitle)}</title>`;
  const printStyle = "<style>@media print{body{background:#fff!important}}@page{size:auto;margin:18mm}</style>";
  if (html.includes("</head>")) return html.replace("</head>", `${title}${printStyle}</head>`);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">${title}${printStyle}</head><body>${html}</body></html>`;
}

/**
 * يجب استدعاؤها قبل أي await حتى لا يمنع المتصفح النافذة باعتبارها popup.
 * يعرض حوار الطباعة الأصلي حيث يمكن للمستخدم اختيار «Save as PDF».
 */
export function openWebPdfExportWindow() {
  const browser = globalThis as unknown as {
    open?: (url?: string, target?: string, features?: string) => WebPdfExportWindow | null;
  };
  const printWindow = browser.open?.("", "_blank", "popup,width=960,height=760");
  if (!printWindow) throw new Error("تعذر فتح نافذة التصدير. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.");
  return printWindow;
}

export function writeWebPdfExportWindow(printWindow: WebPdfExportWindow, html: string, documentTitle: string) {
  printWindow.document.open();
  printWindow.document.write(prepareWebPdfHtml(html, documentTitle));
  printWindow.document.close();

  // تنتظر الصور والخطوط داخل التقرير قبل إظهار نافذة الطباعة قدر الإمكان.
  setTimeout(() => {
    if (printWindow.closed) return;
    printWindow.focus();
    printWindow.print();
  }, 350);
}
