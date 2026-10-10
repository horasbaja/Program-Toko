import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from "lucide-react";
import { useData } from "@/context/DataContext";
import { calcLine } from "@/lib/calc";
import { rp, num, uid, isBendable, productBend } from "@/lib/format";
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
  const bendable = isBendable(p.category_name, p.is_length);
  const pb = productBend(p);
  const [bend, setBend] = useState(bendable && pb.is_lengkung ? "lengkung" : "lurus");
  const [bendFee, setBendFee] = useState(pb.upah_lengkung);
  const need = Number(qty) * (u.ratio || 1);
  const avail = Number(p.stock?.[wh] || 0);
  const line = calcLine({ mode: "ready", product_id: p.id, name: p.name, category_name: p.category_name, is_length: p.is_length,
    unit: u.unit, ratio: u.ratio || 1, qty, length: p.length, price, bendable, bend: bendable ? bend : "lurus",
    bend_fee: bendable && bend === "lengkung" ? bendFee : 0, warehouse: wh, supplier_id: p.supplier_id });
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
      {bendable && (
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <BendToggle value={bend} onChange={setBend} testid="ready-bend-switch" />
          {bend === "lengkung" && (
            <Field label="Upah Lengkung Standar per Lembar"><Input data-testid="ready-bendfee-input" type="number" value={bendFee} onChange={(e) => setBendFee(e.target.value)} className="font-mono" /></Field>
          )}
        </div>
      )}
      {need > avail && (
        <div data-testid="ready-stock-warning" className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> Qty melebihi stok {wh} (tersedia {num(avail)} {p.unit})
        </div>
      )}
      <div className="rounded-md bg-secondary/50 p-3 font-mono text-sm space-y-1">
        {p.is_length && <div>Total Meter: {num(line.total_meter)} m</div>}
        <div>Subtotal Material: {rp(line.subtotal)}</div>
        {line.bend_subtotal > 0 && <div className="text-orange-300">Upah Lengkung: {num(qty)} {u.unit} x {rp(line.bend_fee)} = {rp(line.bend_subtotal)}</div>}
      </div>
      <Button data-testid="ready-add-to-cart" onClick={add} className="h-12 text-base gap-2"><Plus className="h-5 w-5" /> Tambah ke Keranjang</Button>
    </div>
  );
}

const SHORT = { Lembar: "Lbr", Batang: "Btg", Bungkus: "Bks", Kotak: "Ktk", Meter: "m" };
const short = (u) => SHORT[u] || u || "Pcs";

function ProductRow({ p, i, onPick }) {
  const low = totalStock(p) <= Number(p.min_stock || 0);
  const stockText = `G1: ${num(p.stock?.G1)} ${short(p.unit)} | G2: ${num(p.stock?.G2)} ${short(p.unit)}`;
  return (
    <tr data-testid={`pos-product-${i}`} className="cursor-pointer" onClick={() => onPick(p)}>
      <td className="!py-1.5 [overflow-wrap:anywhere]">
        {p.category_name && <span className="tag tag-ready mr-1.5 !text-[9px]">{p.category_name}</span>}
        <span className="text-[13px] font-medium">{p.name}</span>
        <div className={`sm:hidden font-mono text-[11px] ${low ? "text-red-400" : "text-muted-foreground"}`}>{stockText}</div>
      </td>
      <td className={`hidden sm:table-cell !py-1.5 font-mono text-xs whitespace-nowrap ${low ? "text-red-400" : "text-slate-300"}`} data-testid={`pos-product-stock-${i}`}>
        {stockText}
      </td>
      <td className="!py-1.5 num !whitespace-normal sm:!whitespace-nowrap text-xs text-orange-300">
        {rp(p.price)}<span className="block sm:inline">/{p.is_length ? "m" : short(p.unit)}</span>
        {p.is_length && <div className="hidden sm:block text-[10px] text-muted-foreground">≈ {rp(p.price * p.length)}/{short(p.unit)}</div>}
      </td>
      <td className="!py-1.5 text-right">
        <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" data-testid={`pos-product-add-${i}`} onClick={(e) => { e.stopPropagation(); onPick(p); }}>
          <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Pilih</span>
        </Button>
      </td>
    </tr>
  );
}

