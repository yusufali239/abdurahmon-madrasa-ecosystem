-- Анонимная хайрия: платёж и пожертвование могут быть без учителя
ALTER TABLE "Payment" ALTER COLUMN "teacherId" DROP NOT NULL;
ALTER TABLE "Donation" ALTER COLUMN "teacherId" DROP NOT NULL;
