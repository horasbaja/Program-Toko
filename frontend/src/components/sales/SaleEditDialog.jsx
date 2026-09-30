import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { summarize } from "@/lib/calc";
import { rp } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/common";
import { CartLines } from "@/components/pos/CartLines";
import { ItemAdder } from "@/components/pos/ItemAdder";

export function SaleEditDialog({ sale, onClose, onSaved }) {
  const { refresh } = useData();
  const [f, setF] = useState(null);
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (sale) setF({ ...sale, customer: { ...sale.customer }, items: sale.items.map((i) => ({ ...i })) }); setAdding(false); }, [sale]);
  if (!sale || !f) return null;
  const tot = summarize(f.items, f.ongkir, sale.payments || []);
  const save = async () => {
    try {
      const items = f.items.map(({ _key, ...l }) => l);
      const { data } = await api.put(`/sales/${sale.id}`, { items, delivery_date: f.delivery_date, notes: f.notes, ongkir: Number(f.ongkir) || 0,
        due_date: f.due_date, delivery_address: f.delivery_address, customer: f.customer });
      toast.success("Nota direvisi. Stok, Auto-PO & piutang diperbarui");
      refresh();
      onSaved?.(data);
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const set = (k, v) => setF({ ...f, [k]: v });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto" data-testid="sale-edit-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">Edit Nota {sale.invoice_no}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Nama Pelanggan"><Input data-testid="edit-customer-name" value={f.customer.name || ""} onChange={(e) => set("customer", { ...f.customer, name: e.target.value })} /></Field>
          <Field label="No HP"><Input data-testid="edit-customer-phone" value={f.customer.phone || ""} onChange={(e) => set("customer", { ...f.customer, phone: e.target.value })} /></Field>
          <Field label="Tanggal Pengantaran"><Input type="date" data-testid="edit-delivery-date" value={f.delivery_date || ""} onChange={(e) => set("delivery_date", e.target.value)} /></Field>
          <Field label="Jatuh Tempo"><Input type="date" data-testid="edit-due-date" value={f.due_date || ""} onChange={(e) => set("due_date", e.target.value)} /></Field>
          <Field label="Alamat Kirim" className="col-span-2"><Input data-testid="edit-delivery-address" value={f.delivery_address || ""} onChange={(e) => set("delivery_address", e.target.value)} /></Field>
          <Field label="Ongkir (Rp)"><Input type="number" data-testid="edit-ongkir" value={f.ongkir} onChange={(e) => set("ongkir", e.target.value)} /></Field>
        </div>
        <Field label="Catatan / Instruksi Khusus"><Textarea data-testid="edit-notes" value={f.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        <div className="panel p-3">
          <div className="flex items-center justify-between">
            <div className="font-heading text-lg uppercase">Item Nota</div>
            <Button variant="secondary" className="gap-2" data-testid="edit-add-item-button" onClick={() => setAdding(!adding)}><Plus className="h-4 w-4" /> Tambah Item Baru</Button>
          </div>
          {adding && <div className="my-3 rounded-md border border-dashed border-primary/60 p-3"><ItemAdder onAdd={(l) => setF((s) => ({ ...s, items: [...s.items, l] }))} /></div>}
          <CartLines lines={f.items} onChange={(items) => set("items", items)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-sm">
          <div data-testid="edit-totals">Total Baru: <b className="text-orange-300">{rp(tot.grand_total)}</b> · Terbayar {rp(tot.paid_total)} · Sisa Piutang <b>{rp(tot.balance)}</b></div>
          <Button data-testid="edit-save-button" onClick={save} className="h-11 px-8">Simpan Revisi</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
