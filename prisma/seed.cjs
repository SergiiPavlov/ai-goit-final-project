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

  
// --- PR-08: KB seed (RU) + scaffolding for UA/EN
// By default it seeds RU KB unless SEED_KB=0
const seedKbEnabled = process.env.SEED_KB !== "0";
if (seedKbEnabled) {
  const fs = require("fs");
  const path = require("path");

  const kbLang = (process.env.KB_LANG || "ru").toLowerCase();
  const kbDir = path.resolve(__dirname, "..", "kb", kbLang);

  function titleFromMarkdown(md, fallback) {
    const m = md.match(/^#\s+(.+)\s*$/m);
    return (m?.[1] || fallback).trim();
  }

  function splitIntoChunks(text, maxLen = 1200, overlap = 120) {
    const normalized = String(text || "").replace(/\r\n/g, "\n");
    const parts = normalized.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    const chunks = [];
    let buf = "";

    const flush = () => {
      const s = buf.trim();
      if (!s) return;
      if (s.length <= maxLen) {
        chunks.push(s);
        buf = "";
        return;
      }
      // hard split if needed
      let i = 0;
      while (i < s.length) {
        const end = Math.min(i + maxLen, s.length);
        chunks.push(s.slice(i, end));
        i = end - overlap;
        if (i < 0) i = 0;
        if (i >= s.length) break;
      }
      buf = "";
    };

    for (const p of parts) {
      if ((buf + "\n\n" + p).length > maxLen) flush();
      buf = buf ? buf + "\n\n" + p : p;
    }
    flush();

    return chunks;
  }

  let kbSeeded = 0;
  if (fs.existsSync(kbDir)) {
    const files = fs.readdirSync(kbDir).filter((f) => f.toLowerCase().endsWith(".md")).sort();
    for (const file of files) {
      const filePath = path.join(kbDir, file);
      const md = fs.readFileSync(filePath, "utf8");
      const title = titleFromMarkdown(md, path.parse(file).name);

      const existing = await prisma.knowledgeSource.findFirst({
        where: { projectId: project.id, title },
        select: { id: true },
      });
      if (existing) continue;

      const source = await prisma.knowledgeSource.create({
        data: {
          projectId: project.id,
          title,
          url: null,
          text: md,
        },
        select: { id: true },
      });

      const chunks = splitIntoChunks(md);
      if (chunks.length) {
        await prisma.knowledgeChunk.createMany({
          data: chunks.map((content, ord) => ({
            projectId: project.id,
            sourceId: source.id,
            ord,
            content,
          })),
        });
      }

      kbSeeded++;
    }
  }

  console.log(`KB seeded: ${kbSeeded} sources (lang=${kbLang})`);
}

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
