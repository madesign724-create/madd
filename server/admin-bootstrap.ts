/** البريد الوحيد لمالك تشغيل MADD. لا تُستخدم قيمة بيئية متغيرة حتى لا تُفتح الإدارة لحساب سابق بالخطأ. */
export function getBootstrapAdminEmail(): string {
  return "madesign724@gmail.com";
}

export function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  try {
    return email.trim().toLowerCase() === getBootstrapAdminEmail();
  } catch {
    return false;
  }
}
