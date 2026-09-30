import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, num, todayStr, uid } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Sel } from "@/components/common";
import { BendToggle } from "@/components/pos/ItemAdder";

const PAID = ["Belum Bayar", "Sebagian", "Lunas"];
const itemSubtotal = (it) => Math.round((it.is_length ? Number(it.qty) * Number(it.length) : Number(it.qty) * (Number(it.ratio) || 1)) * (Number(it.hpp_unit) || 0));

function POItemRow({ it, i, upd, del, products }) {
  const pick = (id) => {
    const p = products.find((x) => x.id === id);
    if (p) upd(i, { product_id: p.id, name: p.name, category_name: p.category_name, is_length: p.is_length, unit: p.unit, length: p.length || "", hpp_unit: p.hpp || 0, bend: "lurus", ratio: 1 });
  };
  return (
    <div className="panel p-3 grid gap-2" data-testid={`po-item-${i}`}>
      <div className="flex gap-2">
        {it.sale_line_id ? <div className="flex-1 text-sm font-medium">{it.name} <span className="tag tag-indent">INDENT</span></div> :
          <Sel testid={`po-item-product-${i}`} className="flex-1" value={it.product_id} onChange={pick} placeholder="Pilih barang..." options={products.map((p) => ({ value: p.id, label: p.name }))} />}
        <Button size="icon" variant="ghost" onClick={() => del(i)} data-testid={`po-item-remove-${i}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {it.is_length && <Field label="Panjang (m)"><Input type="number" data-testid={`po-item-length-${i}`} value={it.length ?? ""} onChange={(e) => upd(i, { length: e.target.value })} /></Field>}
        <Field label={`Qty (${it.unit || "Pcs"})`}><Input type="number" data-testid={`po-item-qty-${i}`} value={it.qty ?? ""} onChange={(e) => upd(i, { qty: e.target.value })} /></Field>
        <Field label={it.is_length ? "HPP Beli / Meter" : "HPP Satuan"}><Input type="number" data-testid={`po-item-hpp-${i}`} value={it.hpp_unit ?? ""} onChange={(e) => upd(i, { hpp_unit: e.target.value })} /></Field>
        <Field label="Subtotal"><div className="h-10 flex items-center font-mono text-sm">{rp(itemSubtotal(it))}</div></Field>
      </div>
      {it.is_length && (
        <div className="flex flex-wrap items-center gap-3">
          <BendToggle value={it.bend} onChange={(v) => upd(i, { bend: v })} testid={`po-item-bend-${i}`} />
          <span className="font-mono text-xs text-muted-foreground">{num(it.qty)} {it.unit} × {num(it.length)} m = {num(Number(it.qty) * Number(it.length))} m</span>
        </div>
      )}
    </div>
  );
}

export function PODialog({ po, open, onClose, onSaved }) {
  const { suppliers, products, warehouses } = useData();
  const [f, setF] = useState(null);
  useEffect(() => {
    if (!open) return;
    setF(po ? { ...po, items: po.items.map((i) => ({ ...i })) } : { supplier_id: suppliers[0]?.id, date: todayStr(), warehouse: "G1", paid_status: "Belum Bayar", paid_amount: 0, notes: "", items: [] });
  }, [open, po, suppliers]);
  if (!open || !f) return null;
  const upd = (i, p) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const itemsTotal = f.items.reduce((a, it) => a + itemSubtotal(it), 0);
  const save = async () => {
    try {
      const body = { ...f, paid_amount: Number(f.paid_amount) || 0, total_manual: f.total_manual === "" || f.total_manual == null ? null : Number(f.total_manual),
        items: f.items.map((it) => ({ ...it, qty: Number(it.qty), length: Number(it.length) || 0, hpp_unit: Number(it.hpp_unit) || 0 })) };
      const { data } = po ? await api.put(`/purchases/${po.id}`, body) : await api.post("/purchases", body);
      toast.success(po ? "PO diperbarui, HPP & utang dagang disesuaikan" : `PO ${data.po_no} dibuat`);
      onSaved?.(data);
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto" data-testid="po-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">{po ? `Edit PO ${po.po_no}` : "Buat PO / Pembelian Manual"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Supplier"><Sel testid="po-supplier-select" value={f.supplier_id} onChange={(v) => setF({ ...f, supplier_id: v })} options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.prefix})` }))} /></Field>
          <Field label="Tanggal"><Input type="date" data-testid="po-date-input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Gudang Tujuan"><Sel testid="po-warehouse-select" value={f.warehouse} onChange={(v) => setF({ ...f, warehouse: v })} options={warehouses.map((w) => ({ value: w.code, label: `${w.code} - ${w.name}` }))} /></Field>
          <Field label="Status Bayar"><Sel testid="po-paid-status-select" value={f.paid_status} onChange={(v) => setF({ ...f, paid_status: v })} options={PAID} /></Field>
          <Field label="Sudah Dibayar (Rp)"><Input type="number" data-testid="po-paid-amount-input" value={f.paid_amount ?? 0} onChange={(e) => setF({ ...f, paid_amount: e.target.value })} /></Field>
          <Field label="Override Total Tagihan (opsional)"><Input type="number" data-testid="po-total-manual-input" placeholder={String(itemsTotal)} value={f.total_manual ?? ""} onChange={(e) => setF({ ...f, total_manual: e.target.value })} /></Field>
          <Field label="Catatan" className="col-span-2 md:col-span-3"><Input data-testid="po-notes-input" value={f.notes || ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <div className="grid gap-2">
          {f.items.map((it, i) => <POItemRow key={it.line_id || it._key} it={it} i={i} upd={upd} del={(j) => setF({ ...f, items: f.items.filter((_, k) => k !== j) })} products={products} />)}
          <Button variant="secondary" className="gap-2" data-testid="po-add-item-button" onClick={() => setF({ ...f, items: [...f.items, { _key: uid(), qty: 1, unit: "Pcs", hpp_unit: 0 }] })}><Plus className="h-4 w-4" /> Tambah Barang</Button>
        </div>
        <div className="flex items-center justify-between font-mono text-sm">
          <span>Total Item: <b>{rp(itemsTotal)}</b> {f.total_manual ? `· Total Override: ${rp(f.total_manual)}` : ""}</span>
          <Button data-testid="po-save-button" onClick={save} className="h-11 px-8">Simpan PO</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
