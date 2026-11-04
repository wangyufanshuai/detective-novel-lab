import { loadAgentProposalReceipt } from "@/app/api/v1/_agent-proposals";
import { adminGuard, adminOk, errorResponse, fail } from "@/app/api/v1/_utils";

/** Read one persisted Agent proposal receipt on the operator surface. */
export async function GET(request: Request) {
  try {
    const unauthorized = adminGuard(request);
    if (unauthorized) return unauthorized;
    const url = new URL(request.url);
    const worldId = url.searchParams.get("worldId");
    const proposalId = url.searchParams.get("proposalId");
    if (!worldId || !proposalId) return fail("BAD_REQUEST", "worldId and proposalId are required");
    const receipt = loadAgentProposalReceipt(proposalId);
    if (!receipt || receipt.worldId !== worldId) return fail("PROPOSAL_NOT_FOUND", "Proposal receipt not found", 404);
    return adminOk({ schema: receipt.schema, proposal: receipt });
  } catch (error) {
    return errorResponse(error);
  }
}
