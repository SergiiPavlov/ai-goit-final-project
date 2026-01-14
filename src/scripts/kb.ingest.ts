import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../prisma";
import { createKnowledgeSource } from "../services/kb.service";

dotenv.config();

function getProjectKey() {
  return process.env.KB_PROJECT_KEY || process.env.PROJECT_KEY || "leleka-dev";
}

function getLang() {
  return (process.env.KB_LANG || "ru").toLowerCase();
}

function titleFromMarkdown(md: string, fallback: string) {
  const m = md.match(/^#\s+(.+)\s*$/m);
  return (m?.[1] || fallback).trim();
}

function decodeText(buf: Buffer): string {
  // Handle UTF-8/UTF-16 with BOM. This avoids "KB_TEXT_EMPTY" when files are saved in UTF-16.
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf.subarray(2));
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buf.subarray(2));
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buf.subarray(3));
  }
  return new TextDecoder("utf-8").decode(buf);
}

async function readMarkdownFile(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  const text = decodeText(buf);
  return typeof text === "string" ? text : String(text || "");
}

async function main() {
  const projectKey = getProjectKey();
  const lang = getLang();

  const project = await prisma.project.findUnique({
    where: { publicKey: projectKey },
    select: { id: true, publicKey: true },
  });
  if (!project) throw new Error(`Project not found for key: ${projectKey}`);

  const kbPath = path.resolve(process.cwd(), "kb", lang);
  const entries = await fs.readdir(kbPath, { withFileTypes: true });

  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "en"));

  if (!files.length) {
    throw new Error(`No .md files found in ${kbPath}`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    if (!file.toLowerCase().endsWith(".md")) {
      skipped++;
      continue;
    }
    if (file.toLowerCase() === "readme.md") {
      skipped++;
      continue;
    }

    const filePath = path.join(kbPath, file);
    const md = await readMarkdownFile(filePath);
    if (!md || !md.trim()) {
      skipped++;
      // eslint-disable-next-line no-console
      console.warn(`[kb.ingest] skip empty file: ${path.join(lang, file)}`);
      continue;
    }
    const title = titleFromMarkdown(md, path.parse(file).name);

    const existing = await prisma.knowledgeSource.findFirst({
      where: { projectId: project.id, title },
      select: { id: true },
    });

    // Strategy: delete + recreate to guarantee chunk regeneration consistency.
    if (existing) {
      await prisma.knowledgeChunk.deleteMany({ where: { projectId: project.id, sourceId: existing.id } });
      await prisma.knowledgeSource.delete({ where: { id: existing.id } });
    }

    try {
      await createKnowledgeSource({ projectId: project.id, title, url: null, text: md });
      if (existing) updated++;
      else created++;
    } catch (err: any) {
      skipped++;
      // eslint-disable-next-line no-console
      console.warn(`[kb.ingest] failed to ingest ${path.join(lang, file)}: ${err?.message ?? String(err)}`);
      continue;
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, projectKey: project.publicKey, lang, files: files.length, created, updated, skipped }, null, 2));
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
