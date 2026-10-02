# 🕌 Abdurahmon ibn Avf madrasasi — Telegram ekotizim

Osh shahri (Qirg'iziston) dagi **Abdurahmon ibn Avf madrasasi** uchun to'liq Telegram ekotizimi:

| Qism | Texnologiya | Papka |
|---|---|---|
| **Backend + Bot** | NestJS · Prisma · PostgreSQL · Redis · BullMQ · grammY | `backend/` |
| **Mini App** (talaba va ustoz) | React · Vite · TypeScript · Tailwind · shadcn/ui · Telegram WebApp SDK · Wavesurfer.js · Plyr | `miniapp/` |
| **Admin panel** | React · Vite · TypeScript · Tailwind · shadcn/ui | `admin/` |
| Ma'lumotlar bazasi | Prisma sxema, migratsiyalar, seed | `prisma/` |
| Dizayn tizimi | SVG logotip, Tailwind preset, umumiy UI komponentlar | `shared/` |

Barcha interfeys **100% o'zbek lotin** tilida, kod izohlari rus tilida. Barcha cron vazifalar **Asia/Bishkek** vaqt zonasida ishlaydi.

---

## ⚡️ Tez ishga tushirish

Talablar: **Node.js 20+**, **Docker** (yoki o'rnatilgan PostgreSQL 15 + Redis 7).

```bash
# 1. Muhit o'zgaruvchilari
cp .env.example .env          # BOT_TOKEN, ADMIN_IDS va boshqalarni to'ldiring

# 2. PostgreSQL va Redis
docker compose up -d postgres redis

# 3. Paketlar (barcha papkalar uchun bitta buyruq — npm workspaces)
npm install

# 4. Baza: migratsiya + namunaviy ma'lumotlar
npm run db:deploy             # yoki ishlab chiqishda: npm run db:migrate
npm run db:seed

# 5. Hammasini birga ishga tushirish (API+bot, Mini App, Admin)
npm run dev
```

| Xizmat | Manzil |
|---|---|
| API | http://localhost:3000/api (holat: `/api/health`) |
| Mini App | http://localhost:5173 |
| Admin panel | http://localhost:5174 |

### Har bir papkada alohida

```bash
cd backend && npm run dev      # API + Telegram bot + cron + BullMQ worker
cd miniapp && npm run dev      # Telegram Mini App
cd admin   && npm run dev      # Admin panel

npm run build                  # ildizda: hammasini build qilish
cd backend && npm run build    # yoki har bir papkada alohida
```

### Telegram'siz sinash (dev rejim)

* `.env` da `ALLOW_DEV_AUTH=true` bo'lsa (faqat `NODE_ENV != production`), Mini App brauzerda ochilganda **demo foydalanuvchini tanlash** oynasi chiqadi (Sardor domla, talabalar…).
* Admin panelda **«Dev rejimda kirish»** tugmasi paydo bo'ladi.
* `BOT_TOKEN` bo'sh bo'lsa, API botsiz ishlaydi (xabarlar logga yoziladi).
* Bot ssenariylarini Telegram'siz tekshirish (ro'yxatdan o'tish, 08:00 tasdiq, sabab, eslatma, davomat):
  ```bash
  npm run build -w backend && npm run simulate -w backend   # 22 ta tekshiruv
  ```

---

## 🔐 Muhit o'zgaruvchilari (`.env.example`)

| O'zgaruvchi | Tavsif |
|---|---|
| `BOT_TOKEN` | @BotFather tokeni |
| `DATABASE_URL` | PostgreSQL ulanishi |
| `REDIS_URL` | Redis (BullMQ navbatlari, admin kirish tokenlari) |
| `TUNDUK_API_URL` | Tunduk pasport tekshiruvi. **Bo'sh = MOCK**: ID ichida `0000` bo'lsa — yaroqsiz |
| `HAYRIYA_MBANK_NUMBER` | Hayriya jamg'armasi MBank raqami |
| `ADMIN_IDS` | Admin Telegram ID lari, vergul bilan (`ADMIN_TELEGRAM_IDS` ham qabul qilinadi) |
| `DONATION_LIMIT` | Jamg'arma limiti (standart 20000). Admin paneldan o'zgartiriladi |
| `MINIAPP_URL`, `ADMIN_URL` | Frontend manzillari (bot tugmalari uchun **https** bo'lishi shart) |
| `BOT_WEBHOOK_URL` | Prod uchun webhook (`https://api.../api/bot/webhook`). Bo'sh = long-polling |
| `PUBLIC_API_URL` | Backendning tashqi manzili (fayl va stream havolalari) |
| `JWT_SECRET` | Admin JWT va media havolalari imzosi |
| `VITE_API_URL` | Mini App va Admin uchun API manzili |

---

## 🤖 Bot imkoniyatlari

**Toza chat (MAJBURIY qoida):** har bir yangi xabardan **oldin** botning oldingi xabari o'chiriladi (`User.last_bot_message_id`), foydalanuvchining kiruvchi xabarlari ham o'chiriladi. Barcha yuborishlar `MessengerService` orqali o'tadi.

1. **Ro'yxatdan o'tish:** `/start` → Pasport ID → **Tunduk tekshiruvi** → kontakt ulashish (faqat o'z raqami) → F.I.Sh → rol (Talaba/Ustoz) → `PENDING` → adminlarga xabar `[✅ Tasdiqlash] [❌ Rad etish]`.
2. **08:00 tasdiq (cron, Asia/Bishkek):** `isContinuous=true` va bugungi `weekDay` darslar uchun ustozga:
   > **Bugun Payshanba darsingiz bo'ladimi? 56-bet Halol va harom** `[✅ Ha, bo'ladi] [❌ Yo'q]`
   * **Ha** → yozilgan talabalarga: «✅ Bugun dars bor: 56-bet …»
   * **Yo'q** → **majburiy** sabab so'raladi (boshqa tugmalar bloklanadi) → talabalarga: «❌ Bugun dars bekor qilindi. Sabab: …»
3. **Eslatma 2 soat 30 daqiqa oldin:** BullMQ kechiktirilgan vazifa + har 5 daqiqada zaxira cron. Matnda bet va mavzu bor. «Shomdan keyin» kabi vaqtlar **Osh namoz vaqtlari** bo'yicha avtomatik hisoblanadi.
4. **Davomat:** `/davomat` — talaba nomini bosib ✅ → ❌ → ⏰ → 📝; «Saqlash» → kitob bo'yicha keyingi darsga o'tish taklifi (73-betdan…).
5. **Baholar**, **Yangiliklar**, **Profil**, **Hayriya** (`[Hisobotlarni ko'rish]`), admin uchun **Arizalar** va `/admin` (bir martalik kirish havolasi).

## 📱 Mini App

* Bosh sahifa: salomlashuv, Osh namoz vaqtlari, bugungi darslar, fan kartalari (Fiqh, Aqida, Arab tili, Qur'on, Hadis), hayriya, yangiliklar.
* Darslar: fan/kun filtrlari, kitob progressi (56–72 / 200 bet), narx 50/100/200/Shaxsiy, MBank/Hayriya belgisi, Davomiy ✓.
* Dars sahifasi: **Audio — Wavesurfer.js** to'lqin shakli, **Video — Plyr**, **PDF to'ri**; pullik materiallar to'lov tasdiqlangach ochiladi (imzolangan stream havolalari).
* **To'lov:** MBank raqami + **QR** + **nusxalash** tugmasi + **chek yuklash** → `PENDING` → admin (yoki MBank to'lovida ustoz) `CONFIRMED` qiladi.
* **Hayriya jamg'armasi:** «Sizning hissangiz 3 270 som», «Umumiy jamg'arma 16 370 som», limit progressi, hisobot videolari.
* **Ustoz paneli:** dars yaratish/tahrirlash (to'lov turi, narx), «Ha/Yo'q», davomat, baholar, kontent yuklash, Telegram va MBank raqamlarini o'zi tahrirlash, manzillar (2GIS/Yandex/Google).

## 🛠 Admin panel

Boshqaruv paneli · arizalarni tasdiqlash · ustozlar · fanlar · darslar (davomat va baholar bilan) · to'lovlarni tasdiqlash (chek ko'rish) · Hayriya jamg'armasi (limit, ustozlar hissasi, **DonationReport** video-hisobotlari) · yangiliklar (rasm bilan, **hammaga push**) · 08:00 tasdiqni qo'lda ishga tushirish.

Kirish: botda `/admin` → bir martalik havola (10 daqiqa) yoki admin panelni Telegram WebApp sifatida ochish.

---

## 💰 To'lov mantiqi

| Tur | Pul qayerga tushadi | Kim tasdiqlaydi | Natija |
|---|---|---|---|
| `MBANK_SELF` | Ustozning `mbankNumber` | Admin yoki ustozning o'zi | Shu oy uchun materiallar ochiladi |
| `HAYRIYA` | `HAYRIYA_MBANK_NUMBER` | Admin | `Donation` CONFIRMED → `DonationFund.personalTotal += amount` |

`GlobalTotal = sum(personalTotal)`. Qoldiq = GlobalTotal − tarqatilgan (hisobotlar). Qoldiq limitga yetganda adminlarga xabar boradi; admin mablag'ni tarqatib **DonationReport** (video + tavsif + summa) joylaydi, ustozlarga bildirishnoma ketadi.

## 🌱 Seed (namunaviy ma'lumotlar)

`npm run db:seed` — idempotent (qayta ishga tushirish mumkin):

* **Sardor domla** — Fiqh, **Payshanba**, **Shomdan keyin — 22:00 gacha**, «Muxtasar al-Quduriy» **200 bet**, bugun **56–72-bet «Halol va harom»**, **Davomiy ✓**, narx **100 som**, MBank.
* Boshqa darslar: Aqida (50, Hayriya), Arab tili (200, MBank), Qur'on (Shaxsiy 150, Hayriya), Hadis (bepul).
* Hayriya: Sardor domla hissasi **3 270 som**, umumiy jamg'arma **16 370 som**, bitta hisobot.
* Talabalar, to'lovlar (tasdiqlangan va kutilayotgan), ariza, yangiliklar, Audio/Video/PDF kontent.
* `ADMIN_IDS` dagi foydalanuvchilar admin sifatida yaratiladi.

## 🧱 Loyiha tuzilishi

```
prisma/            schema.prisma, migrations/, seed.ts
backend/src/
  bot/             grammY, toza chat (MessengerService), ro'yxatdan o'tish, menyu
  tunduk/          TundukService (mock / TUNDUK_API_URL)
  lessons/         darslar, sessiyalar (tasdiq, bekor, eslatma), davomat, baholar
  scheduler/       @Cron 08:00 va eslatma zaxirasi (Asia/Bishkek)
  queue/           BullMQ: xabarlar, eslatmalar, yangilik push (25 xabar/s)
  payments/ fund/  MBank va Hayriya, jamg'arma, hisobotlar
  news/ content/   yangiliklar, media stream
  admin/           admin API
miniapp/src/       Telegram Mini App
admin/src/         Admin panel
shared/            logo.svg, tailwind-preset, UI komponentlar
```

## 🚀 Hostingga chiqarish

1. PostgreSQL va Redis (masalan Supabase + Upstash yoki `docker compose --profile full up -d --build`).
2. Backend: `npm run build -w backend` → `npm run start:prod -w backend` (migratsiyalarni ham qo'llaydi) yoki `backend/Dockerfile`.
3. `BOT_WEBHOOK_URL=https://<api-domen>/api/bot/webhook` qo'ying (yoki bo'sh qoldirib long-polling).
4. Mini App va Admin: `npm run build -w miniapp`, `npm run build -w admin` → `dist/` ni istalgan statik hostingga (Vercel, Netlify, Nginx). SPA uchun barcha yo'llarni `index.html` ga yo'naltiring.
5. @BotFather → Bot Settings → **Menu Button / Web App** ga `MINIAPP_URL` (https) ni kiriting.

---

Alloh ilmimizni manfaatli qilsin! 🤲
