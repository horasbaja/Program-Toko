import { toast } from "sonner";
import { Ban, CheckCircle2, MessageCircle, Pencil, Printer, Truck, Wallet } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, num, fdate, lineQty, bendLabel, whName, STATUS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sel, StatusDot, ModeTag } from "@/components/common";
import { useDocs } from "@/components/docs/useDocs";

const Info = ({ l, v, testid }) => (
  <div><div className="font-mono text-[10px] uppercase text-muted-foreground">{l}</div><div className="text-sm" data-testid={testid}>{v || "-"}</div></div>
);

export function SaleDetailDialog({ sale, onClose, onChanged, onDeliver, onPay, onEdit }) {
  const { isAdmin } = useAuth();
  const { warehouses } = useData();
  const { printNota, printSJ, sendWA } = useDocs();
  if (!sale) return null;
  const act = async (fn, msg) => {
    try { const r = await fn(); toast.success(msg); onChanged?.(r?.data); } catch (e) { toast.error(errMsg(e)); }
  };
  const setStatus = (st) => act(() => api.patch(`/sales/${sale.id}/status`, { order_status: st }), "Status pesanan diperbarui");
  const voidSale = () => {
    const reason = window.prompt("Alasan void nota?");
    if (reason === null) return;
    act(() => api.post(`/sales/${sale.id}/void`, { reason }), "Nota di-void, stok dikembalikan").then(onClose);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="sale-detail-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl uppercase flex items-center gap-2">
            <StatusDot status={sale.order_status} testid="sale-detail-status-dot" /> {sale.invoice_no}
            {sale.voided && <span className="tag bg-red-500/20 text-red-300">VOID</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 panel p-3">
          <Info l="Tanggal" v={fdate(sale.date)} />
          <Info l="Pelanggan" v={`${sale.customer?.name} ${sale.customer?.phone ? "· " + sale.customer.phone : ""}`} />
          <Info l="Rencana Pengantaran" v={fdate(sale.delivery_date)} testid="sale-detail-delivery-date" />
          <Info l="Kasir" v={sale.cashier} />
          <Info l="Alamat Kirim" v={sale.delivery_address} />
          <Info l="Pembayaran" v={`${sale.payment_method} · ${sale.payment_status}`} />
          <Info l="Jatuh Tempo" v={fdate(sale.due_date)} />
          <Info l="Catatan / Instruksi" v={sale.notes} />
        </div>
        <div className="overflow-x-auto panel">
          <table className="dtable">
            <thead><tr><th>Item</th><th>Qty / Ukuran</th><th>Status</th><th className="text-right">Harga</th><th className="text-right">Subtotal</th><th className="text-right">Terkirim</th>{isAdmin && <th className="text-right">HPP</th>}</tr></thead>
            <tbody>
              {sale.items.map((it, i) => (
                <tr key={it.line_id}>
                  <td><div className="font-medium">{it.name}</div><div className="mt-1 flex gap-1"><ModeTag mode={it.mode} wh={it.warehouse} />{it.po_no && <span className="tag tag-ready">{it.po_no}</span>}</div>
                    {it.bend_subtotal > 0 && <div className="mt-1 font-mono text-[11px] text-orange-200">[ Rincian Upah Lengkung: {num(it.qty)} {it.unit} x {rp(it.bend_fee)} = {rp(it.bend_subtotal)} ]</div>}</td>
                  <td className="font-mono text-xs">{lineQty(it)}</td>
                  <td className="text-xs">{it.is_length ? bendLabel(it.bend) : "-"}{it.mode === "indent" && <div className={it.indent_received ? "text-emerald-400" : "text-yellow-400"}>{it.indent_received ? "Diterima gudang" : "Menunggu pabrik"}</div>}</td>
                  <td className="num">{rp(it.price)}</td>
                  <td className="num">{rp(it.line_total)}</td>
                  <td className="num">{num(it.delivered_qty)} / {num(it.qty)}</td>
                  {isAdmin && <td className="num text-muted-foreground" data-testid={`sale-detail-hpp-${i}`}>{rp(it.hpp_total)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="panel p-3" data-testid="delivery-log">
            <div className="font-heading text-lg uppercase mb-2">Log Surat Jalan (per Rit)</div>
            {!sale.deliveries?.length && <div className="text-sm text-muted-foreground">Belum ada pengiriman</div>}
            {sale.deliveries?.map((d, i) => (
              <div key={d.id} className="border-t border-border py-2 text-sm">
                <div className="flex justify-between"><span className="font-mono">Rit {d.rit} · {d.sj_no} · {fdate(d.date)}</span>
                  <button className="text-orange-300 text-xs" data-testid={`reprint-sj-${i}`} onClick={() => printSJ(sale, d)}>Cetak ulang</button></div>
                <div className="text-xs text-muted-foreground">{whName(warehouses, d.warehouse)} · {d.items.map((x) => `${x.name} (${num(x.qty)} ${x.unit})`).join(", ")}</div>
              </div>
            ))}
          </div>
          <div className="panel p-3 font-mono text-sm space-y-1" data-testid="sale-detail-totals">
            <div className="flex justify-between"><span>Material</span><span>{rp(sale.total_material)}</span></div>
            <div className="flex justify-between"><span>Upah Lengkung</span><span>{rp(sale.total_bend)}</span></div>
            <div className="flex justify-between"><span>Ongkir</span><span>{rp(sale.ongkir)}</span></div>
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{rp(sale.grand_total)}</span></div>
            {sale.payments?.map((p) => <div key={p.id} className="flex justify-between text-xs text-muted-foreground"><span>{fdate(p.date)} · {p.method} · {p.note}</span><span>{rp(p.amount)}</span></div>)}
            <div className="flex justify-between text-orange-300"><span>Sisa</span><span data-testid="sale-detail-balance">{rp(sale.balance)}</span></div>
            {isAdmin && <div className="flex justify-between text-emerald-400"><span>Laba Kotor</span><span>{rp(sale.total_material + sale.total_bend - sale.hpp_total)}</span></div>}
          </div>
        </div>
        {!sale.voided && (
          <div className="flex flex-wrap items-center gap-2">
            <Sel testid="sale-status-select" value={sale.order_status} onChange={setStatus} options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
            <Button variant="secondary" className="gap-2" data-testid="sale-print-nota" onClick={() => printNota(sale)}><Printer className="h-4 w-4" /> Nota</Button>
            <Button variant="secondary" className="gap-2" data-testid="sale-send-wa" onClick={() => sendWA(sale)}><MessageCircle className="h-4 w-4" /> WA</Button>
            <Button variant="secondary" className="gap-2" data-testid="sale-create-sj" onClick={() => onDeliver(sale)}><Truck className="h-4 w-4" /> Surat Jalan</Button>
            {sale.balance > 0 && <Button variant="secondary" className="gap-2" data-testid="sale-add-payment" onClick={() => onPay(sale)}><Wallet className="h-4 w-4" /> Pelunasan</Button>}
            {isAdmin && !sale.credit_approved && sale.balance > 0 && (
              <Button variant="secondary" className="gap-2" data-testid="sale-approve-credit" onClick={() => act(() => api.post(`/sales/${sale.id}/approve-credit`), "Piutang disetujui")}><CheckCircle2 className="h-4 w-4" /> Setujui Piutang</Button>
            )}
            {isAdmin && <Button className="gap-2" data-testid="sale-edit-button" onClick={() => onEdit(sale)}><Pencil className="h-4 w-4" /> Edit</Button>}
            {isAdmin && <Button variant="destructive" className="gap-2" data-testid="sale-void-button" onClick={voidSale}><Ban className="h-4 w-4" /> Void</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
