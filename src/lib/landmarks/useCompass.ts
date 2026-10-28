"use client";

import { useEffect, useState } from "react";

/**
 * Phone compass heading (degrees clockwise from north) while `active`.
 * Uses the absolute device-orientation event (Android WebView / Chrome).
 * Returns null until the sensor reports, or if the phone has no compass.
 */
export function useCompass(active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    const onEvent = (ev: Event) => {
      const e = ev as DeviceOrientationEvent & { webkitCompassHeading?: number };
      let h: number | null = null;
      if (typeof e.webkitCompassHeading === "number") h = e.webkitCompassHeading;
      else if ((e.absolute || ev.type === "deviceorientationabsolute") && typeof e.alpha === "number") {
        // alpha is counter-clockwise; correct for the screen's own rotation.
        const screenAngle = typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0;
        h = (360 - e.alpha + screenAngle) % 360;
      }
      if (h !== null && Number.isFinite(h)) setHeading(h);
    };
    window.addEventListener("deviceorientationabsolute", onEvent);
    window.addEventListener("deviceorientation", onEvent);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onEvent);
      window.removeEventListener("deviceorientation", onEvent);
    };
  }, [active]);
  return heading;
}
