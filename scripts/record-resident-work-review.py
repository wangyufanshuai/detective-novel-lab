"""Bind only executed local work checks; keep art and model claims separate."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/3d-town/resident-work-v1"

def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def load_report(path):
    report = json.loads(path.read_text(encoding="utf-8"))
    assert report.get("passed") is True or report.get("status") == "passed", path
    for file, expected in report.get("sources", {}).items():
        assert sha(ROOT / file) == expected, f"Source changed after checking: {file}"
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path), "checks": len(report.get("checks", []))}

work_reports = sorted((ROOT / "output/resident-work-v1").glob("checks-*/report.json"), key=lambda p: p.stat().st_mtime)
http_reports = sorted((ROOT / "output/resident-work-v1").glob("http-*.json"), key=lambda p: p.stat().st_mtime)
reports = [
    load_report(work_reports[-1]), load_report(http_reports[-1]),
    load_report(ROOT / "docs/3d-town/riverbend-v1/daily-routine-review.json"),
    load_report(ROOT / "docs/3d-town/riverbend-v1/exploration-engine-review.json"),
    load_report(ROOT / "docs/3d-town/riverbend-v1/case-review.json"),
]
art_path = ROOT / "docs/3d-town/classic-bookshop-v2/final-report.json"
art = json.loads(art_path.read_text(encoding="utf-8"))
changed_art_references = []
for ref in art["references"]:
    if sha(ROOT / ref["path"]) != ref["sha256"]:
        changed_art_references.append(ref["path"])

files = set()
for ref in reports:
    files.update(json.loads((ROOT / ref["path"]).read_text(encoding="utf-8")).get("sources", {}))
files.update(["docs/3d-town/resident-work-v1/README.zh-CN.md", "scripts/record-resident-work-review.py"])
report = {
    "schema": "resident-work-delivery.v1", "createdAt": datetime.now(timezone.utc).isoformat(),
    "status": "verified-local-engine-and-http-candidate", "goalStatus": "active", "fullGoalComplete": False,
    "checks": {"realEngine": True, "isolatedSqlite": True, "controlledModelTransport": True, "durableModelBudgetAndRecovery": True, "realHttp": True, "legacyCommuteAndFirstCase": True, "typecheck": True},
    "boundaries": {"liveModelVerified": False, "blenderAnimationBound": False, "actualBrowserInteractionThisMilestone": False, "humanApproved": False, "windowsRelease": False, "fullAgentPolicy": False},
    "typecheckEvidence": {"command": "node node_modules/typescript/bin/tsc --noEmit --pretty false", "exitCode": 0, "source": "Executed shell tool result in this implementation turn; not a browser or model test."},
    "reports": reports,
    "priorArt": {"path": art_path.relative_to(ROOT).as_posix(), "sha256": sha(art_path), "referenceCount": len(art["references"]), "changedReferences": changed_art_references, "reinspectionPerformed": False},
    "sources": {file: sha(ROOT / file) for file in sorted(files)},
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": report["status"], "reportGroups": len(reports), "checks": [r["checks"] for r in reports], "unchangedArtReferences": len(art["references"]) - len(changed_art_references), "changedArtReferences": changed_art_references, "sourceCount": len(files)}, ensure_ascii=False))
