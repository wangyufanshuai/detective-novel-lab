"use client";

import { AlertTriangle, Database, Map as MapIcon, Play } from "lucide-react";
import DeductionGraphView from "@/app/components/DeductionGraphView";
import { actorInitial } from "@/app/lib/client-runtime";
import { caseGalleryStorageKey, type AuthoringController, type AuthoringTab } from "@/app/controllers/useAuthoringController";
import type { CaseGalleryEntry, CaseTemplateId, WorldMapActor, WorldMapMarker } from "@/lib/engine";

export function CaseAuthoringWorkbench({ controller, onPlay, onWorldGraph }: {
  controller: AuthoringController;
  onPlay: () => void;
  onWorldGraph: () => void;
}) {
  const {
    authoringDraft,
    authoringTab,
    setAuthoringTab,
    authoringCharacterId,
    setAuthoringCharacterId,
    authoringEvidenceId,
    setAuthoringEvidenceId,
    authoringSceneId,
    setAuthoringSceneId,
    authoringTimelineId,
    setAuthoringTimelineId,
    authoringImportText,
    setAuthoringImportText,
    authoringExportText,
    authoringStatus,
    caseGalleryEntries,
    contentSeedHistory,
    contentSeedPreviewed,
    authoringReport,
    builtInGalleryEntries,
    authoringCase,
    authoringCharacter,
    authoringEvidence,
    authoringScene,
    authoringTimelineEvent,
    contentAuthoringGuide,
    pendingSafeDiff,
    appliedSafeDiff,
    authoringChecklist,
    authoringProofAudit,
    authoringBlocker,
    authoringWorkflowCoach,
    authoringMapSnapshot,
    caseTemplates,
    caseTemplateId,
    safeDiffGroups,
    detectiveContentSummary,
    detectiveContentPack,
    patchAuthoring,
    updateContentSelection,
    toggleContentRole,
    toggleContentEvidenceType,
    previewContentSeed,
    applyContentSeed,
    undoLatestContentSeed,
    focusAuthoringIssue,
    runAuthoringCoachNextAction,
    authoringEvidenceReferences,
    loadPremiumTemplate,
    saveAuthoringToGallery,
    loadGalleryEntry,
    runGalleryEntry,
    deleteGalleryEntry,
    exportGalleryEntry,
    deleteAuthoringEvidence,
    importAuthoringJson,
    exportAuthoring,
    exportGalleryBundle,
    runAuthoringDraft
  } = controller;

  const authoringActorsByTile = new Map<string, WorldMapActor[]>();
  for (const actor of authoringMapSnapshot.actors) {
    const key = `${actor.x}:${actor.y}`;
    authoringActorsByTile.set(key, [...(authoringActorsByTile.get(key) || []), actor]);
  }
  const authoringMarkersByTile = new Map<string, WorldMapMarker[]>();
  for (const marker of authoringMapSnapshot.markers) {
    const key = `${marker.x}:${marker.y}`;
    authoringMarkersByTile.set(key, [...(authoringMarkersByTile.get(key) || []), marker]);
  }
  const allGalleryEntries = [...builtInGalleryEntries, ...caseGalleryEntries];
  const formatGalleryTime = (value: string) => {
    const time = new Date(value);
    return Number.isNaN(time.getTime()) ? value : time.toLocaleString();
  };
  const renderGalleryCard = (entry: CaseGalleryEntry, readonly: boolean) => (
    <article key={entry.id} className={`caseGalleryCard ${entry.validation.valid ? "pass" : "fail"}`} data-testid="case-gallery-card">
      <div className="caseGalleryCardTop">
        <div>
          <p>{entry.source === "built-in" ? "Built-in template" : entry.source === "imported" ? "Imported draft" : "Local draft"}</p>
          <h3>{entry.title}</h3>
        </div>
        <span className={entry.validation.valid ? "runtimePill pass" : "runtimePill fail"}>{entry.validation.valid ? "Runnable" : "Blocked"}</span>
      </div>
      <div className="caseGalleryMeta">
        <span><strong>{entry.validation.evidenceCount}</strong><small>Evidence</small></span>
        <span><strong>{entry.validation.characterCount}</strong><small>Characters</small></span>
        <span><strong>{entry.validation.hardLogicValid ? "Pass" : "Fail"}</strong><small>Hard logic</small></span>
        <span><strong>{formatGalleryTime(entry.updatedAt)}</strong><small>Updated</small></span>
      </div>
      {!entry.validation.valid && entry.validation.errorCount > 0 && (
        <p className="caseGalleryIssue">{entry.validation.errorCount} validation errors must be fixed before this draft can run.</p>
      )}
      <div className="caseGalleryActions">
        <button type="button" onClick={() => loadGalleryEntry(entry)}>Load into Authoring</button>
        <button type="button" onClick={() => runGalleryEntry(entry)} disabled={!entry.validation.valid}>Run Draft</button>
        <button type="button" onClick={() => exportGalleryEntry(entry)}>Export JSON</button>
        {!readonly && <button type="button" className="dangerButton" data-testid="delete-gallery-entry" onClick={() => deleteGalleryEntry(entry.id)}>Delete</button>}
      </div>
    </article>
  );

  return (
    <main className="authoringShell" data-testid="authoring-workbench">
      <aside className="authoringRail">
        <div className="brandBlock">
          <div className="brandIcon"><MapIcon size={24} /></div>
          <div>
            <p>Detective Town</p>
            <h1>Case Authoring</h1>
          </div>
        </div>
        <div className="modeSwitch">
          <button onClick={() => onPlay()}>Play</button>
          <button className="active">Authoring</button>
          <button onClick={() => onWorldGraph()}>Living World Lab</button>
        </div>
        <div className="authoringTabs">
          {[
            ["case", "Case"],
            ["content", "Content"],
            ["characters", "Characters"],
            ["evidence", "Evidence"],
            ["scenes", "Scenes"],
            ["timeline", "Timeline"],
            ["logic", "Logic"],
            ["gallery", "Gallery"]
          ].map(([value, label]) => (
            <button key={value} className={authoringTab === value ? "active" : ""} onClick={() => setAuthoringTab(value as AuthoringTab)}>{label}</button>
          ))}
        </div>

        {authoringTab === "case" && (
          <section className="authoringPanel">
            <h2>Case Basics</h2>
            <label>Case title
              <input data-testid="authoring-title" value={authoringCase.title} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.title", event.target.value)} />
            </label>
            <label>Public case file
              <textarea value={authoringCase.publicCaseFile} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.publicCaseFile", event.target.value)} />
            </label>
            <label>Theme
              <input value={authoringCase.theme} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.theme", event.target.value)} />
            </label>
            <label>Premise
              <textarea value={authoringCase.premise} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.premise", event.target.value)} />
            </label>
          </section>
        )}

        {authoringTab === "content" && (
          <section className="authoringPanel contentGuidePanel" data-testid="content-authoring-guide">
            <div className="contentGuideHeader">
              <div>
                <p>Browser-local template guide</p>
                <h2>Content-Guided Case Authoring</h2>
              </div>
              <span className="runtimePill">localStorage only</span>
            </div>
            <p className="caseGalleryNote">Uses read-only <code>content/detective-v1</code> tables to seed safe public-facing draft text. It does not write repo JSON, call `/api/*`, change ids, or edit playable proof structure.</p>
            <div className="contentGuideMetricGrid" data-testid="authored-content-expansion">
              <span><strong>{detectiveContentSummary.caseTypeCount}</strong><small>Case types</small></span>
              <span><strong>{detectiveContentSummary.eventArchetypeCount}</strong><small>Events</small></span>
              <span><strong>{detectiveContentSummary.progressionLineCount}</strong><small>Growth lines</small></span>
              <span><strong>{detectiveContentSummary.authored.clusterCount}</strong><small>Authored clusters</small></span>
            </div>
            <label>Case type
              <select aria-label="Content case type" value={contentAuthoringGuide.selection.caseTypeId} onChange={(event) => updateContentSelection({ caseTypeId: event.target.value })}>
                {[...detectiveContentPack.caseTypes].sort((left, right) => (right.weight - left.weight) || left.id.localeCompare(right.id)).map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / weight {row.weight}</option>
                ))}
              </select>
            </label>
            <label>Location
              <select aria-label="Content location" value={contentAuthoringGuide.selection.locationId} onChange={(event) => updateContentSelection({ locationId: event.target.value })}>
                {contentAuthoringGuide.compatible.locations.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / {row.kind}</option>
                ))}
              </select>
            </label>
            <label>Motive
              <select aria-label="Content motive" value={contentAuthoringGuide.selection.motiveId} onChange={(event) => updateContentSelection({ motiveId: event.target.value })}>
                {contentAuthoringGuide.compatible.motives.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / {row.category}</option>
                ))}
              </select>
            </label>
            <label>Red herring pattern
              <select aria-label="Content red herring pattern" value={contentAuthoringGuide.selection.redHerringPatternId} onChange={(event) => updateContentSelection({ redHerringPatternId: event.target.value })}>
                {contentAuthoringGuide.compatible.redHerringPatterns.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / risk {row.risk}</option>
                ))}
              </select>
            </label>
            <label>Resource
              <select aria-label="Content resource" value={contentAuthoringGuide.selection.resourceId} onChange={(event) => updateContentSelection({ resourceId: event.target.value })}>
                {contentAuthoringGuide.compatible.resources.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / pressure {row.pressure}</option>
                ))}
              </select>
            </label>
            <label>Faction
              <select aria-label="Content faction" value={contentAuthoringGuide.selection.factionId} onChange={(event) => updateContentSelection({ factionId: event.target.value })}>
                {contentAuthoringGuide.compatible.factions.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / {row.kind}</option>
                ))}
              </select>
            </label>
            <label>Event archetype
              <select aria-label="Content event archetype" value={contentAuthoringGuide.selection.eventArchetypeId} onChange={(event) => updateContentSelection({ eventArchetypeId: event.target.value })}>
                {contentAuthoringGuide.compatible.eventArchetypes.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / risk {row.risk}</option>
                ))}
              </select>
            </label>
            <label>Growth line
              <select aria-label="Content growth line" value={contentAuthoringGuide.selection.progressionLineId} onChange={(event) => updateContentSelection({ progressionLineId: event.target.value })}>
                {contentAuthoringGuide.compatible.progressionLines.map((row) => (
                  <option key={row.id} value={row.id}>{row.label} / {row.stageCount} stages</option>
                ))}
              </select>
            </label>
            <div className="contentGuideMetricGrid">
              <span><strong>{contentAuthoringGuide.coverage.compatibleEvidenceTypeCount}</strong><small>Compatible evidence</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleRoleCount}</strong><small>Compatible roles</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleMotiveCount}</strong><small>Compatible motives</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleLocationCount}</strong><small>Locations</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleResourceCount}</strong><small>Resources</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleFactionCount}</strong><small>Factions</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleEventArchetypeCount}</strong><small>Events</small></span>
              <span><strong>{contentAuthoringGuide.coverage.compatibleProgressionLineCount}</strong><small>Growth lines</small></span>
              <span><strong>{contentAuthoringGuide.riskSummary.averageEvidenceContaminationRisk}</strong><small>Avg risk</small></span>
              <span><strong>{contentAuthoringGuide.riskSummary.redHerringRisk}</strong><small>Red herring risk</small></span>
              <span><strong>{contentAuthoringGuide.riskSummary.resourcePressure}</strong><small>Resource pressure</small></span>
              <span><strong>{contentAuthoringGuide.riskSummary.eventRisk}</strong><small>Event risk</small></span>
              <span><strong>{contentAuthoringGuide.riskSummary.progressionStageCount}</strong><small>Growth stages</small></span>
            </div>
            <div className="contentGuidePicker">
              <h3>Roles</h3>
              {contentAuthoringGuide.compatible.roles.map((row) => (
                <label key={row.id} className="checkRow">
                  <input type="checkbox" checked={contentAuthoringGuide.selection.roleIds.includes(row.id)} onChange={() => toggleContentRole(row.id)} />
                  <span>{row.label} - {row.publicDescription}</span>
                </label>
              ))}
            </div>
            <div className="contentGuidePicker">
              <h3>Evidence types</h3>
              {contentAuthoringGuide.compatible.evidenceTypes.map((row) => (
                <label key={row.id} className="checkRow">
                  <input type="checkbox" checked={contentAuthoringGuide.selection.evidenceTypeIds.includes(row.id)} onChange={() => toggleContentEvidenceType(row.id)} />
                  <span>{row.label} - risk {row.contaminationRisk}: {row.publicDescription}</span>
                </label>
              ))}
            </div>
            <div className="contentSeedPreview" data-testid="content-seed-preview">
              <h3>Preview Content Seed</h3>
              <div className="contentSeedSummary">
                <span><strong>{contentAuthoringGuide.preview.title}</strong><small>Case title</small></span>
                <span><strong>{contentAuthoringGuide.preview.theme}</strong><small>Theme</small></span>
                <span><strong>{contentAuthoringGuide.preview.evidenceLabels.join(", ") || "None"}</strong><small>Evidence labels</small></span>
                <span><strong>{contentAuthoringGuide.preview.roleLabels.join(", ") || "None"}</strong><small>Role labels</small></span>
                <span><strong>{contentAuthoringGuide.preview.worldSystemLabels.join(" / ") || "None"}</strong><small>World-system labels</small></span>
                <span><strong>{contentAuthoringGuide.preview.progressionLineLabel}</strong><small>Growth line</small></span>
              </div>
              <p>{contentAuthoringGuide.preview.publicCaseFile}</p>
              <div className="contentPatchList">
                {(["case", "characters", "evidence", "logic"] as const).map((group) => {
                  const patches = contentAuthoringGuide.patches.filter((patch) => patch.group === group);
                  if (!patches.length) return null;
                  return (
                    <section key={group} className="contentPatchGroup" data-testid={`content-patch-group-${group}`}>
                      <h4>{group === "case" ? "Case" : group === "characters" ? "Characters" : group === "evidence" ? "Evidence" : "Logic"}</h4>
                      {patches.slice(0, 12).map((patch) => (
                        <span key={patch.path}><strong>{patch.label}</strong><small>{patch.path}</small></span>
                      ))}
                    </section>
                  );
                })}
                {!contentAuthoringGuide.patches.length && <span><strong>No changes pending</strong><small>The current draft already matches this content seed.</small></span>}
              </div>
              <p className="caseGalleryNote">Apply saves the current draft to Local Case Gallery first. IDs, suspect matrix, clue order, timeline, and proof structure remain unchanged.</p>
            </div>
            <div className="safeDiffPanel" data-testid="safe-diff-review">
              <div className="contentSeedTrailHeader">
                <div>
                  <p>Browser-local review</p>
                  <h3>Safe Diff Review</h3>
                </div>
                <span className="runtimePill">{contentSeedHistory[0] ? "applied" : "pending"}</span>
              </div>
              <section className="safeDiffSection" data-testid="pending-safe-diff">
                <div className="safeDiffSectionHeader">
                  <strong>Pending safe diff</strong>
                  <span>{pendingSafeDiff.length} fields</span>
                </div>
                <p className="caseGalleryNote">Preview-only changes from the selected content seed. Only public-facing text fields are listed.</p>
                <div className="safeDiffGroups">
                  {safeDiffGroups.map((group) => {
                    const items = pendingSafeDiff.filter((item) => item.group === group.id);
                    if (!items.length) return null;
                    return (
                      <section key={group.id} className="safeDiffGroup" data-testid={`pending-safe-diff-${group.id}`}>
                        <h4>{group.label}</h4>
                        {items.slice(0, 12).map((item) => (
                          <article key={`${item.field}:${item.label}`} className="safeDiffCard">
                            <div className="safeDiffCardTop">
                              <strong>{item.label}</strong>
                              <small>{item.field}</small>
                            </div>
                            <div className="safeDiffValues">
                              <div>
                                <small>Before</small>
                                <span className="safeDiffValuePreview">{item.before || "(empty)"}</span>
                                <p>{item.before || "(empty)"}</p>
                              </div>
                              <div>
                                <small>After</small>
                                <span className="safeDiffValuePreview">{item.after || "(empty)"}</span>
                                <p>{item.after || "(empty)"}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </section>
                    );
                  })}
                  {!pendingSafeDiff.length && <p className="caseGalleryNote">No pending safe diff. The current draft already matches this content seed.</p>}
                </div>
              </section>
              {contentSeedHistory[0] && (
                <section className="safeDiffSection" data-testid="applied-safe-diff">
                  <div className="safeDiffSectionHeader">
                    <strong>Applied safe diff</strong>
                    <span>{appliedSafeDiff.length} fields / {contentSeedHistory[0].validation.valid ? "validation pass" : `${contentSeedHistory[0].validation.errorCount} blockers`}</span>
                  </div>
                  <p className="caseGalleryNote">Compared from the session before snapshot to the current draft. Gallery backup: <strong>{contentSeedHistory[0].backupTitle}</strong>.</p>
                  <div className="safeDiffGroups">
                    {safeDiffGroups.map((group) => {
                      const items = appliedSafeDiff.filter((item) => item.group === group.id);
                      if (!items.length) return null;
                      return (
                        <section key={group.id} className="safeDiffGroup" data-testid={`applied-safe-diff-${group.id}`}>
                          <h4>{group.label}</h4>
                          {items.slice(0, 12).map((item) => (
                            <article key={`${item.field}:${item.label}`} className="safeDiffCard">
                              <div className="safeDiffCardTop">
                                <strong>{item.label}</strong>
                                <small>{item.field}</small>
                              </div>
                              <div className="safeDiffValues">
                                <div>
                                  <small>Before</small>
                                  <span className="safeDiffValuePreview">{item.before || "(empty)"}</span>
                                  <p>{item.before || "(empty)"}</p>
                                </div>
                                <div>
                                  <small>After</small>
                                  <span className="safeDiffValuePreview">{item.after || "(empty)"}</span>
                                  <p>{item.after || "(empty)"}</p>
                                </div>
                              </div>
                            </article>
                          ))}
                        </section>
                      );
                    })}
                    {!appliedSafeDiff.length && <p className="caseGalleryNote">No applied safe diff is active. Undo has restored the pre-apply draft or no seed has been applied.</p>}
                  </div>
                </section>
              )}
            </div>
            <div className="contentSeedTrail" data-testid="content-seed-trail">
              <div className="contentSeedTrailHeader">
                <div>
                  <p>Session-only audit trail</p>
                  <h3>Content Seed Undo</h3>
                </div>
                <span className="runtimePill">{contentSeedHistory.length} recent</span>
              </div>
              {contentSeedHistory[0] ? (
                <div className="contentSeedUndoCard">
                  <span><strong>{contentSeedHistory[0].beforeTitle}</strong><small>Before</small></span>
                  <span><strong>{contentSeedHistory[0].afterTitle}</strong><small>After</small></span>
                  <span><strong>{contentSeedHistory[0].patchCount}</strong><small>Safe text patches</small></span>
                  <span><strong>{contentSeedHistory[0].validation.valid ? "Pass" : `${contentSeedHistory[0].validation.errorCount} blockers`}</strong><small>Post-apply validation</small></span>
                  <p>Latest seed: {contentSeedHistory[0].caseTypeLabel}. The Gallery snapshot remains available as <strong>{contentSeedHistory[0].backupTitle}</strong>.</p>
                  <button data-testid="undo-content-seed" type="button" onClick={undoLatestContentSeed}>Undo Content Seed</button>
                </div>
              ) : (
                <p className="caseGalleryNote">No Content Seed changes in this browser session. Apply a non-empty seed to create one undo entry and a Gallery backup.</p>
              )}
            </div>
            <div className="authoringActions">
              <button data-testid="preview-content-seed" type="button" onClick={previewContentSeed}>Preview Content Seed</button>
              <button data-testid="apply-content-seed" type="button" className="primaryButton" onClick={applyContentSeed} disabled={!contentAuthoringGuide.patches.length}>Apply Content Seed</button>
            </div>
          </section>
        )}

        {authoringTab === "characters" && authoringCharacter && (
          <section className="authoringPanel">
            <h2>Characters</h2>
            <select value={authoringCharacter.id} onChange={(event) => setAuthoringCharacterId(event.target.value)}>
              {authoringCase.characters.map((character) => <option key={character.id} value={character.id}>{character.name} - {character.role}</option>)}
            </select>
            <label>Name<input value={authoringCharacter.name} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.name`, event.target.value)} /></label>
            <label>Role<input value={authoringCharacter.role} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.role`, event.target.value)} /></label>
            <label>Public bio<textarea value={authoringCharacter.publicBio} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.publicBio`, event.target.value)} /></label>
            <label>Testimony<textarea value={authoringCharacter.initialStatement} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.initialStatement`, event.target.value)} /></label>
            <label>Motive surface<textarea value={authoringCharacter.motive} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.characters.${authoringCase.characters.findIndex((item) => item.id === authoringCharacter.id)}.motive`, event.target.value)} /></label>
          </section>
        )}

        {authoringTab === "evidence" && authoringEvidence && (
          <section className="authoringPanel">
            <h2>Evidence</h2>
            <select value={authoringEvidence.id} onChange={(event) => setAuthoringEvidenceId(event.target.value)}>
              {authoringCase.evidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <label>Title<input value={authoringEvidence.title} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.title`, event.target.value)} /></label>
            <label>Player-visible description<textarea data-testid="authoring-evidence-description" value={authoringEvidence.visibleDescription} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.visibleDescription`, event.target.value)} /></label>
            <label>True meaning<textarea value={authoringEvidence.trueMeaning} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.trueMeaning`, event.target.value)} /></label>
            <label className="checkRow"><input type="checkbox" checked={authoringEvidence.discoverable} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.evidence.${authoringCase.evidence.findIndex((item) => item.id === authoringEvidence.id)}.discoverable`, event.target.checked)} /> Discoverable</label>
            <button data-testid="delete-authoring-evidence" className="dangerButton" onClick={deleteAuthoringEvidence}>Delete Evidence</button>
          </section>
        )}

        {authoringTab === "scenes" && authoringScene && (
          <section className="authoringPanel">
            <h2>Scenes</h2>
            <select value={authoringScene.id} onChange={(event) => setAuthoringSceneId(event.target.value)}>
              {authoringCase.scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}
            </select>
            <label>Name<input value={authoringScene.name} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.name`, event.target.value)} /></label>
            <label>Description<textarea value={authoringScene.description} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.description`, event.target.value)} /></label>
            <label>Evidence IDs<input value={authoringScene.evidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.scenes.${authoringCase.scenes.findIndex((item) => item.id === authoringScene.id)}.evidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
          </section>
        )}

        {authoringTab === "timeline" && authoringTimelineEvent && (
          <section className="authoringPanel">
            <h2>Timeline</h2>
            <select value={authoringTimelineEvent.id} onChange={(event) => setAuthoringTimelineId(event.target.value)}>
              {authoringCase.truth.trueTimeline.map((item) => <option key={item.id} value={item.id}>{item.time} - {item.id}</option>)}
            </select>
            <label>Time<input value={authoringTimelineEvent.time} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.time`, event.target.value)} /></label>
            <label>True event<textarea value={authoringTimelineEvent.event} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.event`, event.target.value)} /></label>
            <label>Public version<textarea value={authoringTimelineEvent.publicVersion} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.publicVersion`, event.target.value)} /></label>
            <label>Contradicting evidence IDs<input value={authoringTimelineEvent.contradictedByEvidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.truth.trueTimeline.${authoringCase.truth.trueTimeline.findIndex((item) => item.id === authoringTimelineEvent.id)}.contradictedByEvidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label>
          </section>
        )}

        {authoringTab === "logic" && (
          <section className="authoringPanel">
            <h2>Logic Chain</h2>
            <label>Required clue order
              <input value={authoringCase.logicPuzzle.requiredClueOrder.join(", ")} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.logicPuzzle.requiredClueOrder", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
            </label>
            <label>Red herrings
              <textarea value={authoringCase.logicPuzzle.redHerrings.join("\n")} onChange={(event) => patchAuthoring("caseFromLog.deductionCase.logicPuzzle.redHerrings", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} />
            </label>
            <div className="matrixEditor">
              {authoringCase.logicPuzzle.suspectMatrix.map((row, index) => (
                <div key={row.characterId} className="matrixEditorRow">
                  <strong>{row.name}</strong>
                  <label><input type="checkbox" checked={row.motive} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.motive`, event.target.checked)} /> Motive</label>
                  <label><input type="checkbox" checked={row.means} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.means`, event.target.checked)} /> Means</label>
                  <label><input type="checkbox" checked={row.opportunity} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.opportunity`, event.target.checked)} /> Opportunity</label>
                  <input value={row.excludedByEvidenceIds.join(", ")} onChange={(event) => patchAuthoring(`caseFromLog.deductionCase.logicPuzzle.suspectMatrix.${index}.excludedByEvidenceIds`, event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      <section className="authoringStage">
        <header className="stageTopbar">
          <div>
            <p>Visual preview</p>
            <h2>{authoringCase.title}</h2>
          </div>
          <div className="runDraftControl">
            <button data-testid="run-authoring-draft" className="primaryButton" onClick={runAuthoringDraft} disabled={!authoringReport.valid}><Play size={15} /> Run Draft</button>
            {!authoringReport.valid && authoringBlocker && (
              <button className="runDraftBlocker" type="button" onClick={() => focusAuthoringIssue(authoringBlocker)}>
                Blocked: {authoringBlocker.message}
              </button>
            )}
          </div>
        </header>
        {authoringTab === "gallery" ? (
          <section className="actionPanel caseGalleryPanel" data-testid="case-gallery-panel">
            <div className="caseGalleryHeader">
              <div>
                <p>Browser-local case library</p>
                <h2><Database size={16} /> Local Case Gallery</h2>
              </div>
              <span className="runtimePill">{caseGalleryEntries.length} local / {builtInGalleryEntries.length} built-in</span>
            </div>
            <div className="caseGallerySummary">
              <span><strong>{allGalleryEntries.filter((entry) => entry.validation.valid).length}</strong><small>Runnable</small></span>
              <span><strong>{allGalleryEntries.filter((entry) => !entry.validation.valid).length}</strong><small>Blocked</small></span>
              <span><strong>{allGalleryEntries.reduce((sum, entry) => sum + entry.validation.evidenceCount, 0)}</strong><small>Total evidence</small></span>
            </div>
            <p className="caseGalleryNote">Gallery data stays in this browser under <code>{caseGalleryStorageKey}</code>. It is safe for Static Demo deployments and never calls `/api/*`.</p>
            <div className="caseGallerySectionHeader">
              <h3>Built-in Premium Templates</h3>
              <span>Read-only</span>
            </div>
            <div className="caseGalleryGrid">
              {builtInGalleryEntries.map((entry) => renderGalleryCard(entry, true))}
            </div>
            <div className="caseGallerySectionHeader">
              <h3>Local Drafts</h3>
              <span>{caseGalleryEntries.length} saved</span>
            </div>
            {caseGalleryEntries.length === 0 ? (
              <div className="galleryEmptyState" data-testid="case-gallery-empty">
                <strong>No local drafts saved yet.</strong>
                <span>Use Save to Gallery after editing a template. Imports and exports stay browser-local unless you copy the JSON out.</span>
              </div>
            ) : (
              <div className="caseGalleryGrid">
                {caseGalleryEntries.map((entry) => renderGalleryCard(entry, false))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="pixelMapWrap compactMap" data-testid="authoring-map">
              <div className="pixelMap" style={{ gridTemplateColumns: `repeat(${authoringMapSnapshot.width}, minmax(18px, 1fr))` }}>
                {authoringMapSnapshot.tiles.map((tile) => {
                  const actors = authoringActorsByTile.get(`${tile.x}:${tile.y}`) || [];
                  const markers = authoringMarkersByTile.get(`${tile.x}:${tile.y}`) || [];
                  return (
                    <button key={tile.id} className={`mapTile terrain-${tile.terrain} ${tile.searchable ? "searchable" : ""}`} data-location-id={tile.locationId || undefined} title={tile.locationName || tile.terrain}>
                      {tile.locationName && <span className="placeName">{tile.locationName}</span>}
                      {markers.slice(0, 2).map((marker) => <span key={marker.id} className={`marker marker-${marker.type}`}>?</span>)}
                      <span className="actorStack">{actors.slice(0, 3).map((actor) => <span key={actor.id} className={`actorPin actor-${actor.status}`}>{actorInitial(actor.name)}</span>)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="actionPanel">
              <h2><Database size={16} /> Deduction Graph Preview</h2>
              <DeductionGraphView
                graph={authoringReport.deductionGraph}
                discoveredEvidenceIds={authoringCase.evidence.map((item) => item.id)}
                solutionRevealed
                onSelectEvidence={setAuthoringEvidenceId}
                onSelectEvent={setAuthoringTimelineId}
                onSelectCharacter={setAuthoringCharacterId}
              />
            </section>
          </>
        )}
      </section>

      <aside className="authoringInspector">
        <section className={`authoringWorkflowCoach ${authoringWorkflowCoach.nextAction.tone}`} data-testid="authoring-workflow-coach">
          <div className="workflowCoachHeader">
            <div>
              <p>Browser-local guidance</p>
              <h2>Authoring Workflow Coach</h2>
            </div>
            <span className={`runtimePill ${authoringWorkflowCoach.nextAction.tone}`}>{authoringWorkflowCoach.nextAction.tone}</span>
          </div>
          <div className="workflowCoachStages" data-testid="authoring-workflow-stages">
            {authoringWorkflowCoach.stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                className={`workflowCoachStage ${stage.status}`}
                data-testid={`authoring-workflow-stage-${stage.id}`}
                onClick={() => {
                  if (stage.id === "content-seed" || stage.id === "safe-diff") setAuthoringTab("content");
                  else if (stage.id === "gallery-backup") setAuthoringTab("gallery");
                  else if (stage.id === "run-draft" || stage.id === "validation") setAuthoringTab("logic");
                  else setAuthoringTab("case");
                }}
              >
                <span>{stage.status}</span>
                <strong>{stage.label}</strong>
                <small>{stage.detail}</small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`workflowNextAction ${authoringWorkflowCoach.nextAction.tone}`}
            data-testid="authoring-next-action"
            onClick={runAuthoringCoachNextAction}
          >
            <span>Next Action</span>
            <strong>{authoringWorkflowCoach.nextAction.label}</strong>
            <small>{authoringWorkflowCoach.nextAction.detail}</small>
          </button>
          <p className="caseGalleryNote">Coach reads only current browser draft status, safe diff counts, validation result, and Gallery backup availability. It does not expose spoiler fields or call `/api/*`.</p>
        </section>

        <section className={`authoringReport ${authoringReport.valid ? "pass" : "fail"}`} data-testid="authoring-rule-report">
          <h2>Rule Report</h2>
          <div className="validationChecklist" data-testid="authoring-validation-checklist">
            {authoringChecklist.map((item) => (
              <button key={item.label} type="button" className={item.ok ? "pass" : "fail"} onClick={() => setAuthoringTab(item.tab)}>
                <span>{item.ok ? "OK" : "!"}</span>
                <strong>{item.label}</strong>
              </button>
            ))}
          </div>
          <div className="metricGrid">
            <div><strong>{authoringReport.valid ? "Pass" : "Fail"}</strong><small>Status</small></div>
            <div><strong>{authoringReport.qualityScore}</strong><small>Quality</small></div>
            <div><strong>{authoringReport.logicStrength}</strong><small>Logic</small></div>
            <div><strong>{authoringReport.misdirectionQuality}</strong><small>Misdirect</small></div>
            <div><strong>{Math.round(authoringReport.reasoningCoverage.coverageRatio * 100)}%</strong><small>Coverage</small></div>
            <div><strong>{authoringReport.errors.length}</strong><small>Errors</small></div>
          </div>
          <article className={`proofAuditCard ${authoringProofAudit.valid ? "pass" : "fail"}`} data-testid="authoring-proof-audit">
            <strong>Proof Audit: {authoringProofAudit.valid ? "Pass" : "Fail"}</strong>
            <span>{authoringProofAudit.tour.length} proof tour steps / emergence {authoringProofAudit.trace.evaluation.emergenceScore}</span>
            <small>{authoringProofAudit.valid ? "The current draft can generate a player proof tour." : "The current draft is missing a complete emergence proof or final conclusion step."}</small>
          </article>
          <div className="issueList">
            {(authoringReport.issues.length ? authoringReport.issues : [{ id: "ok", severity: "warning" as const, source: "authoring" as const, path: "$", message: "\u5f53\u524d\u8349\u7a3f\u901a\u8fc7 schema\u3001\u4e16\u754c\u6765\u6e90\u3001hard logic \u548c\u63a8\u7406\u8986\u76d6\u6821\u9a8c\u3002" }]).slice(0, 12).map((item) => (
              <button key={item.id} type="button" className={`issueItem ${item.severity}`} onClick={() => focusAuthoringIssue(item)}>
                <strong>{item.source} / {item.path}</strong>
                <span>{item.message}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="authoringPanel">
          <h2>Suspect Matrix</h2>
          <div className="suspectBoard">
            {authoringReport.suspectBoard.map((row) => (
              <button key={row.characterId} className={`suspectRow ${row.status}`}>
                <strong>{row.name}</strong>
                <span>M {row.motive ? "Y" : "N"} / W {row.means ? "Y" : "N"} / O {row.opportunity ? "Y" : "N"}</span>
                <small>{row.exclusionEvidenceIds.join(", ") || "no exclusion"}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="authoringPanel">
          <h2>Import / Export</h2>
          <label>\u6a21\u677f
            <select value={caseTemplateId} onChange={(event) => loadPremiumTemplate(event.target.value as CaseTemplateId)}>
              {caseTemplates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <div className="authoringActions">
            <button onClick={() => loadPremiumTemplate()}>Load Premium Template</button>
            <button data-testid="save-to-gallery" onClick={saveAuthoringToGallery}>Save to Gallery</button>
            <button onClick={() => exportAuthoring("json")}>Export JSON</button>
            <button onClick={() => exportAuthoring("markdown")}>Export Markdown</button>
            <button data-testid="export-gallery-json" onClick={exportGalleryBundle} disabled={!caseGalleryEntries.length}>Export Gallery JSON</button>
          </div>
          <textarea data-testid="authoring-import-text" placeholder="Paste AuthoringDraft, DeductionCase, or CaseGalleryBundle JSON" value={authoringImportText} onChange={(event) => setAuthoringImportText(event.target.value)} />
          <button className="secondaryButton full" onClick={importAuthoringJson}>Import JSON</button>
          <textarea data-testid="authoring-export-text" readOnly value={authoringExportText} placeholder="Export output appears here" />
          <div className="statusBox"><AlertTriangle size={16} /><span>{authoringStatus}</span></div>
        </section>
      </aside>
    </main>
  );
}
