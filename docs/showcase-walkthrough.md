# Showcase Walkthrough

The default Showcase is designed to be understandable in one minute:

1. Start the app with `npm run dev -- -p 3000`.
2. Open `http://localhost:3000/?runtime=static`.
3. The Premium case loads automatically at 08:00 with the pixel map, 8 NPCs, event log, timeline, and case file.
4. Use the Case Library selector in **World Settings** to switch between `archive-blunt`, `clocktower-locked-room`, and `clinic-poison`.
5. Replay the 24-hour timeline and inspect the **Causal Trace** panel.
6. Search the crime scene and related locations.
7. Interrogate an NPC with and without evidence.
8. Submit an incorrect theory and verify it fails without revealing the culprit.
9. Discover the decisive evidence chain and submit the correct theory.
10. Unlock the final deduction graph node and solution reveal.

The Showcase target is 8 NPCs, 9 locations, 24 hours, one murder case, event-backed evidence, memory-scoped testimony, and a unique culprit.

## Premium Case Library

| Template id | What it demonstrates |
| --- | --- |
| `archive-blunt` | staged archive murder, strong red herrings, and a complete exclusion chain |
| `clocktower-locked-room` | locked-room timing contradiction and mechanical misdirection |
| `clinic-poison` | poison case, testimony reversal, and medical record evidence |

All three cases are deterministic, playable in Static Demo Runtime, and validated by the same hard-case rules as server-generated cases.
