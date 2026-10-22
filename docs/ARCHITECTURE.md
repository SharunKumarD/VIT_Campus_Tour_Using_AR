# Architecture

One installable APK. The interface is a statically exported Next.js app running
in Capacitor's WebView; real AR runs in native Android screens (Java + ARCore).
There is no server inside the APK and none is needed for navigation.

```
┌──────────────────────────── APK ─────────────────────────────┐
│ WebView: Next.js static export (src/app, src/components)     │
│   ├─ Campus store ── bundled demo pack / imported pack (IDB) │
│   ├─ Routing engine (A*, profiles, instructions)  ◄─ offline │
│   ├─ Location (Capacitor Geolocation, in memory only)        │
│   ├─ Research session store (IndexedDB)                      │
│   └─ Native bridge (src/lib/native/ar.ts)                    │
│            │ ImmersiveAr plugin calls (JSON payloads)        │
│ Native Java (android/.../ar)                                 │
│   ├─ ImmersiveArPlugin   availability, install, launch       │
│   ├─ ArTestActivity      camera + plane + anchored arrow     │
│   └─ ArNavActivity       guidance screen                     │
│        ├─ Alignment      campus frame ⇄ ARCore world         │
│        ├─ RouteGuide     progress, confidence modes, log     │
│        ├─ QrScanner      ZXing on the camera image           │
│        └─ renderers      camera background, arrows (GLES 2)  │
└──────────────────────────────────────────────────────────────┘
Optional later: hosted backend (pack updates, admin, AI) over HTTPS only.
```

## Responsibilities

| Component | Owns | Does not do |
|---|---|---|
| Routing engine (`src/lib/routing`) | Graph filtering, A*, distances, times, text steps, explanations when no route exists | Anything about cameras or AR |
| Campus store (`src/lib/campus/store.ts`) | Which pack is active, validation on load/import, demo relocation | Editing data |
| AR bridge (`src/lib/native`) | Typed calls, payload building, defensive parsing of results | Rendering |
| `ArNavActivity` | Camera, alignment, drawing arrows, showing modes | Computing routes |
| `RouteGuide` | Whether the position can be trusted right now | Rendering, Android APIs (pure Java, unit-tested) |

## Coordinate frames

| Frame | Definition | Conversion |
|---|---|---|
| WGS84 | GPS latitude/longitude | ⇄ campus by equirectangular projection around the pack origin (`geo.ts`); error is far below GPS error over a few km |
| Campus | x east, y north, metres from the origin; `level` = floor | ⇄ AR world by `Alignment` |
| ARCore world | Gravity-aligned, Y up, heading arbitrary, origin where AR started; drifts slowly | Re-anchored at every alignment |

`Alignment` is created when the user stands at a checkpoint facing its marked
direction: the checkpoint's campus position maps to the camera's floor position,
and its facing bearing maps to the camera's horizontal forward direction.

## Guidance modes (RouteGuide)

```
ALIGNING ─align─► GUIDING ─40 m walked─► DEGRADED ─80 m walked─► LOST(drift)
                    ▲  │                                   │
                    │  └─tracking lost >1.5 s─► LOST(tracking)─stable 1 s─┘
                    └──────────── re-align at a checkpoint ◄──────────────
GUIDING ─reach floor change─► NEED_REALIGN ─align on new floor─► GUIDING
GUIDING ─within 3 m of destination─► ARRIVED
```

Arrows are drawn only in GUIDING (amber) and DEGRADED (pale). In every other
mode they are hidden and the screen shows text directions, re-align and Map.

## What needs the internet

| Needs internet | Works offline |
|---|---|
| First install of Google Play Services for AR | Search, routing, map, text directions |
| Downloading app updates | AR guidance (ARCore runs on the phone) |
| (Future) campus pack updates from a server | GPS location |
| | Importing a pack file already on the phone |

## Key decisions

- **Static export:** Capacitor serves files; Next.js server features (route handlers, Cache Components) are off.
- **Custom plugin instead of a third-party AR plugin:** no maintained Capacitor ARCore plugin could be verified.
- **Java instead of Kotlin (for now):** the Capacitor template is Java-only; avoiding a Kotlin Gradle plugin removed a failure point for the first native compile.
- **Raw ARCore + OpenGL ES instead of a rendering library:** ARCore's Java API is stable; fast-moving renderers were a compatibility risk.
- **Checkpoint alignment instead of GPS for AR:** GPS cannot place arrows on the floor accurately; ARCore Geospatial/VPS coverage at VIT is unknown and can be added later as another alignment source.
