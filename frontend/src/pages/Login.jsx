import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { errMsg } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HERO = "https://images.unsplash.com/photo-1602064828974-fcac67d33f4e?crop=entropy&cs=srgb&fm=jpg&q=80&w=1600";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try { await login(u, p); toast.success("Selamat datang di HORAS BAJA"); nav("/"); } catch (e2) { setErr(errMsg(e2)); }
    setBusy(false);
  };
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.2fr_1fr]">
      <div className="relative hidden lg:block overflow-hidden">
        <img src={HERO} alt="Seng roofing" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/70 to-[#0B0F17]/30" />
        <div className="absolute bottom-12 left-12 right-12 fade-up">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Pematang Siantar · Sejak dulu</p>
          <h1 className="font-heading text-6xl font-extrabold uppercase leading-none tracking-tight">HORAS BAJA</h1>
          <p className="mt-3 max-w-md text-slate-300">Spesialis Seng, Roofing & Material Konstruksi. POS, stok multi-gudang Mojopahit & Wahidin, PO pabrik, dan laporan laba rugi dalam satu sistem.</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm panel p-8 fade-up" data-testid="login-form">
          <div className="mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-sm bg-primary font-heading text-2xl font-extrabold">HB</div>
            <h2 className="mt-4 font-heading text-3xl font-bold uppercase">Masuk Sistem</h2>
            <p className="text-sm text-muted-foreground">Gunakan akun Admin/Pemilik atau Kasir</p>
          </div>
          <div className="grid gap-3">
            <div className="relative"><User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input data-testid="login-username-input" className="h-11 pl-9" placeholder="Username" value={u} onChange={(e) => setU(e.target.value)} autoFocus /></div>
            <div className="relative"><Lock className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input data-testid="login-password-input" type="password" className="h-11 pl-9" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} /></div>
            {err && <div className="text-sm text-red-400" data-testid="login-error">{err}</div>}
            <Button data-testid="login-submit-button" disabled={busy} className="h-11 text-base">{busy ? "Memproses..." : "Masuk"}</Button>
          </div>
          <div className="mt-6 rounded-md border border-dashed border-border p-3 font-mono text-[11px] text-muted-foreground">
            Demo: admin / admin123 · kasir / kasir123
          </div>
        </form>
      </div>
    </div>
  );
}
