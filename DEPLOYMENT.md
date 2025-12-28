# دليل النشر | Deployment Guide

## 📋 قبل النشر | Before Deployment

1. **تأكد من تنفيذ الـ Migration في Supabase:**
   - افتح Supabase SQL Editor
   - نفذ محتوى `api/migrations/001_add_message_hash.sql`

2. **تأكد من إعدادات RLS في Supabase:**
   ```sql
   -- Enable RLS
   ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
   
   -- Allow anonymous inserts
   CREATE POLICY "Allow anonymous inserts" ON submissions
       FOR INSERT WITH CHECK (true);
   ```

---

## 🚀 النشر على Vercel | Deploy to Vercel

### الخطوة 1: رفع الكود على GitHub

```bash
cd "e:\أجر لا ينقطع"
git init
git add .
git commit -m "Initial commit - أجر لا ينقطع"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ajr-la-yanqati.git
git push -u origin main
```

### الخطوة 2: ربط المشروع بـ Vercel

1. اذهب إلى [vercel.com](https://vercel.com)
2. سجل دخول بحساب GitHub
3. اضغط "New Project"
4. اختر الـ repository

### الخطوة 3: إعداد Environment Variables

في Vercel، اذهب إلى **Settings → Environment Variables** وأضف:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://buwwoyhnyqwrhjskwmkz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (مفتاح service_role من Supabase) |
| `ALLOWED_ORIGINS` | `https://your-project.vercel.app` |
| `NODE_ENV` | `production` |

> ⚠️ **مهم:** استخدم **service_role key** وليس anon key

### الخطوة 4: Deploy

اضغط "Deploy" وانتظر حتى ينتهي النشر.

---

## 🔧 بعد النشر | After Deployment

1. **تحديث ALLOWED_ORIGINS:**
   - بعد النشر، ستحصل على رابط مثل `https://ajr-la-yanqati.vercel.app`
   - ارجع إلى Vercel → Settings → Environment Variables
   - حدث `ALLOWED_ORIGINS` بالرابط الجديد

2. **اختبار الموقع:**
   - افتح الرابط
   - جرب إرسال ذكر
   - تأكد من وصوله للـ database

---

## 🌐 ربط Domain مخصص (اختياري)

1. في Vercel → Settings → Domains
2. أضف الـ domain الخاص بك
3. اتبع تعليمات DNS
4. حدث `ALLOWED_ORIGINS` بالـ domain الجديد

---

## 📁 هيكل الملفات للنشر

```
أجر لا ينقطع/
├── index.html          ← الصفحة الرئيسية
├── styles.css          ← التصميم
├── script.js           ← الـ JavaScript
├── vercel.json         ← إعدادات Vercel
├── .gitignore          ← ملفات مستثناة
├── README.md           ← التوثيق
└── api/
    ├── server.js       ← الـ Backend API
    ├── package.json    ← الاعتماديات
    └── .env.example    ← نموذج المتغيرات
```

---

## ⚠️ ملاحظات أمنية

- ❌ لا ترفع `.env` على GitHub
- ❌ لا تشارك `service_role key`
- ✅ استخدم Environment Variables في Vercel
- ✅ تأكد أن `.gitignore` يحتوي على `.env`

---

بالتوفيق! 🤍
