# مرجع إعداد دخول Google المستقل — MADD

## المصدر الرسمي

توثيق Supabase الرسمي: <https://supabase.com/docs/guides/auth/social-login/auth-google>

## الخلاصة المعتمدة للتنفيذ

يدعم Supabase Auth تسجيل الدخول عبر Google لتطبيقات الويب والتطبيقات الأصلية. يلزم إنشاء OAuth Client في Google Cloud، ثم تفعيل موفّر Google في إعدادات Auth داخل مشروع Supabase وإدخال **Client ID** و**Client Secret**. رابط العودة الذي يجب إضافته في Google هو:

```text
https://ddfpymanvyvjjnqcvsuw.supabase.co/auth/v1/callback
```

يجب كذلك ضبط روابط عودة MADD الموثوقة في إعدادات Supabase Auth للتطبيق المنشور والتطوير، ثم يبدأ التطبيق عملية الدخول عبر Supabase Auth بدلاً من بوابة Manus. بيانات الاعتماد الخاصة بـ Google لا تُخزّن في التطبيق؛ تحفظ في إعدادات موفّر Google داخل Supabase فقط.

## مصادر إضافية

- <https://supabase.com/docs/guides/auth/redirect-urls>
- <https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth>
