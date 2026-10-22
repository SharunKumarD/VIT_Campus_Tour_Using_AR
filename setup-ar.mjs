// VIT ImmersiveAR — one-time Android setup for the ARCore step.
// Run from the project folder:   node setup-ar.mjs
// Safe to run more than once. Prints exactly what it changed. Makes a .bak
// copy of each file before its first change.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const ARCORE_VERSION = "1.54.0";
const APP = "android/app";
const MANIFEST = `${APP}/src/main/AndroidManifest.xml`;
const GRADLE = `${APP}/build.gradle`;
const MAIN = `${APP}/src/main/java/dev/sainikhil/immersivear/MainActivity.java`;

let failed = false;
const fail = (msg) => { console.error(`✗ ${msg}`); failed = true; };

function edit(file, fn) {
  if (!existsSync(file)) return fail(`${file} not found. Run this from C:\\dev\\vit-immersivear`);
  const before = readFileSync(file, "utf8");
  const result = fn(before);
  if (typeof result === "string" && result.startsWith("ERROR:")) return fail(`${file}: ${result.slice(6)}`);
  const [after, msg] = result;
  if (after === before) return console.log(`✓ ${file}: ${msg}`);
  if (!existsSync(file + ".bak")) copyFileSync(file, file + ".bak");
  writeFileSync(file, after);
  console.log(`✓ ${file}: ${msg}`);
}

// 1. ARCore library
edit(GRADLE, (s) => {
  if (s.includes("com.google.ar:core")) return [s, "ARCore dependency already present"];
  const i = s.search(/^dependencies\s*\{/m);
  if (i < 0) return "ERROR: no top-level dependencies { } block found";
  const brace = s.indexOf("{", i) + 1;
  const line = `\n    // ARCore (Google Play Services for AR) — native AR for VIT ImmersiveAR\n    implementation "com.google.ar:core:${ARCORE_VERSION}"`;
  return [s.slice(0, brace) + line + s.slice(brace), `added com.google.ar:core:${ARCORE_VERSION}`];
});

// 2. Manifest: camera permission, AR as OPTIONAL (app still installs on non-AR phones), AR screens.
//    Each piece is checked separately, so this also upgrades a project set up by an earlier version.
const AR_ACTIVITIES = ["ArTestActivity", "ArNavActivity"];
edit(MANIFEST, (s) => {
  if (!s.includes("</application>") || !s.includes("</manifest>")) return "ERROR: unexpected manifest structure";
  const added = [];
  let out = s;
  const beforeManifestEnd = (xml) => { out = out.replace("</manifest>", xml + "</manifest>"); };
  const beforeAppEnd = (xml) => { out = out.replace("</application>", xml + "    </application>"); };

  if (!out.includes("android.permission.CAMERA")) {
    beforeManifestEnd(
      `    <!-- AR: camera access, and ARCore is optional so non-AR phones can still install the app -->\n` +
      `    <uses-permission android:name="android.permission.CAMERA" />\n` +
      `    <uses-feature android:name="android.hardware.camera.ar" android:required="false" />\n` +
      `    <uses-feature android:name="android.hardware.camera" android:required="false" />\n` +
      `    <uses-feature android:glEsVersion="0x00020000" android:required="true" />\n`);
    added.push("CAMERA permission");
  }
  if (!out.includes('android:name="com.google.ar.core"')) {
    beforeAppEnd(`        <meta-data android:name="com.google.ar.core" android:value="optional" />\n`);
    added.push("optional ARCore");
  }
  for (const name of AR_ACTIVITIES) {
    if (out.includes(`.ar.${name}"`)) continue;
    beforeAppEnd(
      `        <activity\n` +
      `            android:name=".ar.${name}"\n` +
      `            android:exported="false"\n` +
      `            android:screenOrientation="portrait"\n` +
      `            android:configChanges="orientation|screenSize|keyboardHidden"\n` +
      `            android:theme="@style/AppTheme.NoActionBar" />\n`);
    added.push(name);
  }
  return [out, added.length ? `added ${added.join(", ")}` : "AR entries already present"];
});

// 3. Register the plugin in MainActivity
edit(MAIN, (s) => {
  if (s.includes("registerPlugin(ImmersiveArPlugin.class)")) return [s, "plugin already registered"];
  if (!/public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*\}/.test(s)) {
    return "ERROR: MainActivity has been customised; add registerPlugin(ImmersiveArPlugin.class) before super.onCreate by hand";
  }
  const out =
`package dev.sainikhil.immersivear;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import dev.sainikhil.immersivear.ar.ImmersiveArPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugins must be registered before super.onCreate.
        registerPlugin(ImmersiveArPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
  return [out, "registered ImmersiveArPlugin"];
});

if (failed) {
  console.error("\nSome steps failed. Nothing else was changed. Send the message above to Claude.");
  process.exit(1);
}
console.log("\nDone. Next: npm install @capacitor/app@^8, then npm run build and npx cap sync android");
