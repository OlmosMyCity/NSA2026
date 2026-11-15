# Orbvital — Product context

## What it is
Astronaut digital twin for NASA Space Apps 2026 ("Create Health Monitoring Software for Astronauts").
A 3D anatomical twin with five zones (heart, brain, blood, bones, sleep) driven by a deterministic
rules engine (green / amber / red, trend, overdue measurements) and the NASA HRP five-hazard matrix
(radiation, isolation, distance, gravity, hostile closed environment).

## Who uses it, where
- Crew member on board (Orion / lunar base) checking their own status between tasks, low attention budget.
- Flight surgeon / judges watching a 2-minute demo on a laptop or projector.

## Product truths (never violate)
- Deterministic rules decide the official status. Gemini Decision 1 is a triage layer / second opinion.
  When they disagree, the rule wins and the discrepancy is shown.
- Every model output carries its confidence and the label "estimación del modelo, no diagnóstico".
- The API key lives server-side only. What-If edits must not spend tokens; the model runs only on explicit "Run triage".

## Surface: /dashboard (Digital Twin) — mode: Operate
Layout: 3D body left-center with the What-If scenario dock attached directly underneath;
right-hand inspector with zone selector + zone detail + AI triage.
Visual world: incumbent dark mission-console (space backdrop, blueberry/berry palette, luminous status colors),
restrained, instrument-like, Apple-style precision. UI copy in English.

