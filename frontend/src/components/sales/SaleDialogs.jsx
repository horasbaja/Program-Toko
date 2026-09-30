import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { num, rp, todayStr, PAY_METHODS } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Sel } from "@/components/common";
import { useDocs } from "@/components/docs/useDocs";

export function DeliveryDialog({ sale, onClose, onDone }) {
  const { warehouses } = useData();
  const { printSJ } = useDocs();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({});
  useEffect(() => {
    if (!sale) return;
    setRows(sale.items.map((i) => ({ line_id: i.line_id, left: Number(i.qty) - Number(i.delivered_qty || 0), qty: Number(i.qty) - Number(i.delivered_qty || 0), on: Number(i.qty) - Number(i.delivered_qty || 0) > 0, it: i })));
    setMeta({ date: todayStr(), warehouse: sale.items.find((i) => i.warehouse)?.warehouse || "G1", address: sale.delivery_address || sale.customer?.address || "", driver: "", vehicle: "" });
  }, [sale]);
  const upd = (i, p) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const submit = async () => {
    try {
      const items = rows.filter((r) => r.on && Number(r.qty) > 0).map((r) => ({ line_id: r.line_id, qty: Number(r.qty) }));
      const { data } = await api.post(`/sales/${sale.id}/deliveries`, { ...meta, items });
      toast.success(`Surat Jalan ${data.delivery.sj_no} dibuat`);
      onDone?.(data.sale);
      onClose();
      printSJ(data.sale, data.delivery);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="delivery-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">Surat Jalan Parsial · Rit ke-{(sale?.deliveries?.length || 0) + 1}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Pengiriman"><Input type="date" data-testid="delivery-date-input" value={meta.date || ""} onChange={(e) => setMeta({ ...meta, date: e.target.value })} /></Field>
          <Field label="Gudang Pengambilan"><Sel testid="delivery-warehouse-select" value={meta.warehouse} onChange={(v) => setMeta({ ...meta, warehouse: v })} options={warehouses.map((w) => ({ value: w.code, label: `${w.code} - ${w.name}` }))} /></Field>
          <Field label="Alamat Kirim" className="col-span-2"><Input data-testid="delivery-address-input" value={meta.address || ""} onChange={(e) => setMeta({ ...meta, address: e.target.value })} /></Field>
          <Field label="Sopir"><Input data-testid="delivery-driver-input" value={meta.driver || ""} onChange={(e) => setMeta({ ...meta, driver: e.target.value })} /></Field>
          <Field label="Kendaraan / No Polisi"><Input data-testid="delivery-vehicle-input" value={meta.vehicle || ""} onChange={(e) => setMeta({ ...meta, vehicle: e.target.value })} /></Field>
        </div>
        <div className="panel divide-y divide-border">
          {rows.map((r, i) => (
            <div key={r.line_id} className="flex items-center gap-3 p-3" data-testid={`delivery-item-${i}`}>
              <Checkbox data-testid={`delivery-item-check-${i}`} checked={r.on} disabled={r.left <= 0} onCheckedChange={(c) => upd(i, { on: !!c })} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{r.it.name}</div>
                <div className="font-mono text-xs text-muted-foreground">Sisa {num(r.left)} {r.it.unit}{r.it.is_length ? ` · ${num(r.it.length)} m` : ""}</div>
              </div>
              <Input data-testid={`delivery-item-qty-${i}`} type="number" className="w-24 font-mono" disabled={!r.on} value={r.qty} max={r.left} onChange={(e) => upd(i, { qty: e.target.value })} />
              <span className="w-14 text-xs text-muted-foreground">{r.it.unit}</span>
            </div>
          ))}
        </div>
        <Button data-testid="delivery-submit-button" onClick={submit} className="h-11">Simpan & Cetak Surat Jalan</Button>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentDialog({ sale, onClose, onDone }) {
  const [f, setF] = useState({});
  useEffect(() => { if (sale) setF({ amount: sale.balance, method: "Tunai", date: todayStr(), note: "Pelunasan" }); }, [sale]);
  const submit = async () => {
    try {
      const { data } = await api.post(`/sales/${sale.id}/payments`, { ...f, amount: Number(f.amount) });
      toast.success("Pelunasan tercatat");
      onDone?.(data);
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="payment-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">Input Pelunasan</DialogTitle></DialogHeader>
        <div className="font-mono text-sm">Sisa tagihan {sale?.invoice_no}: <span className="text-orange-300">{rp(sale?.balance)}</span></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nominal (Rp)" className="col-span-2"><Input data-testid="payment-amount-input" type="number" value={f.amount ?? ""} onChange={(e) => setF({ ...f, amount: e.target.value })} className="h-12 text-lg font-mono" /></Field>
          <Field label="Metode"><Sel testid="payment-method-select" value={f.method} onChange={(v) => setF({ ...f, method: v })} options={PAY_METHODS.slice(0, 2)} /></Field>
          <Field label="Tanggal"><Input type="date" data-testid="payment-date-input" value={f.date || ""} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Keterangan" className="col-span-2"><Input data-testid="payment-note-input" value={f.note || ""} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <Button data-testid="payment-submit-button" onClick={submit} className="h-11">Simpan Pelunasan</Button>
      </DialogContent>
    </Dialog>
  );
}
