import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { hashPublicArtifactTree } from "./public-artifact-safety-lib.mjs";
import {
  V10_PROTECTED_PUBLIC_HASH,
  V10_PROTECTED_PUBLIC_PATHS,
  assertInside,
  gitOutput,
  parseLastJson,
  runCommand,
  sanitizeDiagnostic
} from "./lib/v10-release.mjs";

const sourceRoot = gitOutput(process.cwd(), ["rev-parse", "--show-toplevel"]);
const snapshotArg = process.argv.find((value) => value.startsWith("--snapshot="));
const snapshot = snapshotArg ? snapshotArg.slice("--snapshot=".length) : "HEAD";
const snapshotCommit = gitOutput(sourceRoot, ["rev-parse", `${snapshot}^{commit}`]);
const sourcePublic = hashPublicArtifactTree({ root: sourceRoot, paths: V10_PROTECTED_PUBLIC_PATHS });
if (sourcePublic.treeHash !== V10_PROTECTED_PUBLIC_HASH) throw new Error("Source protected public snapshot does not match the frozen v10 hash.");

const worktreeParent = path.join(path.dirname(sourceRoot), ".v10-worktrees");
fs.mkdirSync(worktreeParent, { recursive: true });
const worktreeRoot = path.join(worktreeParent, `clean-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
if (!path.resolve(worktreeRoot).startsWith(`${path.resolve(worktreeParent)}${path.sep}`)) throw new Error("Temporary worktree path escaped its dedicated parent.");
const destinationEvidence = path.join(sourceRoot, "outputs", "v10-distribution");
let worktreeAdded = false;
let childResult = null;

try {
  execFileSync("git", ["worktree", "add", "--detach", worktreeRoot, snapshotCommit], { cwd: sourceRoot, stdio: ["ignore", "pipe", "pipe"] });
  worktreeAdded = true;
  for (const relativePath of V10_PROTECTED_PUBLIC_PATHS) {
    const source = path.join(sourceRoot, relativePath);
    const target = path.join(worktreeRoot, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true, errorOnExist: true });
  }
  const copiedPublic = hashPublicArtifactTree({ root: worktreeRoot, paths: V10_PROTECTED_PUBLIC_PATHS });
  if (copiedPublic.treeHash !== V10_PROTECTED_PUBLIC_HASH) throw new Error("Copied public snapshot changed during clean-worktree provisioning.");

  childResult = await runCommand(process.execPath, ["scripts/run-v10-clean-environment.mjs"], {
    cwd: worktreeRoot,
    timeoutMs: 7_200_000,
    forwardStderr: true,
    env: { ...process.env, AI_PROVIDER: "mock", DEEPSEEK_API_KEY: "", SILICONFLOW_API_KEY: "" }
  });
  if (!childResult.ok) throw new Error(`Clean environment gate failed. ${sanitizeDiagnostic(`${childResult.stdout}\n${childResult.stderr}`, [sourceRoot, worktreeRoot, os.tmpdir()])}`);
  const parsed = parseLastJson(childResult.stdout);
  if (!parsed?.ok) throw new Error("Clean environment gate did not return a passing report.");

  const sourceEvidence = path.join(worktreeRoot, "outputs", "v10-distribution");
  const destinationRoot = path.join(sourceRoot, "outputs");
  fs.mkdirSync(destinationRoot, { recursive: true });
  const safeDestination = assertInside(destinationRoot, destinationEvidence, "copied v10 evidence");
  fs.rmSync(safeDestination, { recursive: true, force: true });
  fs.cpSync(sourceEvidence, safeDestination, { recursive: true, force: true });
  console.log(JSON.stringify({ ok: true, releaseLine: "v10.0", sourceTree: parsed.sourceTree, protectedPublicTreeHash: copiedPublic.treeHash, qualityRcRuns: parsed.reproducibility?.qualityRcRuns, docker: parsed.docker, evidenceCopied: true }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, releaseLine: "v10.0", error: sanitizeDiagnostic(error instanceof Error ? error.message : String(error), [sourceRoot, worktreeRoot, os.tmpdir()]) }));
  process.exitCode = 1;
} finally {
  if (worktreeAdded) {
    try { execFileSync("git", ["worktree", "remove", "--force", worktreeRoot], { cwd: sourceRoot, stdio: "ignore" }); } catch {}
  }
  try {
    if (fs.existsSync(worktreeRoot)) fs.rmSync(worktreeRoot, { recursive: true, force: true });
    if (fs.existsSync(worktreeParent) && fs.readdirSync(worktreeParent).length === 0) fs.rmdirSync(worktreeParent);
  } catch {}
}
