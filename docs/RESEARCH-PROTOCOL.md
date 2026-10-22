# Research evaluation protocol

Working title: *An Accessibility-Aware and Context-Adaptive Augmented Reality
Framework for Outdoor-Indoor University Campus Navigation*.

Narrowed contribution (see the Phase 0–1 plan): a **confidence-gated guidance
policy** that hides AR guidance when positioning is unreliable and falls back
to map and text, evaluated with objective, on-device logs.

**Report every number as measured. Label demo-map and simulation results as such.**

## Research questions

- RQ1: Does confidence-gated AR reduce wrong turns and recovery time after localisation loss, compared with always-on AR and with map-only guidance?
- RQ2: How often is AR guidance usable on a typical Indian campus (tree cover, open grounds, corridors)?
- RQ3: Does strict accessibility filtering make destinations unreachable with currently verified data, and how should the app explain it?

## What the app logs (per session)

Saved in Settings > Research sessions, exported as CSV/JSON.

| Field | Meaning |
|---|---|
| `outcome` | arrived / ended / map |
| `durationS`, `walkedM`, `plannedDistanceM`, `remainingM` | Time and distance |
| `realigns` | Re-alignments at checkpoints |
| `seconds_<MODE>` | Time in ALIGNING, GUIDING, DEGRADED, LOST, NEED_REALIGN, ARRIVED |
| `trackingLosses` | Times ARCore tracking dropped |
| `offRouteEvents` | Times the user was > 5 m from the route for > 3 s |
| `events` (JSON) | Timestamped ALIGNED, MODE changes, TRACKING_LOST/RECOVERED, OFF_ROUTE |
| `thresholds` (JSON) | The policy constants used in that session |

Recovery time = TRACKING_RECOVERED time − TRACKING_LOST time (computed by the app).

## Policy constants (to calibrate)

| Constant | Value | Where |
|---|---|---|
| Degraded after walking | 40 m since alignment | `RouteGuide.DEGRADED_AFTER_M` |
| Lost after walking | 80 m | `RouteGuide.LOST_AFTER_M` |
| Tracking grace | 1.5 s | `TRACKING_GRACE_MS` |
| Recovery stability | 1.0 s | `RECOVERY_MS` |
| Off-route | 5 m for 3 s | `OFF_ROUTE_M`, `OFF_ROUTE_MS` |
| Arrival | 3 m | `ARRIVE_M` |
| GPS good / fair | ≤ 10 m / ≤ 25 m | `src/lib/location/position.ts` |

## Stage A: simulation (no participants)

Run `RouteGuide` on synthetic traces with injected faults (tracking dropouts of
0.5–5 s, drift of 1–5 % of distance, off-route detours). Measure mode switches
per minute, time with arrows hidden, and false "on route" time. The JUnit tests
are the starting harness.

## Stage B: technical field test (researcher only, with VIT permission)

1. Place the demo map at your location (Settings > Location) or use an imported verified pack.
2. Print markers (`docs/demo-checkpoint-markers.pdf`); lay them flat, arrow along the route.
3. For each of 3 routes × 5 repetitions × each phone: run AR guidance, record the session.
4. Also record: weather, time of day, lighting (indoor lux if possible), crowd level.
5. Device measures: battery % per 10 min, phone temperature (if available), visible stutter.
6. Deliberate faults: cover the camera 3 s at a fixed point; walk 10 m off route.

## Stage C: user study (only after IEC approval)

Within-subjects, counterbalanced: (1) map + text only, (2) always-on AR,
(3) confidence-gated AR. Participants unfamiliar with the routes.
Measures: success, time, wrong turns (observer + log), recovery time, SUS,
NASA-TLX. Sample size from a power analysis on Stage B variance.
Condition (2) needs a build flag that disables hiding; add it before the study.

## Threats to validity

Demo-map results are not campus results; marker placement accuracy affects
alignment; the researcher's own walks are not user data; one phone model so far.
