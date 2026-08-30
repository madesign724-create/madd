# إعداد عودة Google على Android

## الحالة المكتشفة

في Supabase Authentication > URL Configuration كان **Site URL** مضبوطاً على `http://localhost:3000`، ولذلك كانت محاولات العودة غير المطابقة لقائمة السماح تعود إلى localhost بعد اختيار حساب Google.

## الإعداد المطبّق

1. تم تغيير **Site URL** إلى `https://finishingpl-rp7a8za3.manus.space`.
2. تمت إضافة `madd://auth/callback` إلى **Redirect URLs** مع الإبقاء على رابط معاينة الويب الحالي.

تسمح هذه الإعدادات بعودة Google إلى تطبيق Android عبر الرابط العميق، وتبقي عودة الويب على نطاق MADD المنشور بدلاً من localhost.
