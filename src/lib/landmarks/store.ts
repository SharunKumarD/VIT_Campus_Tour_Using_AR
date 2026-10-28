"use client";

/**
 * Campus landmarks for outdoor guidance.
 *
 * The app ships only the NAMES of well-known VIT Vellore places. It does not
 * ship coordinates or photos: those are recorded on the phone by the user,
 * standing at the place ("Save my location here") and taking their own photo.
 * Nothing is copied from Google Maps or any website, and nothing is invented.
 *
 * Stored in this phone's localStorage only (never uploaded).
 */

import { useEffect, useState } from "react";

export type LandmarkKind = "academic" | "library" | "hostel" | "entrance" | "food" | "other";

export interface LandmarkDef {
  id: string;
  name: string;
  /** Short label, e.g. "SJT". */
  short: string;
  kind: LandmarkKind;
  custom?: boolean;
  /** Built-in position from OpenStreetMap (or the student's own GPS survey). */
  seed?: { lat: number; lng: number; accuracyM: number; source: string };
}

export interface LandmarkData {
  lat: number;
  lng: number;
  accuracyM: number;
  /** ISO time the location was saved. */
  savedAt: string;
  /** JPEG data URL of the user's own photo, resized on the phone. */
  photo?: string;
}

export interface Landmark extends LandmarkDef {
  data?: LandmarkData;
  /** "phone" = saved on this phone; "osm"/"survey" = built-in. */
  dataSource?: "phone" | "builtin";
}

const OSM = "OpenStreetMap (© OpenStreetMap contributors, ODbL), building centre";
const osm = (lat: number, lng: number, accuracyM = 25) => ({ lat, lng, accuracyM, source: OSM });

/**
 * Built-in positions: OpenStreetMap building outlines (centre point), fetched
 * 2026-10-29, plus the PRP E2 entrance from the student's own GPS survey.
 * Positions are building centres, so "arrived" uses a generous radius.
 * MGR Block is not mapped in OpenStreetMap: set it on site with "I'm here".
 */
export const PRESET_LANDMARKS: LandmarkDef[] = [
  { id: "main-gate", name: "VIT Main Gate", short: "Gate", kind: "entrance", seed: osm(12.968351, 79.155678, 15) },
  { id: "sjt", name: "Silver Jubilee Tower (SJT)", short: "SJT", kind: "academic", seed: osm(12.970957, 79.163902) },
  { id: "tt", name: "Technology Tower (TT)", short: "TT", kind: "academic", seed: osm(12.970606, 79.159531) },
  { id: "smv", name: "Sir M. Visvesvaraya Block (SMV)", short: "SMV", kind: "academic", seed: osm(12.969234, 79.157731) },
  { id: "gdn", name: "G.D. Naidu Block (GDN)", short: "GDN", kind: "academic", seed: osm(12.969976, 79.154837) },
  { id: "mgb", name: "Mahatma Gandhi Block (MGB)", short: "MGB", kind: "academic", seed: osm(12.972115, 79.167848) },
  { id: "prp", name: "Pearl Research Park (PRP) – E2 entrance", short: "PRP", kind: "academic", seed: { lat: 12.971579, lng: 79.165686, accuracyM: 10, source: "Student GPS survey at the E2 entrance, 2026-10-28" } },
  { id: "mgr", name: "Dr. M.G.R. Block", short: "MGR", kind: "academic" },
  { id: "library", name: "Periyar Central Library", short: "Library", kind: "library", seed: osm(12.969332, 79.156848) },
  { id: "anna-audi", name: "Anna Auditorium", short: "Anna", kind: "other", seed: osm(12.969978, 79.155638) },
  { id: "food-court", name: "Food Court", short: "Food", kind: "food", seed: osm(12.970020, 79.158970) },
  { id: "health", name: "Health Centre", short: "Health", kind: "other", seed: osm(12.969528, 79.154646) },
  { id: "mens-hostel", name: "Men's Hostel main gate", short: "MH", kind: "hostel", seed: { lat: 12.968366, lng: 79.159508, accuracyM: 15, source: "OpenStreetMap (© OpenStreetMap contributors, ODbL): \"security point & main gate for hostels\"" } },
  { id: "ladies-hostel", name: "Ladies' Hostel (Mother Teresa Block)", short: "LH", kind: "hostel", seed: osm(12.971060, 79.160663) },
];

