/**
 * Симуляция бота без Telegram: подменяем Bot API и прогоняем сценарии.
 * Запуск (после npm run build и npm run db:seed):  node scripts/simulate-bot.js
 * Требуется локальная БД и Redis. ВНИМАНИЕ: сценарий создаёт тестового пользователя 555000555.
 */
process.env.BOT_TOKEN = '123456:SIMULATION';
process.env.ADMIN_IDS = '999000999';
process.env.BOT_WEBHOOK_URL = '';
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { BotService } = require('../dist/bot/bot.service');
const { SessionsService } = require('../dist/lessons/sessions.service');
const { PrismaService } = require('../dist/prisma/prisma.service');

const calls = [];
let msgId = 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeApi(prev, method, payload) {
  calls.push({ method, payload });
  switch (method) {
    case 'getMe':
      return { ok: true, result: { id: 1, is_bot: true, first_name: 'Madrasa', username: 'sim_bot', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false } };
    case 'getUpdates':
      return sleep(500).then(() => ({ ok: true, result: [] }));
    case 'sendMessage':
    case 'sendPhoto':
      return { ok: true, result: { message_id: ++msgId, date: 0, chat: { id: Number(payload.chat_id), type: 'private' }, text: payload.text } };
    default:
      return { ok: true, result: true };
  }
}

let updateId = 1;
const from = (id, name = 'Test') => ({ id, is_bot: false, first_name: name });
const text = (id, t) => ({ update_id: updateId++, message: { message_id: updateId, date: 0, chat: { id, type: 'private' }, from: from(id), text: t, ...(t.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: t.split(' ')[0].length }] } : {}) } });
const contact = (id, phone, owner = id) => ({ update_id: updateId++, message: { message_id: updateId, date: 0, chat: { id, type: 'private' }, from: from(id), contact: { phone_number: phone, first_name: 'T', user_id: owner } } });
const cb = (id, data) => ({ update_id: updateId++, callback_query: { id: String(updateId), from: from(id), chat_instance: 'x', data, message: { message_id: 1, date: 0, chat: { id, type: 'private' }, text: 'x' } } });

