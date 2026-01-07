-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "localeDefault" TEXT NOT NULL DEFAULT 'ru',
    "disclaimerTemplate" TEXT NOT NULL DEFAULT 'Информация носит справочный характер и не заменяет консультацию врача.',
    "systemPrompt" TEXT NOT NULL DEFAULT 'Ты справочный ассистент по беременности. Не ставь диагнозы и не назначай лечение.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_publicKey_key" ON "Project"("publicKey");
