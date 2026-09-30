import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { rp, num } from "@/lib/format";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Field, Sel, Empty } from "@/components/common";
import EntityManager from "@/components/EntityManager";

const UNITS = ["Lembar", "Batang", "Pcs", "Kotak", "Bungkus", "Meter", "Roll"];

function ProductDialog({ product, onClose, onSaved }) {
  const { categories, suppliers, warehouses } = useData();
  const [f, setF] = useState(null);
  useEffect(() => {
    if (product) setF({ stock: { G1: 0, G2: 0 }, alt_units: [], unit: "Lembar", ...product, alt: product.alt_units?.[0] || { unit: "", ratio: "", price: "" } });
  }, [product]);
  if (!product || !f) return null;
  const set = (k, v) => setF({ ...f, [k]: v });
  const pickCat = (id) => { const c = categories.find((x) => x.id === id); setF({ ...f, category_id: id, is_length: !!c?.is_length, unit: c?.unit || f.unit }); };
  const save = async () => {
    try {
      const { alt, ...body } = f;
      body.alt_units = alt.unit ? [{ unit: alt.unit, ratio: Number(alt.ratio) || 1, price: Number(alt.price) || 0 }] : [];
      if (f.id) await api.put(`/products/${f.id}`, body); else await api.post("/products", body);
      toast.success("Produk tersimpan");
      onSaved();
      onClose();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const N = (k, label) => <Field label={label}><Input type="number" data-testid={`product-${k}-input`} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto" data-testid="product-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl uppercase">{f.id ? "Edit" : "Tambah"} Produk</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Nama Produk" className="col-span-2 md:col-span-3"><Input data-testid="product-name-input" value={f.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Kategori"><Sel testid="product-category-select" value={f.category_id} onChange={pickCat} placeholder="Pilih..." options={categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Supplier"><Sel testid="product-supplier-select" value={f.supplier_id} onChange={(v) => set("supplier_id", v)} placeholder="-" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Satuan Dasar"><Sel testid="product-unit-select" value={f.unit} onChange={(v) => set("unit", v)} options={UNITS} /></Field>
          <Field label="Merk"><Input data-testid="product-brand-input" value={f.brand || ""} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Tebal"><Input data-testid="product-thickness-input" value={f.thickness || ""} onChange={(e) => set("thickness", e.target.value)} /></Field>
          <Field label="Warna"><Input data-testid="product-color-input" value={f.color || ""} onChange={(e) => set("color", e.target.value)} /></Field>
          <Field label="Barang Berpanjang (harga/meter)"><div className="h-10 flex items-center"><Switch data-testid="product-is-length-switch" checked={!!f.is_length} onCheckedChange={(v) => set("is_length", v)} /></div></Field>
          {f.is_length && N("length", "Panjang Standar (m)")}
          {N("price", f.is_length ? "Harga Standar / Meter" : "Harga Jual / Satuan")}
          {f.is_length && N("bend_fee", "Upah Lengkung / Lembar")}
          {N("hpp", f.is_length ? "HPP Beli / Meter" : "HPP / Satuan")}
          {N("min_stock", "Stok Minimum")}
          {warehouses.map((w) => (
            <Field key={w.code} label={`Stok ${w.code} (${f.unit})`}><Input type="number" data-testid={`product-stock-${w.code}-input`} value={f.stock?.[w.code] ?? 0} onChange={(e) => set("stock", { ...f.stock, [w.code]: e.target.value })} /></Field>
          ))}
        </div>
        <div className="panel p-3 grid grid-cols-3 gap-3">
          <div className="col-span-3 font-mono text-[11px] uppercase text-muted-foreground">Multi-satuan (opsional) — mis. Kotak isi 10 Bungkus, Roll isi 25 Meter</div>
          <Field label="Satuan Alternatif"><Sel testid="product-alt-unit-select" value={f.alt.unit} onChange={(v) => set("alt", { ...f.alt, unit: v })} placeholder="-" options={UNITS} /></Field>
          <Field label={`Isi (${f.unit})`}><Input type="number" data-testid="product-alt-ratio-input" value={f.alt.ratio} onChange={(e) => set("alt", { ...f.alt, ratio: e.target.value })} /></Field>
          <Field label="Harga Jual"><Input type="number" data-testid="product-alt-price-input" value={f.alt.price} onChange={(e) => set("alt", { ...f.alt, price: e.target.value })} /></Field>
        </div>
        <Button data-testid="product-save-button" onClick={save}>Simpan Produk</Button>
      </DialogContent>
    </Dialog>
  );
}

function ProductTable() {
  const { products, categories, refresh } = useData();
  const [edit, setEdit] = useState(null);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const rows = products.filter((p) => (!cat || p.category_id === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const del = async (p) => { if (!window.confirm(`Hapus ${p.name}?`)) return; try { await api.delete(`/products/${p.id}`); refresh(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="panel">
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        <Input data-testid="products-search" className="flex-1 min-w-[180px]" placeholder="Cari produk..." value={q} onChange={(e) => setQ(e.target.value)} />
        <Sel testid="products-category-filter" value={cat} onChange={setCat} placeholder="Semua Kategori" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <Button className="gap-2" data-testid="products-add-button" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> Tambah Produk</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="dtable">
          <thead><tr><th>Produk</th><th>Kategori</th><th className="text-right">Harga Jual</th><th className="text-right">Upah Lengkung</th><th className="text-right">HPP</th><th className="text-right">Margin</th><th className="text-right">G1</th><th className="text-right">G2</th><th /></tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id} data-testid={`products-row-${i}`}>
                <td>{p.name}<div className="text-xs text-muted-foreground">{p.is_length ? `${num(p.length)} m / ${p.unit}` : p.unit}{p.alt_units?.length ? ` · ${p.alt_units.map((a) => `${a.unit} isi ${a.ratio}`).join(", ")}` : ""}</div></td>
                <td className="text-xs">{p.category_name}</td>
                <td className="num">{rp(p.price)}{p.is_length ? "/m" : ""}</td>
                <td className="num">{p.is_length ? rp(p.bend_fee) : "-"}</td>
                <td className="num text-muted-foreground">{rp(p.hpp)}</td>
                <td className="num text-emerald-400">{p.price ? `${num(((p.price - p.hpp) / p.price) * 100, 1)}%` : "-"}</td>
                <td className="num">{num(p.stock?.G1)}</td><td className="num">{num(p.stock?.G2)}</td>
                <td className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" data-testid={`products-edit-${i}`} onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" data-testid={`products-delete-${i}`} onClick={() => del(p)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty />}
      </div>
      <ProductDialog product={edit} onClose={() => setEdit(null)} onSaved={refresh} />
    </div>
  );
}

export default function Products() {
  const { refresh } = useData();
  return (
    <div>
      <PageHeader title="Produk & Kategori" subtitle="Master Data" />
      <Tabs defaultValue="products">
        <TabsList><TabsTrigger value="products" data-testid="tab-products">Produk</TabsTrigger><TabsTrigger value="categories" data-testid="tab-categories">Kategori</TabsTrigger></TabsList>
        <TabsContent value="products"><ProductTable /></TabsContent>
        <TabsContent value="categories">
          <EntityManager title="Kategori" endpoint="/categories" testid="categories-manager" onChanged={refresh} defaults={{ is_length: false, unit: "Pcs" }}
            fields={[{ key: "name", label: "Nama Kategori" }, { key: "is_length", label: "Berpanjang (per meter)", type: "switch" }, { key: "unit", label: "Satuan Default", type: "select", options: UNITS }]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