export const KIND_LABEL: Record<LandmarkKind, string> = {
  academic: "Academic block",
  library: "Library",
  hostel: "Hostel",
  entrance: "Entrance",
  food: "Food",
  other: "Place",
};

const KEY = "vitiar.landmarks.v1";
const EVENT = "vitiar-landmarks";

interface Saved {
  data: Record<string, LandmarkData>;
  custom: LandmarkDef[];
}

function read(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { data: {}, custom: [] };
    const p = JSON.parse(raw) as Partial<Saved>;
    const data: Record<string, LandmarkData> = {};
    for (const [id, d] of Object.entries(p.data ?? {})) {
      if (d && ((Number.isFinite(d.lat) && Number.isFinite(d.lng) && Math.abs(d.lat) <= 90 && Math.abs(d.lng) <= 180) || typeof d.photo === "string")) data[id] = d;
    }
    const custom = Array.isArray(p.custom) ? p.custom.filter((c) => c && typeof c.id === "string" && typeof c.name === "string") : [];
    return { data, custom };
  } catch {
    return { data: {}, custom: [] };
  }
}

function write(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new Error("Could not save on this phone (storage full?). Try a smaller photo or delete one.");
  }
  window.dispatchEvent(new Event(EVENT));
}

export function allLandmarks(): Landmark[] {
  const s = read();
  return [...PRESET_LANDMARKS, ...s.custom].map((d) => {
    const saved = s.data[d.id];
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) return { ...d, data: saved, dataSource: "phone" as const };
    if (d.seed) {
      return { ...d, dataSource: "builtin" as const, data: { lat: d.seed.lat, lng: d.seed.lng, accuracyM: d.seed.accuracyM, savedAt: "", photo: saved?.photo } };
    }
    return { ...d };
  });
}

export function getLandmark(id: string | null): Landmark | undefined {
  return id ? allLandmarks().find((l) => l.id === id) : undefined;
}

export function saveLocation(id: string, fix: { lat: number; lng: number; accuracyM: number }): void {
  const s = read();
  const prev = s.data[id];
  s.data[id] = { lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM, savedAt: new Date().toISOString(), photo: prev?.photo };
  write(s);
}

export function savePhoto(id: string, photo: string): void {
  const s = read();
  const prev = s.data[id];
  if (prev) {
    s.data[id] = { ...prev, photo };
  } else {
    const def = [...PRESET_LANDMARKS, ...s.custom].find((d) => d.id === id);
    if (!def?.seed) throw new Error("Save the location first, then add a photo.");
    // Photo only: keep using the built-in position (NaN marks "no saved position").
    s.data[id] = { lat: Number.NaN, lng: Number.NaN, accuracyM: 0, savedAt: "", photo }; // stored as null: "no saved position"
  }
  write(s);
}

export function clearLandmark(id: string): void {
  const s = read();
  delete s.data[id];
  s.custom = s.custom.filter((c) => c.id !== id);
  write(s);
}

export function addCustom(name: string): string {
  const clean = name.trim().slice(0, 60);
  if (!clean) throw new Error("Enter a name.");
  const s = read();
  const id = `custom-${Date.now().toString(36)}`;
  s.custom.push({ id, name: clean, short: clean.slice(0, 8), kind: "other", custom: true });
  write(s);
  return id;
}

/** Re-renders when landmarks change (this tab or another). */
export function useLandmarks(): Landmark[] {
  const [list, setList] = useState<Landmark[]>(PRESET_LANDMARKS);
  useEffect(() => {
    const update = () => setList(allLandmarks());
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return list;
}

/** Shrink a camera photo to a small JPEG so it fits in phone storage. */
export function resizePhoto(file: File, maxSide = 720, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error("Could not process the photo."));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a photo this phone can read."));
    };
    img.src = url;
  });
}
