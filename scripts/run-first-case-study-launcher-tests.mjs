import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertFirstCaseStudyPortAvailable } from "./start-first-case-study.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
const launcher = fileURLToPath(new URL("./start-first-case-study.mjs", import.meta.url));
const evidence = [];
const readIfPresent = (name) => {
  const file = new URL(`../outputs/first-case-study/${name}`, import.meta.url);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
};
const listen = (server, port = 0) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port, exclusive: true }, () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

async function launch(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [launcher, ...args], { cwd: repo, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, output }));
  });
}

for (const port of [-1, 0, 1023, 65536, 23630.5, NaN]) {
  await assert.rejects(assertFirstCaseStudyPortAvailable(port), /无效的首案测试端口/);
}
evidence.push("invalid ports fail before opening a listener");

let healthRequests = 0;
const existing = http.createServer((request, response) => {
  healthRequests += 1;
  response.writeHead(200); response.end("existing session, not a fresh database");
});
const occupiedPort = await listen(existing);
const frozenBefore = readIfPresent("frozen-build.json");
const sessionBefore = readIfPresent("current-session.json");
try {
  await assert.rejects(assertFirstCaseStudyPortAvailable(occupiedPort), /已被占用/);
  // --freeze must also refuse before building or replacing the current manifest.
  for (const args of [[`--port=${occupiedPort}`], [`--port=${occupiedPort}`, "--freeze"]]) {
    const result = await launch(args);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /已被占用，未启动新场次/);
    assert.doesNotMatch(result.output, /"databaseIsolated"\s*:\s*true|构建并冻结首案测试版本/);
  }
  assert.equal(healthRequests, 0, "An existing HTTP 200 must never be accepted as the new process's readiness.");
  assert.equal(readIfPresent("frozen-build.json"), frozenBefore);
  assert.equal(readIfPresent("current-session.json"), sessionBefore);
  assert.equal(existing.listening, true, "Refusal must not stop the existing service.");
  evidence.push("occupied HTTP listener rejects normal and freeze launches without HTTP health acceptance or changing manifests");
} finally {
  await close(existing);
}

await assertFirstCaseStudyPortAvailable(occupiedPort);
const successor = http.createServer();
try {
  assert.equal(await listen(successor, occupiedPort), occupiedPort);
  evidence.push("free-port preflight succeeds and releases its listener for the actual server");
} finally {
  await close(successor);
}

// Optional read-only check against a running study owned by the operator.
const existingPortArgument = process.argv.find((argument) => argument.startsWith("--existing-port="));
if (existingPortArgument) {
  const existingPort = Number(existingPortArgument.split("=")[1]);
  await assert.rejects(assertFirstCaseStudyPortAvailable(existingPort), /已被占用/);
  const result = await launch([`--port=${existingPort}`]);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /已被占用，未启动新场次/);
  assert.equal(readIfPresent("current-session.json"), sessionBefore);
  evidence.push(`running study at ${existingPort} rejects a duplicate launch without replacing its session record`);
}

console.log(JSON.stringify({ ok: true, checks: evidence.length, evidence, note: "Only temporary HTTP fixtures and read-only duplicate-launch checks; no game build or study service started." }, null, 2));
