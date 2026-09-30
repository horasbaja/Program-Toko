import { api } from "./api";

const DB_NAME = "horasbaja-pos";

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("kv");
      r.result.createObjectStore("queue", { keyPath: "offline_id" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function run(store, mode, fn) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}

export const kvGet = (k) => run("kv", "readonly", (s) => s.get(k));
export const kvSet = (k, v) => run("kv", "readwrite", (s) => s.put(v, k));
export const queueAdd = (sale) => run("queue", "readwrite", (s) => s.put(sale));
export const queueAll = () => run("queue", "readonly", (s) => s.getAll());
export const queueDel = (id) => run("queue", "readwrite", (s) => s.delete(id));

export async function syncQueue() {
  const items = (await queueAll()) || [];
  let synced = 0;
  for (const it of items) {
    try {
      await api.post("/sales", it);
      await queueDel(it.offline_id);
      synced += 1;
    } catch (e) {
      if (!e.response) break;
    }
  }
  return { synced, remaining: items.length - synced };
}

export async function deductLocalStock(lines) {
  const boot = await kvGet("bootstrap");
  if (!boot) return null;
  lines.filter((l) => l.mode === "ready").forEach((l) => {
    const p = boot.products.find((x) => x.id === l.product_id);
    if (p) p.stock[l.warehouse] = (Number(p.stock[l.warehouse]) || 0) - Number(l.qty) * (Number(l.ratio) || 1);
  });
  await kvSet("bootstrap", boot);
  return boot;
}
