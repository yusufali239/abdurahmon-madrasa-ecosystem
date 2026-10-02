/**
 * Проверка настроек перед запуском: npm run check
 * Читает корневой .env (переменные окружения имеют приоритет) и проверяет подключения.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m, fix) => {
  console.log(`  ❌ ${m}${fix ? `\n     → ${fix}` : ''}`);
  process.exitCode = 1;
};
const warn = (m) => console.log(`  ⚠️  ${m}`);
const env = (k) => (process.env[k] || '').trim();

async function main() {
  console.log('\nПроверка настроек Abdurahmon ibn Avf madrasasi\n');

  // --- BOT_TOKEN ---
  console.log('Telegram бот:');
  const token = env('BOT_TOKEN');
  if (!token) bad('BOT_TOKEN пустой', 'возьмите токен у @BotFather');
  else if (!/^\d+:[\w-]{30,}$/.test(token)) bad('BOT_TOKEN выглядит неправильно', 'формат: 123456789:AAH...');
  else {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      if (j.ok) ok(`бот найден: @${j.result.username}`);
      else bad(`Telegram отклонил токен: ${j.description}`, 'проверьте токен в @BotFather');
    } catch (e) {
      warn(`нет связи с api.telegram.org (${e.message}) — проверьте сеть`);
    }
  }
  const admins = env('ADMIN_IDS') || env('ADMIN_TELEGRAM_IDS');
  if (!admins) bad('ADMIN_IDS пустой', 'узнайте свой Telegram ID у @userinfobot и впишите его');
  else if (!admins.split(/[,\s;]+/).every((x) => /^\d+$/.test(x))) bad('ADMIN_IDS должен содержать только числа через запятую');
  else ok(`админы: ${admins.split(/[,\s;]+/).length} шт.`);

  // --- База данных ---
  console.log('\nБаза данных (PostgreSQL):');
  const db = env('DATABASE_URL');
  if (!db) bad('DATABASE_URL пустой');
  else if (/\[.*\]/.test(db)) bad('в DATABASE_URL остался шаблон пароля вида [YOUR-PASSWORD]', 'замените его на настоящий пароль базы (без квадратных скобок)');
  else {
    if (/db\.[a-z0-9]+\.supabase\.co/.test(db)) warn('прямой адрес Supabase (db.xxx.supabase.co) работает только по IPv6 — на хостинге используйте «Session pooler» (…pooler.supabase.com)');
    const prisma = new PrismaClient();
    try {
      await prisma.$queryRaw`SELECT 1`;
      ok('подключение есть');
      try {
        const n = await prisma.subject.count();
        ok(n ? `таблицы созданы, предметов: ${n}` : 'таблицы созданы, данных пока нет (seed выполнится при первом запуске)');
      } catch {
        warn('таблиц ещё нет — они создадутся при запуске (prisma migrate deploy)');
      }
    } catch (e) {
      bad(`не удалось подключиться: ${String(e.message).split('\n').filter(Boolean).pop()}`, 'проверьте адрес, пароль и что база доступна');
    } finally {
      await prisma.$disconnect();
    }
  }

  // --- Redis ---
  console.log('\nRedis:');
  let redisUrl = env('REDIS_URL');
  if (!redisUrl) bad('REDIS_URL пустой');
  else {
    if (/redis-cli/.test(redisUrl)) warn('в REDIS_URL вставлена вся команда "redis-cli ..." — нужен только адрес rediss://... (программа исправит сама, но лучше поправить)');
    const tls = /--tls\b/.test(redisUrl);
    redisUrl = (redisUrl.match(/rediss?:\/\/\S+/) || [redisUrl])[0];
    if (tls) redisUrl = redisUrl.replace(/^redis:\/\//, 'rediss://');
    const r = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 8000, retryStrategy: () => null });
    r.on('error', () => undefined);
    try {
      await r.connect();
      ok(`подключение есть (${await r.ping()})`);
      const policy = await r.config('GET', 'maxmemory-policy').catch(() => null);
      if (policy && policy[1] && policy[1] !== 'noeviction') warn(`maxmemory-policy=${policy[1]} — для очередей BullMQ лучше noeviction`);
    } catch (e) {
      bad(`не удалось подключиться: ${e.message}`);
    } finally {
      r.disconnect();
    }
  }

  // --- Адреса и оплата ---
  console.log('\nАдреса и оплата:');
  for (const k of ['MINIAPP_URL', 'ADMIN_URL']) {
    const v = env(k);
    if (!v) warn(`${k} пустой — кнопки Mini App/админки в боте не появятся`);
    else if (/localhost|127\.0\.0\.1/.test(v) || /^http:\/\//.test(v)) warn(`${k}=${v} — Telegram принимает только https-адреса (для локальной разработки это нормально)`);
    else ok(`${k} = ${v}`);
  }
  if (!env('HAYRIYA_MBANK_NUMBER')) bad('HAYRIYA_MBANK_NUMBER пустой', 'впишите номер MBank фонда');
  else ok('номер MBank фонда задан');
  if (!env('JWT_SECRET') || env('JWT_SECRET').startsWith('change-me')) warn('JWT_SECRET стандартный — на хостинге задайте случайную длинную строку');
  if (!env('TUNDUK_API_URL')) warn('TUNDUK_API_URL пустой — проверка паспорта работает в тестовом режиме (MOCK)');

  console.log(process.exitCode ? '\n❌ Есть ошибки — исправьте пункты выше.\n' : '\n✅ Всё готово к запуску.\n');
}
main();
