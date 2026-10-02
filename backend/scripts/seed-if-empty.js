/**
 * Запускается при старте на хостинге (start:prod): если база пустая (нет предметов),
 * заполняет её начальными данными из prisma/seed.ts. Отключить: SEED_ON_EMPTY=false.
 */
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('child_process');
const path = require('path');

(async () => {
  if (process.env.SEED_ON_EMPTY === 'false') return;
  const prisma = new PrismaClient();
  try {
    const subjects = await prisma.subject.count();
    if (subjects > 0) {
      console.log(`[seed] Baza to'ldirilgan (${subjects} ta fan) — seed o'tkazib yuborildi`);
      return;
    }
    console.log('[seed] Baza bo\'sh — boshlang\'ich ma\'lumotlar yuklanmoqda...');
    const root = path.join(__dirname, '..', '..');
    const res = spawnSync('npx', ['tsx', 'prisma/seed.ts'], { cwd: root, stdio: 'inherit', env: process.env });
    if (res.status !== 0) console.error('[seed] Seed xatosi (server baribir ishga tushadi)');
  } catch (e) {
    console.error(`[seed] Tekshirib bo'lmadi: ${e.message}`);
  } finally {
    await prisma.$disconnect();
  }
})();
