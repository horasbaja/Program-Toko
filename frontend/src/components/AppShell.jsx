import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, ShoppingCart, ReceiptText, PackagePlus, Warehouse, Users, Boxes, Factory, LineChart,
  Settings, LogOut, Wifi, WifiOff, RefreshCw, Menu, X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/pos", label: "Kasir / POS", icon: ShoppingCart, id: "pos" },
  { to: "/sales", label: "Riwayat Penjualan", icon: ReceiptText, id: "sales" },
  { to: "/purchases", label: "Pembelian / PO", icon: PackagePlus, id: "purchases" },
  { to: "/stock", label: "Stok & Mutasi", icon: Warehouse, id: "stock" },
  { to: "/customers", label: "Pelanggan", icon: Users, id: "customers" },
  { to: "/products", label: "Produk & Kategori", icon: Boxes, id: "products", admin: true },
  { to: "/suppliers", label: "Supplier / Pabrik", icon: Factory, id: "suppliers", admin: true },
  { to: "/reports", label: "Keuangan & Laporan", icon: LineChart, id: "reports", admin: true },
  { to: "/settings", label: "Pengaturan", icon: Settings, id: "settings", admin: true },
];

function NavItems({ onClick }) {
  const { isAdmin } = useAuth();
  return NAV.filter((n) => !n.admin || isAdmin).map((n) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.to === "/"}
      onClick={onClick}
      data-testid={`nav-${n.id}`}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? "bg-primary/15 text-orange-300 border-l-2 border-primary" : "text-slate-300 hover:bg-secondary"
        }`
      }
    >
      <n.icon className="h-4 w-4 shrink-0" /> {n.label}
    </NavLink>
  ));
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid h-10 w-10 place-items-center rounded-sm bg-primary font-heading text-xl font-extrabold text-white">HB</div>
      <div>
        <div className="font-heading text-2xl font-extrabold leading-none tracking-wider">HORAS BAJA</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pematang Siantar</div>
      </div>
    </div>
  );
}

function StatusBar() {
  const { online, queueCount, syncNow, syncing } = useData();
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span data-testid="online-status" className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] uppercase ${online ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
        {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />} {online ? "Online" : "Offline"}
      </span>
      {queueCount > 0 && (
        <button data-testid="sync-queue-button" onClick={syncNow} className="flex items-center gap-1.5 rounded-full bg-yellow-500/15 px-2.5 py-1 font-mono text-[11px] text-yellow-400">
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> {queueCount} antrian
        </button>
      )}
      <div className="hidden sm:block text-right leading-tight">
        <div className="text-sm font-semibold" data-testid="current-user-name">{user?.name}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-primary" data-testid="current-user-role">{user?.role === "admin" ? "Admin / Pemilik" : "Kasir"}</div>
      </div>
      <button data-testid="logout-button" onClick={logout} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Keluar">
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-6 border-r border-border bg-[#080B12]/95 p-4 sticky top-0 h-screen">
        <Brand />
        <nav className="flex flex-col gap-1 overflow-y-auto"><NavItems /></nav>
        <div className="mt-auto font-mono text-[10px] text-muted-foreground">v1.0 · PWA Offline-Ready</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden bg-black/70" onClick={() => setOpen(false)}>
          <aside className="h-full w-72 bg-[#080B12] p-4 flex flex-col gap-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><Brand /><button onClick={() => setOpen(false)} data-testid="close-mobile-menu"><X className="h-5 w-5" /></button></div>
            <nav className="flex flex-col gap-1"><NavItems onClick={() => setOpen(false)} /></nav>
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/85 px-3 sm:px-6 backdrop-blur-xl">
          <button className="lg:hidden rounded-md p-2 hover:bg-secondary" onClick={() => setOpen(true)} data-testid="open-mobile-menu"><Menu className="h-5 w-5" /></button>
          <div className="hidden lg:block font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Spesialis Seng · Roofing · Material Konstruksi</div>
          <StatusBar />
        </header>
        <main className="flex-1 p-3 sm:p-6 pb-24 lg:pb-8"><Outlet /></main>
        <nav className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-border bg-background/95 backdrop-blur lg:hidden">
          {NAV.slice(0, 4).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} data-testid={`bottom-nav-${n.id}`}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? "text-orange-400" : "text-muted-foreground"}`}>
              <n.icon className="h-5 w-5" /> {n.label.split(" ")[0]}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
