import { prisma } from "../prisma";

function getArg(name: string): string | undefined {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : undefined;
}

function normalizeOrigin(origin: string): string {
  // trim + remove trailing slash
  return origin.trim().replace(/\/+$/, "");
}

async function main(): Promise<void> {
  const projectKey = getArg("project") ?? process.env.DEFAULT_PROJECT_KEY ?? "leleka-dev";
  const originRaw = getArg("origin");

  if (!originRaw) {
    console.error(
      "Usage: npm run project:add-origin -- --project=leleka-dev --origin=http://localhost:5500"
    );
    process.exitCode = 2;
    return;
  }

  const origin = normalizeOrigin(originRaw);

  const project = await prisma.project.findUnique({ where: { publicKey: projectKey } });
  if (!project) {
    console.error(`Project not found: publicKey=${projectKey}`);
    process.exitCode = 2;
    return;
  }

  const current = Array.isArray(project.allowedOrigins) ? project.allowedOrigins : [];
  const next = Array.from(new Set([...current, origin])).sort();

  if (next.length === current.length && next.every((v, i) => v === current[i])) {
    console.log(JSON.stringify({ ok: true, changed: false, projectKey, origin, allowedOrigins: next }, null, 2));
    return;
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { allowedOrigins: next },
  });

  console.log(JSON.stringify({ ok: true, changed: true, projectKey, origin, allowedOrigins: next }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
