import { Trash2 } from "lucide-react";
import { calcLine } from "@/lib/calc";
import { rp, num } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ModeTag, Empty } from "@/components/common";
import { BendToggle } from "./ItemAdder";

const Mini = ({ label, children }) => (
  <label className="flex flex-col gap-1 min-w-0"><span className="font-mono text-[10px] uppercase text-muted-foreground">{label}</span>{children}</label>
);

function CartLine({ l, i, upd, del }) {
  return (
    <div className="border-b border-border py-3" data-testid={`cart-line-${i}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-snug">{l.name}</div>
          <div className="mt-1 flex flex-wrap gap-1"><ModeTag mode={l.mode} wh={l.warehouse} />{l.po_no && <span className="tag tag-ready">{l.po_no}</span>}{l.delivered_qty > 0 && <span className="tag tag-ready">Terkirim {num(l.delivered_qty)}</span>}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => del(i)} data-testid={`cart-line-remove-${i}`}><Trash2 className="h-4 w-4 text-red-400" /></Button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Mini label={`Qty (${l.unit})`}><Input data-testid={`cart-line-qty-${i}`} type="number" value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} className="h-10 font-mono" /></Mini>
        {l.is_length && (
          <Mini label="Panjang (m)"><Input data-testid={`cart-line-length-${i}`} type="number" step="0.01" value={l.length} disabled={l.mode === "ready"} onChange={(e) => upd(i, { length: e.target.value })} className="h-10 font-mono" /></Mini>
        )}
        <Mini label={l.is_length ? "Harga Nego/m" : `Harga/${l.unit}`}><Input data-testid={`cart-line-price-${i}`} type="number" value={l.price} onChange={(e) => upd(i, { price: e.target.value })} className="h-10 font-mono" /></Mini>
      </div>
      {l.is_length && <div className="mt-2"><BendToggle value={l.bend} onChange={(v) => upd(i, { bend: v })} testid={`cart-line-bend-${i}`} /></div>}
      <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
        <span>{l.is_length ? `${num(l.qty)} ${l.unit} × ${num(l.length)} m = ${num(l.total_meter)} m` : `${num(l.qty)} ${l.unit}`}</span>
        <span className="text-foreground">{rp(l.subtotal)}</span>
      </div>
      {l.bend_subtotal > 0 && (
        <div data-testid={`cart-line-bend-breakdown-${i}`} className="mt-1 rounded-sm border-l-2 border-primary bg-primary/10 px-2 py-1 font-mono text-[11px] text-orange-200">
          [ Rincian Upah Lengkung: {num(l.qty)} {l.unit} x {rp(l.bend_fee)} = {rp(l.bend_subtotal)} ]
        </div>
      )}
    </div>
  );
}

export function CartLines({ lines, onChange }) {
  const upd = (i, patch) => onChange(lines.map((l, j) => (j === i ? calcLine({ ...l, ...patch }) : l)));
  const del = (i) => onChange(lines.filter((_, j) => j !== i));
  if (!lines.length) return <Empty text="Keranjang kosong — pilih barang ready stock atau buat item indent" />;
  return <div>{lines.map((l, i) => <CartLine key={l.line_id || l._key || i} l={l} i={i} upd={upd} del={del} />)}</div>;
}
