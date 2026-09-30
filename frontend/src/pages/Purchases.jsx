import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, fdate, RECEIVE_STATUSES } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, Sel, Empty } from "@/components/common";
import { PODetail } from "@/components/purchases/PODetail";
import { PODialog } from "@/components/purchases/PODialog";

const STATUS_COLOR = { Draft: "text-slate-400", "Dalam Proses": "text-sky-300", "Barang Diterima": "text-emerald-400", "Barang Belum Lengkap": "text-orange-300", "Barang Direject Semua": "text-red-400" };

export default function Purchases() {
  const { isAdmin } = useAuth();
  const { suppliers } = useData();
  const [fl, setFl] = useState({ q: "", supplier_id: "", status: "", type: "", date_from: "", date_to: "" });
  const [data, setData] = useState({ items: [], summary: {} });
  const [sel, setSel] = useState(null);
  const [dlg, setDlg] = useState(null);
  const set = (k, v) => setFl({ ...fl, [k]: v });

  const load = useCallback(() => api.get("/purchases", { params: fl }).then((r) => {
    setData(r.data);
    setSel((cur) => (cur ? r.data.items.find((p) => p.id === cur.id) || null : r.data.items[0] || null));
  }).catch((e) => toast.error(errMsg(e))), [fl]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <PageHeader title="Pembelian / PO Pabrik" subtitle={isAdmin ? "Purchasing & Utang Dagang" : "Status Tracking"}>
        {isAdmin && <Button className="gap-2 h-11" data-testid="po-create-button" onClick={() => setDlg({ po: null })}><Plus className="h-4 w-4" /> Buat PO / Pembelian Manual</Button>}
      </PageHeader>
      <div className="panel p-3 mb-3 grid gap-2 grid-cols-2 md:grid-cols-6" data-testid="po-filters">
        <div className="relative col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input data-testid="po-search-input" className="pl-9" placeholder="Cari No PO, nota, konsumen..." value={fl.q} onChange={(e) => set("q", e.target.value)} /></div>
        <Sel testid="po-supplier-filter" value={fl.supplier_id} onChange={(v) => set("supplier_id", v)} placeholder="Semua Supplier" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
        <Sel testid="po-status-filter" value={fl.status} onChange={(v) => set("status", v)} placeholder="Semua Status" options={["Draft", ...RECEIVE_STATUSES]} />
        <Input type="date" data-testid="po-date-from" value={fl.date_from} onChange={(e) => set("date_from", e.target.value)} />
        <Input type="date" data-testid="po-date-to" value={fl.date_to} onChange={(e) => set("date_to", e.target.value)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="panel overflow-hidden">
          <div className="max-h-[70vh] overflow-y-auto" data-testid="po-list">
            {data.items.map((p, i) => (
              <button key={p.id} data-testid={`po-row-${i}`} onClick={() => setSel(p)}
                className={`block w-full border-b border-border p-3 text-left transition-colors hover:bg-secondary/50 ${sel?.id === p.id ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}>
                <div className="flex justify-between"><span className="font-mono font-semibold text-orange-300">{p.po_no}</span><span className={`text-xs ${STATUS_COLOR[p.receive_status]}`}>{p.receive_status}</span></div>
                <div className="text-sm">{p.supplier_name}</div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{fdate(p.date)} · {p.type === "indent" ? `Indent · ${p.customer_name}` : "Manual"}</span>
                  {isAdmin && <span className="font-mono">{rp(p.total)}</span>}
                </div>
              </button>
            ))}
            {!data.items.length && <Empty text="Belum ada PO" />}
          </div>
          <div className="border-t-2 border-primary/60 bg-secondary/60 p-3 font-mono text-sm" data-testid="po-summary">
            {data.summary.count} PO{isAdmin && ` · Total ${rp(data.summary.total)} · Utang ${rp(data.summary.debt)}`}
          </div>
        </div>
        <div>{sel ? <PODetail po={sel} onChanged={(p) => { if (!p) setSel(null); load(); }} onEdit={(p) => setDlg({ po: p })} /> : <div className="panel"><Empty text="Pilih PO untuk melihat rincian" /></div>}</div>
      </div>
      <PODialog open={!!dlg} po={dlg?.po} onClose={() => setDlg(null)} onSaved={(p) => { setSel(p); load(); }} />
    </div>
  );
}
