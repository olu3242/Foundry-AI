"use client";

/** Captures saved on the device while offline, sent when the network returns. IndexedDB, no deps. */
export type OutboxItem = {
  clientRef: string;
  businessId: string;
  channel: "text" | "voice" | "photo";
  text: string;
  photo?: Blob;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB = "foundry-outbox";
const STORE = "captures";
export const OUTBOX_EVENT = "foundry:outbox";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientRef" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const changed = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

export async function addToOutbox(item: Omit<OutboxItem, "attempts" | "createdAt">) {
  await tx("readwrite", (s) => s.put({ ...item, attempts: 0, createdAt: Date.now() }));
  changed();
}

export const listOutbox = () => tx<OutboxItem[]>("readonly", (s) => s.getAll());

let flushing: Promise<{ sent: number; failed: number }> | null = null;

/** Sends queued captures oldest first. Stops on network errors; drops items the server rejects (4xx). */
export function flushOutbox() {
  flushing ??= (async () => {
    let sent = 0;
    let failed = 0;
    const items = (await listOutbox()).sort((a, b) => a.createdAt - b.createdAt);
    for (const item of items) {
      const body = new FormData();
      body.set("businessId", item.businessId);
      body.set("channel", item.channel);
      if (item.text) body.set("text", item.text);
      if (item.photo) body.set("photo", new File([item.photo], "capture.jpg", { type: item.photo.type || "image/jpeg" }));
      try {
        const res = await fetch("/api/captures", { method: "POST", body, headers: { "Idempotency-Key": item.clientRef } });
        if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 401 && res.status !== 408 && res.status !== 429)) {
          await tx("readwrite", (s) => s.delete(item.clientRef));
          if (res.ok) sent += 1;
          else failed += 1;
        } else {
          await tx("readwrite", (s) => s.put({ ...item, attempts: item.attempts + 1, lastError: `HTTP ${res.status}` }));
          break;
        }
      } catch {
        break; // still offline
      }
    }
    changed();
    return { sent, failed };
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
