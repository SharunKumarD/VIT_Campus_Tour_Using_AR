/**
 * Typed interface to the native ARCore plugin (android/.../ar/ImmersiveArPlugin.java).
 *
 * Every function is safe to call in a desktop browser: outside the Android
 * app it reports "NOT_ANDROID" instead of throwing, so screens can show the
 * map fallback.
 */

import { Capacitor, registerPlugin } from "@capacitor/core";
import { parseNavSession, type NavSession } from "./nav-session.ts";

export type { NavOutcome, NavSession } from "./nav-session.ts";

export type ArAvailability =
  | "SUPPORTED_INSTALLED"
  | "SUPPORTED_NOT_INSTALLED"
  | "SUPPORTED_APK_TOO_OLD"
  | "UNSUPPORTED_DEVICE_NOT_CAPABLE"
  | "UNKNOWN_CHECKING"
  | "UNKNOWN_TIMED_OUT"
  | "UNKNOWN_ERROR"
  | "NOT_ANDROID";

export interface AvailabilityResult {
  status: ArAvailability;
  supported: boolean;
  installed: boolean;
  cameraPermission?: "granted" | "denied" | "prompt" | "prompt-with-rationale";
}

export interface ArTestResult {
  /** False if the user left with the system back gesture before closing normally. */
  completed: boolean;
  arrowPlaced: boolean;
  /** Most floor planes tracked at once. */
  maxPlanes: number;
  /** Times camera tracking dropped from TRACKING to PAUSED. */
  trackingLossCount: number;
  secondsTracking: number;
}

/** Error codes the native side can return. */
export type ArErrorCode =
  | "CAMERA_DENIED"
  | "CAMERA_UNAVAILABLE"
  | "DEVICE_NOT_COMPATIBLE"
  | "INSTALL_DECLINED"
  | "INSTALL_ERROR"
  | "ARCORE_NOT_INSTALLED"
  | "ARCORE_TOO_OLD"
  | "APP_TOO_OLD"
  | "SESSION_FAILED"
  | "RENDER_INIT_FAILED"
  | "FRAME_FAILED"
  | "AVAILABILITY_ERROR"
  | "BAD_ROUTE"
  | "NOT_ANDROID"
  | "UNKNOWN";

export class ArError extends Error {
  readonly code: ArErrorCode;
  constructor(code: ArErrorCode, message: string) {
    super(message);
    this.name = "ArError";
    this.code = code;
  }
}

interface ImmersiveArPlugin {
  checkAvailability(): Promise<AvailabilityResult>;
  requestInstall(): Promise<{ status: "INSTALLED" | "INSTALL_REQUESTED" }>;
  openArTest(): Promise<ArTestResult>;
  startNavigation(options: { payload: string }): Promise<{ outcome: string; resultJson?: string | null }>;
}



const Native = registerPlugin<ImmersiveArPlugin>("ImmersiveAr");

export const isAndroidApp = (): boolean => Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();

function toArError(e: unknown): ArError {
  const err = e as { code?: string; message?: string };
  const known: readonly string[] = [
    "CAMERA_DENIED", "CAMERA_UNAVAILABLE", "DEVICE_NOT_COMPATIBLE", "INSTALL_DECLINED", "INSTALL_ERROR",
    "ARCORE_NOT_INSTALLED", "ARCORE_TOO_OLD", "APP_TOO_OLD", "SESSION_FAILED", "RENDER_INIT_FAILED",
    "FRAME_FAILED", "AVAILABILITY_ERROR", "BAD_ROUTE",
  ];
  const code = err?.code && known.includes(err.code) ? (err.code as ArErrorCode) : "UNKNOWN";
  return new ArError(code, err?.message || "Unknown AR error");
}

export async function checkArAvailability(): Promise<AvailabilityResult> {
  if (!isAndroidApp()) return { status: "NOT_ANDROID", supported: false, installed: false };
  try {
    return await Native.checkAvailability();
  } catch (e) {
    throw toArError(e);
  }
}

export async function requestArInstall(): Promise<"INSTALLED" | "INSTALL_REQUESTED"> {
  if (!isAndroidApp()) throw new ArError("NOT_ANDROID", "AR is only available in the Android app.");
  try {
    return (await Native.requestInstall()).status;
  } catch (e) {
    throw toArError(e);
  }
}

export async function openArTest(): Promise<ArTestResult> {
  if (!isAndroidApp()) throw new ArError("NOT_ANDROID", "AR is only available in the Android app.");
  try {
    return await Native.openArTest();
  } catch (e) {
    throw toArError(e);
  }
}

/** Start AR route guidance. The payload comes from buildNavPayload(). */
export async function startArNavigation(payload: object): Promise<NavSession> {
  if (!isAndroidApp()) throw new ArError("NOT_ANDROID", "AR is only available in the Android app.");
  try {
    const r = await Native.startNavigation({ payload: JSON.stringify(payload) });
    return parseNavSession(r.outcome, r.resultJson);
  } catch (e) {
    throw toArError(e);
  }
}

/** Plain-language explanation of an availability status. */
export function describeAvailability(s: ArAvailability): { title: string; detail: string; ok: boolean } {
  switch (s) {
    case "SUPPORTED_INSTALLED":
      return { ok: true, title: "AR is ready on this phone", detail: "ARCore is supported and installed." };
    case "SUPPORTED_NOT_INSTALLED":
      return { ok: false, title: "One install needed", detail: "This phone supports AR. Install Google Play Services for AR to use it." };
    case "SUPPORTED_APK_TOO_OLD":
      return { ok: false, title: "Update needed", detail: "Update Google Play Services for AR to use AR." };
    case "UNSUPPORTED_DEVICE_NOT_CAPABLE":
      return { ok: false, title: "AR not supported", detail: "This phone does not support ARCore. Map and step-by-step directions still work." };
    case "NOT_ANDROID":
      return { ok: false, title: "AR needs the Android app", detail: "You are viewing the app in a browser. Install the APK on an ARCore phone to use AR." };
    default:
      return { ok: false, title: "Could not confirm AR support", detail: "Check your internet connection and try again." };
  }
}
