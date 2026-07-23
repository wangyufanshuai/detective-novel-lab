import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadEngineForTool(namespace) {
  const root = process.cwd();
  const sourceDir = path.join(root, "packages", "engine", "src");
  const runtimeDir = path.join(root, "outputs", "tool-runtime", namespace);

  async function collectTsFiles(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return collectTsFiles(fullPath);
      return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
    }));
    return nested.flat();
  }

  await fs.rm(runtimeDir, { recursive: true, force: true });
  const files = await collectTsFiles(sourceDir);
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
    }).outputText;
    const relative = path.relative(sourceDir, file).replace(/\.ts$/, ".cjs");
    const target = path.join(runtimeDir, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, compiled.replace(/require\("(\.{1,2}\/.+?)"\)/g, 'require("$1.cjs")'), "utf8");
  }
  return import(`${pathToFileURL(path.join(runtimeDir, "index.cjs")).href}?tool=${encodeURIComponent(namespace)}-${Date.now()}`);
}
