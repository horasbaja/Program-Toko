import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Search } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { num, fdate, whName } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Sel, Field, Empty } from "@/components/common";

function TransferDialog({ open, onClose, product, onDone }) {
  const { products, warehouses } = useData();
  const [f, setF] = useState({});
  useEffect(() => { if (open) setF({ product_id: product?.id || products[0]?.id, from_wh: "G1", to_wh: "G2", qty: "", note: "" }); }, [open, product, products]);
  const p = products.find((x) => x.id === f.product_id);
  const submit = async () => {
    try { const { data } = await api.post("/stock/transfer", { ...f, qty: Number(f.qty) }); toast.success(`Mutasi ${data.no} berhasil`); onDone(); onClose(); } catch (e) { toast.error(errMsg(e)); }
  };
  const whOpts = warehouses.map((w) => ({ value: w.code, label: `${w.code} - ${w.name}` }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="transfer-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">Mutasi Stok Antar Gudang</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Barang"><Sel testid="transfer-product-select" value={f.product_id} onChange={(v) => setF({ ...f, product_id: v })} options={products.map((x) => ({ value: x.id, label: x.name }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari Gudang"><Sel testid="transfer-from-select" value={f.from_wh} onChange={(v) => setF({ ...f, from_wh: v })} options={whOpts} /></Field>
            <Field label="Ke Gudang"><Sel testid="transfer-to-select" value={f.to_wh} onChange={(v) => setF({ ...f, to_wh: v })} options={whOpts} /></Field>
          </div>
          {p && <div className="font-mono text-xs text-muted-foreground">Stok asal: {num(p.stock?.[f.from_wh])} {p.unit}</div>}
          <Field label={`Qty (${p?.unit || ""})`}><Input type="number" data-testid="transfer-qty-input" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Keterangan"><Input data-testid="transfer-note-input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <Button data-testid="transfer-submit-button" onClick={submit}>Proses Mutasi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Stock() {
  const { products, categories, warehouses, refresh } = useData();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tr, setTr] = useState(null);
  const [logs, setLogs] = useState([]);
  const loadLogs = useCallback(() => api.get("/stock/transfers").then((r) => setLogs(r.data)).catch(() => null), []);
  useEffect(() => { refresh(); loadLogs(); }, [refresh, loadLogs]);
  const rows = useMemo(() => products.filter((p) => (!cat || p.category_id === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()))), [products, q, cat]);
  return (
    <div>
      <PageHeader title="Stok Multi-Gudang" subtitle="Mojopahit & Wahidin">
        <Button className="gap-2 h-11" data-testid="stock-transfer-button" onClick={() => setTr({})}><ArrowLeftRight className="h-4 w-4" /> Mutasi Stok</Button>
      </PageHeader>
      <div className="panel p-3 mb-3 flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input data-testid="stock-search-input" className="pl-9" placeholder="Cari barang..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Sel testid="stock-category-filter" value={cat} onChange={setCat} placeholder="Semua Kategori" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
      </div>
      <div className="panel overflow-x-auto" data-testid="stock-table">
        <table className="dtable">
          <thead><tr><th>Barang</th><th>Kategori</th>{warehouses.map((w) => <th key={w.code} className="text-right">{w.code} · {w.name}</th>)}<th className="text-right">Total</th><th>Satuan</th><th /></tr></thead>
          <tbody>
            {rows.map((p, i) => {
              const total = Object.values(p.stock || {}).reduce((a, b) => a + Number(b || 0), 0);
              const low = total <= Number(p.min_stock || 0);
              return (
                <tr key={p.id} data-testid={`stock-row-${i}`}>
                  <td>{p.name}{p.is_length && <div className="text-xs text-muted-foreground">{num(p.length)} m / {p.unit}</div>}</td>
                  <td className="text-xs text-muted-foreground">{p.category_name}</td>
                  {warehouses.map((w) => <td key={w.code} className="num">{num(p.stock?.[w.code])}</td>)}
                  <td className={`num font-semibold ${low ? "text-red-400" : ""}`}>{num(total)}{low && <div className="text-[10px]">MENIPIS</div>}</td>
                  <td className="text-xs">{p.unit}</td>
                  <td><Button size="sm" variant="ghost" data-testid={`stock-transfer-${i}`} onClick={() => setTr({ product: p })}><ArrowLeftRight className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
      <div className="panel mt-4 overflow-x-auto" data-testid="transfer-log">
        <div className="p-3 font-heading text-lg uppercase">Riwayat Mutasi</div>
        <table className="dtable">
          <thead><tr><th>No</th><th>Tanggal</th><th>Barang</th><th>Dari</th><th>Ke</th><th className="text-right">Qty</th><th>Oleh</th></tr></thead>
          <tbody>{logs.map((l) => <tr key={l.id}><td className="font-mono">{l.no}</td><td>{fdate(l.date)}</td><td>{l.product_name}</td><td>{whName(warehouses, l.from_wh)}</td><td>{whName(warehouses, l.to_wh)}</td><td className="num">{num(l.qty)} {l.unit}</td><td>{l.by}</td></tr>)}</tbody>
        </table>
        {!logs.length && <Empty text="Belum ada mutasi" />}
      </div>
      <TransferDialog open={!!tr} product={tr?.product} onClose={() => setTr(null)} onDone={() => { refresh(); loadLogs(); }} />
    </div>
  );
}