function lastSent(chatId) {
  const sent = calls.filter((c) => (c.method === 'sendMessage' || c.method === 'sendPhoto') && String(c.payload.chat_id) === String(chatId));
  const last = sent[sent.length - 1];
  return last ? (last.payload.text || last.payload.caption) : '(hech narsa)';
}
function check(cond, label) {
  console.log(`${cond ? '✅' : '❌'} ${label}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const botService = app.get(BotService);
  botService.bot.api.config.use(fakeApi);
  await app.init();
  const bot = botService.bot;
  const prisma = app.get(PrismaService);
  const sessions = app.get(SessionsService);

  const U = 555000555;
  await prisma.user.deleteMany({ where: { telegramId: BigInt(U) } });

  await bot.handleUpdate(text(U, '/start'));
  check(/1\/4/.test(lastSent(U)), 'start -> pasport so\'raldi');
  await bot.handleUpdate(text(U, 'ID1230000'));
  check(/tasdiqlanmadi/.test(lastSent(U)), 'Tunduk mock: "0000" -> yaroqsiz');
  await bot.handleUpdate(text(U, 'id 1234 589'));
  check(/2\/4/.test(lastSent(U)), 'pasport tasdiqlandi -> kontakt so\'raldi');
  await bot.handleUpdate(contact(U, '996555123456', 42));
  check(/o'zingizning/.test(lastSent(U)), 'begona kontakt rad etildi');
  await bot.handleUpdate(contact(U, '996555123456'));
  check(/3\/4/.test(lastSent(U)), 'kontakt qabul -> F.I.Sh so\'raldi');
  await bot.handleUpdate(text(U, 'aliyev vali'));
  check(/4\/4/.test(lastSent(U)), 'F.I.Sh -> rol so\'raldi');
  await bot.handleUpdate(cb(U, 'reg:role:STUDENT'));
  check(/Arizangiz qabul qilindi/.test(lastSent(U)), 'ariza PENDING');
  check(/Yangi ariza/.test(lastSent(999000999)), 'adminga xabar ketdi');
  const u = await prisma.user.findUnique({ where: { telegramId: BigInt(U) } });
  check(u.fullName === 'Aliyev Vali' && u.phone === '+996555123456' && u.passportId === 'ID1234589', 'foydalanuvchi ma\'lumotlari saqlandi');

  await bot.handleUpdate(cb(999000999, `adm:approve:${u.id}`));
  check(/tasdiqlandi/.test(lastSent(U)), 'admin tasdiqladi -> talabaga bosh menyu');

  // Чистый чат: перед каждым новым сообщением удаляется предыдущее
  const deletes = calls.filter((c) => c.method === 'deleteMessage' && String(c.payload.chat_id) === String(U)).length;
  check(deletes >= 6, `toza chat: ${deletes} ta eski xabar o'chirildi`);

  // ---- 08:00 подтверждение урока ----
  const sardor = await prisma.user.findUnique({ where: { telegramId: 100000010n }, include: { teacher: true } });
  const fiqh = await prisma.lesson.findFirst({ where: { teacherId: sardor.teacher.id, bookTitle: 'Muxtasar al-Quduriy' } });
  const today = sessions.now();
  const origDays = fiqh.weekDays;
  await prisma.lesson.update({ where: { id: fiqh.id }, data: { weekDays: [today.weekDay] } });
  await prisma.lessonSession.deleteMany({ where: { lessonId: fiqh.id } });
  await prisma.enrollment.create({ data: { lessonId: fiqh.id, studentId: u.id } });

  const res = await sessions.runDailyConfirmation();
  check(res.lessons >= 1, `08:00 cron: ${res.lessons} ta dars topildi`);
  check(/darsingiz bo'ladimi\? 56-betdan · Halol va harom/.test(lastSent(100000010)), 'ustozga savol: "Bugun ... darsingiz bo\'ladimi? 56-betdan · Halol va harom"');
  console.log('   ' + lastSent(100000010).split('\n').slice(0, 3).join('\n   '));

  const session = await prisma.lessonSession.findFirst({ where: { lessonId: fiqh.id } });
  await bot.handleUpdate(cb(100000010, `ls:no:${session.id}`));
  check(/sababini yozing/.test(lastSent(100000010)), 'Yo\'q -> sabab so\'raldi');
  await bot.handleUpdate(cb(100000010, 'menu:home'));
  check(/sababini yozing/.test(lastSent(100000010)), 'sabab majburiy: boshqa tugma bloklandi');
  await bot.handleUpdate(text(100000010, 'Betobman'));
  await sleep(1500); // очередь BullMQ
  const s2 = await prisma.lessonSession.findUnique({ where: { id: session.id } });
  check(s2.status === 'CANCELLED' && s2.cancelReason === 'Betobman', 'sessiya bekor qilindi, sabab saqlandi');
  check(/Bugun dars bekor qilindi\.<\/b>\nSabab: Betobman/.test(lastSent(U)), 'talabaga: "Bugun dars bekor qilindi. Sabab: Betobman"');

  // Ha -> студентам «Bugun dars bor 56-bet»
  await prisma.lessonSession.update({ where: { id: session.id }, data: { status: 'SCHEDULED', cancelReason: null } });
  await bot.handleUpdate(cb(100000010, `ls:yes:${session.id}`));
  await sleep(1500);
  check(/Bugun dars bor: 56-bet/.test(lastSent(U)), 'Ha -> talabaga "Bugun dars bor: 56-bet"');

  // Напоминание за 2ч30м
  await prisma.lessonSession.update({ where: { id: session.id }, data: { reminderSentAt: null, startsAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const due = await sessions.sendDueReminders();
  await sleep(1500);
  check(due === 1 && /Eslatma/.test(lastSent(U)) && /56-betdan/.test(lastSent(U)) && /Halol va harom/.test(lastSent(U)), 'eslatma (2s30d oldin) bet va mavzu bilan');

  // Посещаемость
  await bot.handleUpdate(cb(100000010, `att:s:${session.id}`));
  check(/Davomat — Fiqh/.test(lastSent(100000010)), 'davomat ro\'yxati ochildi');
  await bot.handleUpdate(cb(100000010, `att:t:${session.id}:${u.id}`));
  await bot.handleUpdate(cb(100000010, `att:done:${session.id}`));
  const att = await prisma.attendance.findMany({ where: { sessionId: session.id } });
  check(att.length >= 1 && att.find((a) => a.studentId === u.id)?.status === 'PRESENT', 'davomat saqlandi');
  check(/Qaysi betgacha/.test(lastSent(100000010)), 'davomatdan keyin: "Qaysi betgacha o\'qildi?"');
  await bot.handleUpdate(cb(100000010, 'pend:cancel'));

  // ▶ Boshlash -> ⏹ Yakunlash: bet + keyingi mavzu
  await bot.handleUpdate(cb(100000010, `ls:start:${session.id}`));
  check(/Dars boshlandi/.test(lastSent(100000010)) && /56-betdan/.test(lastSent(100000010)), '▶ dars boshlandi (56-betdan)');
  await bot.handleUpdate(cb(100000010, `ls:finish:${session.id}`));
  await bot.handleUpdate(text(100000010, '72'));
  check(/Keyingi darsning mavzusi/.test(lastSent(100000010)), '⏹ bet so\'raldi -> keyingi mavzu so\'raldi');
  await bot.handleUpdate(text(100000010, 'Savdo odoblari'));
  const adv = await prisma.lesson.findUnique({ where: { id: fiqh.id } });
  const done = await prisma.lessonSession.findUnique({ where: { id: session.id } });
  check(done.status === 'DONE' && done.pageFrom === 56 && done.pageTo === 72, `sessiya: ${done.pageFrom}–${done.pageTo}-bet, ${done.status}`);
  check(adv.currentPage === 73 && adv.topic === 'Savdo odoblari', `keyingi dars: ${adv.currentPage}-betdan «${adv.topic}»`);

  // Davom etayotgan kitob: bet noma'lum bo'lsa, boshlashda so'raladi
  await prisma.lesson.update({ where: { id: fiqh.id }, data: { currentPage: null } });
  await prisma.lessonSession.deleteMany({ where: { lessonId: fiqh.id } });
  const s3 = await sessions.ensureSession(fiqh.id, today);
  await bot.handleUpdate(cb(100000010, `ls:start:${s3.id}`));
  check(/qaysi betdan/.test(lastSent(100000010)), 'davom etayotgan kitob: "qaysi betdan?" so\'raldi');
  await bot.handleUpdate(text(100000010, '120'));
  const s3b = await prisma.lessonSession.findUnique({ where: { id: s3.id } });
  check(s3b.status === 'STARTED' && s3b.pageFrom === 120, 'dars 120-betdan boshlandi');

  // Откат демо-данных
  await prisma.lesson.update({ where: { id: fiqh.id }, data: { weekDays: origDays, currentPage: 56, topic: 'Halol va harom' } });
  await prisma.lessonSession.deleteMany({ where: { lessonId: fiqh.id } });
  await prisma.user.deleteMany({ where: { telegramId: BigInt(U) } });
  await app.close();
  process.exit(process.exitCode || 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
