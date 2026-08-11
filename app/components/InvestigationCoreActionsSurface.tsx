"use client";

import {
  FinalDetectiveWorkspace,
  type FinalDetectiveWorkspaceProps
} from "@/app/components/FinalDetectiveWorkspace";

/** Stable compatibility boundary for the certified investigation surface. */
export function InvestigationCoreActionsSurface(props: FinalDetectiveWorkspaceProps) {
  return <FinalDetectiveWorkspace {...props} />;
}
