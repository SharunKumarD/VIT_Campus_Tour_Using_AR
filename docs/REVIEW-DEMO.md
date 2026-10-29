# Review demo script (29 Oct 2026)

## Before the review (at home, 10 min)
1. Install the latest build (see the install steps in chat).
2. Open the app once with internet off: it must still open (everything is offline).
3. Settings → Offline campus data: the PRP map (`prp-e2-ground-v2.campus.json`) is imported.

## Part 1 — Outdoor: reach a building with AR arrows (SJT, TT, SMV, PRP)
1. Campus tab → pick a building (photo card) → Details.
2. Tap **Guide me with AR camera**.
3. Stand in the open. Hold the phone flat, top pointing the way you face. Wait until GPS shows ±30 m or better and "Facing" shows a number.
4. Tap **Open AR camera**. Hold the phone upright, do not turn, tap **Align here**.
5. Amber arrows appear on the ground pointing towards the building. Walk.
6. Also show **Compass arrow (no camera)**: a big arrow, distance and "You have arrived".

What to say: building positions come from OpenStreetMap (credited in the app); the outdoor
start point comes from GPS and the direction from the compass, so it is approximate (a few metres).

## Part 2 — Indoor: PRP ground floor with AR (the main contribution)
1. Places → G32 (or G31/G33/G34) → Guide me with AR → start **Inside the E2 entrance**.
2. Stand just inside the E2 door facing into the building, tap **Align here**, follow the arrows.
3. Show step-free routing: Step-free on → routes only use corridors surveyed as step-free.
4. Cover the camera for 3 s: arrows hide ("AR paused") and come back — the app never shows arrows it cannot trust.

## Part 3 — Future enhancements (say these)
- Survey all PRP floors and the other blocks indoors (stairs, lifts, ramps), checked by VIT Estates.
- QR / wall markers at every entrance and stair landing for exact indoor alignment.
- ARCore Geospatial (Google VPS) for centimetre-level outdoor alignment instead of GPS + compass.
- Real footpath network outdoors (route along paths, not a straight line).
- Accessibility study with users (needs ethics committee approval first).
- Voice guidance, Tamil/Hindi language support, AI campus assistant.
- Official photos and verified data from VIT; signed release on the Play Store.

## Honest limits (if asked)
- Building positions are OpenStreetMap building centres; MGR is not on OpenStreetMap yet.
- Outdoor arrows: straight line, GPS ±5–15 m, compass ±5–15°.
- Indoor map: one floor, step counts (0.7 m per step), labelled "unverified".
- Some building photos were supplied by the student for the demo; replace with own/authorised photos before any public release.
