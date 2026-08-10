"use client";

import { useMemo } from "react";
import {
  buildCampaignCommandBrief,
  type CampaignCommandBrief
} from "@/app/campaign/campaign-command-brief-model";
import type { StrategicCommandViewModel } from "@/app/campaign/strategic-command-model";

/** Request-free memoized projection over the existing safe Strategic Command state. */
export function useCampaignCommandBrief(command: StrategicCommandViewModel): CampaignCommandBrief {
  return useMemo(() => buildCampaignCommandBrief({ command }), [command]);
}
