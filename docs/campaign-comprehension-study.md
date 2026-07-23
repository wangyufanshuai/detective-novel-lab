# v6.2 Campaign Comprehension Study Protocol

## Status

`instrumentation ready` — the browser-local recorder, strict operations guard, pure model tests, privacy checks, and Server/Static browser QA are implemented. The eight required official human attempts have not yet been run, so `human gate passed` must not be claimed.

This study measures whether a person can complete and explain the existing three-case Server Campaign. It is a baseline instrument. v6.2 does not change campaign copy, layout, world rules, case truth, evidence coverage, certified routes, candidate ranking, or judgement.

## Start conditions

Use one frozen production build and one dedicated, ignored runtime database. Stop the server before each participant, remove only `data/campaign-study-runtime.db` plus its `-wal` and `-shm` companions, then restart with `DATABASE_URL=file:./data/campaign-study-runtime.db`. This avoids contaminating the fixed Premium world with events from the previous participant and never touches the normal development database.

1. Open `http://127.0.0.1:3000/?runtime=server&study=1` in the same browser profile.
2. Keep Showcase, Premium, `archive-blunt`, and `showcase-seed`, then use **Reset / Create Town**.
3. Confirm Campaign is at `opening` and there is no active investigation session. The recorder never resets the town automatically.
4. Expand **Campaign Study Recorder**. Confirm its read-only required slot, then select **Start P1**, **Start P2**, or the displayed official slot. Cohort, protocol, and scenario cannot be selected manually.
5. Collapse the recorder during play. The moderator may reopen it to apply only the fixed marks below.

Before the first pilot, use **Reset study data** once to remove automated or rehearsal records. Do not reset study data again during the two pilots and eight official attempts. Export the safe JSON after each attempt as an off-repository backup. The guard derives the only valid next slot from existing runs without storing another field.

The recorder is unavailable in Static Runtime. `?runtime=static&study=1` creates no recorder, performs no study `localStorage` write, and continues to make zero `/api/*` requests.

## Pilot and official matrix

Run exactly two `pilot` sessions first with two people who do not enter the official sample: `mystery-first / standard`, then `systems-first / recovery-probe`. A pilot advances only after full completion; abandoned or interrupted pilots repeat the same locked slot. Pilots verify the procedure but never count toward the gate. Any instrumentation or protocol correction requires both pilots to be repeated before the official build is frozen.

The official matrix is fixed at eight uninterrupted sessions:

| Cohort | Standard | Recovery probe | Total |
|---|---:|---:|---:|
| mystery-first | 2 | 2 | 4 |
| systems-first | 2 | 2 | 4 |
| Total | 4 | 4 | 8 |

- **mystery-first**: the participant primarily approaches the product as a detective/mystery game.
- **systems-first**: the participant primarily approaches it as a simulation/strategy system.
- **standard**: do not manufacture a failure.
- **recovery-probe**: ask the participant to make the first theory submission incomplete. After rejection, do not mention Recovery unless the participant explicitly becomes stuck. If help is necessary, mark **Moderator prompted Recovery** before giving the fixed prompt, “请查看 Campaign 区域中的当前 Recovery 行动。”

Recruit six people for each cohort: one pilot, four official participants, and one reserve, for a 12-person pool. Ten people normally run; reserves replace only same-cohort technical interruptions and must be replenished if used before later batches. Participants are Chinese-native readers who can understand English game terms and have not used this project before. Classify cohort by primary mystery/puzzle versus simulation/strategy orientation without storing identity or screening answers. Use this fixed recruitment notice: “本地三案 Campaign 测试，最长 90 分钟；不收集姓名、设备、回答正文或谈话内容，只保存浏览器本地匿名汇总。” Run the matrix in this fixed order:

1. mystery-first / standard
2. systems-first / recovery-probe
3. systems-first / standard
4. mystery-first / recovery-probe
5. mystery-first / recovery-probe
6. systems-first / standard
7. systems-first / recovery-probe
8. mystery-first / standard

The moderator must not click game controls or enter theory content for the participant. Each attempt has a 90-minute cap. Participant-requested stops and cap expiry use **Abandon** and remain eligible but incomplete. A reload, browser failure, or server failure is `interrupted`, does not consume the locked official slot, and requires a new same-cohort participant replacement. An abandoned official consumes its slot; abandoned or interrupted pilots do not.

