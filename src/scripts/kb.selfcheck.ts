import dotenv from "dotenv";
import { prisma } from "../prisma";
import { retrieveKnowledgeCitations } from "../services/kb.service";

dotenv.config();

function getProjectKey() {
  return process.env.KB_PROJECT_KEY || process.env.PROJECT_KEY || "leleka-dev";
}

function getQuery() {
  return process.env.KB_QUERY || "Курение при беременности";
}

async function main() {
  const projectKey = getProjectKey();
  const query = getQuery();

  const project = await prisma.project.findUnique({
    where: { publicKey: projectKey },
    select: { id: true, publicKey: true },
  });
  if (!project) throw new Error(`Project not found for key: ${projectKey}`);

  const { citations, debug } = await retrieveKnowledgeCitations({
    projectId: project.id,
    query,
    limit: 4,
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: citations.length > 0,
        projectKey: project.publicKey,
        query,
        sourcesFound: citations.length,
        debug,
      },
      null,
      2
    )
  );

  if (!citations.length) {
    throw new Error("KB_SELF_CHECK_FAILED");
  }
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
