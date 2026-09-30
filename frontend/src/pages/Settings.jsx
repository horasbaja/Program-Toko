import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { api, errMsg, download } from "@/lib/api";
import { todayStr } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Field } from "@/components/common";
import EntityManager from "@/components/EntityManager";

const STORE_FIELDS = [["name", "Nama Toko"], ["tagline", "Tagline"], ["address", "Alamat Toko Utama"], ["phone", "Telp"], ["wa1", "HP/WA 1"], ["wa2", "HP/WA 2"], ["bank", "Info Rekening Bank"]];
const CSV = ["products", "customers", "suppliers", "categories", "sales", "purchases", "stock_transfers", "expenses"];

function StoreForm() {
  const { settings, refresh } = useData();
  const [f, setF] = useState({});
  useEffect(() => setF(settings || {}), [settings]);
  const save = async () => { try { await api.put("/settings", f); toast.success("Identitas toko disimpan"); refresh(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="panel p-4 grid gap-3 md:grid-cols-2" data-testid="store-settings-form">
      {STORE_FIELDS.map(([k, l]) => <Field key={k} label={l}><Input data-testid={`store-${k}-input`} value={f[k] || ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
      <Field label="Footer Nota" className="md:col-span-2"><Textarea data-testid="store-footer-input" value={f.footer || ""} onChange={(e) => setF({ ...f, footer: e.target.value })} /></Field>
      <Button data-testid="store-save-button" onClick={save} className="md:col-span-2">Simpan Identitas Toko</Button>
    </div>
  );
}

function Warehouses() {
  const { warehouses, refresh } = useData();
  const [rows, setRows] = useState([]);
  useEffect(() => setRows(warehouses.map((w) => ({ ...w }))), [warehouses]);
  const save = async (w) => { try { await api.put(`/warehouses/${w.code}`, w); toast.success(`${w.code} disimpan`); refresh(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((w, i) => (
        <div key={w.code} className="panel p-4 grid gap-3" data-testid={`warehouse-card-${w.code}`}>
          <div className="font-mono text-primary">{w.code}</div>
          <Field label="Nama Gudang"><Input data-testid={`warehouse-name-${w.code}`} value={w.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></Field>
          <Field label="Alamat"><Input data-testid={`warehouse-address-${w.code}`} value={w.address} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)))} /></Field>
          <Button variant="secondary" data-testid={`warehouse-save-${w.code}`} onClick={() => save(w)}>Simpan</Button>
        </div>
      ))}
    </div>
  );
}

function Backup() {
  const { refresh } = useData();
  const dl = (p, n) => download(p, n).catch((e) => toast.error(errMsg(e)));
  const restore = async (file) => {
    if (!file || !window.confirm("Restore akan MENGGANTI seluruh data saat ini. Lanjutkan?")) return;
    try { const json = JSON.parse(await file.text()); const { data } = await api.post("/backup/import", json); toast.success(`Restore selesai: ${Object.keys(data.restored).length} koleksi`); refresh(); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel p-4 grid gap-3">
        <div className="font-heading text-xl uppercase">Backup Database (JSON)</div>
        <p className="text-sm text-muted-foreground">Unduh seluruh data untuk dipindahkan ke server mandiri (VPS / cloud).</p>
        <Button className="gap-2" data-testid="backup-json-button" onClick={() => dl("/backup/export", `horasbaja-backup-${todayStr()}.json`)}><Download className="h-4 w-4" /> Export JSON Lengkap</Button>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border p-3 text-sm hover:bg-secondary" data-testid="restore-json-label">
          <Upload className="h-4 w-4" /> Restore dari File JSON
          <input type="file" accept="application/json" className="hidden" data-testid="restore-json-input" onChange={(e) => restore(e.target.files?.[0])} />
        </label>
      </div>
      <div className="panel p-4">
        <div className="font-heading text-xl uppercase mb-3">Export CSV per Tabel</div>
        <div className="grid grid-cols-2 gap-2">
          {CSV.map((c) => <Button key={c} variant="secondary" data-testid={`export-csv-${c}`} onClick={() => dl(`/backup/csv/${c}`, `${c}-${todayStr()}.csv`)}>{c}.csv</Button>)}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <div>
      <PageHeader title="Pengaturan Sistem" subtitle="Khusus Admin" />
      <Tabs defaultValue="store">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="store" data-testid="settings-tab-store">Identitas Toko</TabsTrigger>
          <TabsTrigger value="wh" data-testid="settings-tab-warehouses">Gudang</TabsTrigger>
          <TabsTrigger value="users" data-testid="settings-tab-users">Manajemen User</TabsTrigger>
          <TabsTrigger value="backup" data-testid="settings-tab-backup">Backup & Export</TabsTrigger>
        </TabsList>
        <TabsContent value="store" className="mt-4"><StoreForm /></TabsContent>
        <TabsContent value="wh" className="mt-4"><Warehouses /></TabsContent>
        <TabsContent value="users" className="mt-4">
          <EntityManager title="User" endpoint="/users" testid="users-manager" defaults={{ role: "kasir", active: true }}
            fields={[{ key: "username", label: "Username", createOnly: true }, { key: "name", label: "Nama" },
              { key: "role", label: "Role", type: "select", options: [{ value: "admin", label: "Admin / Pemilik" }, { value: "kasir", label: "Kasir" }] },
              { key: "active", label: "Aktif", type: "switch" }, { key: "password", label: "Password (isi untuk ganti)", type: "password", table: false }]} />
        </TabsContent>
        <TabsContent value="backup" className="mt-4"><Backup /></TabsContent>
      </Tabs>
    </div>
  );
}
