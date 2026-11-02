# Contributing

Thanks for helping improve VIT ImmersiveAR.

## Workflow
1. Create a branch: `git checkout -b feature/short-name`.
2. Make your change. Keep the app working offline and never add API keys or secrets.
3. Run the checks:
   ```bash
   npm test
   npm run build
   cd android && ./gradlew testDebugUnitTest && cd ..
   ```
4. Commit with a clear message (`feat: …`, `fix: …`, `docs: …`) and open a pull request.

## Rules for campus data
- Never invent coordinates, rooms or accessibility details. Record where data came from (`provenance.source`) and mark it `unverified` until checked.
- Unknown steps must stay `"unknown"`, never `"none"`; the step-free router depends on it.
- OpenStreetMap data needs the credit "© OpenStreetMap contributors".
- Photos: use your own or properly licensed images only.

## Code style
- TypeScript strict mode; keep logic in `src/lib` and test it in `tests/`.
- Native AR code is Java in `android/app/src/main/java/dev/sainikhil/immersivear/ar` with JUnit tests in `android/app/src/test`.
