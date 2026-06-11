import { DetectiveTownClient } from "../sdk/detective-town-client.mjs";

const client = new DetectiveTownClient();

const imported = await client.importNovel({
  title: "Correction Bot Example",
  rawText: "Chapter 1 Archive\nLin saw a brass key in the archive. Mei denied entering the archive, but a witness placed her there after dusk."
});

const projectId = imported.project.id;
const audit = await client.getNovelAudit(projectId);
console.log("Trust score:", audit.auditReport.trustScore, "issues:", audit.auditReport.issues.length);

const suggested = await client.suggestCorrections({ projectId });
console.log("Suggested patches:", suggested.suggestedPatches.length);
