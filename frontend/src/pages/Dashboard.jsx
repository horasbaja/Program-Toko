import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertTriangle, Banknote, CalendarClock, Clock, HandCoins, ReceiptText, TrendingUp, Truck } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, num, fdate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { PageHeader, Stat, StatusDot, Empty } from "@/components/common";

const Box = ({ title, icon: Icon, children, testid }) => (
  <div className="panel p-4 fade-up" data-testid={testid}>
    <div className="mb-3 flex items-center gap-2 font-heading text-lg uppercase tracking-wide"><Icon className="h-4 w-4 text-primary" />{title}</div>
    {children}
  </div>
);

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [d, setD] = useState(null);
  const load = useCallback(() => api.get("/dashboard").then((r) => setD(r.data)).catch((e) => toast.error(errMsg(e))), []);
  useEffect(() => { load(); }, [load]);
  const approve = async (id) => { try { await api.post(`/sales/${id}/approve-credit`); toast.success("Piutang disetujui"); load(); } catch (e) { toast.error(errMsg(e)); } };
  if (!d) return <div className="text-muted-foreground">Memuat ringkasan...</div>;
  return (
    <div>
      <PageHeader title="Ringkasan Toko" subtitle="Dashboard">
        <Link to="/pos"><Button data-testid="dashboard-open-pos" className="h-11">Buka Kasir</Button></Link>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat testid="stat-omzet-today" label="Omzet Hari Ini" value={rp(d.today.omzet)} icon={Banknote} sub={`${d.today.count} transaksi · kas masuk ${rp(d.today.cash_in)}`} />
        <Stat testid="stat-omzet-month" label="Omzet Bulan Ini" value={rp(d.month.omzet)} icon={ReceiptText} sub={`${d.month.count} transaksi`} />
        {isAdmin && <Stat testid="stat-profit-today" label="Laba Kotor Hari Ini" value={rp(d.today.profit)} icon={TrendingUp} tone="text-emerald-400" sub={`Bulan ini ${rp(d.month.profit)}`} />}
        <Stat testid="stat-receivables" label="Total Piutang" value={rp(d.receivables_total)} icon={HandCoins} tone="text-orange-300" sub={`${d.pending_indent} pesanan proses indent`} />
        {isAdmin && <Stat testid="stat-payables" label="Utang Dagang (PO)" value={rp(d.payables_total)} icon={Banknote} tone="text-red-300" />}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2 fade-up" data-testid="dashboard-trend-chart">
          <div className="mb-2 font-heading text-lg uppercase">Omzet 7 Hari Terakhir</div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={d.trend}>
                <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#EA580C" stopOpacity={0.5} /><stop offset="100%" stopColor="#EA580C" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${num(v / 1e6, 1)}jt`} />
                <Tooltip formatter={(v) => rp(v)} contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
                <Area dataKey="omzet" stroke="#EA580C" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <Box title="Alert Stok Menipis" icon={AlertTriangle} testid="dashboard-low-stock">
          {!d.low_stock.length && <Empty text="Semua stok aman" />}
          {d.low_stock.map((p) => (
            <div key={p.id} className="flex justify-between border-t border-border py-2 text-sm">
              <span className="pr-2">{p.name}</span>
              <span className="font-mono text-red-400 whitespace-nowrap">{num(p.total)} {p.unit}<span className="block text-[10px] text-muted-foreground">G1 {num(p.stock.G1)} · G2 {num(p.stock.G2)}</span></span>
            </div>
          ))}
        </Box>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {isAdmin && (
          <Box title="Persetujuan Piutang" icon={HandCoins} testid="dashboard-credit-approval">
            {!d.pending_credit?.length && <Empty text="Tidak ada piutang menunggu persetujuan" />}
            {d.pending_credit?.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-2 border-t border-border py-2 text-sm">
                <div><div>{s.customer}</div><div className="font-mono text-xs text-muted-foreground">{s.invoice_no} · {rp(s.balance)} · JT {fdate(s.due_date)}</div></div>
                <Button size="sm" data-testid={`approve-credit-${i}`} onClick={() => approve(s.id)}>Setujui</Button>
              </div>
            ))}
          </Box>
        )}
        <Box title="Piutang Jatuh Tempo (≤3 hari)" icon={Clock} testid="dashboard-due-soon">
          {!d.due_soon.length && <Empty text="Tidak ada" />}
          {d.due_soon.map((s) => (
            <div key={s.id} className="flex justify-between border-t border-border py-2 text-sm">
              <div><div>{s.customer}</div><div className="font-mono text-xs text-muted-foreground">{s.invoice_no}</div></div>
              <div className="text-right font-mono text-xs"><div className="text-orange-300">{rp(s.balance)}</div><div>{fdate(s.due_date)}</div></div>
            </div>
          ))}
        </Box>
        <Box title="Jadwal Antar Hari Ini & Besok" icon={Truck} testid="dashboard-deliveries">
          {!d.deliveries.length && <Empty text="Tidak ada jadwal" />}
          {d.deliveries.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border-t border-border py-2 text-sm">
              <StatusDot status={s.order_status} />
              <div className="flex-1"><div>{s.customer}</div><div className="text-xs text-muted-foreground">{s.address}</div></div>
              <span className="font-mono text-xs"><CalendarClock className="inline h-3 w-3" /> {fdate(s.delivery_date)}</span>
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}
