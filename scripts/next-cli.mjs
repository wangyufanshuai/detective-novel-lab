import path from "node:path";
import { spawn } from "node:child_process";

// `.next` is stored on a junction in this workspace. Next resolves the real
// build path before loading route modules, which otherwise makes Node search
// for `next` under the junction target instead of the project checkout.
// Keeping NODE_PATH here makes `npm run build`, `dev`, and `start` reproducible
// without requiring every caller (or CI) to know about that filesystem detail.
const projectNodeModules = path.join(process.cwd(), "node_modules");
const nodePath = [projectNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
const nextBin = path.join(projectNodeModules, "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_PATH: nodePath },
  stdio: "inherit"
});

child.once("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  process.exitCode = typeof code === "number" ? code : signal ? 1 : 0;
});
