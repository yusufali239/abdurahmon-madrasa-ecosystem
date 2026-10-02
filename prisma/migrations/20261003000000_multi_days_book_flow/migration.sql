-- Несколько дней недели, новый учёт страниц (старт/финиш урока), оплата за день, ссылка MBank.
-- Данные сохраняются: weekDay -> weekDays, currentPageFrom -> currentPage.

ALTER TYPE "SessionStatus" ADD VALUE 'STARTED' BEFORE 'CANCELLED';

ALTER TABLE "Teacher" ADD COLUMN "mbankLink" TEXT;

ALTER TABLE "Lesson" ADD COLUMN "weekDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
UPDATE "Lesson" SET "weekDays" = ARRAY["weekDay"];
ALTER TABLE "Lesson" ALTER COLUMN "weekDays" DROP DEFAULT;

ALTER TABLE "Lesson" ADD COLUMN "isNewBook" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Lesson" ADD COLUMN "currentPage" INTEGER;
UPDATE "Lesson" SET "currentPage" = "currentPageFrom", "isNewBook" = ("currentPageFrom" <= 1);
ALTER TABLE "Lesson" ALTER COLUMN "topic" DROP NOT NULL;

DROP INDEX IF EXISTS "Lesson_weekDay_isActive_idx";
ALTER TABLE "Lesson" DROP COLUMN "weekDay",
  DROP COLUMN "currentPageFrom",
  DROP COLUMN "currentPageTo",
  DROP COLUMN "nextTopic";
CREATE INDEX "Lesson_isActive_idx" ON "Lesson"("isActive");

ALTER TABLE "LessonSession" ALTER COLUMN "pageFrom" DROP NOT NULL,
  ALTER COLUMN "pageTo" DROP NOT NULL,
  ALTER COLUMN "topic" DROP NOT NULL,
  ADD COLUMN "startedAt" TIMESTAMP(3);
