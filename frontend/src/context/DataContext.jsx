import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { kvGet, kvSet, queueAll, syncQueue } from "@/lib/offline";
import { useAuth } from "./AuthContext";

const DataCtx = createContext(null);
const EMPTY = { settings: {}, warehouses: [], categories: [], suppliers: [], products: [], customers: [] };

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY);
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const countQueue = useCallback(() => queueAll().then((q) => setQueueCount((q || []).length)).catch(() => null), []);

  const refresh = useCallback(async () => {
    try {
      const { data: d } = await api.get("/bootstrap");
      setData(d);
      await kvSet("bootstrap", d);
    } catch (e) {
      const c = await kvGet("bootstrap").catch(() => null);
      if (c) setData(c);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    const r = await syncQueue().catch(() => ({ synced: 0 }));
    setSyncing(false);
    if (r.synced) toast.success(`${r.synced} transaksi offline berhasil di-sync ke server`);
    await countQueue();
    if (r.synced) refresh();
  }, [countQueue, refresh]);

  useEffect(() => {
    if (!user) return;
    kvGet("bootstrap").then((c) => c && setData(c)).catch(() => null);
    refresh();
    countQueue();
  }, [user, refresh, countQueue]);

  useEffect(() => {
    const on = () => { setOnline(true); toast.success("Koneksi kembali online"); syncNow(); };
    const off = () => { setOnline(false); toast.warning("Mode Offline: transaksi akan disimpan di antrian lokal"); };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [syncNow]);

  useEffect(() => { if (user && online && queueCount > 0) syncNow(); }, [user]); // eslint-disable-line

  return (
    <DataCtx.Provider value={{ ...data, setData, refresh, online, queueCount, countQueue, syncNow, syncing }}>
      {children}
    </DataCtx.Provider>
  );
}

export const useData = () => useContext(DataCtx);