Execute in five batches: P1/P2, O1/O2, O3/O4, O5/O6, and O7/O8. After P2, run the automated checks and freeze the build. Any instrumentation or protocol change after that point invalidates both pilots; any change after O1 invalidates the full official matrix.

## What the recorder observes

The study hook observes existing safe React state and receives explicit notifications only after an existing action handler succeeds. It does not read the DOM or add fields to an API request.

- First meaningful action: first successful runtime advance, case extraction, Join, certified investigation action, or world choice.
- Stage duration: aggregate integer seconds from a stage becoming the current safe objective until the corresponding state succeeds.
- World choice duration: aggregate integer seconds from an actionable World Lead, resource commitment, directive, offer, Recovery, or finale candidate until the first decision succeeds. It never stores the selected option.
- Assistance: counts Guided Step and explicit fallback use.
- Recovery: counts appearance, start, and moderator prompting.
- Outcome: Campaign completion, safe abandonment stage, fixed confusion categories, Finale explanation rating, and Replay intent.

Page reload during an active run marks it `interrupted`; elapsed time is not reconstructed. Campaign completion changes the run to `awaiting-assessment`. The moderator must choose a Finale rating and Replay intent before **Finalize** becomes available.

## Fixed moderator marks

Use **Main-objective misunderstandings +1** for the first observable action in a continuous episode where the participant acts on an incorrect understanding of the current primary objective. Repeated clicks from the same unresolved episode do not add another count; a stage change, demonstrated correction, or later regression starts a new episode. Mark any applicable fixed confusion categories:

- `current-objective`
- `certified-route`
- `world-choice`
- `advance-town`
- `recovery`
- `finale-cause`
- `replay`

Finale explanation is `correct`, `partial`, or `incorrect`. Replay intent is `different-route`, `same-route`, or `none`. Do not write conversation notes or participant quotes into the recorder or export.

## Local data and privacy boundary

The key is exactly `detective-town-campaign-study-v1`. At most 16 summaries are retained; official runs are preserved before the newest pilots. **Reset study data** deletes only this key and never changes the game world.

The export filename is exactly `detective-town-campaign-study-v1.json`. It contains per-run safe summaries only—no overall statistics and no event log.

The recorder must never store a wall-clock timestamp, name, device data, world/case/session/NPC/location/source identifier, seed, selected answer, player text, event sequence, raw body, hidden truth, or absolute path. Study data never enters Server Runtime, SQLite, logs, public projection, or a public artifact.

## Human exit gate

Count exactly eight uninterrupted, `official` attempts from the fixed matrix whose terminal status is `completed` or `abandoned`. Abandoned attempts remain in every denominator, count as incomplete, and keep unassessed Finale/Replay values as failures. `interrupted` attempts never enter the denominator and must be replaced.

- Median first meaningful action is below 300 seconds.
- At least 7/8 runs have no more than one main-objective misunderstanding, and the overall mean is no more than one.
- At least 3/4 Recovery probes start Recovery without moderator prompting.
- At least 6/8 participants complete the three-case Campaign without moderator operation.
- At least 7/8 Finale explanations are `correct`.
- At least 4/8 Replay intents are `different-route`.

If any threshold fails, publish the observed aggregate result and leave the gate failed. v6.3 may change only the layout, ordering, or copy associated with the three most frequent confusion categories. Do not repair the baseline inside v6.2.

Generate the aggregate-only report from the final browser export without copying the export into the repository:

```powershell
npm.cmd run study:analyze -- --input "$HOME\Downloads\detective-town-campaign-study-v1.json" --output docs/campaign-comprehension-results.md
```

The analyzer requires both the exact 2 x 2 matrix and the fixed O1–O8 order, treats a missing first meaningful action as infinite for the median, ranks confusion by attempt prevalence with the documented fixed tie order, and emits no per-attempt rows. Only the aggregate Markdown report may enter the working tree.

## Automated verification

```powershell
npm.cmd run test:campaign-study
npm.cmd run qa:campaign-study -- --json
```

The first command covers model transitions, integer timing, idempotence, bounded retention, reload interruption, export privacy, eligible-attempt analysis, matrix enforcement, tie-breaking, and aggregate-report privacy. The browser QA covers Server start/first action/assessment/finalization/download, unchanged runtime request payloads, and the Static zero-panel/zero-storage/zero-API/390px boundary.
