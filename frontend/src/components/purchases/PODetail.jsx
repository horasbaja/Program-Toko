import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Pencil, Printer } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, num, fdate, bendLabel, whName, RECEIVE_STATUSES } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Sel } from "@/components/common";
import { useDocs } from "@/components/docs/useDocs";

function ReceivePanel({ po, onChanged }) {
  const { warehouses, refresh } = useData();
  const [st, setSt] = useState("Dalam Proses");
  const [wh, setWh] = useState(po.warehouse || "G1");
  const [rq, setRq] = useState({});
  useEffect(() => {
    setSt(RECEIVE_STATUSES.includes(po.receive_status) ? po.receive_status : "Dalam Proses");
    setWh(po.warehouse || "G1");
    setRq(Object.fromEntries(po.items.map((i) => [i.line_id, i.received_qty || 0])));
  }, [po]);
  const save = async () => {
    try {
      const { data } = await api.patch(`/purchases/${po.id}/receive`, { status: st, warehouse: wh, items: Object.entries(rq).map(([line_id, v]) => ({ line_id, received_qty: Number(v) })) });
      toast.success(`Status penerimaan: ${st}`);
      refresh();
      onChanged(data);
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="panel p-3 grid gap-3" data-testid="po-receive-panel">
      <div className="font-heading text-lg uppercase">Update Status Penerimaan Barang</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gudang Tujuan"><Sel testid="receive-warehouse-select" value={wh} onChange={setWh} options={warehouses.map((w) => ({ value: w.code, label: `${w.code} - ${w.name}` }))} /></Field>
        <Field label="Status"><Sel testid="receive-status-select" value={st} onChange={setSt} options={RECEIVE_STATUSES} /></Field>
      </div>
      {st === "Barang Belum Lengkap" && po.items.map((it, i) => (
        <div key={it.line_id} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{it.name}</span>
          <Input type="number" className="w-24" data-testid={`receive-qty-${i}`} value={rq[it.line_id] ?? 0} onChange={(e) => setRq({ ...rq, [it.line_id]: e.target.value })} />
          <span className="w-24 text-muted-foreground">/ {num(it.qty)} {it.unit}</span>
        </div>
      ))}
      <Button data-testid="receive-submit-button" onClick={save}>Simpan Status</Button>
    </div>
  );
}

export function PODetail({ po, onChanged, onEdit }) {
  const { isAdmin } = useAuth();
  const { warehouses } = useData();
  const { printPO } = useDocs();
  const voidPO = async () => {
    if (!window.confirm(`Void / hapus PO ${po.po_no}? Stok yang sudah masuk akan dikoreksi.`)) return;
    try { await api.post(`/purchases/${po.id}/void`); toast.success("PO di-void"); onChanged(null); } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <div className="grid gap-3" data-testid="po-detail">
      <div className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="font-mono text-2xl font-bold text-orange-300" data-testid="po-detail-number">{po.po_no}</div>
            <div className="text-sm">{po.supplier_name}</div>
            <div className="text-xs text-muted-foreground">{fdate(po.date)} · {po.type === "indent" ? `Auto PO Indent · Nota ${po.invoice_no} · ${po.customer_name}` : "Pembelian Manual / Restock"}</div>
            {po.delivery_date && <div className="text-xs text-muted-foreground">Rencana kirim konsumen: {fdate(po.delivery_date)}</div>}
          </div>
          <div className="text-right">
            <span className="tag tag-ready" data-testid="po-detail-status">{po.receive_status}</span>
            <div className="mt-1 text-xs text-muted-foreground">Gudang: {whName(warehouses, po.warehouse)}</div>
            <Button size="sm" variant="secondary" className="mt-2 gap-2" data-testid="po-detail-print-button" onClick={() => printPO(po)}><Printer className="h-4 w-4" /> Cetak PO</Button>
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="dtable">
            <thead><tr><th>Barang</th><th>Qty</th><th>Panjang</th><th>Total Meter</th><th>Lurus/Lengkung</th><th>Diterima</th>{isAdmin && <th className="text-right">HPP</th>}{isAdmin && <th className="text-right">Subtotal</th>}</tr></thead>
            <tbody>
              {po.items.map((it, i) => (
                <tr key={it.line_id}>
                  <td>{it.name}{it.color && !it.name.includes(it.color) ? ` · ${it.color}` : ""}</td>
                  <td className="font-mono whitespace-nowrap" data-testid={`po-detail-qty-${i}`}>{num(it.qty)} {it.unit}</td>
                  <td className="font-mono">{it.is_length ? `${num(it.length)} m` : "-"}</td>
                  <td className="font-mono">{it.is_length ? `${num(it.total_meter)} m` : "-"}</td>
                  <td>{it.is_length ? bendLabel(it.bend) : "-"}</td>
                  <td className="font-mono">{num(it.received_qty)} {it.unit}</td>
                  {isAdmin && <td className="num">{rp(it.hpp_unit)}{it.is_length ? "/m" : ""}</td>}
                  {isAdmin && <td className="num">{rp(it.subtotal)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isAdmin && (
          <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-sm" data-testid="po-detail-money">
            <div>Total: <b>{rp(po.total)}</b></div><div>Dibayar: {rp(po.paid_amount)} ({po.paid_status})</div><div className="text-orange-300">Utang: {rp(po.debt)}</div>
          </div>
        )}
        {isAdmin && (
          <div className="mt-3 flex gap-2">
            <Button className="gap-2" data-testid="po-edit-button" onClick={() => onEdit(po)}><Pencil className="h-4 w-4" /> Edit PO / Harga Beli</Button>
            <Button variant="destructive" className="gap-2" data-testid="po-void-button" onClick={voidPO}><Ban className="h-4 w-4" /> Void / Hapus</Button>
          </div>
        )}
      </div>
      <ReceivePanel po={po} onChanged={onChanged} />
      {po.status_log?.length > 0 && (
        <div className="panel p-3 text-xs">
          <div className="font-heading text-base uppercase mb-1">Riwayat Status</div>
          {po.status_log.map((l, i) => <div key={i} className="border-t border-border py-1">{fdate(l.date)} · {l.status} · {l.warehouse} · {l.by}</div>)}
        </div>
      )}
    </div>
  );
}
