/** Storage for research session records (IndexedDB, on this phone only). */

import { idbAdd, idbAll, idbClear, idbDelete, SESSIONS } from "../offline/idb.ts";
import type { SessionRecord } from "./session-log.ts";

export async function saveSession(r: SessionRecord): Promise<void> {
  await idbAdd(SESSIONS, r);
}

/** Newest first. IndexedDB keys are attached as `id`. */
export async function listSessions(): Promise<SessionRecord[]> {
  const all = await idbAll<SessionRecord>(SESSIONS);
  return all.map((r, i) => ({ ...r, id: r.id ?? i + 1 })).reverse();
}

export async function deleteAllSessions(): Promise<void> {
  await idbClear(SESSIONS);
}

export async function deleteSession(id: number): Promise<void> {
  await idbDelete(SESSIONS, id);
}
