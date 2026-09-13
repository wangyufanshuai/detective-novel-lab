# detective-town-v3-5000-campaign

Public static dataset reader for Detective Novel Lab.

## 5-Minute Reader Path

1. Check `manifest-lite.json` for source run, hashes, and file totals.
2. Check `reader-index.json` for the 5000 tick gate and audit counts.
3. Review graph totals plus case and evidence distributions.
4. Open `case-summary-index.json` for spoiler-safe public case cards.

## Source Run

- Run: campaign-campaign-validation-5000
- Ticks: 5000
- Unique cases: 30
- Case types: 15
- Candidate repeat rate: 0%
- Later-case influence: 100%
- Evidence graph warnings: 0
- Runtime: 150271 ms
- Gate: ok

## Reader Summary

- Solved cases: 30
- Failed cases: 0
- Case graph: 30 nodes / 776 edges
- Evidence graph: 318 nodes / 498 edges
- Evidence completeness: 30/30 resolved cases
- Top case types: blackmail (2), court-intimidation (2), dock-smuggling (2), evidence-tampering (2), false-testimony (2)
- Top evidence types: trace (37), ledger (23), rumor (10), physical (5), testimony (5)
- World packages summarized: 3

## Public Boundary

This static reader contains aggregate review data and spoiler-safe case cards only. It does not include full run artifacts, database files, environment files, private runtime state, or source package bodies.
