/* eslint-disable no-console */
const dotenv = require("dotenv");
dotenv.config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function buildDefaultSystemPrompt() {
  return [
    "Ты справочный ассистент по беременности.",
    "Главное: отвечай на вопрос пользователя по сути (без общих вступлений).",
    "Формат ответа:",
    "1) Короткий вывод (Да/Нет/Зависит) в 1–2 предложениях.",
    "2) 3–6 пунктов объяснения (риски/ограничения/альтернативы).",
    "3) Если вопрос про симптомы — отдельно перечисли 'красные флаги', когда нужно срочно обратиться к врачу/в скорую.",
    "Ограничения:",
    "- Не ставь диагнозы.",
    "- Не назначай лекарства и дозировки.",
    "- Не отменяй назначения врача.",
    "- При сомнениях предлагай обратиться к врачу.",
  ].join("\n");
}

async function main() {
  const defaultProjectKey = process.env.DEFAULT_PROJECT_KEY || "leleka-dev";

  const defaultCreate = {
    name: "Leleka (dev)",
    publicKey: defaultProjectKey,
    // IMPORTANT: widget is embedded into external pages.
    // Add common local dev origins (Live Server / npx serve / Vite / Next).
    allowedOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
    localeDefault: "ru",
    disclaimerTemplate: "Информация носит справочный характер и не заменяет консультацию врача.",
    systemPrompt: buildDefaultSystemPrompt(),
  };

  const project = await prisma.project.upsert({
    where: { publicKey: defaultProjectKey },
    update: {
      // PR-05: make seed deterministic — update defaults on every run.
      allowedOrigins: defaultCreate.allowedOrigins,
      localeDefault: defaultCreate.localeDefault,
      disclaimerTemplate: defaultCreate.disclaimerTemplate,
      systemPrompt: defaultCreate.systemPrompt,
      name: defaultCreate.name,
    },
    create: defaultCreate,
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
