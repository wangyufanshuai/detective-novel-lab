"use client";

import { useEffect, useRef } from "react";
import type { TownPlayView } from "@/lib/town-play-contract";
import { clockHours } from "./town-lighting";
import { townSound } from "./town-sound";

/**
 * Turns town state changes into sound: the clock and open panels steer the
 * ambience; case progress (a clue found, a statement corrected, a case closed,
 * a new commission) plays a cue. Nothing plays on the first render or reload.
 */
export function useTownSound(view: TownPlayView | null, panel: string | null, overview: boolean) {
  useEffect(() => {
    const sound = townSound();
    const unlock = () => sound.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => { window.removeEventListener("pointerdown", unlock); window.removeEventListener("keydown", unlock); };
  }, []);

  useEffect(() => { townSound().setWorld({ hours: clockHours(view?.time), ducked: !!panel, overview }); }, [view?.time, panel, overview]);

  const lastPanel = useRef(panel);
  useEffect(() => {
    const before = lastPanel.current;
    lastPanel.current = panel;
    if (before === panel) return;
    if (!before && panel) townSound().play(panel === "board" ? "pin" : "page");
    else if (before && !panel) townSound().play("close");
    else townSound().play("page");
  }, [panel]);

  const progress = useRef<{ caseId: string; clues: number; corrected: number; solved: boolean; commission: string } | null>(null);
  useEffect(() => {
    if (!view) return;
    const c = view.investigation;
    const now = { caseId: c?.id ?? "", clues: c?.clues.length ?? 0, corrected: c?.conversations.filter(line => line.corrected).length ?? 0, solved: c?.solved ?? false, commission: view.commission?.hook ?? "" };
    const before = progress.current;
    progress.current = now;
    if (!before) return;
    const sound = townSound();
    if (now.caseId && now.caseId === before.caseId) {
      if (now.solved && !before.solved) { sound.play("solved"); return; }
      if (now.corrected > before.corrected) { sound.play("correct"); return; }
      if (now.clues > before.clues) { sound.play("discover"); return; }
    }
    if (now.commission && now.commission !== before.commission) sound.play("commission");
  }, [view]);
}
