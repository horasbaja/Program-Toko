import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Search, Truck, Wallet } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, fdate, STATUS } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, Sel, StatusDot, Empty } from "@/components/common";
import { SaleDetailDialog } from "@/components/sales/SaleDetailDialog";
import { SaleEditDialog } from "@/components/sales/SaleEditDialog";
import { DeliveryDialog, PaymentDialog } from "@/components/sales/SaleDialogs";
import { useDocs } from "@/components/docs/useDocs";

const INIT = { q: "", customer_id: "", status: "", payment_status: "", date_field: "date", date_from: "", date_to: "" };

function Filters({ fl, setFl, customers }) {
  const set = (k, v) => setFl({ ...fl, [k]: v });
  return (
    <div className="panel p-3 mb-3 grid gap-2 grid-cols-2 md:grid-cols-4 xl:grid-cols-8" data-testid="sales-filters">
      <div className="relative col-span-2">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input data-testid="sales-search-input" className="pl-9" placeholder="Cari nota, pelanggan, barang, HP..." value={fl.q} onChange={(e) => set("q", e.target.value)} />
      </div>
      <Sel testid="sales-customer-filter" value={fl.customer_id} onChange={(v) => set("customer_id", v)} placeholder="Semua Konsumen" options={customers.map((c) => ({ value: c.id, label: c.name }))} />
      <Sel testid="sales-status-filter" value={fl.status} onChange={(v) => set("status", v)} placeholder="Semua Status" options={Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }))} />
      <Sel testid="sales-payment-filter" value={fl.payment_status} onChange={(v) => set("payment_status", v)} placeholder="Semua Bayar" options={["Lunas", "DP", "Piutang"]} />
      <Sel testid="sales-date-field" value={fl.date_field} onChange={(v) => set("date_field", v)} options={[{ value: "date", label: "Tgl Transaksi" }, { value: "delivery", label: "Tgl Pengantaran" }]} />
      <Input type="date" data-testid="sales-date-from" value={fl.date_from} onChange={(e) => set("date_from", e.target.value)} />
      <Input type="date" data-testid="sales-date-to" value={fl.date_to} onChange={(e) => set("date_to", e.target.value)} />
    </div>
  );
}

export default function Sales() {
  const { customers, refresh } = useData();
  const { printNota } = useDocs();
  const [fl, setFl] = useState(INIT);
  const [data, setData] = useState({ items: [], summary: {} });
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const [deliver, setDeliver] = useState(null);
  const [pay, setPay] = useState(null);

  const load = useCallback(() => api.get("/sales", { params: fl }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e))), [fl]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);
  const changed = (s) => { load(); refresh(); if (s?.id) setDetail(s); };
  const openDetail = (s) => api.get(`/sales/${s.id}`).then((r) => setDetail(r.data));

  return (
    <div>
      <PageHeader title="Riwayat Penjualan" subtitle="Tracking & Pengantaran">
        <Button variant="secondary" data-testid="sales-filter-today-delivery" onClick={() => setFl({ ...INIT, date_field: "delivery", date_from: new Date().toLocaleDateString("en-CA"), date_to: new Date().toLocaleDateString("en-CA") })}>Jadwal Antar Hari Ini</Button>
        <Button variant="ghost" data-testid="sales-filter-reset" onClick={() => setFl(INIT)}>Reset Filter</Button>
      </PageHeader>
      <Filters fl={fl} setFl={setFl} customers={customers} />
      <div className="panel overflow-x-auto" data-testid="sales-table">
        <table className="dtable">
          <thead><tr><th>Status</th><th>No. Nota</th><th>Tanggal</th><th>Pelanggan</th><th>Tgl Pengantaran</th><th>Surat Jalan</th><th className="text-right">Total</th><th className="text-right">Sisa</th><th>Bayar</th><th className="text-right">Aksi</th></tr></thead>
          <tbody>
            {data.items.map((s, i) => (
              <tr key={s.id} className="cursor-pointer" onClick={() => openDetail(s)} data-testid={`sales-row-${i}`}>
                <td><StatusDot status={s.order_status} testid={`sales-status-dot-${i}`} /></td>
                <td className="font-mono text-orange-300">{s.invoice_no}</td>
                <td className="whitespace-nowrap">{fdate(s.date)}</td>
                <td><div>{s.customer?.name}</div><div className="text-xs text-muted-foreground">{s.customer?.type} {s.customer?.status && `· ${s.customer.status}`}</div></td>
                <td className="whitespace-nowrap" data-testid={`sales-delivery-date-${i}`}>{fdate(s.delivery_date)}</td>
                <td className="text-xs">{s.deliveries?.length ? s.deliveries.map((d) => <div key={d.id}>Rit {d.rit}: {fdate(d.date)}</div>) : <span className="text-muted-foreground">-</span>}</td>
                <td className="num">{rp(s.grand_total)}</td>
                <td className={`num ${s.balance > 0 ? "text-orange-300" : "text-muted-foreground"}`}>{rp(s.balance)}</td>
                <td><span className={`tag ${s.payment_status === "Lunas" ? "bg-emerald-500/15 text-emerald-300" : "bg-orange-500/15 text-orange-300"}`}>{s.payment_status}</span></td>
                <td className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" title="Cetak ulang nota" data-testid={`sales-print-${i}`} onClick={() => printNota(s)}><Printer className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Surat jalan" data-testid={`sales-sj-${i}`} onClick={() => setDeliver(s)}><Truck className="h-4 w-4" /></Button>
                  {s.balance > 0 && <Button size="icon" variant="ghost" title="Pelunasan" data-testid={`sales-pay-${i}`} onClick={() => setPay(s)}><Wallet className="h-4 w-4" /></Button>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="sales-footer-summary">
              <td colSpan={6}>{data.summary.count || 0} transaksi · Ongkir {rp(data.summary.ongkir)} · Terbayar {rp(data.summary.paid_total)}</td>
              <td className="num">{rp(data.summary.grand_total)}</td>
              <td className="num text-orange-300">{rp(data.summary.balance)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        {!data.items.length && <Empty text="Tidak ada transaksi sesuai filter" />}
      </div>
      {detail && <SaleDetailDialog sale={detail} onClose={() => setDetail(null)} onChanged={changed} onDeliver={(s) => { setDetail(null); setDeliver(s); }} onPay={(s) => { setDetail(null); setPay(s); }} onEdit={(s) => { setDetail(null); setEdit(s); }} />}
      {edit && <SaleEditDialog sale={edit} onClose={() => setEdit(null)} onSaved={changed} />}
      <DeliveryDialog sale={deliver} onClose={() => setDeliver(null)} onDone={() => load()} />
      <PaymentDialog sale={pay} onClose={() => setPay(null)} onDone={() => load()} />
    </div>
  );
}
