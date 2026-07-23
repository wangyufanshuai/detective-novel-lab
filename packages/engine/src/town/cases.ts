import type { CaseCandidate, PersistentTownRuntime } from "../persistent-town";

export function reusableTownCandidates(runtime: PersistentTownRuntime): CaseCandidate[] | null {
  return runtime.candidateComputedAtTick === runtime.tick ? runtime.candidates : null;
}

export function storeTownCandidates(runtime: PersistentTownRuntime, candidates: CaseCandidate[]) {
  runtime.candidates = candidates;
  runtime.candidateComputedAtTick = runtime.tick;
  return candidates;
}

export function invalidateTownCandidateCache(runtime: PersistentTownRuntime) {
  runtime.candidateComputedAtTick = undefined;
}
