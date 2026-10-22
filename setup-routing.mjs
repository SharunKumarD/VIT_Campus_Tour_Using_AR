// VIT ImmersiveAR — one-time setup for the routing engine files.
// Run from the project folder:   node setup-routing.mjs
// Safe to run more than once. It only changes the two settings listed below.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function update(file, change) {
  if (!existsSync(file)) {
    console.error(`✗ ${file} not found. Run this from C:\\dev\\vit-immersivear`);
    process.exit(1);
  }
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    console.error(`✗ Could not read ${file} as JSON. Edit it by hand (see the instructions in chat).`);
    process.exit(1);
  }
  const msg = change(json);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`✓ ${file}: ${msg}`);
}

// 1. Our engine imports files with their ".ts" extension so Node can run the
//    tests directly. TypeScript needs this flag to accept that (Next.js is fine with it).
update("tsconfig.json", (t) => {
  t.compilerOptions ??= {};
  if (t.compilerOptions.allowImportingTsExtensions === true) return "already set";
  t.compilerOptions.allowImportingTsExtensions = true;
  return 'added "allowImportingTsExtensions": true';
});

// 2. "npm test" runs the tests with Node's built-in test runner (no extra packages).
update("package.json", (p) => {
  p.scripts ??= {};
  const cmd = 'node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "tests/**/*.test.ts"';
  if (p.scripts.test === cmd) return "test script already set";
  p.scripts.test = cmd;
  return 'added "test" script';
});

console.log("\nDone. Now run:  npm test");
