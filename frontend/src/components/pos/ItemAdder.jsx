import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Search } from "lucide-react";
import { useData } from "@/context/DataContext";
import { calcLine } from "@/lib/calc";
import { rp, num, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Sel } from "@/components/common";

const totalStock = (p) => Object.values(p.stock || {}).reduce((a, b) => a + Number(b || 0), 0);

function BendToggle({ value, onChange, testid }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border px-3 h-10">
      <span className={`text-sm ${value !== "lengkung" ? "text-foreground" : "text-muted-foreground"}`}>Lurus</span>
      <Switch data-testid={testid} checked={value === "lengkung"} onCheckedChange={(c) => onChange(c ? "lengkung" : "lurus")} />
      <span className={`text-sm ${value === "lengkung" ? "text-orange-300" : "text-muted-foreground"}`}>Lengkung Standar</span>
    </div>
  );
}
export { BendToggle };

function ReadyConfig({ product: p, onClose, onAdd }) {
  const { warehouses } = useData();
  const units = [{ unit: p.unit, ratio: 1, price: p.price }, ...(p.alt_units || [])];
  const [wh, setWh] = useState(Number(p.stock?.G1) > 0 ? "G1" : "G2");
  const [unit, setUnit] = useState(p.unit);
  const u = units.find((x) => x.unit === unit) || units[0];
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(p.price);
  const [bend, setBend] = useState("lurus");
  const need = Number(qty) * (u.ratio || 1);
  const avail = Number(p.stock?.[wh] || 0);
  const line = calcLine({ mode: "ready", product_id: p.id, name: p.name, category_name: p.category_name, is_length: p.is_length,
    unit: u.unit, ratio: u.ratio || 1, qty, length: p.length, price, bend_fee: p.bend_fee, bend, warehouse: wh, supplier_id: p.supplier_id });
  const add = () => {
    if (need > avail) toast.warning(`Qty melebihi stok ${wh} (tersedia ${num(avail)} ${p.unit})`);
    onAdd({ ...line, _key: uid() });
    onClose();
  };
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        {warehouses.map((w) => (
          <button key={w.code} data-testid={`ready-wh-${w.code}`} onClick={() => setWh(w.code)} className={`pill h-auto flex-col items-start py-2 ${wh === w.code ? "pill-on" : ""}`}>
            <span className="text-xs font-mono">{w.code} · {w.name}</span>
            <span className="font-mono text-lg">{num(p.stock?.[w.code])} {p.unit}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {units.length > 1 && (
          <Field label="Satuan"><Sel testid="ready-unit-select" value={unit} onChange={(v) => { setUnit(v); setPrice(units.find((x) => x.unit === v).price); }} options={units.map((x) => ({ value: x.unit, label: `${x.unit}${x.ratio > 1 ? ` (isi ${x.ratio} ${p.unit})` : ""}` }))} /></Field>
        )}
        <Field label={`Qty (${u.unit})`}><Input data-testid="ready-qty-input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="h-12 text-lg font-mono" /></Field>
        <Field label={p.is_length ? "Harga Jual Nego / Meter" : `Harga Jual Nego / ${u.unit}`}><Input data-testid="ready-price-input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-12 text-lg font-mono" /></Field>
        {p.is_length && <Field label="Panjang / Lembar"><div className="h-12 flex items-center font-mono text-lg">{num(p.length)} m</div></Field>}
      </div>
      {p.is_length && Number(p.bend_fee) > 0 && <BendToggle value={bend} onChange={setBend} testid="ready-bend-switch" />}
      {need > avail && (
        <div data-testid="ready-stock-warning" className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Qty melebihi stok {wh} (tersedia {num(avail)} {p.unit})
        </div>
      )}
      <div className="rounded-md bg-secondary/50 p-3 font-mono text-sm space-y-1">
        {p.is_length && <div>Total Meter: {num(line.total_meter)} m</div>}
        <div>Subtotal Material: {rp(line.subtotal)}</div>
        {line.bend_subtotal > 0 && <div className="text-orange-300">Upah Lengkung: {num(qty)} {u.unit} x {rp(p.bend_fee)} = {rp(line.bend_subtotal)}</div>}
      </div>
      <Button data-testid="ready-add-to-cart" onClick={add} className="h-12 text-base gap-2"><Plus className="h-5 w-5" /> Tambah ke Keranjang</Button>
    </div>
  );
}

function ReadyPicker({ onAdd }) {
  const { products, categories } = useData();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState(null);
  const list = useMemo(() => products.filter((p) => (!cat || p.category_id === cat) && (!q || `${p.name} ${p.category_name} ${p.color}`.toLowerCase().includes(q.toLowerCase()))), [products, q, cat]);
  return (
    <div className="grid gap-3">
      <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input data-testid="pos-product-search" className="pl-9 h-11" placeholder="Cari barang ready stock..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={`pill h-9 whitespace-nowrap ${!cat ? "pill-on" : ""}`} onClick={() => setCat("")} data-testid="pos-cat-all">Semua</button>
        {categories.map((c) => <button key={c.id} data-testid={`pos-cat-${c.id}`} className={`pill h-9 whitespace-nowrap ${cat === c.id ? "pill-on" : ""}`} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
        {list.map((p, i) => {
          const low = totalStock(p) <= Number(p.min_stock || 0);
          return (
            <button key={p.id} data-testid={`pos-product-${i}`} onClick={() => setSel(p)}
              className="panel p-3 text-left hover:border-primary/70 active:scale-[0.98] transition-transform min-h-[110px] flex flex-col">
              <span className="font-mono text-[10px] uppercase text-muted-foreground truncate">{p.category_name}</span>
              <span className="text-sm font-semibold leading-snug line-clamp-2">{p.name}</span>
              <span className="mt-auto font-mono text-sm text-orange-300">{rp(p.price)}{p.is_length ? "/m" : `/${p.unit}`}</span>
              <span className={`font-mono text-[11px] ${low ? "text-red-400" : "text-muted-foreground"}`}>G1 {num(p.stock?.G1)} · G2 {num(p.stock?.G2)} {p.unit}</span>
            </button>
          );
        })}
      </div>
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase">{sel?.name}</DialogTitle></DialogHeader>
          {sel && <ReadyConfig product={sel} onAdd={onAdd} onClose={() => setSel(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndentBuilder({ onAdd }) {
  const { suppliers, products } = useData();
  const templates = products.filter((p) => p.is_length);
  const [f, setF] = useState({ supplier_id: suppliers[0]?.id || "", product_id: "", brand: "", thickness: "", color: "", length: "", qty: "", bend: "lengkung", price: "", bend_fee: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const pickTpl = (id) => {
    const p = products.find((x) => x.id === id);
    setF((s) => ({ ...s, product_id: id, brand: p?.brand || s.brand, thickness: p?.thickness || s.thickness, price: p?.price ?? s.price, bend_fee: p?.bend_fee ?? s.bend_fee }));
  };
  const tpl = products.find((x) => x.id === f.product_id);
  const sup = suppliers.find((s) => s.id === (f.supplier_id || suppliers[0]?.id));
  const name = `${tpl?.category_name || "Seng"} ${f.brand || sup?.prefix || ""} ${f.thickness} ${f.color}`.replace(/\s+/g, " ").trim();
  const line = calcLine({ mode: "indent", ...f, supplier_id: sup?.id, name, category_name: tpl?.category_name || "Seng Deck (Spandek)", is_length: true, unit: tpl?.unit || "Lembar", ratio: 1 });
  const add = () => {
    if (!sup || !Number(f.length) || !Number(f.qty) || !Number(f.price)) return toast.error("Lengkapi supplier, panjang, qty & harga");
    onAdd({ ...line, _key: uid() });
    toast.success("Item indent ditambahkan");
    setF((s) => ({ ...s, length: "", qty: "" }));
  };
  return (
    <div className="grid gap-3" data-testid="indent-builder">
      <div className="flex items-center gap-2">
        <Checkbox checked disabled data-testid="indent-flag-checkbox" /><span className="text-sm">Barang Indent (PO Pabrik)</span>
        <span className="tag tag-indent ml-auto">[INDENT - PO PABRIK]</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier / Pabrik"><Sel testid="indent-supplier-select" value={f.supplier_id} onChange={(v) => set("supplier_id", v)} options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.prefix})` }))} /></Field>
        <Field label="Jenis Material"><Sel testid="indent-template-select" value={f.product_id} onChange={pickTpl} placeholder="Pilih jenis..." options={templates.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        <Field label="Merk"><Input data-testid="indent-brand-input" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
        <Field label="Tebal"><Input data-testid="indent-thickness-input" value={f.thickness} onChange={(e) => set("thickness", e.target.value)} placeholder="0.30" /></Field>
        <Field label="Warna"><Input data-testid="indent-color-input" value={f.color} onChange={(e) => set("color", e.target.value)} placeholder="Biru" /></Field>
        <Field label="Panjang Kustom (m)"><Input data-testid="indent-length-input" type="number" step="0.01" value={f.length} onChange={(e) => set("length", e.target.value)} className="font-mono" /></Field>
        <Field label="Qty (Lembar)"><Input data-testid="indent-qty-input" type="number" value={f.qty} onChange={(e) => set("qty", e.target.value)} className="font-mono" /></Field>
        <Field label="Harga Jual / Meter"><Input data-testid="indent-price-input" type="number" value={f.price} onChange={(e) => set("price", e.target.value)} className="font-mono" /></Field>
        <Field label="Upah Lengkung / Lembar"><Input data-testid="indent-bendfee-input" type="number" value={f.bend_fee} onChange={(e) => set("bend_fee", e.target.value)} className="font-mono" /></Field>
      </div>
      <BendToggle value={f.bend} onChange={(v) => set("bend", v)} testid="indent-bend-switch" />
      <div className="rounded-md bg-secondary/50 p-3 font-mono text-sm space-y-1">
        <div className="text-foreground">{name}</div>
        <div>Total Meter: {num(f.qty)} Lbr × {num(f.length)} m = {num(line.total_meter)} m</div>
        <div>Subtotal Material: {rp(line.subtotal)}</div>
        {line.bend_subtotal > 0 && <div className="text-orange-300">Upah Lengkung: {num(f.qty)} Lbr x {rp(f.bend_fee)} = {rp(line.bend_subtotal)}</div>}
      </div>
      <Button data-testid="indent-add-to-cart" onClick={add} className="h-12 text-base gap-2"><Plus className="h-5 w-5" /> Tambah Item Indent</Button>
    </div>
  );
}

export function ItemAdder({ onAdd }) {
  return (
    <Tabs defaultValue="ready">
      <TabsList className="grid grid-cols-2 w-full h-12">
        <TabsTrigger value="ready" data-testid="tab-ready-stock" className="h-10 font-heading text-base uppercase tracking-wide">Ready Stock</TabsTrigger>
        <TabsTrigger value="indent" data-testid="tab-indent-builder" className="h-10 font-heading text-base uppercase tracking-wide">Custom / Indent</TabsTrigger>
      </TabsList>
      <TabsContent value="ready" className="mt-3"><ReadyPicker onAdd={onAdd} /></TabsContent>
      <TabsContent value="indent" className="mt-3"><IndentBuilder onAdd={onAdd} /></TabsContent>
    </Tabs>
  );
}
