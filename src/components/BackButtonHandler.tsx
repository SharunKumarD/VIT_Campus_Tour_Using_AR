"use client";

/**
 * Android back button: go back one screen inside the app; only leave the
 * app from the home screen. Does nothing in a desktop browser.
 */

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";

export function BackButtonHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    void App.addListener("backButton", ({ canGoBack }) => {
      const atHome = window.location.pathname === "/" || window.location.pathname === "";
      if (!atHome && canGoBack) window.history.back();
      else void App.exitApp();
    }).then((h) => {
      if (cancelled) void h.remove();
      else handle = h;
    });
    return () => {
      cancelled = true;
      void handle?.remove();
    };
  }, []);
  return null;
}