const SORTERS = { name: (p) => (p.name || "").toLowerCase(), stock: totalStock, price: (p) => Number(p.price) || 0 };

function SortTh({ k, label, sort, onSort, className = "" }) {
  const Icon = sort.key !== k ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th className={`!py-2 ${className}`}>
      <button type="button" data-testid={`pos-sort-${k}`} onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground ${sort.key === k ? "text-orange-300" : ""}`}>
        {label} <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

function ProductTable({ list, onPick }) {
  const [sort, setSort] = useState({ key: "name", dir: 1 });
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));
  const rows = useMemo(() => [...list].sort((a, b) => {
    const x = SORTERS[sort.key](a);
    const y = SORTERS[sort.key](b);
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  }), [list, sort]);
  return (
    <div className="panel overflow-hidden" data-testid="pos-product-table">
      <div className="max-h-[58vh] overflow-auto">
        <table className="dtable table-fixed sm:table-auto [&_td]:!px-2 [&_th]:!px-2 sm:[&_td]:!px-3 sm:[&_th]:!px-3">
          <thead>
            <tr>
              <SortTh k="name" label="Nama Produk & Spesifikasi" sort={sort} onSort={onSort} />
              <SortTh k="stock" label="Stok Gudang" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
              <SortTh k="price" label="Harga" sort={sort} onSort={onSort} className="text-right w-[92px] sm:w-auto" />
              <th className="!py-2 text-right w-[52px] sm:w-auto">Aksi</th>
            </tr>
          </thead>
          <tbody>{rows.map((p, i) => <ProductRow key={p.id} p={p} i={i} onPick={onPick} />)}</tbody>
        </table>
        {!list.length && <div className="py-8 text-center text-sm text-muted-foreground">Produk tidak ditemukan</div>}
      </div>
      <div className="border-t border-border bg-secondary/50 px-3 py-1.5 font-mono text-[11px] text-muted-foreground" data-testid="pos-product-count">
        {list.length} produk · klik baris atau "Pilih" untuk atur gudang & qty
      </div>
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
      <div className="cat-scroll -mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-2" data-testid="pos-category-scroll">
        <button className={`pill h-10 shrink-0 whitespace-nowrap px-4 ${!cat ? "pill-on" : "bg-background"}`} onClick={() => setCat("")} data-testid="pos-cat-all">Semua</button>
        {categories.map((c) => (
          <button key={c.id} data-testid={`pos-cat-${c.id}`} onClick={() => setCat(c.id)}
            className={`pill h-10 shrink-0 whitespace-nowrap px-4 ${cat === c.id ? "pill-on" : "bg-background"}`}>{c.name}</button>
        ))}
      </div>
      <ProductTable list={list} onPick={setSel} />
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading text-xl uppercase">{sel?.name}</DialogTitle></DialogHeader>
          {sel && <ReadyConfig product={sel} onAdd={onAdd} onClose={() => setSel(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const INDENT_RESET = { category: "", product_id: "", brand: "", thickness: "", color: "", price: "", bend_fee: "", bend: "lengkung" };

function IndentBuilder({ onAdd }) {
  const { suppliers, products } = useData();
  const [f, setF] = useState({ supplier_id: suppliers[0]?.id || "", ...INDENT_RESET, length: "", qty: "" });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const supId = f.supplier_id || suppliers[0]?.id;
  const supProducts = useMemo(() => products.filter((p) => p.is_length && p.supplier_id === supId), [products, supId]);
  const cats = [...new Set(supProducts.map((p) => p.category_name).filter(Boolean))];
  const models = supProducts.filter((p) => !f.category || p.category_name === f.category);
  const noMaterial = !supProducts.length;
  const pickSupplier = (v) => setF((s) => ({ ...s, supplier_id: v, ...INDENT_RESET }));
  const pickCategory = (v) => setF((s) => ({ ...s, ...INDENT_RESET, category: v }));
  const pickTpl = (id) => {
    const p = products.find((x) => x.id === id);
    if (!p) return setF((s) => ({ ...s, ...INDENT_RESET, category: s.category }));
    const pb = productBend(p);
    const canBend = isBendable(p.category_name, true);
    return setF((s) => ({ ...s, product_id: id, category: p.category_name || s.category, brand: p.brand || "", thickness: p.thickness || "",
      color: p.color || "", price: p.price ?? "", bend_fee: pb.upah_lengkung, bend: canBend && pb.is_lengkung ? "lengkung" : "lurus" }));
  };
  const tpl = products.find((x) => x.id === f.product_id);
  const bendable = !tpl || isBendable(tpl.category_name, true);
  const bend = bendable ? f.bend : "lurus";
  const sup = suppliers.find((s) => s.id === supId);
  const catName = tpl?.category_name || f.category || "Seng Deck (Spandek)";
  const name = `${catName} ${f.brand || sup?.prefix || ""} ${f.thickness} ${f.color}`.replace(/\s+/g, " ").trim();
  const line = calcLine({ mode: "indent", ...f, bend, bendable, bend_fee: bend === "lengkung" ? f.bend_fee : 0, supplier_id: sup?.id, name,
    category_name: catName, is_length: true, unit: tpl?.unit || "Lembar", ratio: 1 });
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
        <Field label="Nama Pabrik / Supplier"><Sel testid="indent-supplier-select" value={supId} onChange={pickSupplier} options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${s.prefix})` }))} /></Field>
        <Field label="Jenis Material / Kategori"><Sel testid="indent-category-select" value={f.category} onChange={pickCategory} placeholder={noMaterial ? "-" : "Semua jenis..."} options={cats} className={noMaterial ? "opacity-50 pointer-events-none" : ""} /></Field>
        {noMaterial ? (
          <div className="col-span-2 rounded-md border border-dashed border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-300" data-testid="indent-no-material">
            Tidak ada material kustom untuk pabrik ini
          </div>
        ) : (
          <Field label="Merk / Tipe" className="col-span-2"><Sel testid="indent-template-select" value={f.product_id} onChange={pickTpl} placeholder="Pilih merk/tipe..." options={models.map((p) => ({ value: p.id, label: `${p.brand ? p.brand + " · " : ""}${p.name}` }))} /></Field>
        )}
        {noMaterial && <Field label="Merk (manual)"><Input data-testid="indent-brand-input" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>}
        <Field label="Tebal"><Input data-testid="indent-thickness-input" value={f.thickness} onChange={(e) => set("thickness", e.target.value)} placeholder="0.30" /></Field>
        <Field label="Warna"><Input data-testid="indent-color-input" value={f.color} onChange={(e) => set("color", e.target.value)} placeholder="Biru" /></Field>
        <Field label="Panjang Kustom (m)"><Input data-testid="indent-length-input" type="number" step="0.01" value={f.length} onChange={(e) => set("length", e.target.value)} className="font-mono" /></Field>
        <Field label="Qty (Lembar)"><Input data-testid="indent-qty-input" type="number" value={f.qty} onChange={(e) => set("qty", e.target.value)} className="font-mono" /></Field>
        <Field label="Harga Jual / Meter"><Input data-testid="indent-price-input" type="number" value={f.price} onChange={(e) => set("price", e.target.value)} className="font-mono" /></Field>
      </div>
      {bendable && (
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <BendToggle value={bend} onChange={(v) => set("bend", v)} testid="indent-bend-switch" />
          {bend === "lengkung" && (
            <Field label="Upah Lengkung Standar per Lembar"><Input data-testid="indent-bendfee-input" type="number" value={f.bend_fee} onChange={(e) => set("bend_fee", e.target.value)} className="font-mono" /></Field>
          )}
        </div>
      )}
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
