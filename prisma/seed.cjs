/* eslint-disable no-console */
const dotenv = require("dotenv");
dotenv.config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const defaultProjectKey = process.env.DEFAULT_PROJECT_KEY || "leleka-dev";

  const project = await prisma.project.upsert({
    where: { publicKey: defaultProjectKey },
    update: {
      // keep existing settings
    },
    create: {
      name: "Leleka (dev)",
      publicKey: defaultProjectKey,
      allowedOrigins: [
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      localeDefault: "ru",
      disclaimerTemplate:
        "Информация носит справочный характер и не заменяет консультацию врача.",
      systemPrompt:
        "Ты справочный ассистент по беременности. Не ставь диагнозы и не назначай лечение. Всегда напоминай обратиться к врачу при тревожных симптомах.",
    },
    select: { id: true, publicKey: true, allowedOrigins: true },
  });

  console.log("Seed complete:", project);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
