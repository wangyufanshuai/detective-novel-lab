import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

/** Load real TS/TSX production modules for CPU-only React rendering.
 * Only CSS module class names are substituted; application logic is unchanged.
 */
export function createNoirTestLoader(root = process.cwd()) {
  const nativeRequire = createRequire(import.meta.url);
  const cache = new Map();
  function resolveFile(candidate) {
    for (const file of [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, path.join(candidate, "index.ts")]) if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    throw new Error(`Cannot resolve test module: ${candidate}`);
  }
  function load(relativePath) {
    const absolute = resolveFile(path.isAbsolute(relativePath) ? relativePath : path.join(root, relativePath));
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const output = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    const requireForFile = (request) => {
      if (request.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) };
      if (request.startsWith("@/")) return load(request.slice(2));
      if (request.startsWith(".")) return load(path.resolve(path.dirname(absolute), request));
      return nativeRequire(request);
    };
    vm.runInThisContext(`(function(require,module,exports) {\n${output}\n})`, { filename: absolute })(requireForFile, module, module.exports);
    return module.exports;
  }
  return { load };
}
