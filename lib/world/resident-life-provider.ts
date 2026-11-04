import type { ResidentLifeContext } from "@/packages/engine/src/town/resident-cognition";
import { chooseResidentCandidate, type ResidentDecisionProvider } from "./resident-decision-provider";

/** Life providers receive only a bounded self projection and legal solo options.
 * Provider configuration is server-owned, never supplied by a visitor command. */
export function chooseResidentLife(input: {
  context: ResidentLifeContext; provider: ResidentDecisionProvider | null; budgetReserved: boolean;
  timeoutMs?: number; fetcher?: typeof fetch;
}) {
  return chooseResidentCandidate({ ...input, fallbackId: input.context.preferredId });
}
