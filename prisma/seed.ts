/**
 * Начальные данные (идемпотентно — можно запускать повторно).
 *
 * Главный пример:
 *   Sardor domla, Fiqh, Payshanba, «Shomdan keyin» — «22:00 gacha»,
 *   bugun 56–72-bet «Halol va harom», Davomiy ✓, kitob 200 bet, narx 100 som,
 *   Hayriya jamg'armasi: Sardor domla hissasi 3 270 som, umumiy 16 370 som.
 *
 * Запуск: npm run db:seed
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const TZ = 'Asia/Bishkek';
function currentPeriod(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const y = p.find((x) => x.type === 'year')!.value;
  const m = p.find((x) => x.type === 'month')!.value;
  return `${y}-${m}`;
}

const SUBJECTS = [
  { name: 'Fiqh', slug: 'fiqh', icon: 'scale', color: '#0E7A5A', sortOrder: 1, description: 'Islom huquqi: ibodat, muomala, halol va harom' },
  { name: 'Aqida', slug: 'aqida', icon: 'sparkles', color: '#C4A15A', sortOrder: 2, description: 'Iymon asoslari va e\'tiqod' },
  { name: 'Arab tili', slug: 'arab-tili', icon: 'languages', color: '#2F6F8F', sortOrder: 3, description: 'Sarf, nahv va so\'zlashuv' },
  { name: "Qur'on", slug: 'quron', icon: 'book-open', color: '#0B5E46', sortOrder: 4, description: 'Tajvid, qiroat va yodlash' },
  { name: 'Hadis', slug: 'hadis', icon: 'scroll', color: '#8A6A2F', sortOrder: 5, description: 'Hadis ilmi va sharhlar' },
];

// Демо-учителя и студенты (Telegram ID — условные; замените на реальные через админ-панель)
const TEACHERS = [
  { telegramId: 100000010n, fullName: 'Sardor domla', phone: '+996555100010', mbank: '+996555100010', fund: 3270, subjects: ['fiqh', 'hadis'] },
  { telegramId: 100000011n, fullName: 'Abdulloh domla', phone: '+996555100011', mbank: '+996700100011', fund: 5100, subjects: ['aqida'] },
  { telegramId: 100000012n, fullName: 'Muhammad Yusuf domla', phone: '+996555100012', mbank: '+996770100012', fund: 8000, subjects: ['arab-tili', 'quron'] },
];
const STUDENTS = [
  { telegramId: 100000101n, fullName: 'Karimov Azizbek', phone: '+996550000101', passportId: 'ID1234567' },
  { telegramId: 100000102n, fullName: 'Toshpo\'latov Bilol', phone: '+996550000102', passportId: 'ID7654321' },
  { telegramId: 100000103n, fullName: 'Ergashev Umar', phone: '+996550000103', passportId: 'AN1122334' },
];

async function main() {
  console.log('🌱 Seed boshlandi...');

  // ---------- Предметы ----------
  const subjects: Record<string, number> = {};
  for (const s of SUBJECTS) {
    const row = await prisma.subject.upsert({ where: { slug: s.slug }, update: s, create: s });
    subjects[s.slug] = row.id;
  }

  // ---------- Админы из ADMIN_IDS ----------
  const adminIds = (process.env.ADMIN_IDS || process.env.ADMIN_TELEGRAM_IDS || '')
    .split(/[,\s;]+/)
    .filter((x) => /^\d+$/.test(x));
  for (const id of adminIds) {
    await prisma.user.upsert({
      where: { telegramId: BigInt(id) },
      update: { status: 'APPROVED', regStep: 'DONE' },
      create: { telegramId: BigInt(id), fullName: 'Admin', role: 'ADMIN', status: 'APPROVED', regStep: 'DONE', approvedAt: new Date() },
    });
  }

  // SEED_DEMO=false — только предметы, админы и настройки (без демо-учителей и студентов)
  if (process.env.SEED_DEMO === 'false') {
    await prisma.appSetting.upsert({
      where: { key: 'DONATION_LIMIT' },
      update: {},
      create: { key: 'DONATION_LIMIT', value: process.env.DONATION_LIMIT || '20000' },
    });
    console.log('✅ Seed tayyor (demo ma\'lumotlarsiz): fanlar va adminlar');
    return;
  }

  // ---------- Очистка прежних демо-данных ----------
  const demoIds = [...TEACHERS, ...STUDENTS].map((u) => u.telegramId).concat(100000104n);
  await prisma.user.deleteMany({ where: { telegramId: { in: demoIds } } });
  await prisma.news.deleteMany({ where: { title: { startsWith: '[Demo]' } } });
  await prisma.donationReport.deleteMany({ where: { description: { startsWith: '[Demo]' } } });

  // ---------- Учителя ----------
  const teachers: Record<string, { id: number; userId: number }> = {};
  for (const t of TEACHERS) {
    const user = await prisma.user.create({
      data: {
        telegramId: t.telegramId,
        fullName: t.fullName,
        phone: t.phone,
        role: 'TEACHER',
        status: 'APPROVED',
        regStep: 'DONE',
        approvedAt: new Date(),
        teacher: {
          create: {
            telegramPhone: t.phone,
            mbankNumber: t.mbank,
            bio: `${t.fullName} — Abdurahmon ibn Avf madrasasi ustozi.`,
            subjects: { connect: t.subjects.map((slug) => ({ id: subjects[slug] })) },
            donationFund: { create: { personalTotal: 0 } },
          },
        },
      },
      include: { teacher: true },
    });
    teachers[t.fullName] = { id: user.teacher!.id, userId: user.id };
  }
  const sardor = teachers['Sardor domla'];
  const abdulloh = teachers['Abdulloh domla'];
  const muhammad = teachers['Muhammad Yusuf domla'];

  // ---------- Локации ----------
  const masjid = await prisma.teacherLocation.create({
    data: {
      teacherId: sardor.id,
      title: 'Abdurahmon ibn Avf masjidi',
      address: 'Osh shahri, madrasa binosi, 2-qavat',
      map_url: 'https://2gis.kg/osh/search/Abdurahmon%20ibn%20Avf',
      lat: 40.5283,
      lng: 72.7985,
      provider: 'TWOGIS',
    },
  });
  const abdullohLoc = await prisma.teacherLocation.create({
    data: {
      teacherId: abdulloh.id,
      title: 'Madrasa o\'quv zali',
      address: 'Osh shahri, madrasa binosi, 1-qavat',
      map_url: 'https://yandex.ru/maps/?text=Osh%20Abdurahmon%20ibn%20Avf&ll=72.7985%2C40.5283&z=16',
      lat: 40.5283,
      lng: 72.7985,
      provider: 'YANDEX',
    },
  });
  const muhammadLoc = await prisma.teacherLocation.create({
    data: {
      teacherId: muhammad.id,
      title: 'Til markazi',
      address: 'Osh shahri, Lenin ko\'chasi',
      map_url: 'https://www.google.com/maps/search/?api=1&query=40.5283,72.7985',
      lat: 40.5283,
      lng: 72.7985,
      provider: 'GOOGLE',
    },
  });

  // ---------- Уроки ----------
  // ГЛАВНЫЙ ПРИМЕР: Sardor domla, Fiqh, Payshanba, Shomdan keyin — 22:00 gacha, 56-bet Halol va harom
  const fiqh = await prisma.lesson.create({
    data: {
      teacherId: sardor.id,
      subjectId: subjects['fiqh'],
      locationId: masjid.id,
      isContinuous: true,
      weekDay: 4, // Payshanba
      startTime: 'Shomdan keyin',
      endTime: '22:00 gacha',
      bookTitle: 'Muxtasar al-Quduriy',
      bookTotalPages: 200,
      currentPageFrom: 56,
      currentPageTo: 72,
      topic: 'Halol va harom',
      nextTopic: 'Savdo odoblari',
      priceTier: 100,
      paymentType: 'MBANK_SELF',
      isActive: true,
    },
  });

  const otherLessons: Prisma.LessonUncheckedCreateInput[] = [
    {
      teacherId: abdulloh.id, subjectId: subjects['aqida'], locationId: abdullohLoc.id, weekDay: 2,
      startTime: 'Asrdan keyin', endTime: '18:00 gacha', bookTitle: 'Aqidatut-Tahoviya', bookTotalPages: 120,
      currentPageFrom: 14, currentPageTo: 22, topic: 'Iymon arkonlari', nextTopic: 'Farishtalarga iymon',
      priceTier: 50, paymentType: 'HAYRIYA',
    },
    {
      teacherId: muhammad.id, subjectId: subjects['arab-tili'], locationId: muhammadLoc.id, weekDay: 1,
      startTime: '18:30', startClock: '18:30', endTime: '20:00 gacha', bookTitle: 'Al-Arabiyya bayna yadayk, 1-jild', bookTotalPages: 320,
      currentPageFrom: 101, currentPageTo: 110, topic: 'Fe\'lning o\'tgan zamoni', nextTopic: 'Hozirgi-kelasi zamon',
      priceTier: 200, paymentType: 'MBANK_SELF',
    },
    {
      teacherId: muhammad.id, subjectId: subjects['quron'], locationId: muhammadLoc.id, weekDay: 6,
      startTime: 'Bomdoddan keyin', endTime: '08:00 gacha', bookTitle: 'Tajvid qoidalari', bookTotalPages: 90,
      currentPageFrom: 30, currentPageTo: 36, topic: 'Nun sokin va tanvin', nextTopic: 'Mim sokin',
      priceTier: 100, customPrice: 150, paymentType: 'HAYRIYA',
    },
    {
      teacherId: sardor.id, subjectId: subjects['hadis'], locationId: masjid.id, weekDay: 5,
      startTime: 'Juma namozidan keyin', startClock: '14:00', endTime: '15:30 gacha', bookTitle: 'Arbain an-Navaviy', bookTotalPages: 80,
      currentPageFrom: 9, currentPageTo: 12, topic: 'Niyat haqidagi hadis', nextTopic: 'Jabroil hadisi',
      priceTier: 0, paymentType: 'HAYRIYA',
    },
  ];
  const created = [];
  for (const l of otherLessons) created.push(await prisma.lesson.create({ data: { isContinuous: true, ...l } }));
  const aqida = created[0];

  // ---------- Контент (Wavesurfer / Plyr / PDF) ----------
  await prisma.lessonContent.createMany({
    data: [
      { lessonId: fiqh.id, type: 'AUDIO', title: 'Fotiha surasi — tilovat (namuna)', url: 'https://server8.mp3quran.net/afs/001.mp3', isFree: true, durationSec: 49 },
      { lessonId: fiqh.id, type: 'AUDIO', title: '56–72-bet: Halol va harom (dars yozuvi)', url: '/uploads/samples/dars-namuna.mp3', isFree: false, durationSec: 24 },
      { lessonId: fiqh.id, type: 'VIDEO', title: 'Darsga kirish (namuna video)', url: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4', isFree: true, durationSec: 33 },
      { lessonId: fiqh.id, type: 'VIDEO', title: 'Halol va harom — to\'liq dars', url: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-720p.mp4', isFree: false, durationSec: 33 },
      { lessonId: fiqh.id, type: 'PDF', title: 'Konspekt: Halol va harom (56–72-bet)', url: '/uploads/samples/halol-va-harom.pdf', isFree: true, pageCount: 2 },
      { lessonId: fiqh.id, type: 'PDF', title: 'Muxtasar al-Quduriy — 1-qism', url: '/uploads/samples/halol-va-harom.pdf', isFree: false, pageCount: 2 },
      { lessonId: aqida.id, type: 'PDF', title: 'Aqida asoslari', url: '/uploads/samples/aqida-asoslari.pdf', isFree: true, pageCount: 1 },
      { lessonId: aqida.id, type: 'AUDIO', title: 'Iymon arkonlari — dars', url: '/uploads/samples/dars-namuna.mp3', isFree: true },
    ],
  });

  // ---------- Студенты ----------
  const students = [];
  for (const s of STUDENTS) {
    students.push(
      await prisma.user.create({
        data: { ...s, role: 'STUDENT', status: 'APPROVED', regStep: 'DONE', approvedAt: new Date() },
      }),
    );
  }
  // Ожидающая заявка — для демонстрации подтверждения в админ-панели
  await prisma.user.create({
    data: {
      telegramId: 100000104n, fullName: 'Yangi Talaba', phone: '+996550000104', passportId: 'ID5556667',
      role: 'STUDENT', status: 'PENDING', regStep: 'DONE',
    },
  });

  for (const st of students) {
    await prisma.enrollment.create({ data: { lessonId: fiqh.id, studentId: st.id } });
    await prisma.enrollment.create({ data: { lessonId: aqida.id, studentId: st.id } });
  }

  const period = currentPeriod();
  // Подтверждённая оплата MBank (Azizbek) и ожидающая (Bilol)
  await prisma.payment.create({
    data: { studentId: students[0].id, teacherId: sardor.id, lessonId: fiqh.id, amount: 100, paymentType: 'MBANK_SELF', status: 'CONFIRMED', period, confirmedAt: new Date() },
  });
  await prisma.payment.create({
    data: { studentId: students[1].id, teacherId: sardor.id, lessonId: fiqh.id, amount: 100, paymentType: 'MBANK_SELF', status: 'PENDING', period },
  });

  // ---------- Hayriya jamg'armasi: 3270 + 5100 + 8000 = 16370 ----------
  const donationPlan: Array<[number, number[]]> = [
    [sardor.id, [1000, 1270, 1000]], // = 3270
    [abdulloh.id, [2000, 1600, 1500]], // = 5100
    [muhammad.id, [5000, 3000]], // = 8000
  ];
  for (const [teacherId, amounts] of donationPlan) {
    let total = 0;
    for (const [i, amount] of amounts.entries()) {
      const student = students[i % students.length];
      const payment = await prisma.payment.create({
        data: { studentId: student.id, teacherId, amount, paymentType: 'HAYRIYA', status: 'CONFIRMED', period, confirmedAt: new Date() },
      });
      await prisma.donation.create({
        data: { teacherId, studentId: student.id, amount, status: 'CONFIRMED', paymentType: 'HAYRIYA', paymentId: payment.id, confirmedAt: new Date() },
      });
      total += amount;
    }
    await prisma.donationFund.update({ where: { teacherId }, data: { personalTotal: total } });
  }
  // Ожидающее пожертвование — для подтверждения в админке
  const pendingPay = await prisma.payment.create({
    data: { studentId: students[2].id, teacherId: abdulloh.id, lessonId: aqida.id, amount: 50, paymentType: 'HAYRIYA', status: 'PENDING', period },
  });
  await prisma.donation.create({
    data: { teacherId: abdulloh.id, studentId: students[2].id, amount: 50, status: 'PENDING', paymentId: pendingPay.id },
  });

  await prisma.donationReport.create({
    data: {
      video_url: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4',
      description: '[Demo] Ramazon oyida 12 ta muhtoj oilaga oziq-ovqat to\'plamlari tarqatildi.',
      spentAmount: 12000,
    },
  });

  await prisma.appSetting.upsert({
    where: { key: 'DONATION_LIMIT' },
    update: {},
    create: { key: 'DONATION_LIMIT', value: process.env.DONATION_LIMIT || '20000' },
  });

  // ---------- Новости ----------
  await prisma.news.createMany({
    data: [
      { title: '[Demo] Mavlid kechasi', body: 'Juma kuni Xufton namozidan so\'ng madrasada Mavlid kechasi bo\'lib o\'tadi. Barcha talabalar va ota-onalar taklif qilinadi.', type: 'TADBIR' },
      { title: '[Demo] Futbol turniri: Madrasa kubogi', body: 'Shanba kuni soat 16:00 da madrasa stadionida talabalar o\'rtasida futbol turniri. Jamoalar ro\'yxatini ustozlarga topshiring!', type: 'SPORT_FUTBOL' },
      { title: '[Demo] Yangi o\'quv yili qabuli', body: 'Fiqh, Aqida, Arab tili, Qur\'on va Hadis darslariga qabul davom etmoqda. Ro\'yxatdan o\'tish — bot orqali.', type: 'ELON' },
    ],
  });

  const global = await prisma.donationFund.aggregate({ _sum: { personalTotal: true } });
  console.log('✅ Seed tayyor:');
  console.log(`   Sardor domla — Fiqh, Payshanba, Shomdan keyin – 22:00 gacha, 56–72-bet «Halol va harom», 200 bet, 100 som`);
  console.log(`   Hayriya: Sardor domla hissasi 3270 som, umumiy jamg'arma ${global._sum.personalTotal} som`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
