import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prisma";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProjectKey() {
  return process.env.KB_PROJECT_KEY || process.env.PROJECT_KEY || "leleka-dev";
}

async function main() {
  const projectKey = getProjectKey();
  const project = await prisma.project.findUnique({ where: { publicKey: projectKey }, select: { id: true, publicKey: true } });
  if (!project) {
    throw new Error(`Project not found for key: ${projectKey}`);
  }

  const deletedChunks = await prisma.knowledgeChunk.deleteMany({ where: { projectId: project.id } });
  const deletedSources = await prisma.knowledgeSource.deleteMany({ where: { projectId: project.id } });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, projectKey: project.publicKey, deletedSources: deletedSources.count, deletedChunks: deletedChunks.count }, null, 2));
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
