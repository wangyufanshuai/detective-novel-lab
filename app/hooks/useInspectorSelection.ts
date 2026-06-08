"use client";

import { useCallback, useState } from "react";
import type { InspectorTabId } from "@/app/components/DetectiveTownUI";

export function useInspectorSelection(initialTab: InspectorTabId = "events") {
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>(initialTab);

  return {
    inspectorTab,
    setInspectorTab,
    showEvents: useCallback(() => setInspectorTab("events"), []),
    showInvestigation: useCallback(() => setInspectorTab("investigation"), []),
    showLogic: useCallback(() => setInspectorTab("logic"), []),
    showPeople: useCallback(() => setInspectorTab("people"), []),
    showDeveloper: useCallback(() => setInspectorTab("developer"), [])
  };
}
