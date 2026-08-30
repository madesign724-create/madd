# ملاحظات تحقيق بوابة الدخول الخارجية

تاريخ المراجعة: 22 أغسطس 2026.

## النتيجة

توضح لقطات العميل أن حلقة اختيار الحساب تقع داخل بوابة `manus.im/app-auth` قبل عودة المتصفح إلى MADD. لذلك لا يمكن لتطبيق MADD التحكم مباشرة في تصميم صفحة اختيار حساب Google أو إضافة حساب من واجهة البوابة.

توضح صفحة المساعدة الرسمية أن طريقة الدخول لحساب Manus تُعامل كمفتاح تعريف أساسي، ولا تُبدّل من داخل الحساب بعد إنشائه. وهذا يؤكد أن استبدال هذه البوابة بمصادقة MADD مستقلة هو المسار المناسب لإزالة الاعتماد عليها.

## المصادر

1. [Manus Help Center — How can I change the login methods?](https://help.manus.im/en/articles/11712048-how-can-i-change-the-login-methods) — تمت القراءة في 22 أغسطس 2026.
2. [Manus Blog — Connect Multiple Gmail and Google Calendar Accounts on Manus](https://manus.im/blog/manus-google-multi-account) — تمت القراءة في 22 أغسطس 2026؛ تتناول الحسابات المتصلة لخدمات Gmail/Calendar وليست مصادقة تطبيق MADD.
