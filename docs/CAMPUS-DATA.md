# Campus pack format (schema version 1)

A campus pack is one JSON file holding everything the app needs offline: the
walking network, places, buildings and checkpoint markers. Import it in
**Settings > Offline campus data**. Every file is validated in full; a file
with any problem is rejected and the current map is kept.

The authoritative definition is `src/lib/campus/types.ts`; the checks are in
`src/lib/campus/validate.ts`. The bundled example is `src/lib/campus/demo-pack.ts`
(copy it as JSON from the Offline screen to get a starting file).

## Rules that matter most

1. **Never invent data.** Every record has `provenance`. Use `"verified"` only
   when someone checked it on site, and name them in `verifiedBy`.
2. **Unknown is unknown.** If nobody has checked whether a path has steps, set
   `"steps": "unknown"`. Step-free routing treats unknown as *not* step-free.
3. **Coordinates are metres from an origin.** Choose one surveyed origin point
   (`origin.lat`, `origin.lng`), then give every node `x` (metres east) and `y`
   (metres north) from it.
4. **Edge length must not be shorter than the straight line** between its two
   nodes. The routing algorithm depends on this.

## Top level

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | |
| `version` | string | Shown to users, e.g. `"vit-2027.01.15"` |
| `publishedAt` | ISO date | |
| `name` | string | |
| `isDemo` | boolean | `true` if any record is synthetic |
| `origin` | `{lat, lng}` | WGS84 |
| `buildings`, `nodes`, `edges`, `pois`, `checkpoints` | arrays | below |

## Provenance (on every record)

```json
{ "status": "verified", "source": "Estate Office plan 2027-01", "verifiedBy": "A. Surveyor", "verifiedAt": "2027-01-10" }
```

`status`: `verified` | `unverified` | `demo`. `demo` records are only allowed when `isDemo` is `true`.

## nodes

| Field | Notes |
|---|---|
| `id` | unique |
| `kind` | `intersection`, `entrance`, `checkpoint`, `destination`, `stairs`, `lift`, `ramp` |
| `x`, `y` | metres east/north of the origin |
| `level` | floor number, 0 = ground/outdoors |
| `indoor` | boolean; indoor nodes need `buildingId` |
| `buildingId` | must exist, and `level` must be one of that building's levels |
| `landmark` | short phrase used in directions: "lift lobby" |

## edges

| Field | Notes |
|---|---|
| `id`, `from`, `to` | node ids |
| `bidirectional` | boolean |
| `kind` | `path`, `road-crossing`, `corridor`, `door`, `stairs`, `ramp`, `lift`. Only `stairs`, `lift`, `ramp` may change level |
| `lengthM` | walking length in metres, at least the straight-line distance |
| `steps` | `none`, `some`, `unknown`. Lifts must be `none`; stairs cannot be `none` |
| `slopePct` | maximum slope in percent; omit if not measured |
| `surface` | `paved`, `unpaved`, `tiled`, `unknown` |
| `covered` | optional boolean |
| `allowedRoles` | optional, e.g. `["hostel-resident"]`; others are never routed here |
| `closed` | optional; temporarily never routed |

## pois

`id`, `name`, `category` (`academic`, `library`, `laboratory`, `administration`,
`hostel`, `food`, `medical`, `sports`, `student-services`, `entrance`),
`nodeId`, optional `accessibleEntranceNodeId`, `description`, `aliases`.

## checkpoints (QR markers)

| Field | Notes |
|---|---|
| `id` | unique |
| `markerPayload` | exact text in the QR code, e.g. `VITIAR-CP-0012`. Must not be a URL |
| `nodeId` | the node where the marker is placed |
| `buildingId` | the node's building; omit for outdoor markers |
| `level` | must match the node |
| `facingDeg` | direction the arrow points, degrees clockwise from north (0 to 359) |
| `markerVersion` | positive integer; increase when a marker is reprinted or moved |

Print markers with `docs/make_markers.py` (lay them flat on the floor, arrow
pointing along `facingDeg`).

## Collecting real data: suggested process

1. Get written permission from VIT for the area and for placing markers.
2. Pick 2 to 3 buildings and the paths between them.
3. Walk each path with a measuring wheel or a high-accuracy GPS receiver. Record
   steps, slopes (an inclinometer app is enough to start) and surfaces.
4. Have a second person check accessibility attributes; record them in `verifiedBy`.
5. Import the pack and fix anything the validator reports.
