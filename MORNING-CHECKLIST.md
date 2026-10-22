# Morning checklist

Do these in order in PowerShell. Stop and send Claude any red error.

## 1. Install (5 min)

```powershell
cd C:\dev\vit-immersivear
Expand-Archive "$env:USERPROFILE\Downloads\vit-immersivear-complete.zip" -DestinationPath . -Force
npm install @capacitor/geolocation@^8
node setup-ar.mjs
npm test
```

Expect: `setup-ar.mjs` prints ✓ lines (it adds ZXing and location permissions), and `npm test` ends with `pass 70`, `fail 0`.

## 2. Build (5 to 10 min)

```powershell
npm run build
npx cap sync android
cd android
.\gradlew.bat testDebugUnitTest
.\gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
cd ..
git add -A
git commit -m "Add GPS, QR markers, offline data, research logs, docs"
```

Expect: both Gradle commands end with `BUILD SUCCESSFUL`.

## 3. Phone tests (15 min, outdoors in an open area)

1. **Print** `docs/demo-checkpoint-markers.pdf` (page 1 is "main gate"), or just open it on a laptop screen.
2. Settings > Location > **Place demo map at my location** (allow location).
3. Map tab > **Show my location**: a blue dot should appear at the Main Gate.
4. Places > Demo Central Library > Guide me with AR > marker **Main gate** > Start AR guidance.
5. Point the camera at the QR code: it should say **Marker found**.
6. Stand at the tail of the arrow, face where it points, tap **Align here**. Walk along the amber arrows.
7. Cover the camera for 3 seconds: arrows should hide ("AR paused"), then return.
8. Tap End. Settings > Research sessions > **Copy as CSV**, and paste it to Claude.

## 4. Tell Claude

- Gradle result (success or the error)
- Did the blue dot appear? Did the QR code get recognised?
- Did arrows stay on the ground and hide when the camera was covered?
- The CSV from step 8
