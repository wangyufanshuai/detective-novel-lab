import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { startReleaseCandidateServer } from "./lib/release-candidate-server.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(repo, "outputs", "first-case-study");
const manifestPath = path.join(output, "frozen-build.json");
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** Reject an existing listener before the shared HTTP health check can mistake it for this run. */
export async function assertFirstCaseStudyPortAvailable(port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error(`无效的首案测试端口：${port}。请使用 1024–65535。`);
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") reject(new Error(`首案测试端口 127.0.0.1:${port} 已被占用，未启动新场次。请先在上一次测试的终端输入 stop，确认服务已停止后重试；不要把已有页面当作新数据库。现有进程未被终止。`));
      else reject(new Error(`无法核验首案测试端口 127.0.0.1:${port}，未启动新场次：${error.code || error.message}`));
    });
    probe.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      probe.close((error) => error ? reject(error) : resolve());
    });
  });
}
function sourceHash() {
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: repo, maxBuffer: 10 * 1024 * 1024 }).toString("utf8").split("\0")
    .filter((name) => /^(app\/|lib\/|packages\/|content\/|world-packs\/|public\/|docs\/first-case-comprehension-protocol\.md$)/.test(name) || ["package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "scripts/start-first-case-study.mjs"].includes(name));
  const digest = createHash("sha256");
  for (const name of [...new Set(files)].sort()) {
    const file = path.join(repo, name);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) digest.update(name).update("\0").update(fs.readFileSync(file)).update("\0");
  }
  return digest.digest("hex");
}
async function main() {
  process.chdir(repo);
  const portArg = process.argv.find((arg) => arg.startsWith("--port="));
  const port = Number(portArg?.slice(7) || 23630);
  const freeze = process.argv.includes("--freeze");
  if (process.argv.some((arg, i) => i > 1 && arg !== "--freeze" && !/^--port=\d+$/.test(arg))) throw new Error("支持的参数：--freeze、--port=23630。");
  // Check before any build or manifest write, including --freeze.
  await assertFirstCaseStudyPortAvailable(port);
  fs.mkdirSync(output, { recursive: true });
  if (freeze) {
    const before = sourceHash();
    console.log("构建并冻结首案测试版本。已有真人批次开始后不要重新冻结；先结束该轮研究。");
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["scripts/next-cli.mjs", "build", "--webpack"], { cwd: repo, stdio: "inherit", windowsHide: true });
      child.once("error", reject); child.once("exit", resolve);
    });
    if (code !== 0) throw new Error("构建未通过，未冻结或启动测试服务。");
    const after = sourceHash();
    if (before !== after) throw new Error("构建期间源文件发生变化，请结束编辑后重新冻结。");
    fs.writeFileSync(manifestPath, JSON.stringify({ schema: "detective.first-case-build.v1", buildId: fs.readFileSync(path.join(repo, ".next", "BUILD_ID"), "utf8").trim(), sourceSha256: after, buildManifestSha256: hash(fs.readFileSync(path.join(repo, ".next", "build-manifest.json"))), caseLabel: "印刷低语", campaign: "midnight-chorus", route: "baseline", aiProvider: "mock", protocol: "first-case-observer-20260906-v1", frozenAt: new Date().toISOString() }, null, 2));
  }
  if (!fs.existsSync(manifestPath)) throw new Error("没有冻结版本。首次请运行 npm run study:first-case -- --freeze。");
  const frozen = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const buildId = fs.readFileSync(path.join(repo, ".next", "BUILD_ID"), "utf8").trim();
  if (frozen.buildId !== buildId || frozen.sourceSha256 !== sourceHash() || frozen.buildManifestSha256 !== hash(fs.readFileSync(path.join(repo, ".next", "build-manifest.json")))) throw new Error("当前源码或构建与冻结版不一致。请不要混用研究数据；结束编辑后另开一轮并重新 --freeze。");
  let server;
  // A freeze can take minutes. Recheck immediately before starting the server.
  await assertFirstCaseStudyPortAvailable(port);
  try {
    server = await startReleaseCandidateServer({ prefix: "first-case-study", port, env: { FIRST_CASE_STUDY_BUILD_ID: buildId }, healthPath: "/study/first-case?lang=zh-CN" });
    const session = { buildId, moderatorUrl: `${server.baseUrl}/study/first-case?lang=zh-CN`, gameUrl: `${server.baseUrl}/?runtime=server&lang=zh-CN`, databaseIsolated: true, aiProvider: "mock", pid: server.child.pid, startedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(output, "current-session.json"), JSON.stringify(session, null, 2));
    console.log(JSON.stringify(session, null, 2));
    console.log("参与者只看游戏页；主持在另一窗口打开主持台。选择午夜合唱默认路线，确认印刷低语、等待加入、0/7证据。不要点继续旧存档。");
    console.log("每人结束后先导出匿名JSON，再输入 stop 停止。下次重新运行会使用新的干净数据库；同端口主持记录保存在本浏览器。不要并行开两个主持台。");
    const input = createInterface({ input: process.stdin, output: process.stdout });
    await new Promise((resolve) => {
      const stop = () => { input.close(); resolve(); };
      input.on("line", (line) => { if (line.trim().toLowerCase() === "stop") stop(); });
      input.once("close", resolve);
      process.once("SIGINT", stop); process.once("SIGTERM", stop);
    });
  } finally {
    if (server) {
      await server.cleanup();
      console.log("首案测试服务已停止，其临时游戏数据库已清理；浏览器主持记录保持原样。");
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
