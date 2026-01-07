import type { Request, Response } from "express";
import fs from "fs";
import path from "path";

type Pkg = { name?: string; version?: string };

function readPkg(): Pkg {
  // dist/controllers -> dist -> project root
  const pkgPath = path.join(__dirname, "..", "..", "package.json");
  try {
    const raw = fs.readFileSync(pkgPath, "utf-8");
    return JSON.parse(raw) as Pkg;
  } catch {
    return {};
  }
}

export function versionController(_req: Request, res: Response) {
  const pkg = readPkg();
  res.json({
    name: pkg.name ?? "leleka-ai-assistant-service",
    version: pkg.version ?? "unknown",
    ts: new Date().toISOString(),
  });
}
