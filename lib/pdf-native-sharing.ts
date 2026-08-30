import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const REPORTS_DIRECTORY_NAME = "madd-reports";

export async function saveNativePdf({ html, fileName }: { html: string; fileName: string }) {
  const temporaryFile = await Print.printToFileAsync({
    html,
    margins: { left: 18, top: 24, right: 18, bottom: 24 },
  });
  const reportsDirectory = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${REPORTS_DIRECTORY_NAME}/` : null;
  if (!reportsDirectory) throw new Error("لا يتوفر مجلد لحفظ التقارير على هذا الجهاز.");

  await FileSystem.makeDirectoryAsync(reportsDirectory, { intermediates: true });
  const savedFileUri = `${reportsDirectory}${fileName}.pdf`;
  await FileSystem.copyAsync({ from: temporaryFile.uri, to: savedFileUri });

  const fileInfo = await FileSystem.getInfoAsync(savedFileUri);
  if (!fileInfo.exists) throw new Error("تعذر حفظ ملف PDF بعد إنشائه.");
  return savedFileUri;
}

export async function shareNativePdf(fileUri: string, dialogTitle: string) {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) throw new Error("ملف PDF غير متاح للمشاركة. أنشئ التقرير مرة أخرى ثم حاول.");
  if (!(await Sharing.isAvailableAsync())) throw new Error("المشاركة غير متاحة على هذا الجهاز.");

  await Sharing.shareAsync(fileUri, {
    dialogTitle,
    UTI: "com.adobe.pdf",
    mimeType: "application/pdf",
  });
}
