# VIT ImmersiveAR

Campus navigation for Android with step-free routing and camera AR guidance.
Next.js + TypeScript UI, packaged by Capacitor, with native ARCore code in Java.

> **Development build using a synthetic demo campus.** No place, path or
> coordinate in the bundled map is real VIT Vellore data. Real data must be
> authorised and imported as a campus pack (see `docs/CAMPUS-DATA.md`).
> This is not an official VIT app.

## What works

| Feature | Where |
|---|---|
| Search places, browse by type | Places tab |
| A* routing with step-free, slope, unpaved, covered and role rules | Directions screen |
| Turn-by-turn text directions | Directions screen |
| Offline SVG campus map with route | Map tab |
| Live GPS position, "My location" start, off-campus detection | Map tab, Directions |
| AR camera check and floor-anchored test arrow | Settings > Check AR on this phone |
| AR route guidance from a checkpoint, with confidence fallback | Directions > Guide me with AR |
| QR checkpoint markers (scan to select, re-align) | AR guidance screen |
| Import a verified campus pack (no rebuild) | Settings > Offline campus data |
| Research session logs, CSV/JSON export | Settings > Research sessions |

Routing, search and maps work with no internet. See `docs/STATUS.md` for what is
tested and what is still pending.

## Requirements (Windows)

- Windows 10/11, 16 GB RAM recommended
- Node.js 22 or newer (`node -v`)
- Git
- Android Studio Otter (2025.2.1) or newer, which includes JDK 21 and SDK 36
- An ARCore-supported Android phone for AR (tested so far: realme P3 5G, RMX5070, Android 16)

Put the project in a folder **without spaces** (for example `C:\dev\vit-immersivear`).

## First-time setup

```powershell
cd C:\dev\vit-immersivear
npm install
node setup-ar.mjs          # Android: ARCore, ZXing, permissions, AR screens (safe to re-run)
npm test                   # web/logic tests
```

## Run in a browser (fast UI work)

```powershell
npm run dev
```

Open http://localhost:3000. AR is not available in a browser; the app says so.

## Build and install the debug APK

Phone connected by USB with USB debugging on:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat testDebugUnitTest      # native Java tests
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
cd ..
```

## Tests

| Command | What it runs |
|---|---|
| `npm test` | Routing, accessibility rules, data validation, search, location, payloads, CSV export (Node's built-in test runner, no extra packages) |
| `.\gradlew.bat testDebugUnitTest` (in `android`) | Alignment maths, AR guidance modes, QR image handling (JUnit) |

On-device checks are listed in `docs/RESEARCH-PROTOCOL.md` (Stage B).

## Release APK (signed)

1. In Android Studio: **Build > Generate Signed App Bundle / APK > APK**.
2. Create a new keystore. Store it **outside** the project folder and back it up. If it is lost, updates cannot be signed.
3. Choose the `release` build. The APK appears in `android\app\release\`.
4. Never commit the keystore or its passwords. `*.jks` and `*.keystore` are in `.gitignore`.

Before any public release: replace the demo data, complete the items in
`docs/COMPLIANCE.md`, and get VIT's approval.

## Project structure

```
src/app/                 Screens (static export: no server code runs in the APK)
src/components/          UI components (map, navigation, AR guidance section)
src/lib/campus/          Data model, validation, demo pack, search, campus store
src/lib/routing/         A*, accessibility profiles, instructions, geometry
src/lib/location/        GPS fixes, accuracy, snapping
src/lib/native/          Typed bridge to the native AR plugin, route payloads
src/lib/offline/         IndexedDB storage
src/lib/research/        Session records and CSV export
tests/                   Node tests
android/app/src/main/java/dev/sainikhil/immersivear/ar/   Native ARCore code
android/app/src/test/java/...                             JUnit tests
docs/                    Architecture, data format, privacy, security, research protocol
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `adb` not recognised | Close and reopen VS Code/Antigravity after adding `platform-tools` to PATH |
| `adb devices` shows `unauthorized` | Unlock the phone and accept the USB debugging prompt |
| realme/Xiaomi install blocked | Developer options > turn on "Install via USB" |
| `invalid source release: 21` | Gradle is not using JDK 21: set `JAVA_HOME` to Android Studio's `jbr` folder |
| Build says Cache Components enabled | `next.config.ts` lost `output: "export"`; restore it |
| App shows old screens | Run `npm run build` and `npx cap sync android` before Gradle |

## Licence and data

Code: choose a licence before publishing (for example MIT). Third-party
licences are listed in `docs/COMPLIANCE.md`. Campus data belongs to its
provider and is not covered by the code licence.
