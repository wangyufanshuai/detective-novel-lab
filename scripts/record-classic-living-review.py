"""Bind the executed classic-living checks without rewriting prior art evidence."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/3d-town/classic-living-v1"


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8-sig"))


def reference(path):
    file = ROOT / path
    return {"path": path, "sha256": sha(file), "bytes": file.stat().st_size}


sources = set()
check_paths = [
    "output/classic-living-v1/checks-tzG4eD/report.json",
    "output/resident-work-v1/checks-qc3BxW/report.json",
    "output/resident-work-v1/http-1791699438300.json",
    "outputs/riverbend-case-SPG3gH/report.json",
]
checks = []
for path in check_paths:
    report = read(path)
    assert report.get("passed") is True or report.get("status") == "passed", path
    for file, expected in report.get("sources", {}).items():
        assert sha(ROOT / file) == expected, f"Source changed after checking: {file}"
        sources.add(file)
    checks.append({**reference(path), "checkCount": len(report["checks"])})


def browser(name, require_pass=True):
    path = f"output/playwright/classic-living-v1-{name}.log"
    raw = (ROOT / path).read_text(encoding="utf-8-sig")
    assert "### Error" not in raw and "### Result" in raw, path
    result = json.JSONDecoder().raw_decode(raw.split("### Result", 1)[1].lstrip())[0]
    if require_pass:
        assert result.get("passed") is True, path
    assert not result.get("errors") and not result.get("browserErrors"), path
    return result, reference(path)


flow, flow_ref = browser("flow")
resume, resume_ref = browser("resume")
noon, noon_ref = browser("noon")
layout, layout_ref = browser("layout")
baseline, baseline_ref = browser("baseline-flow")
performance, performance_ref = browser("performance", False)
assert flow["working"]["world"] == flow["looped"]["world"]
assert flow["restored"]["world"] == flow["restarted"]["world"]
assert not baseline["apiRequests"] and all(baseline["checks"].values())
assert noon["departed"]["world"]["time"] == "12:05"
assert not any(r["visible"] for r in noon["departed"]["residents"])
assert noon["square"]["world"]["time"] == "12:10"
assert performance["world"] == resume["after"]
assert performance["viewport"] == {"width": 1920, "height": 1080}
assert performance["frames"] > 1000
typecheck_path = "output/classic-living-v1/typecheck.json"
assert read(typecheck_path)["exitCode"] == 0
assert not (ROOT / "output/classic-living-v1/typecheck.log").read_text(encoding="utf-8-sig").strip()

art_path = "docs/3d-town/classic-bookshop-v2/final-report.json"
art = read(art_path)
changed_art = [r["path"] for r in art["references"] if sha(ROOT / r["path"]) != r["sha256"]]
assert set(changed_art) == {
    "app/town-play/art-sample/ClassicScene.tsx",
    "app/town-play/art-sample/sample-navigation.ts",
}, f"Unexpected prior art change: {changed_art}"

sources.update([
    "app/api/v1/town-play/_handlers.ts", "app/api/v1/town-play/route.ts",
    "app/api/v1/town-play/living/route.ts", "app/town-play/useTownWorld.ts",
    "app/town-play/living/page.tsx", "app/town-play/living/LivingTown.tsx",
    "app/town-play/living/living.module.css", "app/town-play/art-sample/ClassicScene.tsx",
    "app/town-play/art-sample/ClassicArtSample.tsx", "app/town-play/art-sample/classic-art.module.css",
    "docs/3d-town/classic-living-v1/README.zh-CN.md", "scripts/record-classic-living-review.py",
])

qa_names = ["flow", "resume", "performance", "noon", "layout", "baseline-flow"]
screenshots = [
    "working", "interrupted", "station", "inn", "empty-bookshop", "noon-square",
    "narrow-note", "narrow-journal", "baseline-final-held", "baseline-final-returned",
    "baseline-final-bookshop-play", "baseline-final-bookshop-portrait",
]
qa_files = [f"output/playwright/classic-living-v1-{name}.js" for name in qa_names]
image_files = [f"output/playwright/classic-living-v1-{name}.png" for name in screenshots]
failure_files = [
    "output/playwright/classic-living-v1-before-door-fix.log",
    "output/playwright/classic-living-v1-before-tour-path-fix.log",
    "output/playwright/classic-living-v1-before-steering-fix.log",
    "output/playwright/classic-living-v1-return.log",
    "output/playwright/classic-living-v1-return.js",
]
asset_files = [
    "docs/3d-town/classic-bookshop-v2/classic-bookshop.blend",
    "public/assets/classic-bookshop/v2/classic-street.glb",
    "public/assets/classic-bookshop/v2/manifest.json",
    "public/assets/classic-bookshop/v2/cast.json",
    "public/assets/classic-bookshop/v2/navigation.json",
]
report = {
    "schema": "classic-living-delivery.v1", "createdAt": datetime.now(timezone.utc).isoformat(),
    "status": "verified-local-world-and-browser-candidate", "goalStatus": "active", "fullGoalComplete": False,
    "preview": "http://127.0.0.1:3187/town-play/living",
    "bindingRevision": "classic-living.v1", "checks": checks,
    "browser": {
        "flow": flow_ref, "workingAfterOrdinaryWait": resume_ref, "noon": noon_ref,
        "narrowLayout": layout_ref, "artBaselineRegression": baseline_ref,
        "interactions": ["actual keyboard travel through all three rooms", "committed work loop without world commands",
                         "greeting interrupts and returns work item", "wait starts a new action", "reload adds no world time",
                         "offscreen bodies and interactions hidden", "actual noon wait and square arrival"],
        "baselineChecks": baseline["checks"], "pageErrors": [],
        "consoleWarning": "Existing THREE.WebGLProgram floating-point precision warning remains.",
        "console": reference(".playwright-cli/console-2026-10-11T06-27-18-200Z.log"),
    },
    "performance": {
        **performance_ref,
        "summary": {k: v for k, v in performance.items() if k not in ("frameMs", "residents")},
    },
    "typecheck": reference(typecheck_path),
    "priorArt": {**reference(art_path), "referenceCount": len(art["references"]),
                 "unchangedReferenceCount": len(art["references"]) - len(changed_art),
                 "changedReferences": changed_art, "historicalReportPreserved": True,
                 "newBlenderRenderPerformed": False, "currentBrowserRegressionPerformed": True},
    "visualReview": {
        "method": "Agent opened actual browser PNGs; no new Blender render or human approval this milestone.",
        "reviewed": ["working", "interrupted", "station", "inn", "empty-bookshop", "noon-square",
                     "narrow-note", "narrow-journal", "baseline-final-held"],
        "observations": ["book and hands visible during work; book on stand after interruption",
                         "workbench remains in empty shop", "resident visible on street after noon arrival",
                         "narrow notebook and toolbar remain within viewport"],
        "knownLimits": ["station and inn still use idle bodies while work status is displayed",
                        "fixed destination poses, no continuous NPC commute animation",
                        "stiff expressions and limited posture changes remain", "existing lampshade highlight noise remains"],
    },
    "boundaries": {"liveModelVerified": False, "fullAgentPolicy": False, "allThreeOccupationalClips": False,
                   "continuousNpcCommute": False, "investigationCaseBound": False, "humanApproved": False,
                   "windowsRelease": False, "coldLoadMeasured": False, "longDurationMeasured": False,
                   "physicalMobileDeviceMeasured": False, "novelBridgeComplete": False},
    "failureHistory": {"references": [reference(p) for p in failure_files],
                       "explanation": "Fixed held-key loss at arrival. Corrected QA steering around physical steps. Return-to-shop test assumed active work at a legal idle boundary; actual wait then started work and passed. Failed logs are not passing evidence."},
    "references": [reference(p) for p in sorted(set(qa_files + image_files + asset_files))],
    "sources": {file: sha(ROOT / file) for file in sorted(sources)},
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": report["status"], "checks": [c["checkCount"] for c in checks],
                  "sourceCount": len(sources), "browserResults": 6,
                  "p95Ms": performance["p95Ms"], "changedPriorArtReferences": changed_art}, ensure_ascii=False))
