import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { api, errMsg } from "@/lib/api";
import { rp, num, fdate, todayStr } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, Sel, Stat, Empty } from "@/components/common";
import EntityManager from "@/components/EntityManager";

const TT = { contentStyle: { background: "#111827", border: "1px solid #334155" }, formatter: (v) => rp(v) };
const useFetch = (path, params) => {
  const [d, setD] = useState(null);
  const key = JSON.stringify(params || {});
  const load = useCallback(() => api.get(path, { params: JSON.parse(key) }).then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))), [path, key]);
  useEffect(() => { load(); }, [load]);
  return d;
};

function Range({ r, setR, children }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <Input type="date" className="w-auto" data-testid="report-date-from" value={r.date_from} onChange={(e) => setR({ ...r, date_from: e.target.value })} />
      <Input type="date" className="w-auto" data-testid="report-date-to" value={r.date_to} onChange={(e) => setR({ ...r, date_to: e.target.value })} />
      {children}
    </div>
  );
}

function PnL() {
  const [r, setR] = useState({ group: "day", date_from: todayStr(-30), date_to: todayStr() });
  const d = useFetch("/reports/pnl", r);
  const t = d?.total || {};
  return (
    <div data-testid="report-pnl">
      <Range r={r} setR={setR}><Sel testid="pnl-group-select" value={r.group} onChange={(v) => setR({ ...r, group: v })} options={[{ value: "day", label: "Harian" }, { value: "month", label: "Bulanan" }, { value: "year", label: "Tahunan" }]} /></Range>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Stat label="Pendapatan Penjualan" value={rp(t.revenue)} testid="pnl-revenue" />
        <Stat label="HPP" value={rp(t.hpp)} tone="text-red-300" />
        <Stat label={`Laba Kotor (${num(t.margin_pct, 1)}%)`} value={rp(t.gross)} tone="text-emerald-400" testid="pnl-gross" />
        <Stat label="Pendapatan Ongkir" value={rp(t.ongkir)} tone="text-sky-300" />
        <Stat label="Laba Bersih" value={rp(t.net)} tone="text-orange-300" testid="pnl-net" sub={`Beban operasional ${rp(t.expenses)}`} />
      </div>
      <div className="panel p-3 h-72 mb-4">
        <ResponsiveContainer>
          <BarChart data={d?.rows || []}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="period" stroke="#64748b" fontSize={11} /><YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${num(v / 1e6, 1)}jt`} />
            <Tooltip {...TT} /><Legend /><Bar dataKey="revenue" name="Pendapatan" fill="#EA580C" /><Bar dataKey="gross" name="Laba Kotor" fill="#22C55E" /><Bar dataKey="net" name="Laba Bersih" fill="#0284C7" /></BarChart>
        </ResponsiveContainer>
      </div>
      <div className="panel overflow-x-auto">
        <table className="dtable">
          <thead><tr><th>Periode</th><th className="text-right">Trx</th><th className="text-right">Material</th><th className="text-right">Jasa Lengkung</th><th className="text-right">HPP</th><th className="text-right">Laba Kotor</th><th className="text-right">Margin</th><th className="text-right">Ongkir</th><th className="text-right">Beban Ops</th><th className="text-right">Laba Bersih</th></tr></thead>
          <tbody>{d?.rows.map((x) => (
            <tr key={x.period}><td className="font-mono">{x.period}</td><td className="num">{x.count}</td><td className="num">{rp(x.material)}</td><td className="num">{rp(x.bend)}</td><td className="num">{rp(x.hpp)}</td><td className="num text-emerald-400">{rp(x.gross)}</td><td className="num">{num(x.margin_pct, 1)}%</td><td className="num">{rp(x.ongkir)}</td><td className="num">{rp(x.expenses)}</td><td className="num text-orange-300">{rp(x.net)}</td></tr>
          ))}</tbody>
          <tfoot><tr><td>TOTAL</td><td className="num">{t.count}</td><td className="num">{rp(t.material)}</td><td className="num">{rp(t.bend)}</td><td className="num">{rp(t.hpp)}</td><td className="num">{rp(t.gross)}</td><td className="num">{num(t.margin_pct, 1)}%</td><td className="num">{rp(t.ongkir)}</td><td className="num">{rp(t.expenses)}</td><td className="num">{rp(t.net)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

function TopProducts() {
  const [r, setR] = useState({ date_from: todayStr(-30), date_to: todayStr() });
  const d = useFetch("/reports/top-products", r) || [];
  return (
    <div data-testid="report-top-products">
      <Range r={r} setR={setR} />
      <div className="panel p-3 h-80 mb-4">
        <ResponsiveContainer>
          <BarChart data={d.slice(0, 10)} layout="vertical" margin={{ left: 40 }}><CartesianGrid stroke="#1e293b" horizontal={false} /><XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${num(v / 1e6, 1)}jt`} /><YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={150} />
            <Tooltip {...TT} /><Bar dataKey="profit" name="Laba" fill="#22C55E" /><Bar dataKey="revenue" name="Omzet" fill="#EA580C" /></BarChart>
        </ResponsiveContainer>
      </div>
      <div className="panel overflow-x-auto"><table className="dtable">
        <thead><tr><th>Kategori / Produk</th><th className="text-right">Qty</th><th className="text-right">Total Meter</th><th className="text-right">Omzet</th><th className="text-right">HPP</th><th className="text-right">Laba</th></tr></thead>
        <tbody>{d.map((x) => <tr key={x.name}><td>{x.name}</td><td className="num">{num(x.qty)}</td><td className="num">{num(x.meter)} m</td><td className="num">{rp(x.revenue)}</td><td className="num">{rp(x.hpp)}</td><td className="num text-emerald-400">{rp(x.profit)}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

function StockReport() {
  const d = useFetch("/reports/stock");
  if (!d) return null;
  return (
    <div data-testid="report-stock">
      <div className="mb-3 grid grid-cols-2 gap-3 lg:w-1/2"><Stat label="Nilai Stok (HPP)" value={rp(d.total_value)} /><Stat label="Reserved Indent Diterima" value={`${d.reserved.length} item`} /></div>
      <div className="panel overflow-x-auto mb-4"><table className="dtable">
        <thead><tr><th>Barang</th><th>Kategori</th><th className="text-right">Mojopahit (G1)</th><th className="text-right">Wahidin (G2)</th><th className="text-right">Gabungan</th><th className="text-right">Nilai</th></tr></thead>
        <tbody>{d.rows.map((x) => <tr key={x.id}><td>{x.name}</td><td className="text-xs">{x.category_name}</td><td className="num">{num(x.stock.G1)}</td><td className="num">{num(x.stock.G2)}</td><td className="num font-semibold">{num(x.total)} {x.unit}</td><td className="num">{rp(x.stock_value)}</td></tr>)}</tbody>
      </table></div>
      <div className="panel overflow-x-auto"><div className="p-3 font-heading text-lg uppercase">Reserved Stock (Indent Sudah Diterima, Belum Dikirim)</div>
        <table className="dtable"><thead><tr><th>Nota</th><th>Konsumen</th><th>Barang</th><th className="text-right">Qty</th><th>Gudang</th></tr></thead>
          <tbody>{d.reserved.map((x, i) => <tr key={i}><td className="font-mono">{x.invoice_no}</td><td>{x.customer}</td><td>{x.name} · {num(x.length)} m</td><td className="num">{num(x.qty)} {x.unit}</td><td>{x.warehouse}</td></tr>)}</tbody></table>
        {!d.reserved.length && <Empty />}
      </div>
    </div>
  );
}

function PORecap() {
  const [r, setR] = useState({ date_from: todayStr(-30), date_to: todayStr() });
  const d = useFetch("/purchases", r);
  return (
    <div data-testid="report-po-recap">
      <Range r={r} setR={setR} />
      <div className="panel overflow-x-auto"><table className="dtable">
        <thead><tr><th>No PO</th><th>Tanggal</th><th>Supplier</th><th>Tipe</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Dibayar</th><th className="text-right">Utang</th></tr></thead>
        <tbody>{d?.items.map((p) => <tr key={p.id}><td className="font-mono text-orange-300">{p.po_no}</td><td>{fdate(p.date)}</td><td>{p.supplier_name}</td><td>{p.type}</td><td className="text-xs">{p.receive_status} · {p.paid_status}</td><td className="num">{rp(p.total)}</td><td className="num">{rp(p.paid_amount)}</td><td className="num text-orange-300">{rp(p.debt)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={5}>{d?.summary.count} PO</td><td className="num">{rp(d?.summary.total)}</td><td /><td className="num">{rp(d?.summary.debt)}</td></tr></tfoot>
      </table></div>
    </div>
  );
}

function Receivables() {
  const d = useFetch("/reports/receivables") || [];
  return (
    <div className="panel overflow-x-auto" data-testid="report-receivables"><table className="dtable">
      <thead><tr><th>Nota</th><th>Tanggal</th><th>Konsumen</th><th className="text-right">Total</th><th className="text-right">Terbayar</th><th className="text-right">Sisa</th><th>Jatuh Tempo</th><th>Status</th></tr></thead>
      <tbody>{d.map((x, i) => <tr key={x.id} data-testid={`receivable-row-${i}`}><td className="font-mono">{x.invoice_no}</td><td>{fdate(x.date)}</td><td>{x.customer}<div className="text-xs text-muted-foreground">{x.phone}</div></td><td className="num">{rp(x.grand_total)}</td><td className="num">{rp(x.paid_total)}</td><td className="num text-orange-300">{rp(x.balance)}</td><td>{fdate(x.due_date)}</td>
        <td>{x.overdue ? <span className="tag bg-red-500/20 text-red-300">JATUH TEMPO</span> : <span className="tag tag-ready">Berjalan</span>}{!x.credit_approved && <span className="tag tag-indent ml-1">Belum disetujui</span>}</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={5}>Total Piutang</td><td className="num">{rp(d.reduce((a, x) => a + x.balance, 0))}</td><td colSpan={2} /></tr></tfoot>
    </table></div>
  );
}

const TABS = [["pnl", "Laba Rugi", PnL], ["top", "Produk Menguntungkan", TopProducts], ["stock", "Laporan Stok", StockReport], ["po", "Rekap PO", PORecap], ["ar", "Piutang Jatuh Tempo", Receivables]];

export default function Reports() {
  return (
    <div>
      <PageHeader title="Keuangan & Laporan" subtitle="Khusus Admin / Pemilik" />
      <Tabs defaultValue="pnl">
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map(([k, l]) => <TabsTrigger key={k} value={k} data-testid={`report-tab-${k}`}>{l}</TabsTrigger>)}
          <TabsTrigger value="exp" data-testid="report-tab-expenses">Beban Operasional</TabsTrigger>
        </TabsList>
        {TABS.map(([k, , C]) => <TabsContent key={k} value={k} className="mt-4"><C /></TabsContent>)}
        <TabsContent value="exp" className="mt-4">
          <EntityManager title="Beban" endpoint="/expenses" testid="expenses-manager" defaults={{ date: todayStr(), category: "Operasional" }}
            fields={[{ key: "date", label: "Tanggal", type: "date" }, { key: "name", label: "Keterangan" },
              { key: "category", label: "Kategori", type: "select", options: ["Operasional", "Gaji", "Transportasi", "Utilitas", "Sewa", "Lainnya"] },
              { key: "amount", label: "Nominal", type: "number", money: true }]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
